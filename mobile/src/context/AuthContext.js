import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as Storage from '../services/secureStorage';
import { unregisterPushToken } from '../services/pushNotifications';
import { setApiToken, setApiRefreshToken, setTokenRefreshedHandler } from '../services/api';

const AuthContext = createContext(null);

// authToken/refreshToken Keychain-Keystore'a, kalanlar AsyncStorage'a yazılır
// (bkz. services/secureStorage.js).
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
      await Storage.setItem('authToken', newAccessToken);
    });
  }, []);

  // Uygulama açılışında AsyncStorage'dan yükle
  useEffect(() => {
    Storage.multiGet(STORAGE_KEYS)
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
    await Storage.multiSet([
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
    // Cihazı hesaptan düşür, yoksa çıkış yapan kullanıcının bildirimleri
    // telefona gelmeye devam eder.
    await unregisterPushToken();
    await Storage.multiRemove(STORAGE_KEYS);
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
        await Storage.multiSet(pairs);
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
