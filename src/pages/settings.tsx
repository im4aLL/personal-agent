"use client";

import { DownloadIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppearanceTab } from "#components/settings/appearance-tab";
import { DataTab } from "#components/settings/data-tab";
import { ProviderForm, type ProviderFormData } from "#components/settings/provider-form";
import { ProvidersList } from "#components/settings/providers-list";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#components/ui/tabs";
import type { ConnectionMode } from "#lib/providers";
import { PROVIDER_PRESETS, type ProviderInfo, useChatStore } from "#store/chat";

export default function SettingsPage() {
  const providers = useChatStore((state) => state.providers);
  const addProvider = useChatStore((state) => state.addProvider);
  const updateProvider = useChatStore((state) => state.updateProvider);
  const deleteProvider = useChatStore((state) => state.deleteProvider);
  const setDefaultProvider = useChatStore((state) => state.setDefaultProvider);
  const setProviderSyncEnabledFlag = useChatStore((state) => state.setProviderSyncEnabledFlag);
  const refreshProviderModels = useChatStore((state) => state.refreshProviderModels);
  const providerSyncEnabled = useChatStore((state) => state.providerSyncEnabled);
  const providerSyncKey = useChatStore((state) => state.providerSyncKey);
  const providerSyncStatus = useChatStore((state) => state.providerSyncStatus);
  const providerSyncPending = useChatStore((state) => state.providerSyncPending);
  const disabledModels = useChatStore((state) => state.disabledModels);
  const toggleModelEnabled = useChatStore((state) => state.toggleModelEnabled);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderInfo | null>(null);
  const [deleteConfirmProvider, setDeleteConfirmProvider] = useState<ProviderInfo | null>(null);

  function handleAdd() {
    setEditingProvider(null);
    setFormOpen(true);
  }

  function handleEdit(provider: ProviderInfo) {
    setEditingProvider(provider);
    setFormOpen(true);
  }

  function handleDelete(provider: ProviderInfo) {
    setDeleteConfirmProvider(provider);
  }

  function handleConfirmDelete() {
    if (deleteConfirmProvider) {
      deleteProvider(deleteConfirmProvider.id);
      setDeleteConfirmProvider(null);
    }
  }

  function handleSubmit(data: ProviderFormData) {
    if (editingProvider) {
      updateProvider(editingProvider.id, data);
    } else {
      addProvider(data);
    }
  }

  function handleAddPreset(preset: {
    label: string;
    baseUrl: string;
    apiKey: string;
    connectionMode: ConnectionMode;
  }) {
    const alreadyExists = providers.some(
      (provider) => provider.label.toLowerCase() === preset.label.toLowerCase(),
    );

    if (alreadyExists) {
      const existing = providers.find(
        (provider) => provider.label.toLowerCase() === preset.label.toLowerCase(),
      );
      if (existing) {
        handleEdit(existing);
      }
      return;
    }

    addProvider(preset);
  }

  function handleRefreshModels(provider: ProviderInfo) {
    void refreshProviderModels(provider.id);
  }

  function handleSetDefault(provider: ProviderInfo) {
    setDefaultProvider(provider.id);
  }

  function handleToggleProviderSync(provider: ProviderInfo, enabled: boolean) {
    setProviderSyncEnabledFlag(provider.id, enabled);
  }

  function handleExportSettings() {
    const exportData = providers.map((provider) => ({
      label: provider.label,
      baseUrl: provider.baseUrl,
      models: provider.models.map((model) => model.id),
      connectionMode: provider.connectionMode,
    }));

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "personal-agent-providers.json";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success("Settings exported", {
      description: "Provider labels, URLs, and models saved without API keys.",
    });
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage providers, appearance, and data.</p>
        </div>

        <Tabs defaultValue="providers">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-2">
                  <CardTitle>Providers</CardTitle>
                  <CardDescription>AI providers available for chat.</CardDescription>
                </div>
                <Button size="sm" onClick={handleAdd}>
                  <PlusIcon className="size-4" />
                  Add provider
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <SparklesIcon className="size-4" />
                    Quick add
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPreset(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <ProvidersList
                  providers={providers}
                  providerSyncEnabled={providerSyncEnabled}
                  providerSyncUnlocked={providerSyncKey !== null}
                  providerSyncStatus={providerSyncStatus}
                  providerSyncPending={providerSyncPending}
                  disabledModels={disabledModels}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRefreshModels={handleRefreshModels}
                  onSetDefault={handleSetDefault}
                  onToggleSync={handleToggleProviderSync}
                  onToggleModel={toggleModelEnabled}
                />

                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    Click the refresh icon next to a provider to fetch available models. Connection
                    mode is remembered per provider.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExportSettings}
                    disabled={providers.length === 0}
                    aria-label="Export provider settings"
                  >
                    <DownloadIcon className="size-3.5" />
                    Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel.</CardDescription>
              </CardHeader>
              <CardContent>
                <AppearanceTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data">
            <Card>
              <CardHeader>
                <CardTitle>Data</CardTitle>
                <CardDescription>Configure external database connection.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ProviderForm
        provider={editingProvider}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        existingProviders={providers}
      />

      <Dialog
        open={deleteConfirmProvider !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmProvider(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{deleteConfirmProvider?.label}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmProvider(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
