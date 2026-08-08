"use client";

import { useState } from "react";
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
import * as providerEncryption from "#lib/providerEncryption";

export type ProviderSyncSetupMode = "passphrase" | "recovery";

export type ProviderSyncSetupResult =
  | { mode: "passphrase"; passphrase: string }
  | { mode: "recovery"; recoveryKey: string };

interface ProviderSyncSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (result: ProviderSyncSetupResult) => void;
}

export function ProviderSyncSetupDialog({
  open,
  onOpenChange,
  onSubmit,
}: ProviderSyncSetupDialogProps) {
  const [mode, setMode] = useState<ProviderSyncSetupMode>("recovery");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  function reset() {
    setMode("recovery");
    setPassphrase("");
    setConfirmPassphrase("");
    setRecoveryKey(null);
    setIsGenerating(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  }

  async function handleGenerateKey() {
    setIsGenerating(true);
    try {
      const { recoveryKey: generated } = await providerEncryption.generateRandomKey();
      setRecoveryKey(generated);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSubmit() {
    if (mode === "passphrase") {
      if (!passphrase) {
        return;
      }
      onSubmit({ mode: "passphrase", passphrase });
      reset();
      return;
    }

    if (!recoveryKey) {
      return;
    }

    onSubmit({ mode: "recovery", recoveryKey });
    reset();
  }

  const passphraseError =
    passphrase && confirmPassphrase && passphrase !== confirmPassphrase
      ? "Passphrases do not match."
      : "";
  const canSubmit =
    mode === "passphrase"
      ? Boolean(passphrase) && passphrase === confirmPassphrase
      : Boolean(recoveryKey);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enable provider sync</DialogTitle>
          <DialogDescription>
            Choose how to encrypt your provider API keys before they leave this device.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="sync-mode" className="text-sm font-medium">
                Use a passphrase
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter the same passphrase on each device.
              </p>
            </div>
            <Switch
              id="sync-mode"
              checked={mode === "passphrase"}
              onCheckedChange={(checked) => {
                setMode(checked ? "passphrase" : "recovery");
                setRecoveryKey(null);
              }}
            />
          </div>

          {mode === "passphrase" ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sync-passphrase">Passphrase</Label>
                <Input
                  id="sync-passphrase"
                  type="password"
                  placeholder="Enter a strong passphrase"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sync-confirm-passphrase">Confirm passphrase</Label>
                <Input
                  id="sync-confirm-passphrase"
                  type="password"
                  placeholder="Re-enter the passphrase"
                  value={confirmPassphrase}
                  onChange={(event) => setConfirmPassphrase(event.target.value)}
                  aria-invalid={Boolean(passphraseError)}
                />
                {passphraseError && <p className="text-sm text-destructive">{passphraseError}</p>}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {recoveryKey ? (
                <div className="grid gap-2">
                  <Label htmlFor="sync-recovery-key">Recovery key</Label>
                  <p className="text-xs text-muted-foreground">
                    Save this key somewhere safe. You will need it on other devices.
                  </p>
                  <Input
                    id="sync-recovery-key"
                    readOnly
                    value={recoveryKey}
                    onFocus={(event) => event.target.select()}
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Generating..." : "Generate recovery key"}
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enable sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
