"use client";

import { PinIcon, PinOffIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { SidebarTrigger } from "#components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "#components/ui/tooltip";
import { TagEditor } from "./tag-editor";

interface ChatHeaderProps {
  title: string;
  pinned: boolean;
  tags: string[];
  existingTags: string[];
  onTagsChange: (tags: string[]) => void;
  onTogglePin: () => void;
}

export function ChatHeader({
  title,
  pinned,
  tags,
  existingTags,
  onTagsChange,
  onTogglePin,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-2 border-b px-4 py-3">
      <SidebarTrigger />
      <h2 className="min-w-0 truncate text-sm font-semibold flex-1">{title}</h2>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={pinned ? "Unpin conversation" : "Pin conversation"}
              onClick={onTogglePin}
            >
              {pinned ? <PinOffIcon className="size-3.5" /> : <PinIcon className="size-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? "Unpin" : "Pin"}</TooltipContent>
        </Tooltip>
        <TagEditor tags={tags} existingTags={existingTags} onTagsChange={onTagsChange} />
      </div>
    </header>
  );
}
