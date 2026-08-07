"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";
import type { ProviderInfo } from "#store/chat";

interface ProvidersListProps {
  providers: ProviderInfo[];
  onEdit: (provider: ProviderInfo) => void;
  onDelete: (provider: ProviderInfo) => void;
  onRefreshModels: (provider: ProviderInfo) => void;
  onSetDefault?: (provider: ProviderInfo) => void;
}

export function ProvidersList({
  providers,
  onEdit,
  onDelete,
  onRefreshModels,
  onSetDefault,
}: ProvidersListProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No providers configured.</p>
        <p className="text-xs text-muted-foreground">Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {providers.map((provider, index) => (
        <div
          key={provider.id}
          className={cn(
            "group flex items-start justify-between gap-4",
            index === 0 && "border-t pt-4",
            index !== providers.length - 1 && "border-b pb-4",
          )}
        >
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold">
              <span className="truncate">{provider.label}</span>
              {provider.isDefault && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                    "bg-primary text-primary-foreground border-transparent",
                  )}
                >
                  Default
                </span>
              )}
              <ConnectionModeBadge mode={provider.connectionMode} />
            </div>
            <p className="truncate text-sm text-muted-foreground">{provider.baseUrl}</p>
            <p className="text-sm text-muted-foreground">
              API key: {provider.apiKey ? "••••••••" : "Not set"}
            </p>
            {provider.modelsError && (
              <p className="text-sm text-destructive">{provider.modelsError}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRefreshModels(provider)}
              disabled={provider.isLoadingModels}
            >
              {provider.isLoadingModels ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              <span className="sr-only">Refresh models</span>
            </Button>
            {!provider.isDefault && onSetDefault && (
              <Button variant="ghost" size="sm" onClick={() => onSetDefault(provider)}>
                Set default
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(provider)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => onDelete(provider)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectionModeBadge({ mode }: { mode: ProviderInfo["connectionMode"] }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
        mode === "proxy"
          ? "border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200"
          : "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
      )}
    >
      {mode === "proxy" ? "Proxy" : "Direct"}
    </span>
  );
}
