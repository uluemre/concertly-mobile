import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const LanguageContext = createContext({
  lang: 'tr',
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('tr');

  useEffect(() => {
    AsyncStorage.getItem('appLanguage')
      .then(saved => { if (saved === 'tr' || saved === 'en') setLangState(saved); })
      .catch(() => {});
  }, []);

  const setLang = useCallback(async (l) => {
    setLangState(l);
    try { await AsyncStorage.setItem('appLanguage', l); } catch {}
  }, []);

  const t = useCallback((key, params) => {
    let str = translations[lang]?.[key] ?? translations.tr[key] ?? key;
    if (params && typeof str === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
