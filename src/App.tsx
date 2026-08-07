import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "#components/layout";
import ChatPage from "#pages/chat";
import SettingsPage from "#pages/settings";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
