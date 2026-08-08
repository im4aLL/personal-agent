import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "#components/layout";
import ChatPage from "#pages/chat";
import SettingsPage from "#pages/settings";
import { runMigrations } from "#lib/turso-repository";
import { getTursoConfig } from "#lib/turso";
import { useAgentsStore } from "#store/agents";
import { useChatStore } from "#store/chat";

function MigrationRunner({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const config = getTursoConfig();
    if (!config) {
      onDone();
      return;
    }

    runMigrations()
      .then(() => onDone())
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Migration failed";
        toast.error("Migration failed", { description: message });
        onDone();
      });
  }, [onDone]);

  return null;
}

function HistoryLoader() {
  const loadHistory = useChatStore((state) => state.loadHistory);
  const historyError = useChatStore((state) => state.historyError);
  const loadProviderSyncKey = useChatStore((state) => state.loadProviderSyncKey);

  useEffect(() => {
    void loadHistory();
    void loadProviderSyncKey();
  }, [loadHistory, loadProviderSyncKey]);

  useEffect(() => {
    if (historyError) {
      toast.error("Failed to load history", {
        description: historyError,
      });
    }
  }, [historyError]);

  return null;
}

function AgentsLoader() {
  const loadFromTurso = useAgentsStore((state) => state.loadFromTurso);
  const error = useAgentsStore((state) => state.error);

  useEffect(() => {
    void loadFromTurso();
  }, [loadFromTurso]);

  useEffect(() => {
    if (error) {
      toast.error("Failed to load agents", {
        description: error,
      });
    }
  }, [error]);

  return null;
}

function DataLoaders() {
  const [migrationsReady, setMigrationsReady] = useState(false);

  if (!migrationsReady) {
    return <MigrationRunner onDone={() => setMigrationsReady(true)} />;
  }

  return (
    <>
      <HistoryLoader />
      <AgentsLoader />
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DataLoaders />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
