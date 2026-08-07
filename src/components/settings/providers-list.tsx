"use client";

import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import { cn } from "#lib/utils";
import type { ProviderInfo } from "#store/chat";

interface ProvidersListProps {
  providers: ProviderInfo[];
  onEdit: (provider: ProviderInfo) => void;
  onDelete: (provider: ProviderInfo) => void;
}

export function ProvidersList({ providers, onEdit, onDelete }: ProvidersListProps) {
  if (providers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No providers configured.</p>
        <p className="text-xs text-muted-foreground">Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {providers.map((provider) => (
        <Card key={provider.id} className="group">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
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
                </CardTitle>
                <p className="mt-1 truncate text-sm text-muted-foreground">{provider.baseUrl}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="sm" onClick={() => onEdit(provider)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  onClick={() => {
                    onDelete(provider);
                    toast("Coming soon", {
                      description: "Delete provider is not implemented yet.",
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              API key: {provider.apiKey ? "••••••••" : "Not set"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
