"use client";

import { selectSelectedConversation, useChatStore } from "#store/chat";
import { ChatHeader } from "./chat-header";
import { EmptyState } from "./empty-state";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";

export function ChatArea() {
  const selectedConversation = useChatStore(selectSelectedConversation);
  const providers = useChatStore((state) => state.providers);

  if (!selectedConversation) {
    return <EmptyState providers={providers} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col min-w-0">
      <ChatHeader title={selectedConversation.title} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="w-full px-4 pb-8">
          <MessageList conversation={selectedConversation} />
        </div>
      </div>
      <MessageInput />
    </div>
  );
}
