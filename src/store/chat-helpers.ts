import type { Message } from "#lib/types/chat";

/**
 * A summary covers messages[0..cutoffIndex]. Editing or regenerating a message
 * at or before that cutoff makes the persisted summary describe content that
 * no longer matches, so it must be invalidated. Messages strictly after the
 * cutoff are always sent raw, so touching them leaves the summary valid.
 */
export function isSummaryInvalidatedBy(
  messages: Message[],
  targetMessageId: string,
  summarizedUpToId: string | null | undefined,
): boolean {
  if (!summarizedUpToId) {
    return false;
  }

  const cutoffIndex = messages.findIndex((message) => message.id === summarizedUpToId);
  const targetIndex = messages.findIndex((message) => message.id === targetMessageId);

  if (cutoffIndex === -1 || targetIndex === -1) {
    return false;
  }

  return targetIndex <= cutoffIndex;
}

export function regenerateMessages(messages: Message[]): Message[] {
  if (messages.length === 0) {
    throw new Error(
      "regenerateMessages: messages array is empty. Messages must be loaded before regenerating.",
    );
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role !== "assistant") {
    return messages;
  }

  return messages.slice(0, -1);
}

export function applyMessageEdit(
  messages: Message[],
  messageId: string,
  content: string,
  editedAt: Date = new Date(),
): Message[] {
  if (messages.length === 0) {
    throw new Error(
      "applyMessageEdit: messages array is empty. Messages must be loaded before editing.",
    );
  }

  const index = messages.findIndex((message) => message.id === messageId);
  if (index === -1) {
    return messages;
  }

  const target = messages[index];
  if (target?.role !== "user") {
    return messages;
  }

  const trimmed = content.trim();
  if (!trimmed || trimmed === target.content) {
    return messages;
  }

  return [...messages.slice(0, index), { ...target, content: trimmed, editedAt }];
}
