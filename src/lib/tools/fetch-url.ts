import { Readability } from "@mozilla/readability";
import { tool } from "ai";
import { parseHTML } from "linkedom";
import { z } from "zod";
import { proxyRequest } from "#lib/tools/proxy-request";

const MAX_CONTENT_LENGTH = 8000;

export function createFetchUrlTool() {
  return tool({
    description:
      "Fetch a web page by URL and return its readable text content. Use this when the " +
      "user references a URL or you need the actual content of a specific page.",
    inputSchema: z.object({
      url: z.string().url().describe("The absolute URL to fetch, including https://"),
    }),
    execute: async ({ url }) => {
      let response: { status: number; body: string };
      try {
        response = await proxyRequest("GET", url, { Accept: "text/html" });
      } catch (error) {
        return { error: `Failed to fetch ${url}: ${toErrorMessage(error)}` };
      }

      if (response.status < 200 || response.status >= 300) {
        return { error: `Fetching ${url} returned HTTP ${response.status}.` };
      }

      let extracted: { title: string | null; content: string } | null = null;
      try {
        const { document } = parseHTML(response.body);
        const article = new Readability(document).parse();
        const text = article?.textContent?.trim();
        if (text) {
          extracted = {
            title: article?.title ?? null,
            content: truncate(text, MAX_CONTENT_LENGTH),
          };
        }
      } catch {
        // Not (extractable) HTML - fall through to the raw-text fallback below.
      }

      if (extracted) {
        return { url, ...extracted };
      }

      const raw = response.body.trim();
      if (!raw) {
        return { error: `Could not extract readable content from ${url}.` };
      }

      return { url, title: null, content: truncate(raw, MAX_CONTENT_LENGTH) };
    },
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated at ${maxLength} characters]`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
