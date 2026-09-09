import { tool } from "ai";
import { z } from "zod";
import {
  loadLongTermMemoryEnabled,
  loadMemoryEnabled,
  loadShortTermMemoryEnabled,
} from "#lib/config";
import { createMemory } from "#lib/memory-repository";
import { getTursoConfig } from "#lib/turso";
import { MEMORY_TYPES } from "#lib/types/memory";

export const REMEMBER_MAX_CONTENT_LENGTH = 2000;

export function createRememberTool(options: { conversationId?: string | null } = {}) {
  const { conversationId } = options;

  return tool({
    description:
      "Store a durable, useful fact for later recall. Use this only for facts explicitly " +
      "stated or clearly requested by the user (preferences, decisions, names, ongoing " +
      "context). Store personal durable facts such as name, address, and preferences as " +
      "long_term so they are available across conversations; use short_term only for facts " +
      "scoped to the current conversation. Example: user says 'my name is X, I live at Y' " +
      "-> remember it with memoryType long_term.",
    inputSchema: z.object({
      content: z.string().describe("The fact to remember as plain text"),
      memoryType: z
        .enum(MEMORY_TYPES)
        .describe("short_term for the current conversation, long_term for all conversations"),
    }),
    execute: async ({ content, memoryType }) => {
      if (!loadMemoryEnabled()) {
        return { error: "Memory is disabled. Ask the user to enable it in Preferences." };
      }

      const typeEnabled =
        memoryType === "short_term" ? loadShortTermMemoryEnabled() : loadLongTermMemoryEnabled();
      if (!typeEnabled) {
        return {
          error: `${memoryType === "short_term" ? "Short-term" : "Long-term"} memory is disabled in Preferences.`,
        };
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return { error: "Content must not be empty." };
      }
      if (trimmed.length > REMEMBER_MAX_CONTENT_LENGTH) {
        return {
          error: `Content is too long (${trimmed.length} characters, limit ${REMEMBER_MAX_CONTENT_LENGTH}). Store a shorter summary instead.`,
        };
      }

      if (memoryType === "short_term" && !conversationId) {
        return { error: "Short-term memory requires a current conversation." };
      }

      if (!getTursoConfig()) {
        return { error: "Memory storage is not configured. Ask the user to connect Turso." };
      }

      try {
        const { id, deduplicated } = await createMemory({
          content: trimmed,
          memoryType,
          conversationId,
        });
        return { saved: true, id, memoryType, deduplicated };
      } catch (error) {
        return { error: `Failed to store memory: ${toErrorMessage(error)}` };
      }
    },
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
