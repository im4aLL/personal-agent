"use client";

import { PlusIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { AppearanceTab } from "#components/settings/appearance-tab";
import { DataTab } from "#components/settings/data-tab";
import { ProviderForm, type ProviderFormData } from "#components/settings/provider-form";
import { ProvidersList } from "#components/settings/providers-list";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#components/ui/tabs";
import type { ConnectionMode } from "#lib/providers";
import { PROVIDER_PRESETS, type ProviderInfo, useChatStore } from "#store/chat";

export default function SettingsPage() {
  const providers = useChatStore((state) => state.providers);
  const addProvider = useChatStore((state) => state.addProvider);
  const updateProvider = useChatStore((state) => state.updateProvider);
  const deleteProvider = useChatStore((state) => state.deleteProvider);
  const setDefaultProvider = useChatStore((state) => state.setDefaultProvider);
  const refreshProviderModels = useChatStore((state) => state.refreshProviderModels);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderInfo | null>(null);

  function handleAdd() {
    setEditingProvider(null);
    setFormOpen(true);
  }

  function handleEdit(provider: ProviderInfo) {
    setEditingProvider(provider);
    setFormOpen(true);
  }

  function handleDelete(provider: ProviderInfo) {
    deleteProvider(provider.id);
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
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRefreshModels={handleRefreshModels}
                  onSetDefault={handleSetDefault}
                />

                <div className="text-xs text-muted-foreground">
                  Click the refresh icon next to a provider to fetch available models. Connection
                  mode is remembered per provider.
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
    </div>
  );
}
