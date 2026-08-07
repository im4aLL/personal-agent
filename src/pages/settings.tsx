"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { AppearanceTab } from "#components/settings/appearance-tab";
import { DataTab } from "#components/settings/data-tab";
import { ProviderForm, type ProviderFormData } from "#components/settings/provider-form";
import { ProvidersList } from "#components/settings/providers-list";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#components/ui/tabs";
import { MOCK_PROVIDERS, type ProviderInfo } from "#store/chat";

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>(MOCK_PROVIDERS);
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
    setProviders((prev) => prev.filter((item) => item.id !== provider.id));
  }

  function handleSubmit(data: ProviderFormData) {
    if (editingProvider) {
      setProviders((prev) =>
        prev.map((item) =>
          item.id === editingProvider.id
            ? { ...item, label: data.label, baseUrl: data.baseUrl, apiKey: data.apiKey }
            : item,
        ),
      );
    } else {
      const newProvider: ProviderInfo = {
        id: `provider-${Date.now()}`,
        name: data.label.toLowerCase().replace(/\s+/g, "-"),
        label: data.label,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        isDefault: providers.length === 0,
        models: [],
      };
      setProviders((prev) => [...prev, newProvider]);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">Manage providers, appearance, and data.</p>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
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
              <CardContent>
                <ProvidersList providers={providers} onEdit={handleEdit} onDelete={handleDelete} />
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
      />
    </div>
  );
}
