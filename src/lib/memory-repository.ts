import { estimateTextTokens } from "#lib/context";
import { getTursoConfig, tursoExecute, tursoSelect } from "#lib/turso";
import {
  isMemoryType,
  type MemoryRecord,
  type MemoryType,
  type RecallResult,
} from "#lib/types/memory";

export const LONG_TERM_SCOPE_KEY = "global";
const SEARCH_ROW_LIMIT = 50;
const LIKE_ESCAPE_CHAR = "\\";
const MAX_SEARCH_TOKENS = 10;
const MIN_SEARCH_TOKEN_LENGTH = 3;

const SEARCH_STOPWORDS = new Set([
  "what",
  "where",
  "when",
  "who",
  "whom",
  "whose",
  "which",
  "why",
  "how",
  "does",
  "did",
  "are",
  "was",
  "were",
  "been",
  "have",
  "has",
  "had",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "your",
  "you",
  "about",
  "there",
  "here",
  "then",
  "than",
  "also",
  "just",
  "like",
  "know",
  "tell",
  "please",
  "could",
  "would",
  "should",
  "them",
  "they",
  "their",
  "the",
  "and",
  "for",
  "recall",
  "remember",
]);

interface TursoMemoryRow {
  id: string;
  conversation_id: string | null;
  scope_key: string;
  memory_type: string;
  normalized_content: string;
  content: string;
  created_at: string;
}

export function normalizeContent(content: string): string {
  return content.trim().toLowerCase();
}

export function scopeKeyFor(memoryType: MemoryType, conversationId: string | null): string {
  if (memoryType === "long_term") return LONG_TERM_SCOPE_KEY;
  return conversationId ?? "";
}

export function escapeLikeLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function extractSearchTokens(normalizedQuery: string): string[] {
  const raw = normalizedQuery.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of raw) {
    if (token.length < MIN_SEARCH_TOKEN_LENGTH) continue;
    if (SEARCH_STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
    if (tokens.length >= MAX_SEARCH_TOKENS) break;
  }
  return tokens;
}

function createMemoryId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function mapRowToMemory(row: TursoMemoryRow): MemoryRecord {
  return {
    id: row.id,
    memoryType: isMemoryType(row.memory_type) ? row.memory_type : "long_term",
    scopeKey: row.scope_key,
    content: row.content,
    conversationId: row.conversation_id,
    createdAt: new Date(row.created_at),
  };
}

export async function createMemory(params: {
  content: string;
  memoryType: MemoryType;
  conversationId?: string | null;
}): Promise<{ id: string; deduplicated: boolean }> {
  const config = getTursoConfig();
  if (!config) throw new Error("Turso not configured");

  const content = params.content.trim();
  const normalized = normalizeContent(content);
  const scopeKey = scopeKeyFor(params.memoryType, params.conversationId ?? null);
  const conversationId =
    params.memoryType === "short_term" ? (params.conversationId ?? null) : null;

  const existing = await tursoSelect<{ id: string }>(
    "SELECT id FROM memories WHERE memory_type = ? AND scope_key = ? AND normalized_content = ? LIMIT 1",
    [params.memoryType, scopeKey, normalized],
  );
  if (existing.length > 0 && existing[0]?.id) {
    return { id: existing[0].id, deduplicated: true };
  }

  const id = createMemoryId();
  const createdAt = new Date().toISOString();
  await tursoExecute(
    "INSERT OR IGNORE INTO memories (id, conversation_id, scope_key, memory_type, normalized_content, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, conversationId, scopeKey, params.memoryType, normalized, content, createdAt],
  );

  const canonical = await tursoSelect<{ id: string }>(
    "SELECT id FROM memories WHERE memory_type = ? AND scope_key = ? AND normalized_content = ? LIMIT 1",
    [params.memoryType, scopeKey, normalized],
  );
  const canonicalId = canonical[0]?.id ?? id;
  // INSERT OR IGNORE keeps rows safe under concurrency, but two racers that
  // both pass the pre-SELECT can reach here with the same canonical id. The
  // loser (whose INSERT was ignored) must report deduplicated:true.
  return { id: canonicalId, deduplicated: canonicalId !== id };
}

export async function searchMemories(params: {
  query: string;
  memoryTypes: MemoryType[];
  conversationId?: string | null;
}): Promise<MemoryRecord[]> {
  const config = getTursoConfig();
  if (!config) return [];
  if (params.memoryTypes.length === 0) return [];

  const normalizedQuery = normalizeContent(params.query);
  if (!normalizedQuery) return [];

  let tokens = extractSearchTokens(normalizedQuery);
  if (tokens.length === 0) {
    tokens = [normalizedQuery];
  }
  const tokenClauses = tokens
    .map(() => `normalized_content LIKE ? ESCAPE '${LIKE_ESCAPE_CHAR}'`)
    .join(" OR ");
  const typePlaceholders = params.memoryTypes.map(() => "?").join(", ");
  const args: unknown[] = [
    ...params.memoryTypes,
    ...tokens.map((token) => `%${escapeLikeLiteral(token)}%`),
  ];

  let scopeClause = "";
  if (params.conversationId) {
    scopeClause = ` AND ((memory_type = 'short_term' AND scope_key = ?) OR (memory_type = 'long_term' AND scope_key = ?))`;
    args.push(params.conversationId, LONG_TERM_SCOPE_KEY);
  } else {
    scopeClause = ` AND ((memory_type = 'long_term' AND scope_key = ?))`;
    args.push(LONG_TERM_SCOPE_KEY);
  }

  const rows = await tursoSelect<TursoMemoryRow>(
    `SELECT id, conversation_id, scope_key, memory_type, normalized_content, content, created_at
     FROM memories
     WHERE memory_type IN (${typePlaceholders}) AND (${tokenClauses})${scopeClause}
     ORDER BY created_at DESC LIMIT ${SEARCH_ROW_LIMIT}`,
    args,
  );

  return rows.map(mapRowToMemory);
}

export async function deleteMemory(id: string): Promise<void> {
  const config = getTursoConfig();
  if (!config) return;
  await tursoExecute("DELETE FROM memories WHERE id = ?", [id]);
}

export async function clearMemories(memoryType?: MemoryType): Promise<void> {
  const config = getTursoConfig();
  if (!config) throw new Error("Turso not configured");
  if (memoryType) {
    await tursoExecute("DELETE FROM memories WHERE memory_type = ?", [memoryType]);
    return;
  }
  await tursoExecute("DELETE FROM memories", []);
}

function typeLabel(memoryType: MemoryType): string {
  return memoryType === "short_term" ? "short-term" : "long-term";
}

function itemText(memoryType: MemoryType, content: string): string {
  return `[${typeLabel(memoryType)}] ${content}`;
}

export function formatRecallResult(memories: MemoryRecord[], tokenCap: number): RecallResult {
  if (memories.length === 0) {
    return {
      memories: [],
      truncated: false,
      estimatedTokens: 0,
      message: "No matching memories found.",
    };
  }

  const separator = "\n\n";
  const separatorTokens = estimateTextTokens(separator);
  const result: RecallResult["memories"] = [];
  let usedTokens = 0;
  let truncated = false;

  for (const memory of memories) {
    const fullText = itemText(memory.memoryType, memory.content);
    const fullTokens = estimateTextTokens(fullText);
    const prefixTokens = result.length > 0 ? separatorTokens : 0;

    if (usedTokens + prefixTokens + fullTokens <= tokenCap) {
      result.push({ type: memory.memoryType, content: memory.content });
      usedTokens += prefixTokens + fullTokens;
      continue;
    }

    truncated = true;
    const remaining = tokenCap - usedTokens - prefixTokens;
    const labelTokens = estimateTextTokens(`[${typeLabel(memory.memoryType)}] `);
    const minContentTokens = 4;
    if (remaining > labelTokens + minContentTokens) {
      const allowedContentChars = Math.max(0, (remaining - labelTokens) * 4 - 16);
      const truncatedContent = `${memory.content.slice(0, allowedContentChars).trimEnd()}... [truncated]`;
      result.push({ type: memory.memoryType, content: truncatedContent });
      usedTokens = tokenCap;
    }
    break;
  }

  if (result.length === 0) {
    return {
      memories: [],
      truncated: true,
      estimatedTokens: 0,
      message: "Matching memories exceed the recall token cap and were omitted.",
    };
  }

  return { memories: result, truncated, estimatedTokens: usedTokens };
}
