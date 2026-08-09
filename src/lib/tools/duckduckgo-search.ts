import { invoke } from "@tauri-apps/api/core";
import { tool } from "ai";
import { z } from "zod";
import { type SearchWindowOutput, toErrorMessage } from "#lib/tools/search-window";

/**
 * Opens DuckDuckGo in a dedicated app window and lets the user perform the
 * search manually (handling any captcha/anomaly page). Mirrors the Google
 * search window tool, using the static html.duckduckgo.com layout.
 */
export function createDuckDuckGoSearchTool() {
  return tool({
    description:
      "Open DuckDuckGo in a dedicated app window for the given query and let the " +
      "user perform the search manually (handling any captcha). The tool call " +
      "waits until the user clicks the floating 'Done - send results' button in " +
      "that window (it shows 'Sending...' and the window closes automatically " +
      "once the results are collected), then returns the visible result links " +
      "under 'results' plus page info (title, url) under 'page'. If no result " +
      "links could be parsed, 'page.pageText' contains the visible page text. " +
      "Use this when the user wants a DuckDuckGo search, API-based web search " +
      "failed or is unavailable, or the user explicitly asks for a browser " +
      "search window. After collecting results, use the fetchUrl tool on any " +
      "promising 'url' to read the full page content before answering.",
    inputSchema: z.object({
      query: z.string().describe("The search query to open in DuckDuckGo"),
    }),
    execute: async ({ query }) => {
      try {
        await invoke("duckduckgo_search", { query });
        return await invoke<SearchWindowOutput>("collect_duckduckgo_results", {});
      } catch (error) {
        return { error: toErrorMessage(error) };
      }
    },
  });
}
