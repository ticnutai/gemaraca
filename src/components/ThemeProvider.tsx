import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "classic" | "midnight" | "royal" | "custom";

export interface CustomColors {
  background: string;
  primary: string;
  accent: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  customColors: CustomColors;
  setCustomColors: (colors: CustomColors) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "gemara-theme";
const CUSTOM_COLORS_KEY = "gemara-custom-colors";

export const themes: { id: Theme; name: string; description: string }[] = [
  { id: "classic", name: "קלאסי", description: "קרם וזהב - יוקרתי ונקי" },
  { id: "midnight", name: "חצות", description: "כהה עם נגיעות זהב" },
  { id: "royal", name: "מלכותי", description: "כחול עמוק וכסף" },
  { id: "custom", name: "מותאם אישית", description: "בחר צבעים משלך" },
];

const defaultCustomColors: CustomColors = {
  background: "#f5f5f0",
  primary: "#1e3a5f",
  accent: "#d4a853",
};

// Convert hex to HSL
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 50%";
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Determine if color is light or dark
function isLightColor(hex: string): boolean {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return true;
  
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function applyCustomColors(colors: CustomColors) {
  const root = document.documentElement;
  const bgHSL = hexToHSL(colors.background);
  const primaryHSL = hexToHSL(colors.primary);
  const accentHSL = hexToHSL(colors.accent);
  
  const isBgLight = isLightColor(colors.background);
  const isPrimaryLight = isLightColor(colors.primary);
  
  // Background colors
  root.style.setProperty('--background', bgHSL);
  root.style.setProperty('--card', bgHSL);
  root.style.setProperty('--popover', bgHSL);
  root.style.setProperty('--sidebar-background', bgHSL);
  
  // Foreground colors (opposite of background)
  const fgHSL = isBgLight ? hexToHSL(colors.primary) : "0 0% 95%";
  root.style.setProperty('--foreground', fgHSL);
  root.style.setProperty('--card-foreground', fgHSL);
  root.style.setProperty('--popover-foreground', fgHSL);
  root.style.setProperty('--sidebar-foreground', fgHSL);
  
  // Primary colors
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--primary-foreground', isPrimaryLight ? "220 25% 10%" : "0 0% 98%");
  root.style.setProperty('--sidebar-primary', primaryHSL);
  
  // Accent colors
  root.style.setProperty('--accent', accentHSL);
  root.style.setProperty('--ring', accentHSL);
  root.style.setProperty('--sidebar-ring', accentHSL);
  
  // Muted and secondary (derived)
  const mutedLightness = isBgLight ? "90%" : "18%";
  root.style.setProperty('--muted', `${bgHSL.split(' ')[0]} 20% ${mutedLightness}`);
  root.style.setProperty('--muted-foreground', isBgLight ? "220 15% 45%" : "220 10% 60%");
  root.style.setProperty('--secondary', `${bgHSL.split(' ')[0]} 25% ${isBgLight ? '88%' : '20%'}`);
  root.style.setProperty('--border', `${primaryHSL.split(' ')[0]} 20% ${isBgLight ? '80%' : '25%'}`);
  root.style.setProperty('--input', `${bgHSL.split(' ')[0]} 25% ${isBgLight ? '92%' : '18%'}`);
}

function clearCustomColors() {
  const root = document.documentElement;
  const props = [
    '--background', '--foreground', '--card', '--card-foreground', '--popover', 
    '--popover-foreground', '--primary', '--primary-foreground', '--secondary',
    '--secondary-foreground', '--muted', '--muted-foreground', '--accent',
    '--accent-foreground', '--border', '--input', '--ring', '--sidebar-background',
    '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
    '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring'
  ];
  props.forEach(prop => root.style.removeProperty(prop));
}

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

  const [customColors, setCustomColorsState] = useState<CustomColors>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CUSTOM_COLORS_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return defaultCustomColors;
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    
    // Remove all theme classes
    document.documentElement.classList.remove("theme-classic", "theme-midnight", "theme-royal", "theme-custom");
    
    if (theme === "custom") {
      clearCustomColors();
      applyCustomColors(customColors);
      document.documentElement.classList.add("theme-custom");
    } else {
      clearCustomColors();
      document.documentElement.classList.add(`theme-${theme}`);
    }
  }, [theme, customColors]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setCustomColors = (colors: CustomColors) => {
    setCustomColorsState(colors);
    localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors, setCustomColors }}>
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
