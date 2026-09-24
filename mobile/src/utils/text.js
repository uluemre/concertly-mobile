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
 * Etkinlik kartında sanatçı satırı gösterilmeli mi? Etkinlik adı zaten
 * sanatçının adıysa ("Sami Yusuf" / "🎤 Sami Yusuf") aynı şeyi iki kez yazmayalım.
 */
export function showArtistLine(artistName, eventName) {
  if (!artistName) return false;
  return foldName(artistName) !== foldName(eventName);
}
