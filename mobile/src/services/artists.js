import API from './api';

/**
 * Kayıt akışındaki sanatçı önerileri.
 *
 * Tür seçimi ekranında "Devam"a basılır basılmaz istek başlar; sanatçı seçimi
 * ekranı açıldığında aynı isteğin sonucunu bekler (ekran geçişi süresince
 * sunucu zaten çalışmış olur). Aynı tür listesi için tek istek atılır.
 */
const cache = new Map();

function keyOf(genres) {
  return [...(genres || [])].map(String).sort().join(',');
}

export function prefetchRecommendedArtists(genres) {
  const key = keyOf(genres);
  if (!key) return Promise.resolve([]);
  if (!cache.has(key)) {
    const request = API.get(`/artists/recommended?genres=${encodeURIComponent((genres || []).join(','))}`)
      .then(res => (Array.isArray(res.data) ? res.data : []))
      .catch(err => {
        cache.delete(key);   // hata kalıcı olmasın; ekran tekrar deneyebilsin
        throw err;
      });
    cache.set(key, request);
  }
  return cache.get(key);
}

/** Önceden başlatılmış isteği kullanır, yoksa yeni istek atar. Sonuç bir kez tüketilir. */
export async function getRecommendedArtists(genres) {
  const key = keyOf(genres);
  try {
    return await prefetchRecommendedArtists(genres);
  } finally {
    cache.delete(key);   // takip durumu değişebilir; bir sonraki açılış taze veri alsın
  }
}
