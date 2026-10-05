import { useEffect, useState } from 'react';

// Türkiye'nin 81 ili — tek kaynak. Tüm ekranlar (onboarding, Home/Events filtresi,
// Settings) buradan okur.
//
// ÖNEMLİ: Türkçe karakterli yazımlar kullanılır çünkü backend etkinlik filtresi
// (EventRepository.findByCityNormalized) şehri "LOWER(REPLACE(city,'İ','I'))" ile
// eşleştirir — yani İstanbul/Istanbul, İzmir/Izmir tutar; diğer iller için de
// Ticketmaster venue verisindeki Türkçe yazımla birebir aynı olması gerekir.
export const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
  'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman',
  'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne',
  'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun',
  'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir',
  'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
  'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya',
  'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu',
  'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Şanlıurfa',
  'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova',
  'Yozgat', 'Zonguldak',
];

// Konser yoğunluğu en yüksek iller — şehir seçicide chip olarak öne çıkar,
// gerisi "＋ Diğer" arama modalından seçilir. (Hepsi TURKISH_CITIES içinde.)
export const POPULAR_CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Adana', 'Eskişehir', 'Konya',
];

// Uygulamanın kapsadığı (açık) şehirler. Asıl liste sunucudan gelir
// (GET /cities — Admin > Şehirler'den açılıp kapatılır); bu dizi yalnız ilk açılışta
// ve bağlantı yokken kullanılan varsayılandır. Backend karşılığı: app.launch.cities.
export const DEFAULT_LAUNCH_CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Eskişehir', 'Adana', 'Mersin', 'Kocaeli',
];

let launchCities = DEFAULT_LAUNCH_CITIES;
const listeners = new Set();

/** Şu anki açık şehirler. */
export function getLaunchCities() {
  return launchCities;
}

/** Sunucudan gelen listeyi uygular (boş/geçersiz liste yok sayılır). */
export function setLaunchCities(list) {
  if (!Array.isArray(list) || list.length === 0) return;
  const next = list.filter(c => typeof c === 'string' && c.trim());
  if (next.length === 0 || next.join('|') === launchCities.join('|')) return;
  launchCities = next;
  listeners.forEach(l => l(next));
}

/** Açık şehirleri izleyen hook: admin yeni şehir açınca ekran da güncellenir. */
export function useLaunchCities() {
  const [cities, setCities] = useState(launchCities);
  useEffect(() => {
    listeners.add(setCities);
    setCities(launchCities);
    return () => { listeners.delete(setCities); };
  }, []);
  return cities;
}

// Backend'in LaunchCityConfig.normalize'ı ile birebir aynı kural: Türkçe harfler
// sadeleşir (İ/ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c), sonra küçülür. "Eskisehir" ile
// "Eskişehir", "Istanbul" ile "İstanbul" aynı şehir sayılır.
const FOLD = { 'İ': 'i', 'I': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g', 'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c' };
const normalizeCity = (city) =>
  (city || '').trim().replace(/[İIıŞşĞğÜüÖöÇç]/g, ch => FOLD[ch]).toLowerCase();

/** Şehir açık şehirlerden biri mi? (Türkçe-duyarlı karşılaştırma) */
export function isLaunchCity(city) {
  if (!city) return false;
  const n = normalizeCity(city);
  return launchCities.some(c => normalizeCity(c) === n);
}

/**
 * Kayıtlı şehri ekran filtresine çevirir: kapsam içindeyse canonical adını,
 * değilse null ("Tümü") döner. Kapsam dışı bir şehirle açılan ekran backend'den
 * boş liste alıp sebepsiz boş görünüyordu — guard'ı tek yerde tutuyoruz.
 */
export function launchCityOrNull(city) {
  if (!city) return null;
  const n = normalizeCity(city);
  return launchCities.find(c => normalizeCity(c) === n) || null;
}
