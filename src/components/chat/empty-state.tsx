"use client";

import { AlertCircleIcon, MessageSquarePlusIcon, SettingsIcon, SparklesIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "#components/ui/button";
import type { ProviderInfo } from "#store/chat";
import { useChatStore } from "#store/chat";

interface EmptyStateProps {
  providers?: ProviderInfo[];
}

export function EmptyState({ providers }: EmptyStateProps) {
  const navigate = useNavigate();
  const createConversation = useChatStore((state) => state.createConversation);

  const hasProviders = providers && providers.length > 0;

  function handleStartConversation() {
    createConversation(true);
    navigate("/");
  }

  if (!hasProviders) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertCircleIcon className="size-6 text-destructive" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">No provider configured</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">Add an AI provider to start chatting.</p>

        <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-6 text-left">
            <h2 className="mb-3 text-sm font-semibold">1. Add an AI provider</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1.</span> Go to Settings and open the
                Providers tab.
              </li>
              <li>
                <span className="font-medium text-foreground">2.</span> Click a Quick Add preset
                (e.g. OpenAI, Ollama) or Add provider.
              </li>
              <li>
                <span className="font-medium text-foreground">3.</span> Enter your API key if
                required, then click Fetch models.
              </li>
              <li>
                <span className="font-medium text-foreground">4.</span> Select a model from the
                dropdown and start chatting.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border bg-card p-6 text-left">
            <h2 className="mb-3 text-sm font-semibold">
              2. Set up persistent storage{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Connect a Turso database to save your conversations across sessions.
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">1.</span> Create a database at{" "}
                <a
                  href="https://turso.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  turso.tech
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-foreground">2.</span> Go to Settings and open the
                Data tab.
              </li>
              <li>
                <span className="font-medium text-foreground">3.</span> Paste your libsql:// URL and
                auth token.
              </li>
            </ol>
          </div>
        </div>

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
        Start a new conversation or go to Settings to configure your AI provider.
      </p>

      <div className="mt-8 flex gap-3">
        <Button onClick={handleStartConversation}>
          <MessageSquarePlusIcon className="size-4" />
          Start Conversation
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings">
            <SettingsIcon className="size-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  );
}
