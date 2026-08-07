"use client";

import { useEffect, useRef } from "react";
import { useChat } from "#hooks/use-chat";
import type { Conversation } from "#lib/types/chat";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  conversation: Conversation;
}

export function MessageList({ conversation }: MessageListProps) {
  const { retry } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: conversation reference changes when messages update
  useEffect(() => {
    if (!endRef.current) {
      return;
    }

    endRef.current.scrollIntoView({ behavior: "auto", block: "end" });
  }, [conversation]);

  return (
    <div className="flex flex-col">
      {conversation.messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRetry={message.status === "error" ? retry : undefined}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
