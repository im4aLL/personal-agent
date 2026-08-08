"use client";

import { TagEditor } from "./tag-editor";

interface ChatHeaderProps {
  title: string;
  tags: string[];
  existingTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function ChatHeader({ title, tags, existingTags, onTagsChange }: ChatHeaderProps) {
  return (
    <header className="flex items-center border-b px-4 py-3">
      <h2 className="truncate text-sm font-semibold flex-1">{title}</h2>
      <TagEditor tags={tags} existingTags={existingTags} onTagsChange={onTagsChange} />
    </header>
  );
}
