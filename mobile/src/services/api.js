import axios from 'axios';
import Constants from 'expo-constants';

// Expo dev server IP'sini otomatik algıla
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

let _onSessionExpired = null;
export function setSessionExpiredHandler(cb) {
  _onSessionExpired = cb;
}

API.interceptors.request.use(async (config) => {
  if (__DEV__) console.log('İSTEK:', config.method?.toUpperCase(), config.url);
  const token = global.authToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Ağ hatası: Backend çalışmıyor veya IP yanlış. URL:', BASE_URL);
    }
    const status = error.response?.status;
    if ((status === 401 || status === 403) && global.authToken) {
      if (_onSessionExpired) _onSessionExpired();
    }
    return Promise.reject(error);
  }
);

export function getApiUrl() {
  return BASE_URL;
}

export default API;
