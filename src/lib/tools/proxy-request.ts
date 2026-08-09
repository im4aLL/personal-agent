import { invoke } from "@tauri-apps/api/core";

export type ProxyRequestResult = {
  status: number;
  body: string;
};

/**
 * Makes a one-off HTTP request through the Rust backend's `proxy` command
 * instead of the webview's `fetch`. This avoids browser CORS entirely (Rust's
 * reqwest client isn't subject to it), which matters here since tool calls hit
 * third-party APIs and arbitrary pages that don't set permissive CORS headers.
 */
export async function proxyRequest(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: string,
): Promise<ProxyRequestResult> {
  return invoke<ProxyRequestResult>("proxy", {
    request: { method, url, headers, body },
  });
}
