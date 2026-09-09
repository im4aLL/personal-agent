"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DatabaseRequirement } from "#components/settings/database-requirement";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { Switch } from "#components/ui/switch";
import {
  DEFAULT_MEMORY_TOKEN_CAP,
  loadLongTermMemoryEnabled,
  loadMemoryEnabled,
  loadMemoryTokenCap,
  loadShortTermMemoryEnabled,
  MAX_MEMORY_TOKEN_CAP,
  MIN_MEMORY_TOKEN_CAP,
  saveLongTermMemoryEnabled,
  saveMemoryEnabled,
  saveMemoryTokenCap,
  saveShortTermMemoryEnabled,
} from "#lib/config";
import { clearMemories } from "#lib/memory-repository";
import { getTursoConfig } from "#lib/turso";

export function PreferencesTab({ onNavigateToData }: { onNavigateToData: () => void }) {
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [shortTermEnabled, setShortTermEnabled] = useState(true);
  const [longTermEnabled, setLongTermEnabled] = useState(true);
  const [tokenCap, setTokenCap] = useState(String(DEFAULT_MEMORY_TOKEN_CAP));
  const [capTouched, setCapTouched] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [tursoConfigured, setTursoConfigured] = useState(false);

  useEffect(() => {
    setMemoryEnabled(loadMemoryEnabled());
    setShortTermEnabled(loadShortTermMemoryEnabled());
    setLongTermEnabled(loadLongTermMemoryEnabled());
    setTokenCap(String(loadMemoryTokenCap()));
    setTursoConfigured(getTursoConfig() !== null);

    // Turso can be connected mid-session (Data section); re-check when the
    // window regains focus so the banner clears without a manual remount.
    const refreshTursoStatus = () => setTursoConfigured(getTursoConfig() !== null);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshTursoStatus();
    };
    window.addEventListener("focus", refreshTursoStatus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refreshTursoStatus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const capError =
    capTouched && !isValidCapInput(tokenCap)
      ? `Enter a whole number between ${MIN_MEMORY_TOKEN_CAP} and ${MAX_MEMORY_TOKEN_CAP}.`
      : "";

  function handleToggleMemory(enabled: boolean) {
    setMemoryEnabled(enabled);
    saveMemoryEnabled(enabled);
    toast.success(enabled ? "Memory enabled" : "Memory disabled", {
      description: enabled
        ? "The agent can now use remember and recall tools."
        : "Existing memories are kept and become available again if memory is re-enabled.",
    });
  }

  function handleToggleShortTerm(enabled: boolean) {
    setShortTermEnabled(enabled);
    saveShortTermMemoryEnabled(enabled);
    toast.success(enabled ? "Short-term memory enabled" : "Short-term memory disabled");
  }

  function handleToggleLongTerm(enabled: boolean) {
    setLongTermEnabled(enabled);
    saveLongTermMemoryEnabled(enabled);
    toast.success(enabled ? "Long-term memory enabled" : "Long-term memory disabled");
  }

  function handleCapChange(value: string) {
    setTokenCap(value);
    if (isValidCapInput(value)) {
      saveMemoryTokenCap(Number(value));
    }
  }

  function handleCapBlur() {
    setCapTouched(true);
    if (!isValidCapInput(tokenCap)) {
      setTokenCap(String(loadMemoryTokenCap()));
    }
  }

  async function handleConfirmClear() {
    setIsClearing(true);
    try {
      await clearMemories();
      toast.success("Memories cleared", {
        description: "All short-term and long-term memories were removed.",
      });
      setClearConfirmOpen(false);
    } catch (error) {
      toast.error("Failed to clear memories", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-medium">Memory</h3>
            <p className="text-sm text-muted-foreground">
              Let the agent store and recall facts with remember and recall tools. Memory is
              model-controlled and is never injected into every prompt - the agent calls recall only
              when prior context seems relevant. Requires configured Turso storage.
            </p>
          </div>
          <Switch checked={memoryEnabled} onCheckedChange={handleToggleMemory} />
        </div>

        {!tursoConfigured && <DatabaseRequirement onNavigateToData={onNavigateToData} />}
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <div>
          <h3 className="text-base font-medium">Short-term memory</h3>
          <p className="text-sm text-muted-foreground">
            Remember facts scoped to the current conversation. Removed when the conversation is
            deleted.
          </p>
        </div>
        <Switch
          checked={shortTermEnabled}
          onCheckedChange={handleToggleShortTerm}
          disabled={!memoryEnabled}
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <div>
          <h3 className="text-base font-medium">Long-term memory</h3>
          <p className="text-sm text-muted-foreground">
            Remember facts shared across all conversations in this Turso database.
          </p>
        </div>
        <Switch
          checked={longTermEnabled}
          onCheckedChange={handleToggleLongTerm}
          disabled={!memoryEnabled}
        />
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="grid gap-2">
          <Label htmlFor="memory-token-cap">Maximum recall result size (tokens)</Label>
          <Input
            id="memory-token-cap"
            type="number"
            min={MIN_MEMORY_TOKEN_CAP}
            max={MAX_MEMORY_TOKEN_CAP}
            value={tokenCap}
            disabled={!memoryEnabled}
            onChange={(event) => handleCapChange(event.target.value)}
            onBlur={handleCapBlur}
            aria-invalid={Boolean(capError)}
            aria-describedby={capError ? "memory-token-cap-error" : undefined}
          />
          {capError && (
            <p id="memory-token-cap-error" className="text-sm text-destructive">
              {capError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Bounds the estimated tokens in a single recall result, including labels and separators.
            Default {DEFAULT_MEMORY_TOKEN_CAP}.
          </p>
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div>
          <h3 className="text-base font-medium">Clear memories</h3>
          <p className="text-sm text-muted-foreground">
            Remove all stored short-term and long-term memories. This cannot be undone.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setClearConfirmOpen(true)}>
          Clear memories
        </Button>
      </div>

      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all memories?</DialogTitle>
            <DialogDescription>
              This removes every stored short-term and long-term memory. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmClear()}
              disabled={isClearing}
            >
              {isClearing ? "Clearing..." : "Clear all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isValidCapInput(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = Number(value);
  return (
    Number.isInteger(parsed) && parsed >= MIN_MEMORY_TOKEN_CAP && parsed <= MAX_MEMORY_TOKEN_CAP
  );
}
