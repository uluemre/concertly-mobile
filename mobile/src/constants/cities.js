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
