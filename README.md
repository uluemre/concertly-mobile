# 🎵 EN- Concertly

**A full-stack social platform for concert and live event enthusiasts.** Discover concerts, share location-verified experiences, find concert buddies, follow artists, and connect with fellow music fans.

|                       |                                        |
| --------------------- | -------------------------------------- |
| 📱 **Frontend**       | React Native (Expo)                    |
| ⚙️ **Backend**        | Spring Boot 3.5 · Java 17 · PostgreSQL |
| 🔐 **Authentication** | JWT (Access + Refresh Tokens)          |
| 🌍 **Languages**      | English / Turkish                      |
| 🎨 **Theme**          | Dark / Light Mode                      |

---

## ✨ Features

### User Features

* 🎫 **Event Discovery** — Browse concerts and festivals by city, genre, and artist (Ticketmaster integration)
* 📍 **Location-Verified Posts** — Create verified posts when you are within 200 meters of an event venue
* 🤝 **Concert Buddy Matching** — Swipe-based matching system for people attending the same concert
* 🛂 **Concert Passport** — Track attended events and earn achievement badges
* ⭐ **Event & Venue Reviews** — Rate and review concerts and venues
* 👥 **Communities** — Join groups based on music preferences and participate in discussions
* 🎧 **Spotify Integration** — Personalized artist and concert recommendations based on listening history
* 📊 **Social Feed** — Text, image, and poll posts with likes, comments, and follows
* 🗺️ **Interactive Map** — View nearby events directly on a map
* 🔔 **Notifications**, 🏅 **Achievements**, and 📅 **Calendar Integration**

### Admin Features

* 📊 Analytics dashboard with user, event, post, and engagement metrics
* 🎵 Event management: create, edit, approve, and remove events
* 👥 User management: ban/unban users and manage admin roles
* 📝 Content moderation tools

---

## 🗂️ Project Structure

```text
concertly-mobile/
├── mobile/                  # React Native (Expo) application
│   └── src/
│       ├── screens/         # 30+ screens
│       ├── components/      # Shared UI components
│       ├── navigation/      # Navigation system
│       ├── context/         # Auth & Language contexts
│       ├── i18n/            # Localization files
│       ├── services/        # API services and token refresh
│       └── theme.js         # Theme configuration
│
├── backend/                 # Spring Boot REST API
│   └── src/main/java/com/concertly/backend/
│       ├── controller/
│       ├── service/
│       ├── repository/
│       ├── model/
│       ├── security/
│       └── exception/
│
└── screenshots/             # Application screenshots
```

---

## 🚀 Installation

### Prerequisites

* Node.js 18+
* Java 17+
* PostgreSQL
* Expo Go (for mobile testing)

### 1. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE concertly_mobile;
```

The schema is automatically generated using:

```properties
spring.jpa.hibernate.ddl-auto=update
```

### 2. Backend

```bash
cd backend
./mvnw spring-boot:run
```

Default server:

```text
http://localhost:8082
```

Environment variables:

| Variable              | Description               |
| --------------------- | ------------------------- |
| DB_URL                | PostgreSQL connection URL |
| DB_USERNAME           | Database username         |
| DB_PASSWORD           | Database password         |
| JWT_SECRET            | JWT signing secret        |
| SPOTIFY_CLIENT_ID     | Spotify API Client ID     |
| SPOTIFY_CLIENT_SECRET | Spotify API Secret        |
| TICKETMASTER_API_KEY  | Ticketmaster API Key      |

Run tests:

```bash
./mvnw test
```

Build:

```bash
./mvnw package
```

### 3. Mobile App

```bash
cd mobile
npm install
npm start
```

Scan the generated QR code with Expo Go.

Both your computer and mobile device must be connected to the same network.

---

## 🔌 API Overview

All endpoints are available under:

```text
/api
```

Authentication uses JWT Bearer tokens.

### Main Endpoint Groups

| Category       | Examples                                      |
| -------------- | --------------------------------------------- |
| Authentication | Register, Login, Refresh Token                |
| Events         | Event listing, details, attendance, bookmarks |
| Social         | Posts, comments, likes, polls                 |
| Concert Buddy  | Matching and swipe actions                    |
| Communities    | Groups and community posts                    |
| Spotify        | Music recommendations                         |
| Admin          | Statistics and moderation                     |

---

## 🧪 Testing

```bash
cd backend
./mvnw test
```

Unit tests are located under:

```text
src/test/java
```

Example:

```text
JwtUtilTest
```

---

## 🌍 Internationalization

Concertly supports multiple languages through a centralized translation system.

* English and Turkish translations
* Dynamic language switching
* Persistent user preferences using AsyncStorage

---

## 📄 Documentation

* ROADMAP.md — Project roadmap
* CONCERTLY_MASTER_DOKUMAN.md — Detailed project documentation
* CONCERTLY_PITCH_DECK.md — Pitch deck content
* CONCERTLY_PRESENTATION_BLUEPRINT.md — Presentation plan
* CLAUDE.md — Development environment notes

---

## 🎯 Vision

Concertly aims to become a dedicated social platform for live music enthusiasts by combining event discovery, social networking, community building, and real-world concert experiences into a single ecosystem.


# 🎵 TR-Concertly

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

**Demo verisi (opsiyonel):** `backend/seeds/` altındaki SQL dosyalarını pgAdmin'de sırayla çalıştır (`seed_fake_data.sql` → `seed_buddy_data.sql` → `seed_games_data.sql`). Sahte kullanıcılar, postlar, buddy eşleşmeleri ve oyun skorlarıyla uygulama dolu görünür. Hepsi idempotent — tekrar çalıştırmak güvenlidir.

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
- `docs/CONCERTLY_MASTER_DOKUMAN.md` — kapsamlı proje dokümanı
- `docs/CONCERTLY_PITCH_DECK.md` — sunum içeriği
- `docs/CONCERTLY_PRESENTATION_BLUEPRINT.md` — sunum planı
- `CLAUDE.md` — geliştirme ortamı notları
