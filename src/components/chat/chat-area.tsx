"use client";

import { ScrollArea } from "#components/ui/scroll-area";
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
    <div className="flex flex-1 flex-col min-w-0">
      <ChatHeader title={selectedConversation.title} />
      <ScrollArea className="flex-1">
        <div className="w-full px-4 pb-8">
          <MessageList conversation={selectedConversation} />
        </div>
      </ScrollArea>
      <MessageInput />
    </div>
  );
}
