import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const LanguageContext = createContext({
  lang: 'tr',
  setLang: () => {},
  t: (k) => k,
  tu: (k) => k,
});

/** Dile duyarlı büyük harf: Türkçede i→İ, ı→I (motorun Intl desteğine güvenmeden). */
export function upperLocale(str, lang) {
  if (str == null) return '';
  const s = String(str);
  return lang === 'en' ? s.toUpperCase() : s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

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

  // Büyük harf başlıklar için: RN'in textTransform:'uppercase'ı iOS'ta dile
  // bakmıyor ve Türkçede "Etkinlik" → "ETKINLIK" (noktasız) yazıyordu.
  const tu = useCallback((key, params) => upperLocale(t(key, params), lang), [t, lang]);

  const value = useMemo(() => ({ lang, setLang, t, tu }), [lang, setLang, t, tu]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
