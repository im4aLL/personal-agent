"use client";

import { DatabaseIcon } from "lucide-react";
import { Button } from "#components/ui/button";

export function DatabaseRequirement({ onNavigateToData }: { onNavigateToData: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed p-4">
      <DatabaseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Memory storage requires a configured Turso database. Connect one in the Data tab.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onNavigateToData}>
          Go to Data tab
        </Button>
      </div>
    </div>
  );
}
