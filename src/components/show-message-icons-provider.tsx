"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { loadShowMessageIcons, saveShowMessageIcons } from "#lib/config";

type ShowMessageIconsProviderState = {
  showMessageIcons: boolean;
  setShowMessageIcons: (value: boolean) => void;
};

const ShowMessageIconsContext = createContext<ShowMessageIconsProviderState | undefined>(undefined);

export function ShowMessageIconsProvider({ children }: { children: React.ReactNode }) {
  const [showMessageIcons, setShowMessageIconsState] = useState(() => loadShowMessageIcons());

  const setShowMessageIcons = useCallback((value: boolean) => {
    saveShowMessageIcons(value);
    setShowMessageIconsState(value);
  }, []);

  return (
    <ShowMessageIconsContext.Provider value={{ showMessageIcons, setShowMessageIcons }}>
      {children}
    </ShowMessageIconsContext.Provider>
  );
}

export function useShowMessageIcons() {
  const context = useContext(ShowMessageIconsContext);
  if (context === undefined) {
    throw new Error("useShowMessageIcons must be used within a ShowMessageIconsProvider");
  }
  return context;
}
