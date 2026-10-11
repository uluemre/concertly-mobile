# Son Doğrulama: Post ve Konser Arkadaşı

**Tarih:** 11 Ekim 2026 · **Süreç:**
1. Haiku UX denetimi.
2. Sonnet bağımsız denetimi ve Haiku doğrulaması.
3. Opus kararları ve uygulama. Backend'i Opus yönetiminde bir uygulayıcı ajan yazdı.
4. Sonnet son incelemesi.
5. Opus düzeltmeleri.

Belgeler: `haiku-ux-audit.md`, `sonnet-review.md`, `implementation-plan.md`, `sonnet-final-review.md`.

## 1. Başlangıçtaki en önemli sorunlar

1. **Unmatch sohbeti kapatmıyordu.** Eşleşmeyi kaldıran kişiye karşı taraf yazmaya devam edebiliyordu.
2. **Deste kartında engelle, şikâyet ya da profil yolu yoktu.** Uygulamanın kendi güvenlik metni ise bu yolu vaat ediyordu.
3. **`GET /events/{id}/buddies` gizliliği deliyordu.** Herkese açıktı ve gizli hesapların şehri ile mesajı görünüyordu.
4. **Anket oyu başka gönderinin seçeneğine yazılabiliyordu.** Ayrıca unique kısıt yoktu.
5. **Gönderi detayında ve yorumlarda şikâyet ya da engel yolu yoktu** (App Store 1.2 riski). Gönderi sahibi yorum silemiyordu.
6. **Bağlantı hatasında oturum kapanıyordu.** Ağ yokken ya da sunucu uyanırken refresh düşünce kullanıcı Login'e atılıyordu.
7. **Kaydırma ve geri alma hataları sessizdi.** Kart kayboluyor, kullanıcı beğendiğini sanıyordu.
8. **Hatalar "boş" gibi görünüyordu:** yorumlar, deste, sohbet, profil gönderileri ve akışın ikinci sayfası.

## 2. Post tarafında yapılanlar

- **Ortak eylem modeli:**
  - `usePostActions`: "⋯" menüsü. Sahibi için Düzenle/Sil, diğerleri için Şikâyet/Engelle. Akış kartında ve gönderi detayında aynı.
  - `ReportSheet` + `useReport`: tek şikâyet alt sayfası. Android'deki 4 düğmeli Alert sorununu çözer. Beş yerde kullanılıyor: gönderi, yorum, profil, sohbet, topluluk.
- **Gönderi detayı:**
  - "⋯" menüsü.
  - Yorum menüsü: kendi yorumunu sil; kendi gönderinde başkasının yorumunu şikâyet et veya sil; diğerlerinde şikâyet et veya engelle.
  - Anket kartı (önceden hiç çizilmiyordu).
  - Yorum yükleme hatası için "tekrar dene".
  - Başlık yorum yazarken artık yeniden kurulmuyor.
  - Yorumcu fotoğrafı.
  - Tek sayaç kaynağı.
  - Avatar harfi açık temada okunuyor.
- **Beğeni:** iyimser güncelleme. Hata olursa geri alınıyor ve bildiriliyor. Sunucu idempotent: tekrar beğeni 204 döner.
- **Akış:**
  - Sonraki sayfa düşerse altta "tekrar dene".
  - Kimliğe göre tekilleştirme.
  - Yeni gönderi Takip akışının başına ekleniyor; Takip akışı artık kendi gönderilerini de içeriyor.
  - Boş Takip akışında sessiz sekme değişimi yerine açıklama.
  - Liste doluyken yenileme hatası bildiriliyor.
- **Kart:**
  - Görsele dokununca detay açılıyor. Yazısız görsel gönderisinin başka giriş noktası yoktu.
  - "düzenlendi" etiketi.
  - Aksiyon dokunma alanı ≥44 pt.
- **Gönderi oluşturma:**
  - Çift gönderim kilidi.
  - Geçersizken Paylaş pasif.
  - Dolu formdan çıkarken "Taslağı at?" onayı (geri tuşu ve kenardan kaydırma dahil; oturum sonu hariç).
  - Anket seçeneği 60 karakter, sunucuyla aynı.
  - Emoji düğmelerine etiket.
- **Sunucu:**
  - Gönderi doğrulaması: tür, anket 2–4 seçenek ve ≤60 karakter, yalnızca kendi görsel adreslerimiz, boş içerik.
  - PATCH'te boş içerik reddi (görsel gönderisinde yazı boşaltılabilir).
  - Akış `size` ≤ 50.
  - Yorumlar eskiden yeniye.
  - `commentCount` gizli yorumu saymıyor (trend skoru dahil).
  - Gönderi sahibi yorum silebiliyor; yetkisiz silme 403.
  - Şikâyet türü, hedef ve gerekçe uzunluğu doğrulaması.
  - Yasaklı kullanıcılar akışlarda görünmüyor.
- **Temizlik:** ölü `CommentModal.js` silindi. `CLAUDE.md` gerçeğe göre düzeltildi (refresh rotasyonu yok, "yanıtlar" özelliği yok).

## 3. Konser Arkadaşı tarafında yapılanlar

- **Unmatch kalıcı (`unmatched_at`).**
  - İki yönde yeni mesaj 403 `BUDDY_UNMATCHED`.
  - Kaldırılmış çifte yeni beğeni de 403.
  - Geri alma yalnızca son 10 dakikadaki ve kaldırılmamış kaydırmada.
  - Sohbet ekranı `GET /messages/status/{id}` ile yazma alanı yerine "bu sohbet kapandı" bandı gösteriyor.
  - Onay metni sohbetin kapanacağını söylüyor.
- **Deste kartında "⋯":** Profili gör / Şikâyet et / Engelle. Engellenen kişi hemen desteden çıkıyor. Güvenlik metni yeni yolu anlatıyor.
- **Uyum yüzdesi:** dokununca neye göre hesaplandığı açıklanıyor ("bir tahmindir, kişiyi puanlamaz").
- **Hata yönetimi:**
  - Kaydırma ağ hatasında kart geri geliyor.
  - Kalıcı 4xx'te kart kalkıyor ve açıklama gösteriliyor.
  - Geri alma hatası ve süre dolması bildiriliyor.
  - İlk yükleme hatası için "Bağlantı kurulamadı / Tekrar dene".
  - Kapanmış ya da geçmiş konserde "arkadaş arıyorum" açılamıyor ve kullanıcıya söyleniyor.
- **Durum tutarlılığı:**
  - Ekrana dönüşte geri al ve kaydırılanlar korunuyor.
  - Uçuşta bir kart varken yenileme yapılmıyor.
  - Uçan karta yeniden dokunulamıyor (deste kilitlenmesi giderildi).
  - Yenilemeden sonra geri alınan kart desteye ekleniyor.
- **Eşleşmeler:**
  - Yeni eşleşmeler iki kez görünmüyor.
  - Yeni eşleşmede görünür "⋯" ve ekran okuyucu eylemi.
  - Kaldırma hatası bildiriliyor.
- **Sunucu:**
  - Kaydırma transaction içinde, çift için kilit (advisory lock) ve upsert. Eşzamanlı karşılıklı beğenide tek eşleşme ve tek bildirim; tekrar kaydırma 200.
  - Yasaklı kullanıcılar destede ve eşleşmelerde görünmüyor.
  - `GET /events/{id}/buddies` artık girişli. Engelli ve yasaklı süzülüyor. Gizli hesabın şehri ve mesajı yalnızca onaylı takipçiye görünüyor.
  - Katılımda etkinlik uygunluğu kontrol ediliyor.
  - Mesaj ≤ 1000 karakter; `receiverId` zorunlu.
- **Erişilebilirlik:**
  - Switch etiketinde konser adı.
  - Filtre çiplerinde rol, durum ve dokunma alanı.
  - Sekmeler ≥44 pt.
  - Uyum etiketi 11 pt.
- **Sohbet:**
  - İlk yükleme hatası için "tekrar dene".
  - Yoklamada değişiklik yoksa yeniden çizim yok.
  - Uçuştaki mesaj kaybolmuyor.

## 4. Tasarım ve mimari kararlar

Gerekçeleri `implementation-plan.md` Bölüm 2'de. Özetle:
- Görsel dil korundu. Değişiklikler güven, dürüst durumlar ve sunucuda zorlanan kurallar üzerine.
- Yeni native bağımlılık eklenmedi, yeni build gerekmiyor.
- Ortak bileşenler: `ReportSheet`, `usePostActions`, `PostEditModal`. Bunlara ek olarak `services/postUpdates.js` genişletildi (patch / remove / hideUser / create).
- Gizli hesapta deste fotoğrafı bilerek gösterilmeye devam ediyor.
- "Geçtim"in kalıcılığı bu turda değişmedi.

## 5. Değiştirilen önemli dosyalar

- **Mobil, yeni:** `components/ReportSheet.js`, `components/feed/usePostActions.js`, `components/feed/PostEditModal.js`.
- **Mobil, değişen:**
  - Servis ve bileşenler: `services/api.js`, `services/postUpdates.js`, `components/feed/PostCard.js`, `PollCard.js`, `components/home/HomePostCard.js`.
  - Ekranlar: `screens/FeedScreen.js`, `PostDetailScreen.js`, `CreatePostScreen.js`, `UserProfileScreen.js`, `ChatScreen.js`, `CommunityDetailScreen.js`, `ConcertBuddyMatchScreen.js`.
  - Diğer: `i18n/translations.js` (+26 anahtar, 3 metin güncellendi), `utils/communityErrors.js`.
- **Mobil, silinen:** `components/feed/CommentModal.js`.
- **Backend, değişen:**
  - Servis ve controller'lar: `PostService`, `CommentService`, `ModerationService`, `MessageService`, `BuddyMatchService`, `CommentController`, `MessageController`, `ModerationController`, `ConcertBuddyController`.
  - Repository'ler: `PostRepository`, `CommentRepository`, `LikeRepository`, `BuddySwipeRepository`.
  - Model ve DTO'lar: `BuddySwipe`, `PollVote`, `ContentLimits`, `PostResponse`, `CommentResponse`, `SecurityConfig`.
- **Backend, yeni:** `ReportTargetValidator`, `V20__post_buddy_integrity.sql`, `PostBuddyIntegrityTest` (27 test).
- **Belge:** `CLAUDE.md`.

## 6. Çalıştırılan testler ve gerçek sonuçlar

| Kontrol | Sonuç |
|---|---|
| Backend `./mvnw test` (son düzeltmelerden sonra Opus tarafından yeniden koşuldu) | **816 test, 0 başarısız, 0 hata, 13 atlanan** (atlananlar bu turdan önce de atlanıyordu) |
| `contextLoads` (gerçek yerel PostgreSQL; bütün `@Query` sorgularını açılışta doğrular) | Geçti, son kod değişikliğinden sonra |
| Native SQL duman testi (yerel PostgreSQL, ROLLBACK'li transaction) | `INSERT … ON CONFLICT DO NOTHING` iki kez çalıştı, çift başına tek satır kaldı. `pg_advisory_xact_lock` iki ayrı bağlantıda gerçekten bekletti: ikinci bağlantı ~2,1 sn bekledi. |
| Mobil Babel derlemesi (değişen tüm dosyalar) | Temiz |
| TR/EN çeviri paritesi | 1491 / 1491 |
| Tanımsız isim taraması (Babel AST, değişen dosyalar) | Temiz |
| Kodda kullanılan her `t('…')` anahtarı tanımlı mı | Evet, eksik yok |
| `npx expo export --platform ios` | Başarılı (2082 modül) |
| Mobil lint / type-check / birim test | **Projede yok**, çalıştırılamadı |
| Cihazda ya da simülatörde görsel test | **Yapılmadı** (bu ortamda simülatör yok). Aşağıdaki elle test listesi Emre için. |

## 7. Son incelemede bulunup düzeltilenler

`sonnet-final-review.md`, koşullu PASS:
- **F-1:** yenilemeden sonra geri al kartı getirmiyordu → kart `cards`'a geri ekleniyor.
- **F-2:** uçan kartı sürüklemek desteyi kilitleyebiliyordu → uçuşta sürükleme kapalı; animasyon kesilse de kayıt gönderiliyor.
- **F-3:** yeni gönderi Trend'e de ekleniyordu ve yenileme hatası sessizdi → yalnızca Takip'e ekleniyor, hata bildiriliyor.
- **F-4:** kalıcı 4xx'te kart geri geliyordu → kalkıyor.
- **F-5:** "taslağı at?" oturum sonu reset'ini de engelliyordu → reset muaf.
- **F-7:** düzenleme sınırı 1000'di, sunucu 500 → 500.
- **F-8:** profil ve sohbetten engellemede listeler güncellenmiyordu → güncelleniyor.
- **F-10:** `CLAUDE.md` ve plan metni gerçeğe göre güncellendi.
- **B-1:** native SQL gerçek PostgreSQL'de denendi (yukarıda).

## 8. Çözülemeyen ya da bilerek bırakılanlar

- **F-6:** bazı küçük yazılar hâlâ 11 pt altında, örneğin tarih rozetindeki ay (9,5 pt). Rozet sığmıyor; bu bilinçli bir istisna.
- **Akışta düzenleme modalı açıkken kart geri dönüştürülürse PATCH yanlış gönderiye gidebilir.** Olasılık çok düşük (modal tam ekran, kaydırma yok). Not edildi.
- **Gerçek iki istemcili eşzamanlı karşılıklı beğeni testi yapılmadı.** Servis mantığı birim testte, kilit ise veritabanında ayrı ayrı doğrulandı.
- **Kapsam dışı:** imleç sayfalama, deste N+1, konser bazlı "geçtim", sohbet artımlı çekim, görsel küçültme, gesture-handler, refresh token rotasyonu, profil sayfalaması, `insets.top` geçişi. Gerekçeleri plan Bölüm 5'te.

## 9. Backend / API'de ek iş gerektirenler

- `GET /posts/{id}` ve yorum listesinde yasaklı yazarın içeriği gizlenmiyor (ürün kararı). Gerekirse iki satırlık bir ek.
- İmleç sayfalama ve trend önbelleği.
- Konser bazlı "geçtim" ve eşleşme arşivi (şema).
- Sohbet için artımlı (`afterId`) çekim.

## 10. Üretime çıkış öncesi kalan riskler

1. **V20 canlıya backend'den ÖNCE elle çalıştırılmalı.** Canlıda Flyway kapalı ve `DDL_AUTO=validate`. `buddy_swipes.unmatched_at` yoksa yeni backend açılmaz ya da mesaj gönderimi ve kaydırma 500 verir. Önce `poll_votes` yinelenen sayısına bakılmalı (V20 yinelenenleri siler).
2. **Sıra:** Neon yedeği → V20 → backend deploy → mobil (OTA). Sürümler arası uyumluluk:
   - **Eski mobil + yeni backend çalışır.** Unmatch sonrası sohbette yalnızca genel hata görünür, sebep yazmaz.
   - **Yeni mobil + eski backend çalışır.** Yorum sırası eski düzende kalır, kapalı sohbet bandı görünmez.
3. **Yerelde duman testi önerilir.** Backend'i yeniden başlatıp şunları dene:
   - Beğeni ve beğeniyi geri alma.
   - Anket oyu.
   - Yorum silme (gönderi sahibi olarak).
   - İki hesapla eşleş, unmatch et ve iki taraftan mesaj dene.
4. **Cihaz testi yapılmadı.** Aşağıdaki liste telefonda doğrulanmalı.

## Elle test listesi (telefon)

**Post**
1. **Akış:** bir gönderiyi beğen ve beğeniyi geri al. Uçak modunda beğen: kalp eski hâline dönmeli ve uyarı çıkmalı.
2. **Yazısız görsel gönderisi:** görsele dokun, detay açılmalı.
3. **Detay "⋯":**
   - Kendi gönderinde Düzenle → kaydet → "düzenlendi" etiketi.
   - Başkasınınkinde Şikâyet et → alt sayfa açılmalı (Android'de "Vazgeç" görünmeli) → teşekkür mesajı.
4. **Detay, yorumlar:**
   - Kendi gönderinde başkasının yorumu → "⋯" → Sil.
   - Başkasının gönderisinde → Şikâyet / Engelle.
5. **Anket gönderisi:** detayda seçenekler görünmeli, oy verilebilmeli.
6. **Gönderi oluştur:**
   - Boşken Paylaş soluk olmalı.
   - Yazıp geri kaydır → "Taslak silinsin mi?".
   - Paylaş → Takip akışında en üstte görünmeli.
7. **Akış, sonraki sayfa:** ağı kapatıp aşağı kaydır → altta "tekrar dene" çıkmalı.

**Konser Arkadaşı**

8. **Kart "⋯":** Profili gör / Şikâyet et / Engelle. Engelleyince kart gitmeli.
9. **Uyum yüzdesi:** dokununca açıklama çıkmalı.
10. **Kaydırma hatası:** uçak modunda kaydır → kart geri gelmeli ve uyarı çıkmalı.
11. **Geri al:** kaydır → profil aç → geri dön → Geri al hâlâ çalışmalı.
12. **Unmatch:** iki hesapla eşleş ve unmatch et. İki tarafın sohbetinde de "bu sohbet kapandı" bandı görünmeli.
13. **Yeni eşleşmeler:** sohbet yokken her kişi bir kez görünmeli; avatar köşesindeki "⋯" çalışmalı.
