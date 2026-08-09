import { tool } from "ai";
import { z } from "zod";
import { proxyRequest } from "#lib/tools/proxy-request";

const MAX_RESULTS = 5;
const SNIPPET_MAX_LENGTH = 400;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type TavilyResponse = {
  results?: { title?: string; url?: string; content?: string }[];
};

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await proxyRequest(
    "POST",
    "https://api.tavily.com/search",
    { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    JSON.stringify({ query, max_results: MAX_RESULTS }),
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Tavily Search returned HTTP ${response.status}`);
  }

  const data = JSON.parse(response.body) as TavilyResponse;
  const results = data.results ?? [];

  return results.slice(0, MAX_RESULTS).map((result) => ({
    title: result.title ?? "",
    url: result.url ?? "",
    snippet: truncate(result.content ?? "", SNIPPET_MAX_LENGTH),
  }));
}

export function createWebSearchTool(apiKey: string) {
  return tool({
    description:
      "Search the web for current information. Use this when you need up-to-date facts, " +
      "news, or information that may not be in your training data. Follow up with " +
      "fetchUrl on a promising result if you need the full page content.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }) => {
      try {
        const results = await searchTavily(query, apiKey);

        if (results.length === 0) {
          return { results: [], message: "No results found." };
        }

        return { results };
      } catch (error) {
        return { error: `Web search failed: ${toErrorMessage(error)}` };
      }
    },
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
