import { Channel, invoke } from "@tauri-apps/api/core";
import type { ConnectionMode, ProviderEndpoint } from "#lib/providers";

export type CoreMessageRole = "user" | "assistant" | "system";

export type CoreMessage = {
  role: CoreMessageRole;
  content: string;
};

export type TextStreamPart =
  | { type: "text-delta"; textDelta: string }
  | { type: "reasoning"; reasoning: string }
  | { type: "finish"; finishReason: string };

export type LanguageModel = {
  provider: string;
  modelId: string;
  baseURL: string;
  apiKey: string;
  connectionMode: ConnectionMode;
};

type StreamChunk = string | { done: true } | { error: string };

type StreamRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  abort_id: string;
};

function createAbortId(): string {
  return `abort-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function recordHeaders(init: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!init.headers) {
    return headers;
  }

  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(init.headers)) {
    for (const [key, value] of init.headers) {
      headers[key] = value;
    }
  } else {
    for (const [key, value] of Object.entries(init.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  return headers;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  return new Error("Proxy stream failed");
}

function createStreamResponse(
  channel: Channel<StreamChunk>,
  request: StreamRequest,
  abortId: string,
  onDone: () => void,
): Response {
  let isAborted = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;

      channel.onmessage = (chunk) => {
        if (isAborted) {
          return;
        }

        if (typeof chunk === "string") {
          controller.enqueue(new TextEncoder().encode(chunk));
        } else if ("error" in chunk) {
          isAborted = true;
          onDone();
          controller.error(new Error(chunk.error));
        } else if ("done" in chunk) {
          isAborted = true;
          onDone();
          controller.close();
        }
      };

      invoke("proxy_stream", { request, channel }).catch((error: unknown) => {
        isAborted = true;
        onDone();
        streamController?.error(toError(error));
      });
    },
    cancel() {
      isAborted = true;
      onDone();
      invoke("abort_stream", { abortId }).catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "text/event-stream" },
  });
}

export async function proxyFetch(
  _provider: ProviderEndpoint,
  url: string,
  init: RequestInit,
): Promise<Response> {
  const abortId = createAbortId();
  const channel = new Channel<StreamChunk>();

  const request: StreamRequest = {
    method: init.method ?? "GET",
    url,
    headers: recordHeaders(init),
    body: typeof init.body === "string" ? init.body : undefined,
    abort_id: abortId,
  };

  let abortListener: (() => void) | null = null;

  const removeAbortListener = () => {
    if (abortListener && init.signal) {
      init.signal.removeEventListener("abort", abortListener);
      abortListener = null;
    }
  };

  const response = createStreamResponse(channel, request, abortId, removeAbortListener);

  if (init.signal) {
    abortListener = () => {
      invoke("abort_stream", { abortId }).catch(() => {});
    };
    init.signal.addEventListener("abort", abortListener);
  }

  return response;
}

export function createOpenAICompatible(options: {
  baseURL: string;
  apiKey: string;
  name: string;
}): {
  languageModel: (modelId: string, connectionMode: ConnectionMode) => LanguageModel;
} {
  return {
    languageModel(modelId: string, connectionMode: ConnectionMode) {
      return {
        provider: options.name,
        modelId,
        baseURL: options.baseURL,
        apiKey: options.apiKey,
        connectionMode,
      };
    },
  };
}

export type SseEvent = {
  data: string;
};

export function parseSseBuffer(buffer: string): {
  events: SseEvent[];
  remaining: string;
} {
  const events: SseEvent[] = [];
  const lines = buffer.split("\n");
  let pendingData = "";
  const remainingLines: string[] = [];
  let foundCompleteEvent = false;

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

    if (line.startsWith("data: ")) {
      const value = line.slice(6);
      pendingData = pendingData === "" ? value : `${pendingData}\n${value}`;
    } else if (line === "") {
      if (pendingData !== "") {
        events.push({ data: pendingData });
        pendingData = "";
        foundCompleteEvent = true;
      }
    } else if (line.startsWith("event: ") || line.startsWith("id: ") || line.startsWith(":")) {
      // Ignore event names, ids, and comments.
    } else {
      // Unrecognized line inside an event; keep it in the remaining buffer.
      remainingLines.push(rawLine);
    }
  }

  const remaining = foundCompleteEvent
    ? remainingLines.length > 0
      ? `${remainingLines.join("\n")}\n`
      : ""
    : buffer;

  return { events, remaining };
}

export function parseOpenAIChunk(data: string): {
  textDelta?: string;
  reasoningDelta?: string;
  finishReason?: string;
} {
  if (data === "[DONE]") {
    return { finishReason: "stop" };
  }

  try {
    const parsed = JSON.parse(data) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const payload = parsed as Record<string, unknown>;
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      return {};
    }

    const firstChoice = choices[0] as Record<string, unknown>;
    const delta = firstChoice.delta as Record<string, unknown> | undefined;
    const finishReason = firstChoice.finish_reason;

    const result: {
      textDelta?: string;
      reasoningDelta?: string;
      finishReason?: string;
    } = {};

    if (typeof finishReason === "string") {
      result.finishReason = finishReason;
    }

    if (!delta) {
      return result;
    }

    if (typeof delta.content === "string") {
      result.textDelta = delta.content;
    }

    if (typeof delta.reasoning_content === "string") {
      result.reasoningDelta = delta.reasoning_content;
    }

    return result;
  } catch {
    return {};
  }
}

export function extractTextDelta(data: string): string | undefined {
  const parsed = parseOpenAIChunk(data);
  return parsed.textDelta;
}

function buildChatRequest(
  model: LanguageModel,
  messages: CoreMessage[],
): { url: string; init: RequestInit } {
  const url = `${model.baseURL.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: model.modelId,
    messages,
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (model.apiKey) {
    headers.Authorization = `Bearer ${model.apiKey}`;
  }

  return {
    url,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
  };
}

function parseApiErrorText(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (parsed && typeof parsed === "object") {
      const errorObject = (parsed as Record<string, unknown>).error;
      if (errorObject && typeof errorObject === "object") {
        const message = (errorObject as Record<string, unknown>).message;
        if (typeof message === "string") {
          return message;
        }
      }
    }
  } catch {
    // Ignore; use raw body.
  }

  const trimmed = bodyText.trim();
  return trimmed.length > 0 && trimmed.length < 200 ? trimmed : bodyText.slice(0, 200);
}

async function fetchChatCompletions(
  model: LanguageModel,
  messages: CoreMessage[],
  abortSignal?: AbortSignal,
): Promise<Response> {
  const { url, init } = buildChatRequest(model, messages);
  const requestInit = { ...init, signal: abortSignal };

  const providerEndpoint: ProviderEndpoint = {
    id: "",
    baseUrl: model.baseURL,
    apiKey: model.apiKey,
    connectionMode: "proxy",
  };

  if (model.connectionMode === "proxy") {
    return proxyFetch(providerEndpoint, url, requestInit);
  }

  try {
    return await fetch(url, requestInit);
  } catch {
    return proxyFetch(providerEndpoint, url, requestInit);
  }
}

export async function streamText(options: {
  model: LanguageModel;
  messages: CoreMessage[];
  abortSignal?: AbortSignal;
}): Promise<{ textStream: AsyncIterable<TextStreamPart> }> {
  const response = await fetchChatCompletions(options.model, options.messages, options.abortSignal);

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      // Ignore; body not available.
    }
    const detail = parseApiErrorText(bodyText);
    throw new Error(detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const textStream: AsyncIterable<TextStreamPart> = {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const { events, remaining } = parseSseBuffer(buffer);
          buffer = remaining;

          for (const event of events) {
            const parsed = parseOpenAIChunk(event.data);

            if (parsed.textDelta !== undefined) {
              yield { type: "text-delta", textDelta: parsed.textDelta };
            }

            if (parsed.reasoningDelta !== undefined) {
              // Reasoning deltas are explicitly dropped from the visible content.
              // Emit them as a separate part so consumers can ignore them.
              yield { type: "reasoning", reasoning: parsed.reasoningDelta };
            }

            if (parsed.finishReason) {
              yield { type: "finish", finishReason: parsed.finishReason };
              return;
            }
          }
        }

        yield { type: "finish", finishReason: "stop" };
      } finally {
        reader.releaseLock();
      }
    },
  };

  return { textStream };
}
