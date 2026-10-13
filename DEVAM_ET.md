# DEVAM ET — Concertly kaldığımız yer

> **Claude: Yeni oturumda İLK İŞ bu dosyayı baştan sona oku.** Sonra Emre'ye kısaca
> "en son şurada kalmıştık, sırada şunlar var" de ve ne yapmak istediğini sor.
> Bu dosya 13 Ekim 2026'da, Emre'nin üyeliği bitmeden önce yazıldı.

---

## 1. Şu anki durum (13 Ekim 2026 akşamı)

- **Dal:** `main`. Son commit **8d479e0** — push edildi, `origin/main` ile aynı.
- **Çalışma ağacı temiz.** Takip dışı yalnız `.claude/agents/*` ve `screenshots/oyun.png`
  (Emre'ye ne olacakları hâlâ sorulmadı; commit'e eklenmesin).
- **Canlıya HİÇBİR ŞEY çıkmadı.** Render'da otomatik deploy kapalı. Canlı backend eski bir
  sürümde; canlı veritabanında (Neon) V7–V29 migration'ları çalışmadı (aşağıdaki sıraya bak).
- Bütün testler yeşil: backend **854 test, 0 hata**; mobil babel + TR/EN parite **2140/2140**.

### Bu oturumda yapılan ve push edilen işler (sırayla)

| Commit | İçerik |
|---|---|
| 296c6f0 | Konser Arkadaşı ekranı bileşenlere bölündü (konser/tür filtresi, konsere göre liste, eşleşme ekranı) |
| b59856e | Admin uygulama ayarları (bakım modu, özellik anahtarları, duyuru bandı, yeni hesap limitleri), işlem kaydı, sanatçı/mekân düzenleme (elle foto kilidi), tüm topluluklar, organizatör başvurusu + paneli (benzersiz görüntülenme, listeden mekân, zorunlu bilet linki), organizatör incelemesi, kullanıcı moderasyonu (süreli yasak, uyarı, not, rozet) — V22–V27 |
| b9a143c | Moderasyon kuyruğu (aynı içeriğe gelen şikâyetler tek kartta, tek dokunuşla gizle/uyar/yasakla, toplu işlem) + admin ana sayfası (dönem karşılaştırmalı sayılar, günlük grafik, bekleyen işler) — V28 |
| 8d479e0 | Organizatör herkese açık profili + takip + yeni etkinlik bildirimi, etkinlikte "Düzenleyen", katılımcılara duyuru (24 saatte bir), etkinlik sahiplenme + admin onayı — V29 |

Ayrıntılı geçmiş Claude'un hafızasında (`project-concertly-state.md`) da var.

---

## 2. Sırada ne var (Emre'ye sor, karar onun)

1. **Canlıya çıkış** — en önemlisi. Uzun süredir yalnız yerelde geliştirildi. Sıra aşağıda (bölüm 3).
2. **Küçük açık öneri:** organizatörün *sahiplendiği* bilet sitesi etkinliğini gece çalışan
   senkron yeniden güncelleyebilir → organizatörün düzenlemesi ezilebilir. Çözüm: mekândaki
   `admin_edited` gibi etkinliğe kilit (`organizer_id` doluysa senkron yalnız boş alanları doldursun).
3. **Telefonda test edilmemiş akışlar** (Emre en son organizatör O1'i ve kullanıcı detayını test etti):
   moderasyon kuyruğu, admin ana sayfası, organizatör profili / duyuru / sahiplenme.
4. Takip dışı dosyalar: `.claude/agents/*`, `screenshots/oyun.png` — commit mi, silinsin mi?

---

## 3. CANLIYA ÇIKIŞ SIRASI (adım adım)

> Emre teknik değil; her adımı sade dille, tek tek birlikte yapın. Bir adım bitmeden diğerine geçme.

### A) Hazırlık (hesaplar)
1. **Apple Developer hesabı** ($99/yıl) — App Store ve TestFlight için şart.
2. **Brevo** (ücretsiz e-posta): brevo.com → hesap → *Senders*'a `Concertly <adres>` ekle, onay
   mailine tıkla → *SMTP & API* → API key (`xkeysib-...`). Olmadan kayıt kodu ve "şifremi
   unuttum" maili GİTMEZ.
3. **Cloudflare R2** (yüklenen fotoğraflar; Render free diski kalıcı değil): kova aç, public erişim
   (r2.dev ya da alan adı, **https**), R2 API token al. Panelde kovanın *listeleme* iznini KAPALI tut.
4. *(İsteğe bağlı)* **Sentry** hesabı (çökme raporları): DSN al.

### B) Güvenlik temizliği
5. Render'daki `claude` API key'ini sil.
6. Daha önce sohbete yapıştırılan **Neon şifresini yenile** ve Render'daki `DB_PASSWORD`'ü güncelle.

### C) Veritabanı (Neon) — backend deploy'undan ÖNCE
7. **Neon yedeği al** (pg_dump ya da Neon panelinden branch).
8. Kontrol: `SELECT count(*) FROM poll_votes` — V20 yinelenen anket oylarını siler, sayıyı not al.
9. Migration'ları **sırayla, elle** çalıştır (canlıda Flyway kapalı; hepsi tekrar çalıştırmaya
   dayanıklı, `IF NOT EXISTS` vb. var). Dosyalar: `backend/src/main/resources/db/migration/`
   - **V7 → V21** (önceki turlar; V12 olmadan Bubilet kayıtları sessizce atlanır, V15 olmadan
     Zorlu/BiletimGo/Biletino yazılamaz, V17/V18/V19/V20/V21 olmadan ilgili sorgular HATA verir)
   - **V22 → V29** (bu oturum). **V26 mutlaka elle** — entity'si yok, otomatik oluşmaz;
     yoksa görüntülenme sessizce sayılmaz.
   - V6'nın canlıda çalışıp çalışmadığı belirsiz — tablolarda `reset_token_attempts` sütunu var mı bak, yoksa V6'yı da çalıştır.

### D) R2'ye taşıma — R2'li sürümü deploy etmeden ÖNCE
10. `backend/scripts/migrate-uploads-to-r2.mjs` — önce kuru çalıştır, sonra `--apply`
    (`DATABASE_URL`=Neon, `SOURCE_ORIGIN`=canlı adres).

### E) Render ortam değişkenleri
11. E-posta: `BREVO_API_KEY`, `MAIL_FROM=Concertly <adres>`, **`EMAIL_VERIFICATION_ENABLED=true`**
12. R2: `STORAGE_TYPE=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
    `R2_PUBLIC_URL` (https olmalı; eksik/yanlışsa uygulama AÇILMAZ)
13. `LAUNCH_CITIES` değişkeni varsa **sil** (eski 4 şehri dayatır; şehirler artık Admin → Şehirler'den).
14. `SYNC_TRIGGER_TOKEN` (aynı değeri GitHub secret olarak da ekle → yedek gece senkronu).

### F) Backend deploy
15. Render'da manuel deploy. Sonra kontrol: `/actuator/health`, giriş, bir fotoğraf yükleme,
    kayıt kodunun e-postaya gelmesi (Spam dahil).
16. **Uyuma sorunu:** Render free 15 dk boşta uyur (~1,5 dk açılış). cron-job.org ile
    `/actuator/health`'e 10 dakikada bir istek kur (gece 04:00 senkronu ve 09:00 hatırlatma da buna bağlı).
17. *(İsteğe bağlı)* Admin ile `POST /api/artists/enrich` (Spotify bağlantıları; canlıda hiç çalışmadı).

### G) Mobil
18. **Yeni EAS build şart** (react-native-gesture-handler yeni native paket; OTA yetmez).
    Sentry kullanılacaksa `EXPO_PUBLIC_SENTRY_DSN` EAS env'e. İlk preview build'de OTA güncellemesini de dene.
19. **Backend ve mobil BİRLİKTE çıkmalı:** yeni backend, ad + doğum tarihi istemeyen eski
    uygulamadan kayıt KABUL ETMEZ.
20. TestFlight → App Store. Gizlilik etiketinde (Sentry varsa) "Crash Data" beyan et.

### Sonra hatırla
- **Open-Meteo** (hava durumu) ücretsiz katmanı ticari kullanıma kapalı; uygulama gelir getirmeye başlarsa ücretli plan ya da başka sağlayıcı.

---

## 4. Çalışma kuralları (Emre ile)

- Türkçe konuş. Emre teknik değil; sade anlat.
- **Commit'i Emre atar.** Claude `git commit`/`git push` çalıştırmaz; komutları metin olarak verir
  (`concertly-commit` skill'i). Commit mesajına **Co-Authored-By satırı EKLENMEZ**.
- Yıkıcı git komutu yok (`checkout --`, `restore`, `reset --hard`, `stash`).
- Her değişiklikten sonra `concertly-verify` skill'i: mobilde babel + TR/EN parite, backend'de
  `./mvnw -q -o clean package -DskipTests` + `./mvnw -q -o test` (pipe kullanma, çıkış kodunu gizler).
- **Yerel backend portu 8084**; backend'i **Emre** yeniden başlatır (backend değişince hatırlat).
  Claude kendi denemeleri için geçici sunucuyu **8086**'da açıp sonra kapatır.
- Yerel DB: `PGPASSWORD=1234 "C:/Program Files/PostgreSQL/16/bin/psql.exe" -U postgres -d concertly_mobile`
  (Türkçe karakterli SQL'i dosyadan çalıştır).
- Yerel admin hesabı: e-posta `d` / şifre `d`.
- Uçtan uca testte oluşturduğun veriyi mutlaka sil; Emre'nin kendi test verisine dokunma.
- Muğlak arayüz isteğinde bilinen bir uygulamaya benzeterek tek soruda netleştir, sonra harfiyen uygula.
- Android `Alert` en fazla 3 düğme gösterir → fazlası için alttan açılan sayfa kullan.
- RN 0.86'da `StyleSheet.absoluteFillObject` YOK → `absoluteFill` ya da açık `position: 'absolute'`.

## 5. Yerel test verisi (canlıda YOK)

- **100 test kullanıcısı:** `*@seed.concertly.test`, şifre `Test1234!` (ör. `tuna.korkmaz1@seed.concertly.test`).
  Silmek için: `Desktop/concertly-backup/seed-users/cleanup.sql` + `seed.manifest.txt`'teki fotoğraflar.
- Emre'nin kendi denemeleri: organizatör **#3 "Ulu Live Concert"** (şu an askıda), etkinlik
  **12156 "Hadise Congresium"**, açık şikâyetler **#1, #2**. Bunlara dokunma.
