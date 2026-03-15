import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface AppContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedMasechet: string | null;
  setSelectedMasechet: (masechet: string | null) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SIDEBAR_PINNED_KEY = 'sidebar-pinned';

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState("gemara");
  const [selectedMasechet, setSelectedMasechet] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_PINNED_KEY);
    return saved !== null ? saved === 'true' : false; // Default: auto-hide (unpinned)
  });

  // Save pinned state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_PINNED_KEY, String(isPinned));
  }, [isPinned]);

  const handleSetActiveTab = useCallback((tab: string) => setActiveTab(tab), []);
  const handleSetSelectedMasechet = useCallback((m: string | null) => setSelectedMasechet(m), []);
  const handleSetIsPinned = useCallback((p: boolean) => setIsPinned(p), []);

  const value = useMemo(() => ({
    activeTab,
    setActiveTab: handleSetActiveTab,
    selectedMasechet,
    setSelectedMasechet: handleSetSelectedMasechet,
    isPinned,
    setIsPinned: handleSetIsPinned,
  }), [activeTab, selectedMasechet, isPinned, handleSetActiveTab, handleSetSelectedMasechet, handleSetIsPinned]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
}
