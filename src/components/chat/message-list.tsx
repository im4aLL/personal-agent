"use client";

import { Loader2Icon, MessageSquareIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useChat } from "#hooks/use-chat";
import type { Conversation } from "#lib/types/chat";
import { cn } from "#lib/utils";
import { useChatStore } from "#store/chat";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  conversation: Conversation;
  fixedWidth: boolean;
}

export function MessageList({ conversation, fixedWidth }: MessageListProps) {
  const { retry, regenerate, editMessage, isGenerating } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const isMessagesLoading = useChatStore((state) => state.messagesLoading.has(conversation.id));

  const messages = conversation.messages;

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    isPinnedToBottomRef.current = distanceFromBottom < 48;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: conversation reference changes when messages update
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    // A newly sent user message always snaps the view back to the bottom.
    if (lastMessage && lastMessage.role === "user" && lastMessage.id !== lastMessageIdRef.current) {
      isPinnedToBottomRef.current = true;
    }
    lastMessageIdRef.current = lastMessage?.id ?? null;

    if (!endRef.current || !isPinnedToBottomRef.current) return;
    endRef.current.scrollIntoView({ behavior: "auto", block: "end" });
  }, [conversation]);

  if (isMessagesLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
          <MessageSquareIcon className="size-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Start a conversation</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Type a message below to begin chatting with your AI assistant.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-8"
    >
      <div className={cn("flex w-full flex-1 flex-col", fixedWidth && "max-w-[896px] mx-auto")}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isGenerating={isGenerating}
            onRetry={message.status === "error" ? retry : undefined}
            onRegenerate={
              message.role === "assistant" && message.status !== "error" ? regenerate : undefined
            }
            onEdit={
              message.role === "user" ? (content) => editMessage(message.id, content) : undefined
            }
          />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
