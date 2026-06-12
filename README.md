# 🎵 Concertly

**Konser ve etkinlik keşfi için full-stack sosyal uygulama.** Konserleri keşfet, konum doğrulamalı post at, konser arkadaşı bul, sanatçıları takip et — müziği yaşa, anları paylaş.

| | |
|---|---|
| 📱 **Frontend** | React Native (Expo) |
| ⚙️ **Backend** | Spring Boot 3.5 · Java 17 · PostgreSQL |
| 🔐 **Auth** | JWT (access + refresh token) |
| 🌍 **Dil** | Türkçe / İngilizce (uygulama içi geçiş) |
| 🎨 **Tema** | Koyu / Açık |

---

## ✨ Özellikler

### Kullanıcı
- 🎫 **Etkinlik keşfi** — şehre, türe ve sanatçıya göre konser/festival listesi (Ticketmaster entegrasyonu)
- 📍 **Konum doğrulamalı post** — konser günü mekâna 200 m yakınsan "doğrulanmış" post atabilirsin
- 🤝 **Concert Buddy** — aynı konsere giden kullanıcılarla swipe tabanlı eşleşme
- 🛂 **Konser Pasaportu** — katıldığın konserlerin rozetli geçmişi
- ⭐ **Etkinlik & mekân değerlendirmeleri**
- 👥 **Topluluklar** — müzik zevkine göre gruplar, topluluk postları
- 🎧 **Spotify bağlantısı** — dinleme geçmişine göre sanatçı/konser önerileri
- 📊 **Feed** — metin, görsel ve anket postları; beğeni, yorum, takip
- 🗺️ **Harita** — etkinlikleri konum üzerinde görüntüleme
- 🔔 **Bildirimler**, 🏅 **rozetler**, 📅 **takvime ekleme**

### Admin
- 📊 İstatistik panosu (kullanıcı, etkinlik, post, katılım metrikleri)
- 🎵 Etkinlik yönetimi: ekleme, düzenleme, onay akışı, silme
- 👥 Kullanıcı yönetimi: ban/unban, admin yetkilendirme
- 📝 Post moderasyonu

---

## 🗂️ Proje Yapısı

```
concertly-mobile/
├── mobile/                  # React Native (Expo) uygulaması
│   └── src/
│       ├── screens/         # 30+ ekran (Home, Feed, EventDetail, Admin*, ...)
│       ├── components/      # Paylaşılan UI bileşenleri (feed, home, profile)
│       ├── navigation/      # AppNavigator — stack + tab navigasyon
│       ├── context/         # AuthContext, LanguageContext
│       ├── i18n/            # TR/EN çeviriler (tek dosya, düz anahtarlar)
│       ├── services/        # Axios API istemcisi (otomatik token refresh)
│       └── theme.js         # Koyu/açık tema paletleri
│
├── backend/                 # Spring Boot REST API
│   └── src/main/java/com/concertly/backend/
│       ├── controller/      # 21 REST controller (/api/...)
│       ├── service/         # İş mantığı (Spotify, Ticketmaster, Deezer dahil)
│       ├── repository/      # Spring Data JPA
│       ├── model/           # 30 JPA entity
│       ├── security/        # JwtFilter, JwtUtil, SecurityConfig
│       └── exception/       # Global hata yönetimi
│
└── screenshots/             # Uygulama ekran görüntüleri
```

---

## 🚀 Kurulum

### Gereksinimler
- **Node.js** 18+ ve npm
- **Java 17+** (JDK)
- **PostgreSQL** (lokal)
- **Expo Go** (telefonda test için)

### 1) Veritabanı

PostgreSQL'de boş bir veritabanı oluştur:

```sql
CREATE DATABASE concertly_mobile;
```

> Şema `spring.jpa.hibernate.ddl-auto=update` ile ilk açılışta otomatik oluşur; ayrı migration aracı yok.

### 2) Backend

```bash
cd backend
./mvnw spring-boot:run        # → http://localhost:8082
```

Varsayılan ayarlar `application.properties` içindedir ve **ortam değişkenleriyle override edilebilir**:

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/concertly_mobile` | PostgreSQL bağlantısı |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / `1234` | DB kimlik bilgileri |
| `JWT_SECRET` | (dev anahtarı) | **Production'da mutlaka değiştir** |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | (dev anahtarları) | Spotify API |
| `TICKETMASTER_API_KEY` | (dev anahtarı) | Ticketmaster Discovery API |

```bash
# Test çalıştırma
./mvnw test

# JAR üretme
./mvnw package
```

### 3) Mobile

```bash
cd mobile
npm install
npm start                     # QR kodu Expo Go ile tara
```

> API adresi otomatik çözülür: uygulama, Expo dev sunucusunun IP'sini alıp `http://<ip>:8082/api` olarak kullanır. Telefon ve bilgisayar **aynı ağda** olmalı.

---

## 🔌 API Özeti

Tüm endpoint'ler `/api` altındadır. Login sonrası dönen `accessToken`, `Authorization: Bearer <token>` başlığıyla gönderilir (mobil istemci bunu otomatik yapar, 401'de refresh token ile sessizce yeniler).

| Alan | Örnek Endpoint'ler |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh` |
| Etkinlik | `GET /api/events` · `GET /api/events/{id}` · katılım, bookmark, review |
| Sosyal | `GET /api/posts` · beğeni, yorum, takip, anket oyları |
| Buddy | `POST /api/buddy/swipe` · eşleşme listesi |
| Topluluk | `GET /api/communities` · üyelik, topluluk postları |
| Spotify | `GET /api/spotify/login` · öneriler |
| Admin | `GET /api/admin/stats` · kullanıcı/etkinlik/post yönetimi (admin rolü gerekir) |

---

## 🧪 Test

```bash
cd backend
./mvnw test
```

Birim testleri `src/test/java` altındadır (ör. `JwtUtilTest` — token üretimi, doğrulama, süre aşımı ve imza senaryoları).

---

## 🌍 Çok Dilli Yapı (i18n)

- Tüm UI metinleri `mobile/src/i18n/translations.js` içinde, `tr` ve `en` olarak **anahtar paritesiyle** tutulur.
- Ekranlar `useLanguage()` hook'undan `t(key, params)` fonksiyonunu kullanır.
- Dil tercihi `AsyncStorage`'da saklanır; Ayarlar ekranından anlık değiştirilir.

---

## 📄 Ek Dokümanlar

- `ROADMAP.md` — tamamlanan ve planlanan özellikler
- `CONCERTLY_MASTER_DOKUMAN.md` — kapsamlı proje dokümanı
- `CONCERTLY_PITCH_DECK.md` — sunum içeriği
- `CLAUDE.md` — geliştirme ortamı notları
