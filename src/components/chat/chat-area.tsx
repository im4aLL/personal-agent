"use client";

import { useMemo } from "react";
import { useChatWidth } from "#components/chat-width-provider";
import { selectSelectedConversation, useChatStore } from "#store/chat";
import { ChatHeader } from "./chat-header";
import { EmptyState } from "./empty-state";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

export function ChatArea() {
  const selectedConversation = useChatStore(selectSelectedConversation);
  const conversations = useChatStore((state) => state.conversations);
  const providers = useChatStore((state) => state.providers);
  const setConversationTags = useChatStore((state) => state.setConversationTags);
  const togglePin = useChatStore((state) => state.togglePin);
  const { fixedWidth } = useChatWidth();

  const existingTags = useMemo(() => {
    const all = new Set<string>();
    for (const conv of conversations) {
      for (const tag of conv.tags) {
        all.add(tag);
      }
    }
    return Array.from(all).sort();
  }, [conversations]);

  if (!selectedConversation) {
    return <EmptyState providers={providers} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col min-w-0">
      <ChatHeader
        title={selectedConversation.title}
        pinned={selectedConversation.pinned}
        tags={selectedConversation.tags}
        existingTags={existingTags}
        onTagsChange={(tags) => setConversationTags(selectedConversation.id, tags)}
        onTogglePin={() => togglePin(selectedConversation.id)}
      />
      <MessageList conversation={selectedConversation} fixedWidth={fixedWidth} />
      <MessageInput key={selectedConversation.id} />
    </div>
  );
}
