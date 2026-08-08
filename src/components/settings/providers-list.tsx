"use client";

import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  Loader2Icon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#components/ui/collapsible";
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
  disabledModels: Set<string>;
  onEdit: (provider: ProviderInfo) => void;
  onDelete: (provider: ProviderInfo) => void;
  onRefreshModels: (provider: ProviderInfo) => void;
  onSetDefault?: (provider: ProviderInfo) => void;
  onToggleSync?: (provider: ProviderInfo, enabled: boolean) => void;
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onSetAllModelsEnabled: (enabled: boolean) => void;
  onSetProviderModelsEnabled: (providerId: string, enabled: boolean) => void;
}

function allModelsState(
  providers: ProviderInfo[],
  disabledModels: Set<string>,
): { total: number; enabled: number; allEnabled: boolean } {
  let total = 0;
  let enabled = 0;
  for (const provider of providers) {
    for (const model of provider.models) {
      total++;
      if (!disabledModels.has(`${provider.id}:${model.id}`)) enabled++;
    }
  }
  return { total, enabled, allEnabled: total > 0 && enabled === total };
}

export function ProvidersList({
  providers,
  providerSyncEnabled,
  providerSyncUnlocked,
  providerSyncStatus,
  providerSyncPending,
  disabledModels,
  onEdit,
  onDelete,
  onRefreshModels,
  onSetDefault,
  onToggleSync,
  onToggleModel,
  onSetAllModelsEnabled,
  onSetProviderModelsEnabled,
}: ProvidersListProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No providers configured.</p>
        <p className="text-xs text-muted-foreground">Add one to get started.</p>
      </div>
    );
  }

  const { total, enabled, allEnabled } = allModelsState(providers, disabledModels);

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {enabled} of {total} model{total !== 1 ? "s" : ""} enabled globally
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">All</span>
            <Switch
              checked={allEnabled}
              onCheckedChange={onSetAllModelsEnabled}
              aria-label="Toggle all models"
            />
          </div>
        </div>
      )}
      {providers.map((provider, index) => (
        <ProviderRow
          key={provider.id}
          provider={provider}
          providerSyncEnabled={providerSyncEnabled}
          providerSyncUnlocked={providerSyncUnlocked}
          providerSyncStatus={providerSyncStatus}
          providerSyncPending={providerSyncPending}
          disabledModels={disabledModels}
          isFirst={index === 0}
          isLast={index === providers.length - 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onRefreshModels={onRefreshModels}
          onSetDefault={onSetDefault}
          onToggleSync={onToggleSync}
          onToggleModel={onToggleModel}
          onSetProviderModelsEnabled={onSetProviderModelsEnabled}
        />
      ))}
    </div>
  );
}

interface ProviderRowProps {
  provider: ProviderInfo;
  providerSyncEnabled: boolean;
  providerSyncUnlocked: boolean;
  providerSyncStatus: SyncStatus;
  providerSyncPending: boolean;
  disabledModels: Set<string>;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (provider: ProviderInfo) => void;
  onDelete: (provider: ProviderInfo) => void;
  onRefreshModels: (provider: ProviderInfo) => void;
  onSetDefault?: (provider: ProviderInfo) => void;
  onToggleSync?: (provider: ProviderInfo, enabled: boolean) => void;
  onToggleModel: (providerId: string, modelId: string, enabled: boolean) => void;
  onSetProviderModelsEnabled: (providerId: string, enabled: boolean) => void;
}

function ProviderRow({
  provider,
  providerSyncEnabled,
  providerSyncUnlocked,
  providerSyncStatus,
  providerSyncPending,
  disabledModels,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onRefreshModels,
  onSetDefault,
  onToggleSync,
  onToggleModel,
  onSetProviderModelsEnabled,
}: ProviderRowProps) {
  const [expanded, setExpanded] = useState(false);

  const enabledCount = provider.models.filter(
    (m) => !disabledModels.has(`${provider.id}:${m.id}`),
  ).length;
  const hasModels = provider.models.length > 0;
  const zeroEnabled = hasModels && enabledCount === 0 && !provider.isLoadingModels;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={cn("group", isFirst && "border-t pt-4", !isLast && "border-b pb-4")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  aria-label={expanded ? "Collapse models" : "Expand models"}
                >
                  <ChevronDownIcon
                    className={cn("size-4 transition-transform", expanded && "rotate-180")}
                  />
                </Button>
              </CollapsibleTrigger>
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
            </div>
            <p className="truncate text-sm text-muted-foreground">{provider.baseUrl}</p>
            <p className="text-sm text-muted-foreground">
              API key: {provider.apiKey ? "••••••••" : "Not set"}
            </p>
            {hasModels && !provider.isLoadingModels && (
              <p className="text-xs text-muted-foreground">
                {enabledCount} of {provider.models.length} model
                {provider.models.length !== 1 ? "s" : ""} enabled
              </p>
            )}
            {zeroEnabled && (
              <p className="text-sm font-medium text-destructive">
                All models are disabled. Enable at least one to use this provider.
              </p>
            )}
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

        <CollapsibleContent>
          <div className="mt-3 ml-8 space-y-1 rounded-md border bg-muted/30 p-3">
            {provider.models.length > 1 && (
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-muted-foreground">
                  {enabledCount} of {provider.models.length} enabled
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">All</span>
                  <Switch
                    checked={enabledCount === provider.models.length}
                    onCheckedChange={(checked) => onSetProviderModelsEnabled(provider.id, checked)}
                    aria-label={`Toggle all models for ${provider.label}`}
                  />
                </div>
              </div>
            )}
            {provider.isLoadingModels && provider.models.length === 0 && (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading models...
              </div>
            )}
            {!provider.isLoadingModels && provider.models.length === 0 && !provider.modelsError && (
              <p className="py-2 text-sm text-muted-foreground">
                No models fetched yet. Click the refresh button to fetch models.
              </p>
            )}
            {provider.modelsError && provider.models.length === 0 && (
              <p className="py-2 text-sm text-destructive">
                Failed to load models. Check your connection and API key.
              </p>
            )}
            {provider.models.map((model) => {
              const modelKey = `${provider.id}:${model.id}`;
              const isEnabled = !disabledModels.has(modelKey);

              return (
                <div key={model.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-sm">{model.name}</span>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => onToggleModel(provider.id, model.id, checked)}
                    aria-label={`${isEnabled ? "Disable" : "Enable"} model ${model.name}`}
                  />
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
