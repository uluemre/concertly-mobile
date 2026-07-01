# App Store Connect — Concertly Vitrin Metinleri

App Store Connect'te **App Information** + her dil için **Localization** alanlarına
kopyala-yapıştır. Birincil dil: **Türkçe**, ek dil: **English**. Karakter limitleri
parantezde; Apple boşluk/virgülü de sayar, gerekirse kırp.

---

## 🔧 App Information (dilden bağımsız)

- **Bundle ID:** `com.concertly.app`
- **Primary Category:** Music
- **Secondary Category:** Social Networking
- **Age Rating:** UGC (kullanıcı içeriği) + sosyal özellikler var → ankette
  "User-Generated Content = Yes" işaretle; şikayet/engelleme + moderasyon
  olduğunu belirt. Beklenen sonuç **12+**.
- **Privacy Policy URL:** `https://concertly-mobile-production.up.railway.app/legal/privacy.html`
- **Support URL:** `https://concertly-mobile-production.up.railway.app/legal/index.html` (iletişim e-postası alt sayfalarda)
- **Marketing URL (opsiyonel):** `https://concertly-mobile-production.up.railway.app/promo/` (tanıtım sayfası)
- **Copyright:** `2026 Emre Ulu`

---

## 🇹🇷 Türkçe (birincil)

**App Name (≤30):**
```
Concertly
```

**Subtitle (≤30):**
```
Konserleri keşfet, yaşa
```

**Promotional Text (≤170, sonradan güncellenebilir):**
```
Türkiye'nin her yerindeki konserleri keşfet, gittiğini konumunla doğrula, anılarını paylaş ve müzik tutkunlarıyla tanış. 🎸
```

**Keywords (≤100, virgülle, boşluksuz tercih edilir):**
```
konser,festival,müzik,etkinlik,bilet,sanatçı,canlı müzik,konser takvimi,topluluk,quiz
```

**Description (≤4000):**
```
Concertly, Türkiye'deki konser ve festival tutkunları için tasarlanmış sosyal bir müzik keşif uygulamasıdır. Konserleri keşfet, gittiğini kanıtla, anılarını paylaş ve aynı müzik zevkini paylaşan insanlarla tanış.

🎸 TÜM KONSERLER TEK YERDE
Türkiye'nin dört bir yanındaki konser, festival ve müzik etkinliklerini keşfet. Şehrine, sanatçına ve türüne göre filtrele.

📍 ORADAYDIN, KANITLA
Konser günü mekanda olduğunu konumunla doğrula. Sadece gerçek deneyimler, gerçek anılar.

🎤 SANATÇINI TAKİP ET
Sevdiğin sanatçıların yeni turlarını ve konserlerini kaçırma, güncellemelerinden haberdar ol.

👥 TOPLULUĞA KATIL
Konser anılarını paylaş, gönderilere yorum yap, aynı müzik zevkini paylaşan insanlarla bağlan.

🎫 KONSER PASAPORTUN
Gittiğin tüm konserleri biriktir, yıllık müzik istatistiklerini gör.

🎯 OYUNLAR & EĞLENCE
Müzik quizleri çöz, günün şarkısını tahmin et, serini büyüt.

🤝 KONSER ARKADAŞI BUL
Aynı konsere gitmek isteyen müzikseverlerle eşleş.

Müziği yalnızca dinleme — yaşa. Concertly'yi indir, bir sonraki konserini keşfet.

İletişim: emre.emre.emre366@gmail.com
```

---

## 🇬🇧 English

**App Name (≤30):**
```
Concertly
```

**Subtitle (≤30):**
```
Discover & live concerts
```

**Promotional Text (≤170):**
```
Discover concerts across Turkey, verify your attendance with your location, share your memories and connect with fellow music lovers. 🎸
```

**Keywords (≤100):**
```
concert,festival,music,event,gig,ticket,artist,live music,concert calendar,community
```

**Description (≤4000):**
```
Concertly is a social music discovery app built for concert and festival lovers in Turkey. Discover concerts, prove you were there, share your memories and meet people who share your music taste.

🎸 EVERY CONCERT IN ONE PLACE
Explore concerts, festivals and music events across Turkey. Filter by city, artist and genre.

📍 YOU WERE THERE, PROVE IT
Verify you were at the venue on concert day with your location. Only real experiences, real memories.

🎤 FOLLOW YOUR ARTISTS
Never miss new tours and concerts from your favorite artists and stay up to date.

👥 JOIN THE COMMUNITY
Share your concert memories, comment on posts and connect with people who share your taste.

🎫 YOUR CONCERT PASSPORT
Collect every concert you attend and see your yearly music stats.

🎯 GAMES & FUN
Take music quizzes, guess the song of the day and grow your streak.

🤝 FIND A CONCERT BUDDY
Match with music lovers who want to go to the same concert.

Don't just listen to music — live it. Download Concertly and discover your next concert.

Contact: emre.emre.emre366@gmail.com
```

---

## 🔐 App Privacy anketi (App Store Connect > App Privacy)

Gizlilik politikasına dayalı özet — anketi doldururken kullan:

- **Veri topluyor musun?** Evet
- **Tracking (izleme) için kullanılıyor mu?** Hayır (reklam/izleme yok)
- **Toplanan ve KİMLİĞE BAĞLI veriler:**
  - Contact Info → E-posta adresi (hesap için)
  - User Content → Fotoğraflar/görseller, gönderiler/yorumlar
  - Identifiers → Kullanıcı ID
  - Location → Konum (yalnızca izin verilince; yakın etkinlikler + katılım doğrulama) → kullanım amacı **App Functionality**
- **Veri satışı:** Hayır
- **Üçüncü taraf paylaşımı:** yalnızca uygulamanın çalışması için (barındırma, e-posta, Spotify/Ticketmaster etkinlik/sanatçı verisi)
- **Crash/Analytics SDK:** Şu an yok (eklenirse Diagnostics olarak işaretle)

---

## 📸 Ekran görüntüleri (zorunlu)

- **6.7" iPhone** (1290 × 2796) — zorunlu, en az 1 (3-5 önerilir)
- Öneri kareler: (1) onboarding/keşfet, (2) konser detay, (3) feed/topluluk,
  (4) konser pasaportu, (5) oyunlar veya konser arkadaşı
- Simülatör yerine cihazdan (Expo Go/build) çekip kırpabiliriz.

---

## ✅ Gönderim öncesi mini checklist

- [ ] Apple Developer kaydı aktif ($99/yıl)
- [ ] Backend redeploy → `/legal/privacy.html` 200 dönüyor
- [ ] `eas build --platform ios --profile production` başarılı
- [ ] App Store Connect'te uygulama oluşturuldu (com.concertly.app)
- [ ] Yukarıdaki metinler + ekran görüntüleri girildi
- [ ] App Privacy anketi dolduruldu
- [ ] `eas submit --platform ios` ile build yüklendi → İncelemeye gönder
