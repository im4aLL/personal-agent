"use client";

import { MessageSquareIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useChat } from "#hooks/use-chat";
import type { Conversation } from "#lib/types/chat";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  conversation: Conversation;
}

export function MessageList({ conversation }: MessageListProps) {
  const { retry, regenerate, editMessage, isGenerating } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = conversation.messages;

  // biome-ignore lint/correctness/useExhaustiveDependencies: conversation reference changes when messages update
  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "auto", block: "end" });
  }, [conversation]);

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
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
  );
}
