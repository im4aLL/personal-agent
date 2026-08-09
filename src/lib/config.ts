const DEFAULT_MODEL_STORAGE_KEY = "personal-agent:default-model";
const OLD_MODEL_STORAGE_KEY = "personal-agent:selected-model";
const DISABLED_MODELS_STORAGE_KEY = "personal-agent:disabled-models";
export const TURSO_URL_KEY = "personal-agent:turso-url";
export const TURSO_TOKEN_KEY = "personal-agent:turso-token";
export const WEB_SEARCH_ENABLED_KEY = "personal-agent:web-search-enabled";
export const FETCH_ENABLED_KEY = "personal-agent:fetch-enabled";
export const GOOGLE_SEARCH_ENABLED_KEY = "personal-agent:google-search-enabled";
export const DUCKDUCKGO_SEARCH_ENABLED_KEY = "personal-agent:duckduckgo-search-enabled";
export const TAVILY_API_KEY_KEY = "personal-agent:tavily-api-key";
export const CHAT_FIXED_WIDTH_KEY = "personal-agent:chat-fixed-width";

export type StoredModelSelection = {
  providerId: string;
  modelId: string;
};

export type DisabledModelsRecord = Record<string, string[]>;

function loadFromStorage<T>(key: string, validate: (value: unknown) => value is T): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!validate(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

export function loadSelectedModel(): StoredModelSelection | null {
  const stored = loadFromStorage(DEFAULT_MODEL_STORAGE_KEY, isValidStoredModelSelection);
  if (stored) {
    return stored;
  }

  // Migrate from old key.
  const migrated = loadFromStorage(OLD_MODEL_STORAGE_KEY, isValidStoredModelSelection);
  if (migrated) {
    saveToStorage(DEFAULT_MODEL_STORAGE_KEY, migrated);
    try {
      window.localStorage.removeItem(OLD_MODEL_STORAGE_KEY);
    } catch {
      // Ignore.
    }
    return migrated;
  }

  return null;
}

export function saveSelectedModel(selection: StoredModelSelection): void {
  saveToStorage(DEFAULT_MODEL_STORAGE_KEY, selection);
}

export function loadDisabledModels(): Set<string> {
  const data = loadFromStorage(DISABLED_MODELS_STORAGE_KEY, isValidDisabledModels);
  if (!data) {
    return new Set<string>();
  }

  const result = new Set<string>();
  for (const [providerId, modelIds] of Object.entries(data)) {
    for (const modelId of modelIds) {
      result.add(`${providerId}:${modelId}`);
    }
  }

  return result;
}

export function saveDisabledModels(disabled: Set<string>): void {
  const record: DisabledModelsRecord = {};

  for (const key of disabled) {
    const separatorIndex = key.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const providerId = key.slice(0, separatorIndex);
    const modelId = key.slice(separatorIndex + 1);

    if (!record[providerId]) {
      record[providerId] = [];
    }

    record[providerId].push(modelId);
  }

  saveToStorage(DISABLED_MODELS_STORAGE_KEY, record);
}

function isValidDisabledModels(value: unknown): value is DisabledModelsRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(candidate)) {
    if (typeof key !== "string" || !Array.isArray(val)) {
      return false;
    }

    if (!val.every((item) => typeof item === "string")) {
      return false;
    }
  }

  return true;
}

function isValidStoredModelSelection(value: unknown): value is StoredModelSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.providerId === "string" &&
    candidate.providerId.length > 0 &&
    typeof candidate.modelId === "string" &&
    candidate.modelId.length > 0
  );
}

export function toStoredModelSelection(providerId: string, modelId: string): StoredModelSelection {
  return { providerId, modelId };
}

export function loadTursoUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TURSO_URL_KEY);
  } catch {
    return null;
  }
}

export function loadTursoToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TURSO_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveTursoConfig(url: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TURSO_URL_KEY, url);
    window.localStorage.setItem(TURSO_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors.
  }
}

export function clearTursoConfig(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TURSO_URL_KEY);
    window.localStorage.removeItem(TURSO_TOKEN_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function loadBooleanFlag(key: string, defaultValue = false): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? defaultValue : raw === "true";
  } catch {
    return defaultValue;
  }
}

function saveBooleanFlag(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Ignore storage errors.
  }
}

export function loadWebSearchEnabled(): boolean {
  return loadBooleanFlag(WEB_SEARCH_ENABLED_KEY);
}

export function saveWebSearchEnabled(enabled: boolean): void {
  saveBooleanFlag(WEB_SEARCH_ENABLED_KEY, enabled);
}

export function loadFetchEnabled(): boolean {
  return loadBooleanFlag(FETCH_ENABLED_KEY);
}

export function saveFetchEnabled(enabled: boolean): void {
  saveBooleanFlag(FETCH_ENABLED_KEY, enabled);
}

export function loadGoogleSearchEnabled(): boolean {
  return loadBooleanFlag(GOOGLE_SEARCH_ENABLED_KEY);
}

export function saveGoogleSearchEnabled(enabled: boolean): void {
  saveBooleanFlag(GOOGLE_SEARCH_ENABLED_KEY, enabled);
}

export function loadDuckDuckGoSearchEnabled(): boolean {
  return loadBooleanFlag(DUCKDUCKGO_SEARCH_ENABLED_KEY);
}

export function saveDuckDuckGoSearchEnabled(enabled: boolean): void {
  saveBooleanFlag(DUCKDUCKGO_SEARCH_ENABLED_KEY, enabled);
}

export function loadTavilyApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TAVILY_API_KEY_KEY);
  } catch {
    return null;
  }
}

export function saveTavilyApiKey(apiKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAVILY_API_KEY_KEY, apiKey);
  } catch {
    // Ignore storage errors.
  }
}

export function clearTavilyApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TAVILY_API_KEY_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function loadChatFixedWidth(): boolean {
  return loadBooleanFlag(CHAT_FIXED_WIDTH_KEY, true);
}

export function saveChatFixedWidth(enabled: boolean): void {
  saveBooleanFlag(CHAT_FIXED_WIDTH_KEY, enabled);
}
