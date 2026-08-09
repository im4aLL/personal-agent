"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { Switch } from "#components/ui/switch";
import {
  clearTavilyApiKey,
  loadFetchEnabled,
  loadTavilyApiKey,
  loadWebSearchEnabled,
  saveFetchEnabled,
  saveTavilyApiKey,
  saveWebSearchEnabled,
} from "#lib/config";

const TAVILY_API_KEY_URL = "https://app.tavily.com/home";

export function WebSearchTab() {
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setWebSearchEnabled(loadWebSearchEnabled());
    setFetchEnabled(loadFetchEnabled());
    setApiKey(loadTavilyApiKey() ?? "");
  }, []);

  const apiKeyError = touched && !apiKey.trim() ? "API key is required to enable web search." : "";

  function handleToggleWebSearch(enabled: boolean) {
    if (enabled && !loadTavilyApiKey()) {
      setTouched(true);
      toast.error("API key required", {
        description: "Enter and save a Tavily API key before enabling web search.",
      });
      return;
    }
    setWebSearchEnabled(enabled);
    saveWebSearchEnabled(enabled);
    toast.success(enabled ? "Web search enabled" : "Web search disabled");
  }

  function handleToggleFetch(enabled: boolean) {
    setFetchEnabled(enabled);
    saveFetchEnabled(enabled);
    toast.success(enabled ? "URL fetching enabled" : "URL fetching disabled");
  }

  function handleSaveKey(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!apiKey.trim()) return;
    saveTavilyApiKey(apiKey.trim());
    toast.success("Tavily key saved");
  }

  function handleClearKey() {
    clearTavilyApiKey();
    setApiKey("");
    setTouched(false);
    if (webSearchEnabled) {
      setWebSearchEnabled(false);
      saveWebSearchEnabled(false);
    }
    toast.success("Tavily key cleared");
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium">Web search</h3>
            <p className="text-sm text-muted-foreground">
              Let the agent search the web using your own Tavily API key.
            </p>
          </div>
          <Switch checked={webSearchEnabled} onCheckedChange={handleToggleWebSearch} />
        </div>

        <form onSubmit={handleSaveKey} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="web-search-api-key">Tavily API key</Label>
            <Input
              id="web-search-api-key"
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={Boolean(apiKeyError)}
              aria-describedby={apiKeyError ? "web-search-api-key-error" : undefined}
            />
            {apiKeyError && (
              <p id="web-search-api-key-error" className="text-sm text-destructive">
                {apiKeyError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Don't have a key?{" "}
              <a
                href={TAVILY_API_KEY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Get a Tavily API key
              </a>
              .
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={handleClearKey}>
              Clear
            </Button>
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <div>
          <h3 className="text-base font-medium">URL fetching</h3>
          <p className="text-sm text-muted-foreground">
            Let the agent fetch and read the content of URLs you paste or reference.
          </p>
        </div>
        <Switch checked={fetchEnabled} onCheckedChange={handleToggleFetch} />
      </div>
    </div>
  );
}
