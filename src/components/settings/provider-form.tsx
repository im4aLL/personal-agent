"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import type { ConnectionMode, ProviderInput, TestConnectionResult } from "#lib/providers";
import { testProviderConnection } from "#lib/providers";
import type { ProviderInfo } from "#store/chat";

export type ProviderFormData = ProviderInput;

interface ProviderFormProps {
  provider?: ProviderInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProviderFormData) => void;
  existingProviders: ProviderInfo[];
}

type FormField = "label" | "baseUrl" | "apiKey" | "models";

type FormState = {
  label: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  connectionMode: ConnectionMode;
  touched: Record<FormField, boolean>;
};

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getInitialState(provider: ProviderInfo | null | undefined): FormState {
  const isEditing = Boolean(provider);

  return {
    label: provider?.label ?? "",
    baseUrl: provider?.baseUrl ?? "",
    apiKey: provider?.apiKey ?? "",
    models: provider?.models.map((model) => model.id).join(", ") ?? "",
    connectionMode: provider?.connectionMode ?? "direct",
    touched: { label: isEditing, baseUrl: isEditing, apiKey: isEditing, models: isEditing },
  };
}

export function ProviderForm({
  provider,
  open,
  onOpenChange,
  onSubmit,
  existingProviders,
}: ProviderFormProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(provider));
  const [isTesting, setIsTesting] = useState(false);

  const isEditing = Boolean(provider);
  const labelError = getLabelError(form, existingProviders, provider?.id);
  const baseUrlError = getBaseUrlError(form);
  const apiKeyError = form.touched.apiKey && !form.apiKey ? "API key is required." : "";
  const isValid = Boolean(
    form.label.trim() &&
      !labelError &&
      form.baseUrl.trim() &&
      !baseUrlError &&
      form.apiKey &&
      !apiKeyError,
  );

  useEffect(() => {
    if (open) {
      setForm(getInitialState(provider));
      setIsTesting(false);
    }
  }, [open, provider]);

  function updateField(field: keyof Omit<FormState, "touched">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: FormField) {
    setForm((prev) => ({ ...prev, touched: { ...prev.touched, [field]: true } }));
  }

  async function handleTestConnection() {
    setForm((prev) => ({
      ...prev,
      touched: { label: true, baseUrl: true, apiKey: true, models: true },
    }));

    if (!isValid) {
      return;
    }

    setIsTesting(true);

    const result = await runTestConnection(form);

    setIsTesting(false);

    if (result.ok) {
      toast.success("Connection successful", {
        description: result.usedProxy ? "Reached via proxy fallback." : "Direct connection works.",
      });
    } else {
      toast.error("Connection failed", {
        description: result.error ?? "Could not reach provider.",
      });
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setForm((prev) => ({
      ...prev,
      touched: { label: true, baseUrl: true, apiKey: true, models: true },
    }));

    if (!isValid) {
      return;
    }

    onSubmit({
      label: form.label.trim(),
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey,
      connectionMode: form.connectionMode,
      models: form.models,
    });

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit provider" : "Add provider"}</DialogTitle>
            <DialogDescription>
              Configure a provider endpoint and API key. Changes are persisted locally.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-label">Label</Label>
              <Input
                id="provider-label"
                placeholder="e.g. OpenAI"
                autoFocus
                value={form.label}
                onChange={(event) => updateField("label", event.target.value)}
                onBlur={() => markTouched("label")}
                aria-invalid={Boolean(labelError)}
                aria-describedby={labelError ? "provider-label-error" : undefined}
              />
              {labelError && (
                <p id="provider-label-error" className="text-sm text-destructive">
                  {labelError}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                placeholder="https://api.example.com/v1"
                value={form.baseUrl}
                onChange={(event) => updateField("baseUrl", event.target.value)}
                onBlur={() => markTouched("baseUrl")}
                aria-invalid={Boolean(baseUrlError)}
                aria-describedby={baseUrlError ? "provider-base-url-error" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Include the API version prefix, e.g. /v1 for OpenAI-compatible endpoints.
              </p>
              {baseUrlError && (
                <p id="provider-base-url-error" className="text-sm text-destructive">
                  {baseUrlError}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider-models">Models (optional)</Label>
              <Input
                id="provider-models"
                placeholder="e.g. gpt-4o, claude-3-opus"
                value={form.models}
                onChange={(event) => updateField("models", event.target.value)}
                onBlur={() => markTouched("models")}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated model IDs. Used when the provider does not expose a /models
                endpoint.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider-api-key">API Key</Label>
              <Input
                id="provider-api-key"
                type="password"
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(event) => updateField("apiKey", event.target.value)}
                onBlur={() => markTouched("apiKey")}
                aria-invalid={Boolean(apiKeyError)}
                aria-describedby={apiKeyError ? "provider-api-key-error" : undefined}
              />
              {apiKeyError && (
                <p id="provider-api-key-error" className="text-sm text-destructive">
                  {apiKeyError}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="provider-connection-mode">Connection mode</Label>
              <select
                id="provider-connection-mode"
                value={form.connectionMode}
                onChange={(event) => updateField("connectionMode", event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="direct">Direct (fetch from browser)</option>
                <option value="proxy">Proxy (via Rust backend)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Auto-detected on model fetch if left as Direct.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !isValid}
            >
              {isTesting ? "Testing..." : "Test connection"}
            </Button>
            <Button type="submit" disabled={!isValid}>
              {isEditing ? "Save changes" : "Add provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getLabelError(
  form: FormState,
  existingProviders: ProviderInfo[],
  excludeProviderId?: string,
): string {
  const trimmed = form.label.trim();

  if (form.touched.label && !trimmed) {
    return "Label is required.";
  }

  if (
    trimmed &&
    existingProviders.some(
      (provider) =>
        provider.label.trim().toLowerCase() === trimmed.toLowerCase() &&
        provider.id !== excludeProviderId,
    )
  ) {
    return "A provider with this label already exists.";
  }

  return "";
}

function getBaseUrlError(form: FormState): string {
  if (!form.touched.baseUrl) {
    return "";
  }

  if (!form.baseUrl.trim()) {
    return "Base URL is required.";
  }

  if (!isValidHttpUrl(form.baseUrl)) {
    return "Enter a valid http or https URL.";
  }

  return "";
}

async function runTestConnection(form: FormState): Promise<TestConnectionResult> {
  return testProviderConnection({
    id: "test",
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKey,
    connectionMode: form.connectionMode,
  });
}
