"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { loadChatFixedWidth, saveChatFixedWidth } from "#lib/config";

type ChatWidthProviderState = {
  fixedWidth: boolean;
  setFixedWidth: (fixedWidth: boolean) => void;
};

const ChatWidthProviderContext = createContext<ChatWidthProviderState | undefined>(undefined);

export function ChatWidthProvider({ children }: { children: React.ReactNode }) {
  const [fixedWidth, setFixedWidthState] = useState(() => loadChatFixedWidth());

  const setFixedWidth = useCallback((value: boolean) => {
    saveChatFixedWidth(value);
    setFixedWidthState(value);
  }, []);

  return (
    <ChatWidthProviderContext.Provider value={{ fixedWidth, setFixedWidth }}>
      {children}
    </ChatWidthProviderContext.Provider>
  );
}

export function useChatWidth() {
  const context = useContext(ChatWidthProviderContext);
  if (context === undefined) {
    throw new Error("useChatWidth must be used within a ChatWidthProvider");
  }
  return context;
}
