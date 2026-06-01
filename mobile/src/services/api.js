import axios from 'axios';
import Constants from 'expo-constants';

function getBaseUrl() {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:8082/api`;
    }
  } catch {}
  return 'http://192.168.1.92:8082/api';
}

const BASE_URL = getBaseUrl();

if (__DEV__) console.log('API Base URL:', BASE_URL);

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Modül düzeyi token değişkenleri — context'ten güncellenir
let _authToken = null;
let _refreshToken = null;

export function setApiToken(token) {
  _authToken = token;
}

export function setApiRefreshToken(token) {
  _refreshToken = token;
}

// Session sona erdiğinde çağrılacak callback (logout + navigate)
let _onSessionExpired = null;
export function setSessionExpiredHandler(cb) {
  _onSessionExpired = cb;
}

// Token yenilendiğinde context'i güncellemek için callback
let _onTokenRefreshed = null;
export function setTokenRefreshedHandler(cb) {
  _onTokenRefreshed = cb;
}

// Eş zamanlı refresh denemelerini engellemek için kuyruk
let _isRefreshing = false;
let _refreshQueue = [];

function processQueue(error, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  _refreshQueue = [];
}

API.interceptors.request.use((config) => {
  if (__DEV__) console.log('İSTEK:', config.method?.toUpperCase(), config.url);
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (error.code === 'ERR_NETWORK') {
      console.error('Ağ hatası: Backend çalışmıyor veya IP yanlış. URL:', BASE_URL);
    }

    // 401 — token geçersiz veya süresi dolmuş
    if (status === 401) {
      if (_refreshToken && !originalRequest._retry) {
        // Refresh token var → yenilenmeyi dene
        if (_isRefreshing) {
          return new Promise((resolve, reject) => {
            _refreshQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return API(originalRequest);
          });
        }

        originalRequest._retry = true;
        _isRefreshing = true;

        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken: _refreshToken,
          });

          const newAccessToken = res.data.accessToken;
          _authToken = newAccessToken;

          if (_onTokenRefreshed) _onTokenRefreshed(newAccessToken);

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return API(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          if (_onSessionExpired) _onSessionExpired();
          return Promise.reject(refreshError);
        } finally {
          _isRefreshing = false;
        }
      } else {
        // Refresh token yok veya ikinci deneme — oturumu sonlandır
        if (_onSessionExpired) _onSessionExpired();
      }
    }

    // 403 — yetki hatası, sadece isteği reddet; oturumu kapatma
    // (admin endpoint'lere yetkisiz erişim ekranı kendi handle eder)

    return Promise.reject(error);
  }
);

export function getApiUrl() {
  return BASE_URL;
}

export default API;
