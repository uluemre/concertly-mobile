# Uygulama Planı: Post ve Konser Arkadaşı (Opus kararları)

**Tarih:** 11 Ekim 2026 · **Girdi:** `haiku-ux-audit.md` (31 bulgu) + `sonnet-review.md` (41 bağımsız bulgu, Haiku doğrulaması, birleşik liste)

## 1. Yaklaşım

İki rapor birbirini büyük ölçüde doğruladı. Sonnet'in iki reddini kabul ediyorum: P-03 yalnızca hiçbir yerden import edilmeyen `CommentModal.js` için geçerli, P-13'te ise FAB aksiyon satırını örtmüyor. Önem düşürmelerini de kabul ediyorum (B-02 Kritik→Yüksek, P-01 ve P-06 Yüksek→Orta).

Ana ilke: **mevcut tasarım dilini koru, güveni ve doğruluğu düzelt.** Görsel kimlik zaten oturmuş durumda: koyu varsayılan tema, Bricolage başlıklar, iskeletler ve Reanimated hareketleri. İki raporun ortak mesajı da şu: asıl sorun görünüş değil.

1. Kullanıcıyı koruma vaadi tutulmuyor: unmatch, engelle ve şikâyet yolları eksik.
2. Hatalar sessiz kalıyor ve "boş" gibi görünüyor.
3. Bazı backend kuralları yalnız mobilde uygulanıyor: anket, gönderi doğrulaması, gizlilik.

Bu yüzden yeniden tasarım "yeni ekran" değil. Şu üç şeyi kapsıyor:
- Her gönderi ve kişi yüzeyinde **tutarlı bir eylem modeli**: tek bir "⋯" menüsü ve tek bir şikâyet sayfası.
- **Dürüst durumlar**: yükleniyor, boş ve hata birbirinden ayrı; her hatanın bir kurtarma yolu var.
- **Sunucuda zorlanan kurallar.**

## 2. Ürün kararları (gerekçeli)

| Konu | Karar | Gerekçe |
|---|---|---|
| Unmatch sonrası sohbet | Sohbet **kapanır**. Geçmiş kalır, iki taraf da yeni mesaj gönderemez (403 `BUDDY_UNMATCHED`). Sohbet ekranında "Bu sohbet kapatıldı" bandı görünür. Onay metni bunu açıkça söyler. | Kaldırma eylemi koruma vaat ediyor. Geçmişi silmek ise şikâyet kanıtını yok eder. |
| Unmatch geri alınabilir mi | Hayır. `undo` yalnızca **son 10 dakikadaki ve kaldırılmamış** kaydırmayı geri alır. | Unmatch işaretinin undo ile silinip sohbetin yeniden açılmasını engeller. |
| Deste kartı güvenliği | Kartta "⋯" menüsü var: Profili gör, Şikâyet et, Engelle. Engellenen kişi desteden anında çıkar. | Uygulamanın kendi güvenlik metni bu yolu vaat ediyor. |
| `GET /events/{id}/buddies` | **Giriş zorunlu.** Engelli ve yasaklı kullanıcılar süzülür. Gizli hesabın şehri ve mesajı, izleyici onu takip etmiyorsa boş gelir. | Yabancılarla buluşma bağlamında kullanıcı adı, şehir ve mesaj anonim olarak kazınamaz. Uygulama zaten girişli çalışıyor. |
| Gizli hesapta deste fotoğrafı | **Gösterilmeye devam eder.** | Buluşma güveninde yüz önemli. Kişi zaten bilerek "arkadaş arıyorum" dedi. Şehir, bio ve türler gizli kalmaya devam ediyor. |
| "Geçtim"in kalıcılığı (S-B-09) | **Bu turda değişmiyor**, sonraki işlere yazıldı. | Şema ve ürün kararı gerektiriyor. Mevcut davranış güvenli tarafta. |
| Yorum sırası | **Eskiden yeniye** (konuşma düzeni). Sunucu `Asc` döner, yeni yorum sona eklenir. | Detay ekranı zaten sona ekleyip aşağı kaydırıyor. |
| Gönderi sahibinin yetkisi | Gönderi sahibi kendi gönderisindeki **herhangi bir yorumu silebilir**. Yetkisiz silme 400 değil **403** döner. | Taciz yorumuna karşı sahibine kontrol verir. |
| Takip akışı | Kullanıcının **kendi gönderileri de** dahil. | "Paylaştım ama yok" algısını giderir. |
| "Düzenlendi" etiketi | `updatedAt > createdAt + 60 sn` ise kartta "düzenlendi" yazar. `Post.updatedAt` zaten var, yalnızca DTO'ya ekleniyor. | Şema değişikliği gerektirmiyor. |
| Şikâyet nedeni seçimi | Alert yerine ortak **`ReportSheet`** alt sayfası kullanılır. | Android'de 4 düğmeli Alert iptal düğmesini düşürür. Tek bileşen beş yerde kullanılacak. |
| Yeni bağımlılık | **Yok.** Görsel küçültme (`expo-image-manipulator`) ve `gesture-handler` sonraki işlere yazıldı. | Native modül yeni build ister. Prompt da gereksiz bağımlılık istemiyor. |

## 3. API sözleşmesi (backend ↔ mobil)

Hata kodları `err.response.data.message` içinde gelir (mevcut desen).

- `POST /api/posts/{id}/poll/vote`: seçenek başka gönderiye aitse ya da gönderi POLL değilse 400 `POLL_OPTION_INVALID`. `(user_id, post_id)` unique.
- `POST /api/posts/{id}/like`: zaten beğenilmişse **204** (idempotent). `DELETE`: beğeni yoksa 204.
- `POST /api/posts`: geçersiz `postType` 400 `POST_TYPE_INVALID`. POLL: 2–4 seçenek, her biri ≤60 karakter (`POLL_TOO_MANY_OPTIONS`, `POLL_OPTION_TOO_LONG`, `POLL_TOO_FEW_OPTIONS`). IMAGE: `imageUrl` yalnızca `/uploads/` ya da yapılandırılmış R2 adresi (`INVALID_IMAGE_URL`). TEXT/POLL içeriği boşsa `CONTENT_EMPTY`.
- `PATCH /api/posts/{id}`: boş içerik 400 `CONTENT_EMPTY`.
- `PostResponse`: yeni `updatedAt` alanı.
- `GET /api/posts/feed/*`: `size` en fazla 50.
- `GET /api/posts/{id}/comments`: eskiden yeniye sıralı. `CommentResponse` yeni `userProfileImageUrl` alanını taşır. `commentCount` gizli yorumları saymaz.
- `DELETE /api/posts/{postId}/comments/{commentId}`: yorum sahibi ya da gönderi sahibi silebilir. Diğerleri 403 `COMMENT_DELETE_FORBIDDEN`. Yorum başka gönderiye aitse 404.
- `POST /api/reports`: `targetType ∈ {POST, COMMENT, USER, MESSAGE}` ya da mevcut topluluk türleri, değilse 400. Hedef yoksa 404. `reason` en fazla 500 karakter.
- Unmatch (mevcut uç `DELETE /api/buddy/matches/{userId}`; uygulamada yeni uç açılmadı): çift kalıcı olarak "kaldırıldı" işaretlenir. Kaldırılmış çifte yeni beğeni de 403 `BUDDY_UNMATCHED` döner. Bundan sonra `POST /api/messages` iki yönde de 403 `BUDDY_UNMATCHED` döner. `GET /api/messages/{otherId}` yanıtı bilgi için aynen kalır.
- Sohbet kapalı mı sorusu için `GET /api/messages/status/{otherId}` → `{ "canMessage": bool, "reason": "BUDDY_UNMATCHED" | "BLOCKED" | "PRIVACY" | null }`. Mesaj gönderme kuralını yeniden kullanır.
- `POST /api/buddy/undo`: yalnızca son 10 dakikadaki ve kaldırılmamış kaydırma. Değilse 400 `UNDO_EXPIRED`.
- `POST /api/buddy/swipe`: aynı çift için kilit (advisory lock) ve upsert. Eşzamanlı karşılıklı beğenide tam olarak bir yanıt `matched=true` döner. Aynı kaydırmanın tekrarı 200 döner.
- Deste, eşleşmeler ve akış: `isActive=false` kullanıcılar görünmez.
- `GET /api/events/{id}/buddies`: giriş zorunlu (401). Engelli ve yasaklı süzülür. Gizli hesabın şehri ve mesajı yalnızca onaylı takipçiye görünür.
- `POST /api/events/{id}/buddies`: iptal edilmiş, listelenmeyen, birleştirilmiş ya da geçmiş etkinlik 400 `EVENT_NOT_JOINABLE`.
- `POST /api/messages`: `receiverId` yoksa 400. İçerik boşsa ya da 1000 karakterden uzunsa 400 (`CONTENT_EMPTY`, `CONTENT_TOO_LONG`).
- Göç `V20__post_buddy_integrity.sql`:
  - `poll_votes` için önce yinelenenleri temizle, sonra `(user_id, post_id)` unique.
  - İndeksler: `likes(post_id)`, `comments(post_id)`, `posts(user_id, created_at desc)`, `posts(created_at desc)`, `poll_votes(post_id)`, `buddy_swipes(target_id) where liked`.
  - `buddy_swipes.unmatched_at timestamp null`.
  - Canlıda elle çalıştırılacak, `ddl-auto=update` yerelde sütunu kendi ekler.

## 4. Mobil iş listesi

### Post
1. **`api.js`:** refresh yalnızca 401/403'te oturumu kapatır. Ağ hatası, zaman aşımı ve 5xx'te oturum korunur. Refresh isteğine 60 sn zaman aşımı (Render free soğuk başlangıcı ~50 sn; 15 sn uyanan sunucuyu keserdi).
2. **`components/ReportSheet.js`:** ortak şikâyet alt sayfası (3 neden + vazgeç). Tema tokenları, erişilebilirlik ve safe area.
3. **`hooks/usePostActions.js`:** sahip için Düzenle/Sil, diğerleri için Şikâyet/Engelle. PostCard ve PostDetail ortak kullanır.
4. **PostCard:**
   - İyimser beğeni: hatada geri al ve bildirim göster, 409'u başarı say.
   - Eylem menüsü hook'tan gelir.
   - Aksiyon düğmeleri ≥44 pt (hitSlop).
   - Düzenleme modalında boşken Kaydet pasif.
   - "düzenlendi" etiketi.
5. **PostDetail:**
   - "⋯" menüsü.
   - Yorum satırında şikâyet; sahibi ya da gönderi sahibi için sil.
   - PollCard.
   - Yorum yükleme hatası için "tekrar dene".
   - `ListHeader` memo'lanır (yazarken yeniden monte olmasın).
   - Avatar harfi tema rengiyle.
   - Yorumcu fotoğrafı.
   - Tek sayaç kaynağı.
6. **FeedScreen:**
   - Sayfa hatasında altta "tekrar dene" satırı.
   - `id` ile tekilleştirme.
   - Paylaşımdan sonra dönünce akış yenilenir.
   - Takip boşken sessiz geçiş yerine açıklama ve tek dokunuşla geçiş.
7. **CreatePost:**
   - Çift gönderim kilidi (`useRef`).
   - Geçersizken Paylaş pasif.
   - Dolu formda Vazgeç'e basınca "Taslağı at?" onayı.
   - Emoji ve anket düğmelerine etiket ve hitSlop.
8. **HomePostCard:** yazı tema rengiyle, accent yalnızca şerit ve avatar zemininde.
9. **UserProfile:** gönderiler yüklenemezse "yüklenemedi" mesajı (yanlış "boş" yerine).
10. **Silinecek:** `CommentModal.js` (ölü kod).
11. **Erişilebilirlik:** PollCard seçeneklerine rol ve durum.

### Konser Arkadaşı
1. Kartta "⋯": Profili gör / Şikâyet et (`ReportSheet`, USER) / Engelle. Engellenen kişi desteden anında çıkar.
2. Kaydırma hatası:
   - Kart desteye geri döner ve bildirim gösterilir.
   - `BUDDY_NOT_ELIGIBLE` ve `BLOCKED` hatalarında kart kalkar, anlamlı bir mesaj gösterilir.
   - Geri alma hatası ve `UNDO_EXPIRED` için mesaj gösterilir.
3. İlk yükleme hatası için "Bağlantı kurulamadı / Tekrar dene" paneli (yanlış boş durum yerine).
4. Ekrana geri dönüldüğünde `removed` ve `lastSwipe` korunur. Uçuşta bir kaydırma varken yenileme ertelenir.
5. Yeni eşleşmeler iki kez görünmez. Yeni eşleşme öğesine görünür "⋯" düğmesi ve erişilebilirlik eylemi eklenir.
6. Unmatch onay metni sohbetin kapanacağını söyler. ChatScreen kapalı sohbette giriş alanı yerine bant gösterir. `BUDDY_UNMATCHED` hatası çevrilir.
7. Uyum skoruna dokununca neye göre hesaplandığını anlatan kısa bir açıklama çıkar.
8. Erişilebilirlik:
   - Switch etiketine konser adı.
   - Filtre çiplerine rol, durum ve hitSlop.
   - Sekmelerde `minHeight: 44`.
   - En küçük yazı 11 pt.
   - Kart gövdesinde biyografi ve nedenler dinamik yazıda kırpılmasın diye satır sınırları korunur. Gövde kaydırılmaz, çünkü kaydırma hareketiyle çakışır.
9. `SwipeShell` yorumu düzeltilir: hareket PanResponder ile JS'de alınıyor, stil UI thread'inde uygulanıyor. Ekran genişliği `useWindowDimensions` ile alınmaz, çünkü uygulama yalnızca dikey yönde çalışıyor (`app.json`). Kararı not olarak yaz.
10. Açık tema: gri ve çerçeve sabit renkleri tokenlara taşınır.
11. ChatScreen: ilk yükleme hatası için "tekrar dene". Yeni veri yoksa state yazılmaz.

## 5. Kapsam dışı (sonraki işler, gerekçeli)

- **İmleç sayfalama ve trend önbelleği (S-P-03 kalıcı çözümü, S-P-15 önbellek):** istemci tekilleştirmesi ve `size` sınırı şimdilik yeterli.
- **Deste N+1 optimizasyonu (S-B-08):** bugünkü veri ölçeğinde ölçülebilir bir sorun yok.
- **Konser bazlı "geçtim" ve eşleşme arşivi (S-B-09):** ürün ve şema kararı gerektiriyor.
- **Sohbet artımlı çekim / WebSocket (S-B-10):** sohbet bu turun ana kapsamı değil.
- **Görsel küçültme (S-P-18):** yeni native bağımlılık gerektiriyor.
- **Gesture-handler (S-B-13):** yeni native bağımlılık gerektiriyor.
- **Refresh token rotasyonu (S-P-23):** CLAUDE.md düzeltilir; rotasyon güvenlik turuna kalır.
- **Profil gönderi sayfalaması (S-P-15).**
- **Sabit üst boşlukların `insets.top`'a taşınması (P-12):** uygulama genelinde bir iş, ayrı tur.

## 6. Kabul kriterleri ve testler

- **Backend:** `./mvnw test` yeşil olmalı. Şu maddeler için en az 12 yeni regresyon testi:
  - Anket çapraz oy reddi.
  - İdempotent beğeni.
  - Gönderi sahibinin yorum silmesi ve üçüncü kişinin 403 alması.
  - `commentCount` gizli yorumu saymıyor.
  - Gönderi doğrulama senaryoları.
  - Unmatch sonrası iki yönde 403.
  - Unmatch'in undo edilememesi.
  - Eşzamanlı karşılıklı beğenide tek eşleşme.
  - Buddies listesinde gizlilik ve 401.
  - Yasaklı kullanıcının desteden çıkması.
  - Geçersiz şikâyet türü.
  - Mesaj uzunluğu.
- **Mobil:**
  - `verify-mobile.js` (Babel ve TR/EN parite) ile tanımsız isim taraması temiz.
  - `npx expo export --platform ios` başarılı.
  - Lint, test ve type-check komutu **projede yok**. Bu durum raporda belirtilir.
- **Cihaz:** bu ortamda simülatör yok. Elle test listesi `final-validation.md`'de verilecek. Emre telefonda doğrulayacak.
