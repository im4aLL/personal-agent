"use client";

import type { ConnectionMode } from "#lib/providers";

const PROVIDERS_STORAGE_KEY = "personal-agent:providers";
const PROVIDER_SYNC_ENABLED_KEY = "personal-agent:provider-sync-enabled";

export type ProviderModelRecord = {
  id: string;
  contextWindow?: number;
};

export type ProviderRecord = {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  connectionMode: ConnectionMode;
  models?: ProviderModelRecord[];
  updated_at: string;
  syncEnabled?: boolean;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readRaw(): unknown[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PROVIDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(records: unknown[]): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(PROVIDERS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

function normalizeConnectionMode(value: unknown): ConnectionMode {
  return value === "direct" || value === "proxy" ? value : "direct";
}

function normalizeModelRecord(item: unknown): ProviderModelRecord | null {
  // Back-compat with data written before contextWindow existed, where
  // `models` was a plain string[] of ids.
  if (typeof item === "string") {
    return item ? { id: item } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const candidate = item as { id?: unknown; contextWindow?: unknown };
  if (typeof candidate.id !== "string" || !candidate.id) {
    return null;
  }

  const contextWindow =
    typeof candidate.contextWindow === "number" &&
    Number.isFinite(candidate.contextWindow) &&
    candidate.contextWindow > 0
      ? candidate.contextWindow
      : undefined;

  return { id: candidate.id, contextWindow };
}

function normalizeModels(value: unknown): ProviderModelRecord[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const models = value
    .map(normalizeModelRecord)
    .filter((item): item is ProviderModelRecord => item !== null);
  return models.length > 0 ? models : undefined;
}

function normalize(record: unknown): ProviderRecord | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const candidate = record as Record<string, unknown>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.baseUrl !== "string" ||
    typeof candidate.apiKey !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    label: candidate.label,
    baseUrl: candidate.baseUrl,
    apiKey: candidate.apiKey,
    isDefault: typeof candidate.isDefault === "boolean" ? candidate.isDefault : false,
    connectionMode: normalizeConnectionMode(candidate.connectionMode),
    models: normalizeModels(candidate.models),
    updated_at:
      typeof candidate.updated_at === "string" && candidate.updated_at
        ? candidate.updated_at
        : new Date().toISOString(),
    syncEnabled: typeof candidate.syncEnabled === "boolean" ? candidate.syncEnabled : false,
  };
}

function recordsEqual(left: ProviderRecord, right: ProviderRecord): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.label === right.label &&
    left.baseUrl === right.baseUrl &&
    left.apiKey === right.apiKey &&
    left.isDefault === right.isDefault &&
    left.connectionMode === right.connectionMode &&
    (left.syncEnabled ?? false) === (right.syncEnabled ?? false) &&
    JSON.stringify(left.models) === JSON.stringify(right.models)
  );
}

export function getAll(): ProviderRecord[] {
  return readRaw()
    .map(normalize)
    .filter((item): item is ProviderRecord => item !== null);
}

export function getById(id: string): ProviderRecord | null {
  return getAll().find((item) => item.id === id) ?? null;
}

export function save(record: ProviderRecord): void {
  const records = getAll();
  const index = records.findIndex((item) => item.id === record.id);
  const next = { ...record, updated_at: new Date().toISOString() };

  if (index >= 0) {
    records[index] = next;
  } else {
    records.push(next);
  }

  writeRaw(records);
}

export function saveAll(records: ProviderRecord[]): void {
  const existing = getAll();
  const existingMap = new Map(existing.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  const next = records.map((record) => {
    const previous = existingMap.get(record.id);
    const withTimestamp = { ...record, updated_at: record.updated_at || now };

    if (previous && recordsEqual(previous, { ...withTimestamp, updated_at: previous.updated_at })) {
      return previous;
    }

    return { ...withTimestamp, updated_at: now };
  });

  writeRaw(next);
}

export function deleteProvider(id: string): void {
  const records = getAll().filter((item) => item.id !== id);
  writeRaw(records);
}

export function getDefault(): ProviderRecord | null {
  const records = getAll();
  return records.find((item) => item.isDefault) ?? records[0] ?? null;
}

export function setDefault(id: string): void {
  const records = getAll().map((item) => ({ ...item, isDefault: item.id === id }));
  writeRaw(records);
}

export function isProviderSyncEnabled(): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    return window.localStorage.getItem(PROVIDER_SYNC_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setProviderSyncEnabled(enabled: boolean): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(PROVIDER_SYNC_ENABLED_KEY, String(enabled));
  } catch {
    // Ignore storage errors.
  }
}
