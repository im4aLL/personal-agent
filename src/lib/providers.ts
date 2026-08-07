import { invoke } from "@tauri-apps/api/core";

export type ConnectionMode = "direct" | "proxy";

export type ModelInfo = {
  id: string;
  name: string;
};

export type ProviderEndpoint = {
  id: string;
  baseUrl: string;
  apiKey: string;
  connectionMode: ConnectionMode;
};

export type ProviderInput = {
  label: string;
  baseUrl: string;
  apiKey: string;
  connectionMode: ConnectionMode;
};

export type FetchModelsResult = {
  models: ModelInfo[];
  usedProxy: boolean;
};

export type TestConnectionResult = {
  ok: boolean;
  usedProxy: boolean;
  error?: string;
};

type ProxyRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

type ProxyResponse = {
  status: number;
  body: string;
};

export async function fetchProviderModels(endpoint: ProviderEndpoint): Promise<FetchModelsResult> {
  const url = buildModelsUrl(endpoint.baseUrl);
  const headers = buildAuthHeaders(endpoint.apiKey);

  if (endpoint.connectionMode === "proxy") {
    const models = await fetchModelsViaProxy(url, headers);
    return { models, usedProxy: true };
  }

  try {
    const models = await fetchModelsDirectly(url, headers);
    return { models, usedProxy: false };
  } catch {
    const models = await fetchModelsViaProxy(url, headers);
    return { models, usedProxy: true };
  }
}

export async function testProviderConnection(
  endpoint: ProviderEndpoint,
): Promise<TestConnectionResult> {
  const url = buildModelsUrl(endpoint.baseUrl);
  const headers = buildAuthHeaders(endpoint.apiKey);

  if (endpoint.connectionMode === "proxy") {
    const result = await testConnectionViaProxy(url, headers);
    return { ...result, usedProxy: true };
  }

  try {
    const result = await testConnectionDirectly(url, headers);
    return { ...result, usedProxy: false };
  } catch {
    const result = await testConnectionViaProxy(url, headers);
    return { ...result, usedProxy: true };
  }
}

function buildModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, "");
  return `${normalized}/models`;
}

function buildAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function fetchModelsDirectly(
  url: string,
  headers: Record<string, string>,
): Promise<ModelInfo[]> {
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as unknown;
  return normalizeModels(data);
}

async function fetchModelsViaProxy(
  url: string,
  headers: Record<string, string>,
): Promise<ModelInfo[]> {
  const response = await proxyRequest({
    method: "GET",
    url,
    headers,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = parseJson(response.body);
  return normalizeModels(data);
}

async function testConnectionDirectly(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function testConnectionViaProxy(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await proxyRequest({
      method: "GET",
      url,
      headers,
    });

    if (response.status < 200 || response.status >= 300) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Proxy request failed",
    };
  }
}

async function proxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  return invoke<ProxyResponse>("proxy", { request });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeModels(data: unknown): ModelInfo[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const candidate = data as Record<string, unknown>;

  if (Array.isArray(candidate.data)) {
    return candidate.data
      .filter(isModelLike)
      .map((item) => ({
        id: item.id ?? "",
        name: item.name ?? item.id ?? "",
      }))
      .filter((item) => item.id);
  }

  if (Array.isArray(candidate.models)) {
    return candidate.models
      .filter(isModelLike)
      .map((item) => {
        const id = item.name ?? item.id ?? item.model ?? "";
        return { id, name: id };
      })
      .filter((item) => item.id);
  }

  return [];
}

function isModelLike(value: unknown): value is { id?: string; name?: string; model?: string } {
  return value !== null && typeof value === "object";
}
