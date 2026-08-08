import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/**
 * Sanitize a string for use as a filename.
 * Strips path separators, control characters, and other unsafe chars.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 255)
    .trim() || "untitled";
}

/**
 * Extended variant that also strips hashes (#), newlines, and collapses whitespace.
 * Useful for deriving filenames from AI-generated code block content hints.
 */
export function sanitizeLanguageHint(hint: string): string {
  return hint
    .replace(/[/\\:*?"<>|#\n\r]/g, " ")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64) || "text";
}

/**
 * Determine file extension from a MIME type.
 */
function extFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/json": "json",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/html": "html",
    "text/csv": "csv",
  };
  return mimeToExt[mimeType] ?? "bin";
}

/**
 * Map an extension to a file filter for the save dialog.
 */
function filterForExt(ext: string): { name: string; extensions: string[] } {
  const filterMap: Record<string, { name: string; extensions: string[] }> = {
    png: { name: "PNG Image", extensions: ["png"] },
    jpg: { name: "JPEG Image", extensions: ["jpg", "jpeg"] },
    gif: { name: "GIF Image", extensions: ["gif"] },
    webp: { name: "WebP Image", extensions: ["webp"] },
    svg: { name: "SVG Image", extensions: ["svg"] },
    pdf: { name: "PDF Document", extensions: ["pdf"] },
    zip: { name: "ZIP Archive", extensions: ["zip"] },
    json: { name: "JSON", extensions: ["json"] },
    txt: { name: "Text", extensions: ["txt"] },
    md: { name: "Markdown", extensions: ["md"] },
    html: { name: "HTML", extensions: ["html"] },
    csv: { name: "CSV", extensions: ["csv"] },
  };
  return filterMap[ext] ?? { name: "File", extensions: [ext] };
}

async function writeFile(dest: string, contents: Uint8Array): Promise<void> {
  await invoke("write_file", { dest, contents: Array.from(contents) });
}

/**
 * Show a save dialog and write a string as a file.
 * Returns true if the file was saved, false if the user cancelled.
 */
export async function downloadString(
  content: string,
  defaultName: string,
  mimeType: string,
): Promise<boolean> {
  const ext = extFromMime(mimeType);
  const filter = filterForExt(ext);
  const filename = sanitizeFilename(defaultName);

  const dest = await save({
    defaultPath: `${filename}.${ext}`,
    filters: [filter],
  });

  if (!dest) return false;

  await writeFile(dest, new TextEncoder().encode(content));
  return true;
}

/**
 * Show a save dialog and write binary data as a file.
 * Returns true if the file was saved, false if the user cancelled.
 */
export async function downloadBytes(
  bytes: Uint8Array,
  defaultName: string,
  mimeType: string,
): Promise<boolean> {
  const ext = extFromMime(mimeType);
  const filter = filterForExt(ext);
  const filename = sanitizeFilename(defaultName);

  const dest = await save({
    defaultPath: `${filename}.${ext}`,
    filters: [filter],
  });

  if (!dest) return false;

  await writeFile(dest, bytes);
  return true;
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const match = /^data:(\w+\/[-+.\w]+)?(;base64)?,(.*)/i.exec(dataUrl);
  if (!match) return null;

  const mimeType = match[1] ?? "image/png";
  const isBase64 = match[2] === ";base64";
  const data = match[3];

  let bytes: Uint8Array;
  if (isBase64) {
    try {
      const binary = atob(data);
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(data));
  }

  return { bytes, mimeType };
}

/**
 * Download a remote URL via the Tauri proxy.
 * Shows a save dialog and writes the file.
 * Returns true if saved, false if cancelled or errored.
 */
export async function downloadViaProxy(
  url: string,
  fallbackName: string,
): Promise<boolean> {
  const resultStr: string = await invoke("proxy_bytes", {
    request: {
      method: "GET",
      url,
      headers: {},
      body: null,
    },
  });

  const result = JSON.parse(resultStr) as { data: string; contentType: string };
  const binary = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));

  return downloadBytes(binary, fallbackName, result.contentType);
}

/**
 * Download an image from a src attribute (handles both data: URLs and remote URLs).
 */
export async function downloadImage(
  src: string,
  fallbackName: string,
): Promise<boolean> {
  if (src.startsWith("data:")) {
    const parsed = dataUrlToBytes(src);
    if (!parsed) return false;
    return downloadBytes(parsed.bytes, fallbackName, parsed.mimeType);
  }

  return downloadViaProxy(src, fallbackName);
}
