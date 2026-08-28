import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeContextValue = {
  isDark: boolean;
  setDark: (dark: boolean) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const getInitial = () => {
    try {
      const stored = localStorage.getItem('nexa_theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch { /* ignore */ }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  };

  const [isDark, setIsDark] = useState<boolean>(getInitial);

  useEffect(() => {
    try { localStorage.setItem('nexa_theme', isDark ? 'dark' : 'light'); } catch {}
    const el = document.documentElement;
    if (isDark) el.classList.add('dark'); else el.classList.remove('dark');
  }, [isDark]);

  const value: ThemeContextValue = {
    isDark,
    setDark: (d: boolean) => setIsDark(d),
    toggleTheme: () => setIsDark(prev => !prev),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
