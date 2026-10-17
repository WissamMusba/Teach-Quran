'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Sun, Moon } from 'lucide-react';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sdca_theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
        applyTheme(stored);
      } else {
        // Default to dark signature aesthetic
        setThemeState('dark');
        applyTheme('dark');
      }
    } catch {
      // Storage access fail-safe
    }
    setMounted(true);
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    if (t === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  };

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      localStorage.setItem('sdca_theme', newTheme);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme, mounted }),
    [theme, toggleTheme, setTheme, mounted]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode (White, Orange & Black)' : 'Switch to dark mode (Pitch Black & Orange)'}
      className={`group relative inline-flex items-center space-x-2 p-2 sm:px-3 sm:py-2 rounded-xl border transition-all duration-200 active:scale-95 ${
        isDark
          ? 'bg-[#121217] hover:bg-[#1A1A22] border-[#26262E] text-neutral-300 hover:text-white hover:border-[#FF5500]/60'
          : 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black hover:border-[#FF5500]/60 shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#FF5500] transition-transform duration-300 group-hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-[#FF5500] transition-transform duration-300 group-hover:-rotate-12" />
        )}
      </div>
      {showLabel && (
        <span className="text-xs font-black uppercase tracking-wider font-sans">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
