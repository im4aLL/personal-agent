const SELECTED_MODEL_STORAGE_KEY = "personal-agent:selected-model";
export const TURSO_URL_KEY = "personal-agent:turso-url";
export const TURSO_TOKEN_KEY = "personal-agent:turso-token";

export type StoredModelSelection = {
  providerId: string;
  modelId: string;
};

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

function isValidStoredModelSelection(value: unknown): value is StoredModelSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.providerId === "string" && typeof candidate.modelId === "string";
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
