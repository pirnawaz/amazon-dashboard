import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { isDemoMode as getDemoMode, setDemoMode as setDemoStorage, clearDemoMode as clearDemoStorage } from "../utils/preferences";

type DemoContextValue = {
  isDemoMode: boolean;
  setDemoMode: () => void;
  clearDemoMode: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(getDemoMode);

  const setDemoMode = useCallback(() => {
    setDemoStorage();
    setDemoModeState(true);
  }, []);

  const clearDemoMode = useCallback(() => {
    clearDemoStorage();
    setDemoModeState(false);
  }, []);

  useEffect(() => {
    const sync = () => setDemoModeState(getDemoMode());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value: DemoContextValue = {
    isDemoMode: demoMode,
    setDemoMode,
    clearDemoMode,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) return { isDemoMode: getDemoMode(), setDemoMode: setDemoStorage, clearDemoMode: clearDemoStorage };
  return ctx;
}
