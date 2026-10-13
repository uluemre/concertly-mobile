import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { setConfigStaleHandler } from '../services/api';

// Admin panelinden yönetilen uygulama ayarları: özellik anahtarları, bakım modu, duyuru.
// Açılışta son bilinen değer AsyncStorage'dan gelir (çevrimdışı açılış), ardından sunucudan
// tazelenir; uygulama öne gelince ve sunucu "bakımda / kapalı" dediğinde yeniden okunur.

const STORAGE_KEY = 'appConfig';
const MIN_REFRESH_MS = 60 * 1000;

const DEFAULT_CONFIG = {
  features: {
    buddy: true, games: true, communities: true, posting: true, eventSuggestions: true, registration: true,
  },
  maintenance: { enabled: false, messageTr: '', messageEn: '' },
  announcement: null,
};

function merge(data) {
  return {
    features: { ...DEFAULT_CONFIG.features, ...(data?.features || {}) },
    maintenance: { ...DEFAULT_CONFIG.maintenance, ...(data?.maintenance || {}) },
    announcement: data?.announcement || null,
  };
}

const AppConfigContext = createContext({
  ...DEFAULT_CONFIG,
  isOn: () => true,
  refresh: () => {},
});

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const lastFetch = useRef(0);
  const fetched = useRef(false);

  const refresh = useCallback(async ({ force = false } = {}) => {
    // Zorla yenileme de 3 sn'de bir: aynı anda düşen onlarca 503 tek istek yapsın
    const since = Date.now() - lastFetch.current;
    if (since < (force ? 3000 : MIN_REFRESH_MS)) return;
    lastFetch.current = Date.now();
    try {
      const res = await API.get('/app/config');
      const next = merge(res.data);
      fetched.current = true;
      setConfig(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    } catch {
      // Sunucuya ulaşılamazsa son bilinen ayarlarla devam
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => { if (raw) setConfig(prev => (fetched.current ? prev : merge(JSON.parse(raw)))); })
      .catch(() => {});
    refresh({ force: true });
    setConfigStaleHandler(() => refresh({ force: true }));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => {
      sub.remove();
      setConfigStaleHandler(null);
    };
  }, [refresh]);

  const value = useMemo(() => ({
    ...config,
    isOn: (feature) => config.features[feature] !== false,
    refresh,
  }), [config, refresh]);

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
