import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setApiToken, setApiRefreshToken, setTokenRefreshedHandler } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEYS = [
  'authToken', 'refreshToken', 'userId', 'username', 'userCity',
  'favoriteGenres', 'isAdmin', 'onboardingCompleted',
];

const DEFAULT_SESSION = {
  authToken: null,
  refreshToken: null,
  userId: null,
  username: null,
  userCity: null,
  favoriteGenres: null,
  isAdmin: false,
  onboardingCompleted: false,
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [isReady, setIsReady] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  // api.js interceptor'larını token değişince güncelle
  useEffect(() => {
    setApiToken(session.authToken);
  }, [session.authToken]);

  useEffect(() => {
    setApiRefreshToken(session.refreshToken);
  }, [session.refreshToken]);

  // api.js refresh başarılı olunca sadece accessToken'ı güncelle
  useEffect(() => {
    setTokenRefreshedHandler(async (newAccessToken) => {
      setSession(prev => ({ ...prev, authToken: newAccessToken }));
      try {
        await AsyncStorage.setItem('authToken', newAccessToken);
      } catch {}
    });
  }, []);

  // Uygulama açılışında AsyncStorage'dan yükle
  useEffect(() => {
    AsyncStorage.multiGet(STORAGE_KEYS)
      .then(pairs => {
        const data = Object.fromEntries(pairs);
        if (data.authToken && data.userId) {
          setSession({
            authToken: data.authToken,
            refreshToken: data.refreshToken || null,
            userId: parseInt(data.userId),
            username: data.username || '',
            userCity: data.userCity || '',
            favoriteGenres: data.favoriteGenres || '',
            isAdmin: data.isAdmin === 'true',
            onboardingCompleted: data.onboardingCompleted === 'true',
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsReady(true));
  }, []);

  const login = useCallback(async (data) => {
    const newSession = {
      authToken: data.accessToken,
      refreshToken: data.refreshToken || null,
      userId: data.userId,
      username: data.username || '',
      userCity: data.city || '',
      favoriteGenres: data.favoriteGenres || '',
      isAdmin: data.isAdmin === true,
      onboardingCompleted: data.onboardingCompleted || false,
    };
    setSession(newSession);
    await AsyncStorage.multiSet([
      ['authToken', newSession.authToken],
      ['refreshToken', newSession.refreshToken || ''],
      ['userId', String(newSession.userId)],
      ['username', newSession.username],
      ['userCity', newSession.userCity],
      ['favoriteGenres', newSession.favoriteGenres],
      ['isAdmin', String(newSession.isAdmin)],
      ['onboardingCompleted', String(newSession.onboardingCompleted)],
    ]);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(STORAGE_KEYS);
    setSession(DEFAULT_SESSION);
    setNotificationCount(0);
  }, []);

  const updateSession = useCallback(async (patch) => {
    setSession(prev => ({ ...prev, ...patch }));
    const pairs = Object.entries(patch)
      .filter(([k]) => STORAGE_KEYS.includes(k))
      .map(([k, v]) => [k, String(v)]);
    if (pairs.length) {
      try {
        await AsyncStorage.multiSet(pairs);
      } catch (err) {
        console.log('Session güncelleme hatası:', err.message);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      isReady,
      login,
      logout,
      updateSession,
      notificationCount,
      setNotificationCount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
