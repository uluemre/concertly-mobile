import API from './api';

/**
 * Konser verisi — backend'in /api/concerts ucu.
 *
 * Uygulama hiçbir bilet sitesine kendisi gitmez; veriyi toplamak, tekilleştirmek
 * ve doğrulamak backend'in işi. Buradaki kayıtlarda kaynak bilgisi de yoktur:
 * konserin Ticketmaster'dan mı Biletinial'den mi geldiği mobil tarafı
 * ilgilendirmiyor.
 *
 * @typedef {Object} Concert
 * @property {number} id
 * @property {string} name
 * @property {string} eventDate         ISO tarih (Türkiye duvar saati)
 * @property {string|null} genre
 * @property {string|null} imageUrl
 * @property {string|null} ticketUrl
 * @property {boolean} isVerified       kaynağı doğrulanmış etkinlik rozeti
 * @property {number|null} artistId
 * @property {string|null} artistName
 * @property {string|null} artistImageUrl
 * @property {number|null} venueId
 * @property {string|null} venueName
 * @property {string|null} venueCity
 * @property {string|null} venueAddress
 * @property {number|null} venueLatitude
 * @property {number|null} venueLongitude
 *
 * @typedef {Object} ConcertPage
 * @property {Concert[]} content
 * @property {number} page
 * @property {number} size
 * @property {number} totalElements
 * @property {number} totalPages
 * @property {boolean} last
 */

/** Sunucu sayfa boyutu üst sınırı 100. */
export const CONCERTS_PAGE_SIZE = 100;

/** Güvenlik sınırı: beklenmedik bir durumda sonsuz sayfa çekmeyelim. */
const MAX_PAGES = 25;

/**
 * Tek sayfa çeker.
 * @returns {Promise<ConcertPage>}
 */
export async function fetchConcertPage({
  city, artist, past = false, page = 0, size = CONCERTS_PAGE_SIZE,
} = {}) {
  const params = { page, size };
  if (city) params.city = city;
  if (artist) params.artist = artist;
  if (past) params.past = true;

  const res = await API.get('/concerts', { params });
  return res.data;
}

/**
 * Sayfaları sırayla çeker ve her sayfa geldiğinde onPage ile bildirir.
 *
 * Ekran arama/sıralama/tarih filtresini istemci tarafında yaptığı için listenin
 * tamamına ihtiyacı var; ama ilk sayfa gelir gelmez göstermek istiyoruz. Bu
 * yüzden sayfalama "ilk sayfayı hemen bas, kalanını arkadan ekle" şeklinde
 * kullanılıyor.
 *
 * @returns {Promise<Concert[]>}
 */
export async function fetchAllConcerts({
  city, artist, past = false, onPage, isCancelled,
} = {}) {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    if (isCancelled && isCancelled()) break;

    const data = await fetchConcertPage({ city, artist, past, page });
    const items = Array.isArray(data?.content) ? data.content : [];
    all.push(...items);

    if (onPage) onPage(items, page === 0, data);
    if (data?.last || items.length === 0) break;
  }
  return all;
}
