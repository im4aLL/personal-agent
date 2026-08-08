import type { Message } from "#lib/types/chat";

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
