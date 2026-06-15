import axios from 'axios';
import Constants from 'expo-constants';

// İnternetteki canlı sunucu (Railway)
const PROD_API = 'https://concertly-mobile-production.up.railway.app/api';

// Geliştirme sırasında da canlı sunucuyu kullanmak istersen bunu true yap
// (örn. telefonda Expo Go ile yayın sunucusunu test etmek için)
const USE_PROD_IN_DEV = true;

function getBaseUrl() {
  // Yayınlanan (production) uygulama → her zaman internetteki sunucu
  if (!__DEV__ || USE_PROD_IN_DEV) return PROD_API;

  // Geliştirme (Expo Go) → aynı ağdaki yerel bilgisayar
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:8082/api`;
    }
  } catch {}
  return PROD_API;
}

const BASE_URL = getBaseUrl();
// Yüklenen görsellerin sunulduğu kök adres (örn. http://192.168.1.5:8082)
const SERVER_ORIGIN = BASE_URL.replace(/\/api$/, '');

if (__DEV__) console.log('API Base URL:', BASE_URL);

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Backend görselleri "/uploads/<dosya>" göreli yoluyla saklar — cihaz hangi
// ağdan bağlanırsa bağlansın çalışsın diye tam URL'ye burada çevrilir.
function absolutizeUploads(value) {
  if (typeof value === 'string') {
    return value.startsWith('/uploads/') ? SERVER_ORIGIN + value : value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = absolutizeUploads(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = absolutizeUploads(value[key]);
    return value;
  }
  return value;
}

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
  (response) => {
    response.data = absolutizeUploads(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (error.code === 'ECONNABORTED') {
      error.userMessage = 'İstek zaman aşımına uğradı. Bağlantını kontrol et.';
    } else if (error.code === 'ERR_NETWORK') {
      error.userMessage = 'Sunucuya ulaşılamıyor. İnternet bağlantını kontrol et.';
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

export function getErrorMessage(error, fallback = 'Bir hata oluştu. Lütfen tekrar dene.') {
  if (error?.userMessage) return error.userMessage;
  if (error?.response?.data?.message) return error.response.data.message;
  return fallback;
}

/**
 * Cihazdaki görseli sunucuya yükler, veritabanına yazılacak GÖRELİ yolu döner.
 * (Göreli saklanır ki IP değişince eski görseller kırılmasın.)
 */
export async function uploadImage(localUri) {
  const filename = localUri.split('/').pop() || `photo-${Date.now()}.jpg`;
  const extMatch = /\.(\w+)$/.exec(filename);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: filename,
    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  const res = await API.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000, // büyük görseller için daha geniş süre
  });
  // interceptor tam URL'ye çevirmiş olabilir — saklamak için göreli hale getir
  return res.data.url.replace(SERVER_ORIGIN, '');
}

export default API;
