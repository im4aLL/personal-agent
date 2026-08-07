"use client";

import {
  AlertCircleIcon,
  BotIcon,
  CopyIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/ui/tooltip";
import type { Message } from "#lib/types/chat";
import { cn } from "#lib/utils";
import { Markdown } from "./markdown";
import { ThinkingBlock } from "./thinking-block";

interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
}

function handleAction(action: string) {
  toast("Coming soon", {
    description: `${action} is not implemented yet.`,
  });
}

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className={cn("group/message flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <BotIcon className="size-4" />
        </div>
      )}

      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm dark:bg-secondary-foreground/15 dark:text-secondary-foreground"
              : "bg-secondary text-secondary-foreground rounded-bl-sm",
            isError && "border border-destructive/50 bg-destructive/10",
          )}
        >
          {isError && (
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
              <AlertCircleIcon className="size-4" />
              Error
            </div>
          )}
          {message.reasoning && (
            <ThinkingBlock
              content={message.reasoning.content}
              defaultCollapsed={message.reasoning.isCollapsed ?? true}
            />
          )}
          <Markdown className={cn("[&_p:last-child]:mb-0", isUser && "prose-invert")}>
            {message.content}
          </Markdown>
          {isStreaming && (
            <span className="ml-1 inline-flex h-4 w-4 align-middle">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </span>
          )}
          {message.error && <p className="mt-2 text-xs text-destructive">{message.error}</p>}
        </div>

        {!isUser && message.model && (
          <p className="text-xs text-muted-foreground">
            {message.model.providerName} / {message.model.modelName}
            {message.thinkingLevel && message.thinkingLevel !== "off"
              ? ` - Thinking: ${message.thinkingLevel}`
              : ""}
          </p>
        )}

        <div
          className={cn(
            "flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100 focus-within:opacity-100",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Edit message"
                onClick={() => handleAction("Edit")}
              >
                <PencilIcon className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={copied ? "Copied" : "Copy message"}
                onClick={handleCopy}
              >
                <CopyIcon className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
          </Tooltip>

          {!isUser && isError && onRetry && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Retry generation"
                  onClick={onRetry}
                >
                  <RefreshCwIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
          )}

          {!isUser && !isError && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Regenerate response"
                  onClick={() => handleAction("Regenerate")}
                >
                  <RefreshCwIcon className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground dark:bg-secondary-foreground/15 dark:text-secondary-foreground">
          <UserIcon className="size-4" />
        </div>
      )}
    </div>
  );
}
