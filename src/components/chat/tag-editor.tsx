"use client";

import { PlusIcon, TagIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#components/ui/popover";

interface TagEditorProps {
  tags: string[];
  existingTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const MAX_TAG_LENGTH = 32;

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, MAX_TAG_LENGTH);
}

export function TagEditor({ tags, existingTags, onTagsChange }: TagEditorProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!draft.trim()) return [];
    const normalized = normalizeTag(draft);
    return existingTags.filter((tag) => tag.includes(normalized) && !tags.includes(tag));
  }, [draft, existingTags, tags]);

  const addTag = useCallback(
    (value?: string) => {
      const normalized = normalizeTag(value ?? draft);
      if (!normalized || tags.includes(normalized)) {
        setDraft("");
        setSelectedSuggestionIndex(0);
        return;
      }

      onTagsChange([...tags, normalized]);
      setDraft("");
      setSelectedSuggestionIndex(0);
      inputRef.current?.focus();
    },
    [draft, tags, onTagsChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onTagsChange(tags.filter((t) => t !== tag));
    },
    [tags, onTagsChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (suggestions.length > 0 && selectedSuggestionIndex < suggestions.length) {
          addTag(suggestions[selectedSuggestionIndex] ?? "");
        } else {
          addTag();
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (event.key === "Backspace" && !draft && tags.length > 0) {
        removeTag(tags[tags.length - 1] ?? "");
      } else if (event.key === "Escape") {
        setDraft("");
        setSelectedSuggestionIndex(0);
      }
    },
    [addTag, draft, tags, removeTag, suggestions, selectedSuggestionIndex],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground">
          <TagIcon className="size-3.5" />
          {tags.length === 0 ? (
            <span className="text-xs">Tags</span>
          ) : (
            <span className="flex items-center gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
              {tags.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
              )}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">Tags</div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <Input
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSelectedSuggestionIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Add tag..."
                className="h-7 text-xs"
                maxLength={MAX_TAG_LENGTH}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => addTag()}
                disabled={!normalizeTag(draft) || tags.includes(normalizeTag(draft))}
                aria-label="Add tag"
              >
                <PlusIcon className="size-3.5" />
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border bg-popover shadow-md">
                {suggestions.map((tag, index) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-accent ${index === selectedSuggestionIndex ? "bg-accent" : ""}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
