// Shared types and helpers for the search-window tools (Google and
// DuckDuckGo). The Rust side returns these shapes from the
// collect_*_results commands.

export type SearchWindowResult = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchWindowPageInfo = {
  title: string;
  url: string;
  scrapedCount: number;
  pageText: string;
};

export type SearchWindowOutput = {
  results: SearchWindowResult[];
  page: SearchWindowPageInfo;
};

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
