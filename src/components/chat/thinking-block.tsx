"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#components/ui/collapsible";
import { cn } from "#lib/utils";

interface ThinkingBlockProps {
  content: string;
  defaultCollapsed?: boolean;
}

export function ThinkingBlock({ content, defaultCollapsed = true }: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="my-2">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
            "hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
          <span>Thinking</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 p-3 rounded-md border-l-2 border-muted-foreground/30 bg-muted/30 text-sm text-muted-foreground whitespace-pre-wrap">
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
