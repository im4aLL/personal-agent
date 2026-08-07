import type { ConnectionMode } from "#lib/providers";

const PROVIDERS_STORAGE_KEY = "personal-agent:providers";
const SELECTED_MODEL_STORAGE_KEY = "personal-agent:selected-model";

export type StoredProvider = {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  connectionMode: ConnectionMode;
  models?: string[];
};

export type StoredModelSelection = {
  providerId: string;
  modelId: string;
};

export function loadProviders(): StoredProvider[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROVIDERS_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map(normalizeStoredProvider)
      .filter((item): item is StoredProvider => item !== null);
  } catch {
    return null;
  }
}

export function saveProviders(providers: StoredProvider[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PROVIDERS_STORAGE_KEY, JSON.stringify(providers));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

export function loadSelectedModel(): StoredModelSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidStoredModelSelection(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveSelectedModel(selection: StoredModelSelection): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

function normalizeStoredProvider(value: unknown): StoredProvider | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.baseUrl !== "string" ||
    typeof candidate.apiKey !== "string"
  ) {
    return null;
  }

  const connectionMode =
    candidate.connectionMode === "direct" || candidate.connectionMode === "proxy"
      ? candidate.connectionMode
      : "direct";

  const models = Array.isArray(candidate.models)
    ? candidate.models.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    id: candidate.id,
    name: candidate.name,
    label: candidate.label,
    baseUrl: candidate.baseUrl,
    apiKey: candidate.apiKey,
    isDefault: typeof candidate.isDefault === "boolean" ? candidate.isDefault : false,
    connectionMode,
    models,
  };
}

function isValidStoredModelSelection(value: unknown): value is StoredModelSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.providerId === "string" && typeof candidate.modelId === "string";
}

export function toStoredProvider(provider: {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  connectionMode: ConnectionMode;
  models?: string[];
}): StoredProvider {
  return {
    id: provider.id,
    name: provider.name,
    label: provider.label,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    isDefault: provider.isDefault,
    connectionMode: provider.connectionMode,
    models: provider.models,
  };
}

export function toStoredModelSelection(providerId: string, modelId: string): StoredModelSelection {
  return { providerId, modelId };
}
