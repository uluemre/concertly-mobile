// Metin karşılaştırma yardımcıları.

const TR_MAP = { İ: 'i', I: 'i', ı: 'i', Ş: 's', ş: 's', Ğ: 'g', ğ: 'g', Ü: 'u', ü: 'u', Ö: 'o', ö: 'o', Ç: 'c', ç: 'c' };

/** Büyük/küçük harf, Türkçe karakter ve noktalama farkını yok sayarak sadeleştirir. */
export function foldName(s) {
  return String(s ?? '')
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => TR_MAP[ch])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Tür adını gösterim için çevirir: veri tabanındaki "Diger" / "Diğer" → t('genre_other').
 * Yalnızca görüntüleme içindir; filtre / sorgu değerleri değişmez.
 */
export function displayGenre(genre, t) {
  if (!genre) return genre;
  return foldName(genre) === 'diger' ? t('genre_other') : genre;
}

/** Ülke adını gösterim için düzeltir: Turkey / Turkiye / Türkiye → "Türkiye". */
export function displayCountry(country) {
  if (!country) return country;
  const f = foldName(country);
  return f === 'turkey' || f === 'turkiye' ? 'Türkiye' : country;
}

/**
 * Arama için sadeleştirme: Türkçe harf ve büyük/küçük harf farkını yok sayar
 * ("sebnem" ↔ "Şebnem", "istanbul" ↔ "İstanbul"). Noktalama korunur; backend'deki
 * SearchText ile aynı kural.
 */
export function foldSearch(s) {
  return String(s ?? '')
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => TR_MAP[ch])
    .replace(/[Ââ]/g, 'a').replace(/[Îî]/g, 'i').replace(/[Ûû]/g, 'u')
    .toLowerCase();
}

/**
 * Etkinlik kartında sanatçı satırı gösterilmeli mi? Etkinlik adı zaten
 * sanatçının adıysa ("Sami Yusuf" / "🎤 Sami Yusuf") aynı şeyi iki kez yazmayalım.
 */
export function showArtistLine(artistName, eventName) {
  if (!artistName) return false;
  return foldName(artistName) !== foldName(eventName);
}
