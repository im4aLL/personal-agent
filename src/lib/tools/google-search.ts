import { invoke } from "@tauri-apps/api/core";
import { tool } from "ai";
import { z } from "zod";
import { type SearchWindowOutput, toErrorMessage } from "#lib/tools/search-window";

/**
 * Opens Google in a dedicated app window and lets the user perform the search
 * manually. This works where API-based search does not: the user's real Google
 * session (login, consent, captcha) is handled by a human in the browser
 * window, and only the visible result links are returned.
 */
export function createGoogleSearchTool() {
  return tool({
    description:
      "Open Google in a dedicated app window for the given query and let the user " +
      "perform the search manually (handling logins or captchas). The tool call " +
      "waits until the user clicks the floating 'Done - send results' button in " +
      "that window (it shows 'Sending...' and the window closes automatically once " +
      "the results are collected), then returns the visible result links under " +
      "'results' plus page info (title, url) under 'page'. If no result links " +
      "could be parsed, 'page.pageText' contains the visible page text. Use this " +
      "when the user must be signed in to search, API-based web search failed or " +
      "is unavailable, or the user explicitly asks to search on Google. After " +
      "collecting results, use the fetchUrl tool on any promising 'url' to read " +
      "the full page content before answering.",
    inputSchema: z.object({
      query: z.string().describe("The search query to open in Google"),
    }),
    execute: async ({ query }) => {
      try {
        await invoke("google_search", { query });
        return await invoke<SearchWindowOutput>("collect_google_results", {});
      } catch (error) {
        return { error: toErrorMessage(error) };
      }
    },
  });
}
