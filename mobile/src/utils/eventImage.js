/**
 * Etkinlik kartlarında hangi görselin gösterileceği.
 *
 * Kaynaklardaki iki sorun:
 *  - Deezer, fotoğrafı olmayan sanatçılar için gri bir silüet döndürüyor
 *    (adres boş dosyanın MD5'ini taşıyor). Bu "fotoğraf yok" demek.
 *  - Ticketmaster, kendi görseli olmayan konserlere genel kalabalık/sahne
 *    fotoğrafları koyuyor; aynı fotoğraf onlarca farklı sanatçıda görünüyor.
 *    Sanatçının gerçek fotoğrafı varsa o daha anlamlı.
 */

const PLACEHOLDER_MARKERS = [
  'd41d8cd98f00b204e9800998ecf8427e',   // Deezer: resmi olmayan sanatçı
  '/images/artist//',
  'default_avatar',
];

export function isPlaceholderImage(url) {
  if (typeof url !== 'string' || !url.trim()) return true;
  return PLACEHOLDER_MARKERS.some(m => url.includes(m));
}

/** Bu kadar farklı sanatçıda görünen görsel, konsere özel değil genel stok görseldir. */
const GENERIC_MIN_ARTISTS = 3;

/**
 * Listede farklı sanatçılarda tekrar eden (genel) görselleri bulur.
 * @param {Array<{imageUrl?: string, artistId?: number, artistName?: string}>} events
 * @returns {Set<string>}
 */
export function findGenericImages(events) {
  const artistsByImage = new Map();
  for (const e of events || []) {
    const url = e?.imageUrl;
    if (!url) continue;
    const artist = e.artistId ?? e.artistName ?? e.id;
    if (!artistsByImage.has(url)) artistsByImage.set(url, new Set());
    artistsByImage.get(url).add(artist);
  }
  const generic = new Set();
  for (const [url, artists] of artistsByImage) {
    if (artists.size >= GENERIC_MIN_ARTISTS) generic.add(url);
  }
  return generic;
}

/**
 * Denenecek görsel adresleri, öncelik sırasıyla. Biri yüklenemezse sonraki
 * denenir; hiçbiri kalmazsa kart kendi yer tutucusunu gösterir.
 */
export function eventImageCandidates(item, genericImages) {
  if (!item) return [];
  const eventImg = item.imageUrl;
  const artistImg = item.artistImageUrl;
  // Sanatçının tek, güncel fotoğrafı önce (profil ve tüm konser kartlarında aynı görsel);
  // yoksa etkinliğin kendi afişi. (genericImages parametresi eski çağrılarla uyum için duruyor.)
  const ordered = [artistImg, eventImg];
  const out = [];
  for (const url of ordered) {
    if (!isPlaceholderImage(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

/**
 * Etkinlik detayının kapak görseli adayları: önce sanatçı fotoğrafı, sonra etkinlik
 * görseli — backend /events/{id} ile aynı kural. Listeden (ham TM görseli) ya da linkten
 * açılsa da aynı kapak görünür. Yer tutucular atlanır; hiçbiri kalmazsa ekran kendi
 * renkli yer tutucusunu gösterir.
 */
export function detailImageCandidates(event) {
  const out = [];
  for (const url of [event?.artistImageUrl, event?.imageUrl]) {
    if (!isPlaceholderImage(url) && !out.includes(url)) out.push(url);
  }
  return out;
}

/** Yer tutucudaki baş harfler: "Mor ve Ötesi" → "MÖ". */
export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '♪';
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toLocaleUpperCase('tr-TR');
}
