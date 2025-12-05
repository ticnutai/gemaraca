import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "classic" | "midnight" | "royal";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "gemara-theme";

export const themes: { id: Theme; name: string; description: string }[] = [
  { id: "classic", name: "קלאסי", description: "קרם וזהב - יוקרתי ונקי" },
  { id: "midnight", name: "חצות", description: "כהה עם נגיעות זהב" },
  { id: "royal", name: "מלכותי", description: "כחול עמוק וכסף" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      if (saved && themes.find(t => t.id === saved)) {
        return saved;
      }
    }
    return "classic";
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Remove all theme classes
    document.documentElement.classList.remove("theme-classic", "theme-midnight", "theme-royal");
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
