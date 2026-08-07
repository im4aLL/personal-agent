"use client";

import { AlertCircleIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import type { ProviderInfo } from "#store/chat";

interface EmptyStateProps {
  providers?: ProviderInfo[];
}

const SUGGESTIONS = [
  "Explain a React hook",
  "Plan a weekend trip",
  "Debug a TypeScript error",
  "Summarize an article",
];

function handleSuggestion(suggestion: string) {
  toast("Coming soon", {
    description: `"${suggestion}" is not implemented yet.`,
  });
}

export function EmptyState({ providers }: EmptyStateProps) {
  const hasProviders = providers && providers.length > 0;

  if (!hasProviders) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertCircleIcon className="size-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">No provider configured</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Add an AI provider in Settings to start chatting.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/settings">Open Settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
        <SparklesIcon className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Welcome to Personal Agent</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Start a conversation below or pick a suggestion to get going.
      </p>

      <div className="mt-8 flex max-w-md flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            onClick={() => handleSuggestion(suggestion)}
          >
            <MessageSquareIcon className="size-3.5" />
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
