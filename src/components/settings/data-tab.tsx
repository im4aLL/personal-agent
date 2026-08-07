"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";

interface DataTabProps {
  initialUrl?: string;
  initialToken?: string;
}

export function DataTab({ initialUrl = "", initialToken = "" }: DataTabProps) {
  const [url, setUrl] = useState(initialUrl);
  const [token, setToken] = useState(initialToken);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    toast("Coming soon", {
      description: "Saving Turso config is not implemented yet.",
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <h3 className="text-base font-medium">Turso Database</h3>
        <p className="text-sm text-muted-foreground">
          Connect to a Turso database for persistent storage.
        </p>
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

      <Button type="submit">Save Turso config</Button>
    </form>
  );
}
