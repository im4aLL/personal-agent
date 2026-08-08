"use client";

import {
  CheckCircleIcon,
  CircleAlertIcon,
  Loader2Icon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "#components/ui/button";
import { Switch } from "#components/ui/switch";
import type { SyncStatus } from "#lib/providerSync";
import { cn } from "#lib/utils";
import type { ProviderInfo } from "#store/chat";

interface ProvidersListProps {
  providers: ProviderInfo[];
  providerSyncEnabled: boolean;
  providerSyncUnlocked: boolean;
  providerSyncStatus: SyncStatus;
  providerSyncPending: boolean;
  onEdit: (provider: ProviderInfo) => void;
  onDelete: (provider: ProviderInfo) => void;
  onRefreshModels: (provider: ProviderInfo) => void;
  onSetDefault?: (provider: ProviderInfo) => void;
  onToggleSync?: (provider: ProviderInfo, enabled: boolean) => void;
}

export function ProvidersList({
  providers,
  providerSyncEnabled,
  providerSyncUnlocked,
  providerSyncStatus,
  providerSyncPending,
  onEdit,
  onDelete,
  onRefreshModels,
  onSetDefault,
  onToggleSync,
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
              <SyncStatusBadge
                syncEnabled={provider.syncEnabled}
                globalSyncEnabled={providerSyncEnabled}
                globalUnlocked={providerSyncUnlocked}
                globalStatus={providerSyncStatus}
                isPending={providerSyncPending}
              />
            </div>
            <p className="truncate text-sm text-muted-foreground">{provider.baseUrl}</p>
            <p className="text-sm text-muted-foreground">
              API key: {provider.apiKey ? "••••••••" : "Not set"}
            </p>
            {provider.modelsError && (
              <p className="text-sm text-destructive">{provider.modelsError}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
            {providerSyncEnabled && onToggleSync && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sync to cloud</span>
                <Switch
                  checked={provider.syncEnabled ?? false}
                  onCheckedChange={(checked) => onToggleSync(provider, checked)}
                  disabled={!providerSyncEnabled}
                />
              </div>
            )}
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

function SyncStatusBadge({
  syncEnabled,
  globalSyncEnabled,
  globalUnlocked,
  globalStatus,
  isPending,
}: {
  syncEnabled?: boolean;
  globalSyncEnabled: boolean;
  globalUnlocked: boolean;
  globalStatus: SyncStatus;
  isPending: boolean;
}) {
  if (!globalSyncEnabled || !syncEnabled) {
    return null;
  }

  if (!globalUnlocked) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
        )}
      >
        <CircleAlertIcon className="size-3" />
        Locked
      </span>
    );
  }

  if (isPending) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
        )}
      >
        <Loader2Icon className="size-3 animate-spin" />
        Syncing
      </span>
    );
  }

  switch (globalStatus) {
    case "synced":
      return (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
          )}
        >
          <CheckCircleIcon className="size-3" />
          Synced
        </span>
      );
    case "error":
      return (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
          )}
        >
          <XCircleIcon className="size-3" />
          Error
        </span>
      );
    default:
      return (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200",
          )}
        >
          <CircleAlertIcon className="size-3" />
          Not synced
        </span>
      );
  }
}
