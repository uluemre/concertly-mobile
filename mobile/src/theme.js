import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'themeMode';

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
    // Ekran başlıkları / tam ekran arka planlar için mor dokunuşlu 3 duraklı gradyan
    screenGradient: ['#0A0A14', '#1a0a2e', '#0A0A14'],
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
    screenGradient: ['#F4F1FA', '#EBE0F6', '#F4F1FA'],
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
  const [themeMode, setThemeModeState] = useState('dark');

  // Seçilen tema hatırlanır; eskiden her açılışta koyu temaya dönüyordu
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(v => { if (v === 'light' || v === 'dark') setThemeModeState(v); })
      .catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    themeMode,
    colors: themePalettes[themeMode] || themePalettes.dark,
    setThemeMode,
  }), [themeMode, setThemeMode]);

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
