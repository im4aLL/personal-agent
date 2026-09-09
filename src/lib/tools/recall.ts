import { tool } from "ai";
import { z } from "zod";
import {
  loadLongTermMemoryEnabled,
  loadMemoryEnabled,
  loadMemoryTokenCap,
  loadShortTermMemoryEnabled,
} from "#lib/config";
import { formatRecallResult, searchMemories } from "#lib/memory-repository";
import { getTursoConfig } from "#lib/turso";
import { MEMORY_TYPES, type MemoryType } from "#lib/types/memory";

export const RECALL_MAX_QUERY_LENGTH = 200;

export function createRecallTool(options: { conversationId?: string | null } = {}) {
  const { conversationId } = options;

  return tool({
    description:
      "Recall previously stored facts matching a query. Use this when the user refers " +
      "to prior conversations or stored preferences. Pass keywords, not the full user " +
      "sentence: when the user asks 'where do I live', call recall with query 'address live name'. " +
      "Returns only matching memories within a bounded token cap.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Keywords to search stored memories for, e.g. 'address live name'"),
      memoryType: z
        .enum(MEMORY_TYPES)
        .optional()
        .describe("Optionally restrict to short_term or long_term memories"),
    }),
    execute: async ({ query, memoryType }) => {
      if (!loadMemoryEnabled()) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: "Memory is disabled in Preferences.",
        };
      }

      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: "Query must not be empty.",
        };
      }
      if (trimmedQuery.length > RECALL_MAX_QUERY_LENGTH) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: `Query is too long (${trimmedQuery.length} characters, limit ${RECALL_MAX_QUERY_LENGTH}). Use a shorter query.`,
        };
      }

      const enabledTypes: MemoryType[] = [];
      if (loadShortTermMemoryEnabled()) enabledTypes.push("short_term");
      if (loadLongTermMemoryEnabled()) enabledTypes.push("long_term");
      const requestedTypes = memoryType ? [memoryType] : enabledTypes;
      const searchTypes = requestedTypes.filter((type) => enabledTypes.includes(type));

      if (searchTypes.length === 0) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: "The requested memory types are disabled in Preferences.",
        };
      }

      if (!getTursoConfig()) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: "Memory storage is not configured.",
        };
      }

      try {
        const matches = await searchMemories({
          query: trimmedQuery,
          memoryTypes: searchTypes,
          conversationId,
        });
        return formatRecallResult(matches, loadMemoryTokenCap());
      } catch (error) {
        return {
          memories: [],
          truncated: false,
          estimatedTokens: 0,
          message: `Recall failed: ${toErrorMessage(error)}`,
        };
      }
    },
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
