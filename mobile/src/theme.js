import React, { createContext, useContext, useMemo, useState } from 'react';

export const themePalettes = {
  dark: {
    background: '#0F0F1A',
    card: '#1A1A2E',
    cardAlt: '#16213E',
    primary: '#E94560',
    secondary: '#F5A623',
    accent: '#00D4AA',
    purple: '#7C3AED',
    text: '#FFFFFF',
    textSecondary: '#A0A0B0',
    border: '#2A2A3E',
    headerGradient: ['#0F0F1A', '#1A1A2E'],
    profileGradient: ['#7C3AED', '#E94560'],
    input: '#2A2A3E',
  },
  light: {
    background: '#E8EAF0',
    card: '#FFFFFF',
    cardAlt: '#F5F6FA',
    primary: '#E94560',
    secondary: '#D4880F',
    accent: '#009B7A',
    purple: '#6D35D6',
    text: '#1A1A2E',
    textSecondary: '#5F6378',
    border: '#CCD1DB',
    headerGradient: ['#F8E4E8', '#EBE0F6'],
    profileGradient: ['#E94560', '#7C3AED'],
    input: '#ECEDF2',
  },
};

export const colors = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  cardAlt: '#16213E',
  primary: '#E94560',
  secondary: '#F5A623',
  accent: '#00D4AA',
  purple: '#7C3AED',
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  border: '#2A2A3E',
};

const ThemeContext = createContext({
  themeMode: 'dark',
  colors: themePalettes.dark,
  setThemeMode: () => {},
});

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('dark');

  const value = useMemo(() => ({
    themeMode,
    colors: themePalettes[themeMode] || themePalettes.dark,
    setThemeMode,
  }), [themeMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const gradients = {
  card1: ['#E94560', '#7C3AED'],
  card2: ['#F5A623', '#E94560'],
  card3: ['#00D4AA', '#7C3AED'],
  card4: ['#7C3AED', '#0F0F1A'],
};
