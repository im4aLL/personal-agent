"use client";

import { BotIcon, CopyIcon, PencilIcon, RefreshCwIcon, UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/ui/tooltip";
import type { Message } from "#lib/types/chat";
import { cn } from "#lib/utils";
import { Markdown } from "./markdown";
import { ThinkingBlock } from "./thinking-block";

interface MessageBubbleProps {
  message: Message;
}

function handleAction(action: string) {
  toast("Coming soon", {
    description: `${action} is not implemented yet.`,
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

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
          )}
        >
          {message.reasoning && (
            <ThinkingBlock
              content={message.reasoning.content}
              defaultCollapsed={message.reasoning.isCollapsed ?? true}
            />
          )}
          <Markdown className={cn("[&_p:last-child]:mb-0", isUser && "prose-invert")}>
            {message.content}
          </Markdown>
        </div>

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
                aria-label="Copy message"
                onClick={() => handleAction("Copy")}
              >
                <CopyIcon className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>

          {!isUser && (
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
