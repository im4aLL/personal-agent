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
import type { ProviderInfo } from "#store/chat";

export type ProviderFormData = {
  label: string;
  baseUrl: string;
  apiKey: string;
};

interface ProviderFormProps {
  provider?: ProviderInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProviderFormData) => void;
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

type FormState = {
  label: string;
  baseUrl: string;
  apiKey: string;
  touched: { label: boolean; baseUrl: boolean; apiKey: boolean };
};

function getInitialState(provider: ProviderInfo | null | undefined): FormState {
  return {
    label: provider?.label ?? "",
    baseUrl: provider?.baseUrl ?? "",
    apiKey: provider?.apiKey ?? "",
    touched: { label: false, baseUrl: false, apiKey: false },
  };
}

export function ProviderForm({ provider, open, onOpenChange, onSubmit }: ProviderFormProps) {
  const [form, setForm] = useState<FormState>(() => getInitialState(provider));

  const isEditing = Boolean(provider);
  const labelError = form.touched.label && !form.label.trim() ? "Label is required." : "";
  const baseUrlError = form.touched.baseUrl
    ? !form.baseUrl.trim()
      ? "Base URL is required."
      : !isValidUrl(form.baseUrl)
        ? "Enter a valid URL."
        : ""
    : "";
  const apiKeyError = form.touched.apiKey && !form.apiKey ? "API key is required." : "";
  const isValid = Boolean(
    form.label.trim() && form.baseUrl.trim() && isValidUrl(form.baseUrl) && form.apiKey,
  );

  useEffect(() => {
    if (open) {
      setForm(getInitialState(provider));
    }
  }, [open, provider]);

  function updateField(field: keyof Omit<FormState, "touched">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function markTouched(field: keyof FormState["touched"]) {
    setForm((prev) => ({ ...prev, touched: { ...prev.touched, [field]: true } }));
  }

  function handleTestConnection() {
    toast("Coming soon", {
      description: "Test connection is not implemented yet.",
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setForm((prev) => ({ ...prev, touched: { label: true, baseUrl: true, apiKey: true } }));

    if (!form.label.trim() || !form.baseUrl.trim() || !isValidUrl(form.baseUrl) || !form.apiKey) {
      return;
    }

    onSubmit({ label: form.label.trim(), baseUrl: form.baseUrl.trim(), apiKey: form.apiKey });
    toast("Coming soon", {
      description: `${isEditing ? "Update" : "Add"} provider is not implemented yet.`,
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
              Configure a provider endpoint and API key. Changes are not persisted yet.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-label">Label</Label>
              <Input
                id="provider-label"
                placeholder="e.g. OpenAI"
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
              {baseUrlError && (
                <p id="provider-base-url-error" className="text-sm text-destructive">
                  {baseUrlError}
                </p>
              )}
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
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleTestConnection}>
              Test connection
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
