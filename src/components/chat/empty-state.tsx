"use client";

import { MessageSquareIcon } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
        <MessageSquareIcon className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">Personal Agent</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Start a conversation or select one from the sidebar.
      </p>
    </div>
  );
}
