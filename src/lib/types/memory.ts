export const MEMORY_TYPES = ["short_term", "long_term"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export function isMemoryType(value: unknown): value is MemoryType {
  return value === "short_term" || value === "long_term";
}

export interface MemoryRecord {
  id: string;
  memoryType: MemoryType;
  scopeKey: string;
  content: string;
  conversationId: string | null;
  createdAt: Date;
}

export interface RecalledMemory {
  type: MemoryType;
  content: string;
}

export interface RecallResult {
  memories: RecalledMemory[];
  truncated: boolean;
  estimatedTokens: number;
  message?: string;
}
