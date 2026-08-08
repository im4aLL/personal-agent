import type { ConnectionMode } from "#lib/providers";
import * as providerEncryption from "./providerEncryption";
import * as providerStorage from "./providerStorage";
import { getTursoConfig, tursoExecute, tursoExecuteMany, tursoSelect } from "./turso";

export type SyncStatus = "never-synced" | "synced" | "pending" | "error";

export type MergeSummary = {
  imports: providerStorage.ProviderRecord[];
  overwrites: providerStorage.ProviderRecord[];
  pushes: providerStorage.ProviderRecord[];
};

export type MergeResult = {
  summary: MergeSummary;
  applied: boolean;
};

export type SyncProviderRemoteRow = {
  id: string;
  label: string;
  base_url: string;
  encrypted_key: string;
  connection_mode: string;
  is_default: number;
  updated_at: string;
  synced_at: string;
};

export async function pushProviders(key: CryptoKey): Promise<void> {
  const config = getTursoConfig();
  if (!config) {
    throw new Error("Turso not configured");
  }

  const providers = providerStorage.getAll().filter((item) => item.syncEnabled);
  const now = new Date().toISOString();

  const requests = await Promise.all(
    providers.map(async (provider) => ({
      sql: `INSERT OR REPLACE INTO provider_configs (
        id, label, base_url, encrypted_key, connection_mode, is_default, updated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        provider.id,
        provider.label,
        provider.baseUrl,
        await providerEncryption.encryptApiKey(provider.apiKey, key),
        provider.connectionMode,
        provider.isDefault ? 1 : 0,
        provider.updated_at,
        now,
      ],
    })),
  );

  await tursoExecuteMany(requests);
}

export async function pullProviders(key: CryptoKey): Promise<providerStorage.ProviderRecord[]> {
  const config = getTursoConfig();
  if (!config) {
    throw new Error("Turso not configured");
  }

  const rows = await tursoSelect<SyncProviderRemoteRow>("SELECT * FROM provider_configs");
  const result: providerStorage.ProviderRecord[] = [];

  for (const row of rows) {
    try {
      result.push({
        id: row.id,
        name: row.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        label: row.label,
        baseUrl: row.base_url,
        apiKey: await providerEncryption.decryptApiKey(row.encrypted_key, key),
        connectionMode: row.connection_mode as ConnectionMode,
        isDefault: row.is_default === 1,
        updated_at: row.updated_at,
        syncEnabled: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to decrypt provider "${row.label}": ${message}`);
    }
  }

  return result;
}

function nameFromLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function mergeAndApply(
  key: CryptoKey,
  onSummary?: (summary: MergeSummary) => Promise<boolean>,
): Promise<MergeResult> {
  const local = providerStorage.getAll();
  const remote = await pullProviders(key);

  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));

  const merged: providerStorage.ProviderRecord[] = [];
  const summary: MergeSummary = {
    imports: [],
    overwrites: [],
    pushes: [],
  };

  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localProvider = localMap.get(id);
    const remoteProvider = remoteMap.get(id);

    if (localProvider && !remoteProvider) {
      merged.push(localProvider);
      if (localProvider.syncEnabled) {
        summary.pushes.push(localProvider);
      }
    } else if (!localProvider && remoteProvider) {
      const imported = { ...remoteProvider, name: nameFromLabel(remoteProvider.label) };
      merged.push(imported);
      summary.imports.push(imported);
    } else if (localProvider && remoteProvider) {
      const localTime = new Date(localProvider.updated_at).getTime();
      const remoteTime = new Date(remoteProvider.updated_at).getTime();

      if (localTime > remoteTime) {
        merged.push(localProvider);
        if (localProvider.syncEnabled) {
          summary.pushes.push(localProvider);
        }
      } else if (remoteTime > localTime) {
        const overwritten = { ...remoteProvider, name: nameFromLabel(remoteProvider.label) };
        merged.push(overwritten);
        summary.overwrites.push(overwritten);
      } else {
        merged.push(localProvider);
      }
    }
  }

  const needsConfirmation =
    summary.imports.length > 0 ||
    summary.overwrites.length > 0 ||
    summary.pushes.some((item) => !localMap.has(item.id));

  if (needsConfirmation && onSummary) {
    const proceed = await onSummary(summary);
    if (!proceed) {
      return { summary, applied: false };
    }
  }

  providerStorage.saveAll(merged);
  await pushProviders(key);
  return { summary, applied: true };
}

export async function deleteRemoteProvider(id: string): Promise<void> {
  const config = getTursoConfig();
  if (!config) {
    return;
  }

  await tursoExecute("DELETE FROM provider_configs WHERE id = ?", [id]);
}
