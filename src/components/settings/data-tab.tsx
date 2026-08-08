"use client";

import { CheckCircleIcon, CircleAlertIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { clearTursoConfig, loadTursoToken, loadTursoUrl, saveTursoConfig } from "#lib/config";
import { getTursoConfig, tursoSelect } from "#lib/turso";

type ConnectionStatus = "idle" | "checking" | "connected" | "failed";

export function DataTab() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const savedUrl = loadTursoUrl();
    const savedToken = loadTursoToken();
    if (savedUrl) setUrl(savedUrl);
    if (savedToken) setToken(savedToken);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (url && token) {
      setStatus("idle");
    } else {
      setStatus("idle");
    }
  }, [url, token, initialized]);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    saveTursoConfig(url.trim(), token.trim());
    toast.success("Turso config saved", {
      description: "Database credentials have been stored.",
    });
    setStatus("idle");
  }

  function handleClear() {
    clearTursoConfig();
    setUrl("");
    setToken("");
    setStatus("idle");
    toast.success("Turso config cleared");
  }

  async function handleTestConnection() {
    setStatus("checking");
    try {
      const config = getTursoConfig();
      if (!config) {
        setStatus("failed");
        return;
      }
      await tursoSelect("SELECT 1");
      setStatus("connected");
      toast.success("Connection successful");
    } catch (error) {
      setStatus("failed");
      toast.error("Connection failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  function renderStatusBadge() {
    switch (status) {
      case "checking":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <Loader2Icon className="size-3.5 animate-spin" />
            Checking...
          </span>
        );
      case "connected":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircleIcon className="size-3.5" />
            Connected
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <XCircleIcon className="size-3.5" />
            Connection failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleAlertIcon className="size-3.5" />
            Not connected
          </span>
        );
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <h3 className="text-base font-medium">Turso Database</h3>
        <p className="text-sm text-muted-foreground">
          Connect to a Turso database for persistent storage.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Status:</span>
        {renderStatusBadge()}
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="turso-url">Turso URL</Label>
          <Input
            id="turso-url"
            placeholder="libsql://...turso.io"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="turso-token">Auth Token</Label>
          <Input
            id="turso-token"
            type="password"
            placeholder="eyJ..."
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="outline" onClick={handleTestConnection}>
          Test Connection
        </Button>
        <Button type="button" variant="ghost" onClick={handleClear}>
          Clear
        </Button>
      </div>
    </form>
  );
}
