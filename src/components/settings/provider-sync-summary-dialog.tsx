"use client";

import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import type { MergeSummary } from "#lib/providerSync";

interface ProviderSyncSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: MergeSummary | null;
  onConfirm: () => void;
}

export function ProviderSyncSummaryDialog({
  open,
  onOpenChange,
  summary,
  onConfirm,
}: ProviderSyncSummaryDialogProps) {
  const imports = summary?.imports ?? [];
  const overwrites = summary?.overwrites ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync summary</DialogTitle>
          <DialogDescription>
            Review the changes that will be applied based on the most recent edit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {imports.length === 0 && overwrites.length === 0 && (
            <p className="text-sm text-muted-foreground">No changes to apply.</p>
          )}

          {imports.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-sm font-medium">Import from cloud</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {imports.map((provider) => (
                  <li key={provider.id}>{provider.label}</li>
                ))}
              </ul>
            </div>
          )}

          {overwrites.length > 0 && (
            <div className="grid gap-2">
              <h4 className="text-sm font-medium">Overwrite local copy</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {overwrites.map((provider) => (
                  <li key={provider.id}>{provider.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Apply changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
