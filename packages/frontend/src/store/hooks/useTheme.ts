import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "flashSale.theme";

export type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Owns the light/dark theme choice: defaults to any explicit prior choice,
 * else the OS preference, and reflects the result onto <html data-theme>
 * so styles.css can key off it (index.html sets the same attribute inline,
 * before paint, to avoid a flash of the wrong theme on load).
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
