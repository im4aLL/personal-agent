import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { Layout } from "#components/layout";
import ChatPage from "#pages/chat";
import SettingsPage from "#pages/settings";
import { useChatStore } from "#store/chat";

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

export default function App() {
  return (
    <HashRouter>
      <HistoryLoader />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
