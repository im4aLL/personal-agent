import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { Message } from "#lib/types/chat";
import type { ProviderInfo } from "#store/chat";
import { proxyFetch } from "./ai";

const TITLE_PROMPT = `Summarize the user's first message into a very short, concise chat title (3-5 words). Respond with only the title text. Do not use quotes, punctuation, or explanations.`;

const SUMMARY_PROMPT = `Summarize this conversation so far. Preserve names, decisions, and unresolved questions. Be concise but keep concrete details a later reply might depend on.`;

export async function generateConversationTitle(
  firstUserMessage: string,
  provider: ProviderInfo,
  modelId: string,
): Promise<string> {
  const fetchImpl = provider.connectionMode === "proxy" ? proxyFetch : undefined;

  const aiProvider = createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    fetch: fetchImpl,
  });

  const model = aiProvider(modelId);

  const { text } = await generateText({
    model,
    messages: [
      { role: "system", content: TITLE_PROMPT },
      { role: "user", content: firstUserMessage },
    ],
  });

  const title = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?]$/, "")
    .trim();

  if (!title) {
    throw new Error("Empty title generated");
  }

  return title;
}

/**
 * One LLM call, reusing the same lightweight pattern as
 * `generateConversationTitle`. Summarizes `messages` (the portion of the
 * conversation being compacted, not the whole history) into prose to persist
 * as the conversation's `summary`.
 */
export async function generateConversationSummary(
  messages: Message[],
  provider: ProviderInfo,
  modelId: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const fetchImpl = provider.connectionMode === "proxy" ? proxyFetch : undefined;

  const aiProvider = createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    fetch: fetchImpl,
  });

  const model = aiProvider(modelId);

  const conversationText = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");

  const { text } = await generateText({
    model,
    messages: [
      { role: "system", content: SUMMARY_PROMPT },
      { role: "user", content: conversationText },
    ],
    maxOutputTokens: 2048,
    abortSignal,
  });

  const summary = text.trim();

  if (!summary) {
    throw new Error("Empty summary generated");
  }

  return summary;
}
