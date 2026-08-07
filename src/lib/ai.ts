import { Channel, invoke } from "@tauri-apps/api/core";

export type StreamChunk = string | { done: true } | { error: string };

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

/**
 * Custom fetch implementation for Tauri proxy streaming.
 * Matches the standard `fetch` signature so it can be passed
 * as the `fetch` option to the Vercel AI SDK's createOpenAICompatible.
 */
export async function proxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const mergedInit = input instanceof Request
    ? { method: input.method, headers: input.headers, body: input.body, signal: input.signal, ...init }
    : init;

  const abortId = createAbortId();
  const channel = new Channel<StreamChunk>();
  const headers = mergedInit ? recordHeaders(mergedInit) : {};

  const request: StreamRequest = {
    method: mergedInit?.method ?? "GET",
    url,
    headers,
    body: typeof mergedInit?.body === "string" ? mergedInit.body : undefined,
    abort_id: abortId,
  };

  let abortListener: (() => void) | null = null;

  const removeAbortListener = () => {
    if (abortListener && mergedInit?.signal) {
      mergedInit.signal.removeEventListener("abort", abortListener);
      abortListener = null;
    }
  };

  const response = createStreamResponse(channel, request, abortId, removeAbortListener);

  if (mergedInit?.signal) {
    abortListener = () => {
      invoke("abort_stream", { abortId }).catch(() => {});
    };
    mergedInit.signal.addEventListener("abort", abortListener);
  }

  return response;
}
