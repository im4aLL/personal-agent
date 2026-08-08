import type { Conversation } from "#lib/types/chat";

export function searchConversations(conversations: Conversation[], query: string): Conversation[] {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return conversations;

  return conversations.filter((conversation) => {
    if (conversation.title.toLowerCase().includes(lowerQuery)) return true;

    return conversation.messages.some((message) =>
      message.content.toLowerCase().includes(lowerQuery),
    );
  });
}
