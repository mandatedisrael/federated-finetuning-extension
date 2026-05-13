"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type Surface = "friendly" | "technical";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  surface: Surface;
  setTheme: (t: Theme) => void;
  setSurface: (s: Surface) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const THEME_KEY = "ffe:theme";
const SURFACE_KEY = "ffe:surface";
const THEME_COOKIE = "ffe-theme";
const SURFACE_COOKIE = "ffe-surface";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function applyAttributes(theme: Theme, surface: Surface) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (theme === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", theme);
  }
  html.setAttribute("data-surface", surface);
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultSurface = "friendly",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultSurface?: Surface;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [surface, setSurfaceState] = React.useState<Surface>(defaultSurface);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const storedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? defaultTheme;
    const storedSurface =
      (localStorage.getItem(SURFACE_KEY) as Surface | null) ?? defaultSurface;
    setThemeState(storedTheme);
    setSurfaceState(storedSurface);
    const resolved = storedTheme === "system" ? getSystemTheme() : storedTheme;
    setResolvedTheme(resolved);
    applyAttributes(storedTheme, storedSurface);
  }, [defaultTheme, defaultSurface]);

  React.useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setResolvedTheme(mql.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback(
    (next: Theme) => {
      setThemeState(next);
      localStorage.setItem(THEME_KEY, next);
      if (next === "system") {
        clearCookie(THEME_COOKIE);
      } else {
        writeCookie(THEME_COOKIE, next);
      }
      const resolved = next === "system" ? getSystemTheme() : next;
      setResolvedTheme(resolved);
      applyAttributes(next, surface);
    },
    [surface],
  );

  const setSurface = React.useCallback(
    (next: Surface) => {
      setSurfaceState(next);
      localStorage.setItem(SURFACE_KEY, next);
      writeCookie(SURFACE_COOKIE, next);
      applyAttributes(theme, next);
    },
    [theme],
  );

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, surface, setTheme, setSurface }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
