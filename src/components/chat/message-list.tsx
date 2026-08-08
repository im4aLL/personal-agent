"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "#hooks/use-chat";
import type { Conversation } from "#lib/types/chat";
import { MessageBubble } from "./message-bubble";

interface MessageListProps {
  conversation: Conversation;
}

const OVERSCAN = 5;
const ESTIMATED_MESSAGE_HEIGHT = 120;

export function MessageList({ conversation }: MessageListProps) {
  const { retry, regenerate, editMessage, isGenerating } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const messages = conversation.messages;

  const { topPadding, bottomPadding } = useMemo(() => {
    const start = visibleRange.start;
    const end = Math.min(visibleRange.end, messages.length);
    return {
      topPadding: start * ESTIMATED_MESSAGE_HEIGHT,
      bottomPadding: Math.max(0, messages.length - end) * ESTIMATED_MESSAGE_HEIGHT,
    };
  }, [visibleRange, messages.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function computeVisibleRange() {
      if (!container) return;
      const scrollTop = container.scrollTop;
      const viewportHeight = container.clientHeight;

      const start = Math.max(0, Math.floor(scrollTop / ESTIMATED_MESSAGE_HEIGHT) - OVERSCAN);
      const end = Math.min(
        messages.length,
        Math.ceil((scrollTop + viewportHeight) / ESTIMATED_MESSAGE_HEIGHT) + OVERSCAN,
      );

      setVisibleRange({ start, end });
    }

    computeVisibleRange();

    let rafId = 0;
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        rafId = requestAnimationFrame(() => {
          computeVisibleRange();
          ticking = false;
        });
        ticking = true;
      }
    }

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [messages.length]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: conversation reference changes when messages update
  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: "auto", block: "end" });
  }, [conversation]);

  if (messages.length === 0) {
    return null;
  }

  const visibleMessages = messages.slice(
    visibleRange.start,
    Math.min(visibleRange.end, messages.length),
  );

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div style={{ height: topPadding }} />
      {visibleMessages.map((message) => (
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
      <div style={{ height: bottomPadding }} />
      <div ref={endRef} />
    </div>
  );
}
