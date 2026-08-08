"use client";

import {
  AlertCircleIcon,
  BotIcon,
  CopyIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  RefreshCwIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Textarea } from "#components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/ui/tooltip";
import type { Message } from "#lib/types/chat";
import { cn } from "#lib/utils";
import { Markdown } from "./markdown";
import { ThinkingBlock } from "./thinking-block";

interface MessageBubbleProps {
  message: Message;
  isGenerating?: boolean;
  onRetry?: () => void;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
}

export function MessageBubble({
  message,
  isGenerating = false,
  onRetry,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";
  const isError = message.status === "error";

  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const lastSelectedRef = useRef("");

  async function handleCopy(text?: string) {
    const toCopy = text ?? message.content;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  function handleTextSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText === lastSelectedRef.current) return;
    lastSelectedRef.current = selectedText;
    handleCopy(selectedText);
  }

  function handleEditStart() {
    setEditValue(message.content);
    setIsEditing(true);
  }

  function handleEditSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit?.(trimmed);
    }
    setIsEditing(false);
  }

  function handleEditCancel() {
    setIsEditing(false);
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleEditSave();
    } else if (event.key === "Escape") {
      handleEditCancel();
    }
  }

  return (
    <div className={cn("flex gap-3 py-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <BotIcon className="size-4" />
        </div>
      )}

      <div
        className={cn(
          "group/message flex max-w-[85%] flex-col gap-1",
          isUser ? "items-end" : "items-start",
        )}
      >
        {isEditing && isUser ? (
          <div className="flex w-full min-w-64 flex-col gap-2">
            <Textarea
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="min-h-20 resize-none"
              autoFocus
              aria-label="Edit message"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={handleEditCancel}>
                <XIcon className="mr-1 size-3" />
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleEditSave} disabled={!editValue.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                "relative rounded-2xl px-4 py-3 cursor-text select-text",
                isUser
                  ? "bg-primary text-primary-foreground rounded-br-sm dark:bg-secondary-foreground/15 dark:text-secondary-foreground"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm",
                isError && "border border-destructive/50 bg-destructive/10",
              )}
              onMouseUp={handleTextSelection}
              onKeyUp={(event) => {
                // Ctrl+C / Cmd+C also counts as selection-then-copy
                if ((event.ctrlKey || event.metaKey) && event.key === "c") {
                  handleTextSelection();
                }
              }}
            >
              {isError && (
                <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircleIcon className="size-4" />
                  Error
                </div>
              )}
              {message.reasoning && (
                <ThinkingBlock
                  key={`${message.id}-${isStreaming}`}
                  content={message.reasoning.content}
                  defaultCollapsed={isStreaming ? false : (message.reasoning.isCollapsed ?? true)}
                />
              )}
              {isUser && message.attachments && message.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-md bg-black/10 dark:bg-white/10 px-2 py-1 text-xs"
                    >
                      {attachment.type.startsWith("image/") && attachment.data ? (
                        <img
                          src={attachment.data}
                          alt={attachment.name}
                          className="size-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded bg-black/20 dark:bg-white/20">
                          {attachment.type.startsWith("image/") ? (
                            <ImageIcon className="size-4" />
                          ) : (
                            <FileTextIcon className="size-4" />
                          )}
                        </div>
                      )}
                      <span className="max-w-40 truncate">{attachment.name}</span>
                    </div>
                  ))}
                </div>
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

            {message.editedAt && <span className="text-xs text-muted-foreground">Edited</span>}

            <div
              className={cn(
                "flex items-center gap-0.5 opacity-0 transition-opacity",
                "group-hover/message:opacity-100",
              )}
            >
              {isUser && onEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Edit message"
                      onClick={handleEditStart}
                      disabled={isGenerating}
                    >
                      <PencilIcon className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={copied ? "Copied" : "Copy message"}
                    onClick={() => handleCopy()}
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

              {!isUser && !isError && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Regenerate response"
                      onClick={onRegenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCwIcon className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate</TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground dark:bg-secondary-foreground/15 dark:text-secondary-foreground">
          <UserIcon className="size-4" />
        </div>
      )}
    </div>
  );
}
