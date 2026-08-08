import type { Conversation } from "#lib/types/chat";

export function searchConversations(conversations: Conversation[], query: string): Conversation[] {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return conversations;

  return conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(lowerQuery) ||
    conversation.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
  );
}
