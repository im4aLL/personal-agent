import type { Attachment, Message } from "#lib/types/chat";

// Providers are matched by base URL, not providerId/label: providerId is
// generated from a user-editable label (see createProviderId in
// #store/chat) and is not a stable signal of which service is behind it.
type ModelWindowRule = { match: RegExp; window: number };

type ParsedBaseUrl = { hostname: string; port: string; pathname: string };

function parseBaseUrl(baseUrl: string): ParsedBaseUrl | null {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return { hostname, port: url.port, pathname: url.pathname };
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

type ProviderWindowRules = {
  matchesBaseUrl: (parsed: ParsedBaseUrl) => boolean;
  rules: ModelWindowRule[];
};

// Rules are ordered most-specific first: a broader pattern later in the
// list (e.g. `^gpt-4`) must never shadow a more specific one (e.g.
// `^gpt-4\.1`) that appears before it. Patterns are boundary-anchored
// (`-` or end of string) so e.g. `^o1` cannot match a future `o10`.
const PROVIDER_WINDOW_RULES: ProviderWindowRules[] = [
  {
    matchesBaseUrl: (parsed) => parsed.hostname === "generativelanguage.googleapis.com",
    rules: [{ match: /.*/, window: 1_000_000 }],
  },
  {
    matchesBaseUrl: (parsed) => parsed.hostname === "api.openai.com",
    rules: [
      { match: /^gpt-4\.1(?:-|$)/, window: 1_047_576 },
      { match: /^gpt-4\.5(?:-|$)/, window: 128_000 },
      { match: /^gpt-5(?:-|$)/, window: 400_000 },
      { match: /^o1-(?:mini|preview)(?:-|$)/, window: 128_000 },
      { match: /^(?:o1|o3|o4-mini)(?:-|$)/, window: 200_000 },
      { match: /^(?:gpt-4o|gpt-4-turbo)(?:-|$)/, window: 128_000 },
      { match: /^gpt-4(?:-|$)/, window: 8_192 },
      { match: /^gpt-3\.5(?:-|$)/, window: 16_385 },
    ],
  },
  {
    matchesBaseUrl: (parsed) => parsed.hostname === "api.deepseek.com",
    rules: [{ match: /.*/, window: 64_000 }],
  },
  {
    matchesBaseUrl: (parsed) =>
      parsed.hostname === "opencode.ai" &&
      (parsed.pathname === "/zen/go" || parsed.pathname.startsWith("/zen/go/")),
    rules: [{ match: /.*/, window: 128_000 }],
  },
  {
    matchesBaseUrl: (parsed) => isLocalHost(parsed.hostname) && parsed.port === "11434",
    rules: [{ match: /.*/, window: 8_192 }],
  },
  {
    matchesBaseUrl: (parsed) => isLocalHost(parsed.hostname) && parsed.port === "1234",
    rules: [{ match: /.*/, window: 8_192 }],
  },
];

const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * Static provider/model -> context window lookup. `/v1/models` never
 * returns context size, so this curated table is the only reliable source.
 * A matched provider's own default (e.g. DeepSeek's 64k, Gemini's 1M) takes
 * precedence for any of its models without a more specific rule; the flat
 * 128k fallback only applies when no provider or model rule matches at all.
 */
export function getContextWindow(baseUrl: string, modelId: string): number {
  const parsed = parseBaseUrl(baseUrl);

  if (!parsed) {
    return DEFAULT_CONTEXT_WINDOW;
  }

  const provider = PROVIDER_WINDOW_RULES.find((entry) => entry.matchesBaseUrl(parsed));

  if (!provider) {
    return DEFAULT_CONTEXT_WINDOW;
  }

  const rule = provider.rules.find((entry) => entry.match.test(modelId));

  return rule?.window ?? DEFAULT_CONTEXT_WINDOW;
}

// The only attachments buildUserContent (#hooks/use-chat) actually sends to
// the model; anything else is dropped there, so it must not be counted here.
export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const CHARS_PER_TOKEN = 4;
const TOKENS_PER_IMAGE = 1000;

function countQualifyingImages(attachments: Attachment[] | undefined): number {
  return (
    attachments?.filter(
      (attachment) => attachment.data && IMAGE_MIME_TYPES.includes(attachment.type),
    ).length ?? 0
  );
}

type TokenMemoEntry = { contentLength: number; imageCount: number; tokens: number };

// Keyed by (id, content.length, imageCount): a streaming assistant message
// keeps a stable id while its content grows in place, so the length must be
// part of the key or the count would freeze at the first near-empty value.
// imageCount is included too, since editing a message's attachments without
// changing its text would otherwise return a stale cached count.
// Bounded so a long-running session doesn't retain an entry per message
// ever seen, including messages from deleted or unloaded conversations.
const TOKEN_MEMO_LIMIT = 2000;
const tokenMemo = new Map<string, TokenMemoEntry>();

function estimateMessageTokens(message: Message): number {
  const imageCount = countQualifyingImages(message.attachments);
  const cached = tokenMemo.get(message.id);

  if (
    cached &&
    cached.contentLength === message.content.length &&
    cached.imageCount === imageCount
  ) {
    return cached.tokens;
  }

  const tokens =
    Math.ceil(message.content.length / CHARS_PER_TOKEN) + imageCount * TOKENS_PER_IMAGE;

  if (!cached && tokenMemo.size >= TOKEN_MEMO_LIMIT) {
    const oldestKey = tokenMemo.keys().next().value;
    if (oldestKey !== undefined) {
      tokenMemo.delete(oldestKey);
    }
  }

  tokenMemo.set(message.id, { contentLength: message.content.length, imageCount, tokens });

  return tokens;
}

/**
 * Characters/4 heuristic, memoized per message. Attachment `data` (base64
 * image payload) is never counted as text - images use a flat per-image
 * estimate instead, since counting the blob would wildly overcount.
 */
export function estimateTokens(messages: Message[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

export function shouldCompact(tokens: number, window: number): boolean {
  return tokens > 0.7 * window;
}

export type SummaryState = {
  summary: string | null | undefined;
  summarizedUpToId: string | null | undefined;
};

export type OutgoingContext = {
  /** Raw messages to send as-is: the tail after `summarizedUpToId`, or full history if no summary applies. */
  messages: Message[];
  /** Summary text to fold into the request's system message, or null if none applies. */
  summaryText: string | null;
};

/**
 * Collapses long history into `[summary] + [tail]` when a persisted summary
 * covers a prefix of `messages`. Falls back to full history when there is no
 * summary, or the summary's cutoff id is no longer present in `messages`
 * (e.g. that message was deleted) - sending everything is always correct,
 * just not always cheap.
 */
export function buildOutgoingContext(
  messages: Message[],
  { summary, summarizedUpToId }: SummaryState,
): OutgoingContext {
  if (!summary || !summarizedUpToId) {
    return { messages, summaryText: null };
  }

  const cutoffIndex = messages.findIndex((message) => message.id === summarizedUpToId);

  if (cutoffIndex === -1) {
    return { messages, summaryText: null };
  }

  return { messages: messages.slice(cutoffIndex + 1), summaryText: summary };
}

/**
 * Characters/4 heuristic for plain text that isn't a `Message` - the system
 * prompt and the in-progress draft in the input box. Shares the estimate
 * with `estimateTokens` but is not memoized: both inputs already change on
 * every keystroke, so a memo would never hit.
 */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Same chars/4 + per-image estimate as `estimateTokens`, for a draft that
 * hasn't become a `Message` yet - the input box's pending text and
 * attachments. Kept in sync with `buildUserContent` (#hooks/use-chat) via
 * the shared `IMAGE_MIME_TYPES` list.
 */
export function estimatePendingTokens(text: string, attachments: Attachment[] | undefined): number {
  return estimateTextTokens(text) + countQualifyingImages(attachments) * TOKENS_PER_IMAGE;
}
