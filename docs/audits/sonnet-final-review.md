# Sonnet Nihai İnceleme: Post ve Konser Arkadaşı Turu

**Tarih:** 11 Ekim 2026 · **Kapsam:** `implementation-plan.md` Bölüm 3 (backend) ve Bölüm 4 (mobil) uygulaması, `CLAUDE.md` farkı
**Yöntem:** Yalnızca kod okuma ve `git diff/status/log`. Backend başlatılmadı, test koşturulmadı, ağ isteği atılmadı. Test sonuçları (816 test, TR/EN parite 1491, `expo export`) görevde verildiği gibi kabul edildi. Çeviri anahtarlarından yaklaşık 35 tanesi elle grep ile iki dilde doğrulandı.

## Karar: PASS (koşullu)

Kritik bulgu yok. Planın büyük çoğunluğu kanıtlı biçimde uygulanmış. Yine de TestFlight ve canlıya çıkmadan önce düzeltilmesi gereken **iki Orta mobil hata**, **bir Orta doğrulama eksiği** ve **canlı veritabanı için operasyonel bir adım** var (Bölüm 7).

---

## 1. İlk denetim maddeleri: çözüm durumu

### 1a. Backend (plan Bölüm 3)

| Madde | Durum | Kanıt |
|---|---|---|
| Anket oyu: çapraz seçenek ya da POLL olmayan gönderi 400 `POLL_OPTION_INVALID`, `(user,post)` unique, upsert | Çözüldü | `PostService.java` votePoll (seçenek-gönderi eşleşmesi ve upsert), `PollVote.java` unique, V20 madde 1 |
| Beğeni idempotent 204; beğeni kaldırma yoksa 204 | Çözüldü | `PostService.likePost/unlikePost`, `LikeRepository.insertIfAbsent` |
| `POST /posts` doğrulama (tür, anket 2–4 ve ≤60, IMAGE url, boş içerik) | Çözüldü | `PostService.validateNewPost`, `isAllowedImageUrl`. `/media/upload` her zaman `/uploads/<dosya>` döndürdüğü için R2 açıkken de geçerli (`MediaController.java:100`) |
| `PATCH` boş içerik 400 | Çözüldü | `PostService.updatePost` (IMAGE için boşaltmaya izin, bilinçli) |
| `PostResponse.updatedAt`, `size` en fazla 50 | Çözüldü | `PostResponse.java`, `PostService` `MAX_FEED_SIZE` |
| Yorumlar Asc, `userProfileImageUrl`, gizli yorum sayılmaz | Çözüldü | `CommentService.getCommentsByPost`, `CommentRepository.countByPostIdIn`. Tek tüketici `PostDetailScreen` (mobilde başka `/posts/{id}/comments` GET çağrısı yok; eski `...Desc` metodu yalnızca testte `never()` ile doğrulanıyor) |
| Yorum silme: sahibi ya da gönderi sahibi, aksi 403 `COMMENT_DELETE_FORBIDDEN`, başka gönderi 404 | Çözüldü | `CommentService.deleteComment(postId, commentId, userId)` |
| `POST /reports` tür beyaz listesi, hedef 404, neden ≤500 | Çözüldü | `ReportTargetValidator`, `ModerationController` |
| Unmatch kalıcı, iki yönde 403 `BUDDY_UNMATCHED` | Çözüldü | `BuddyMatchService.unmatch`, `ModerationService.requireCanMessage` (devam eden sohbet kısa devresinden ÖNCE bakılıyor) |
| `GET /messages/status/{id}` | Çözüldü | `MessageController.status`, `ModerationService.messageBlockReason` |
| Undo yalnız son 10 dk ve kaldırılmamış, aksi 400 `UNDO_EXPIRED` | Çözüldü | `BuddyMatchService.undo` |
| Swipe: çift kilidi, upsert, tek `matched=true`, tekrar 200 | Kısmen (kod doğru, kanıt zayıf) | `BuddyMatchService.swipe` `lockPair` (B-1) |
| Pasif kullanıcı deste, eşleşme ve akıştan çıkar | Çözüldü | `BuddyMatchService.isActive`, `PostRepository` iki sorgu, trending süzgeci |
| `GET /events/{id}/buddies` giriş zorunlu, engelli ve yasaklı süzülür, gizli hesap şehir ve mesaj boş | Çözüldü | `SecurityConfig.java:84` (sıra doğru, `permitAll` kuralından önce), `ConcertBuddyController.getBuddies`, `SecurityRoutesTest` 401 testi |
| `POST /events/{id}/buddies` `EVENT_NOT_JOINABLE` | Çözüldü | `ConcertBuddyController.java:91-95` |
| `POST /messages` receiverId ve uzunluk | Çözüldü | `MessageController.send`, `MessageService.send`, `ContentLimits.MESSAGE_MAX` |
| V20 göçü | Kısmen | Dosya doğru ve yeniden çalıştırılabilir, ama hiçbir veritabanında çalıştığına dair kanıt yok (B-2) |
| Takip akışına kendi gönderileri | Çözüldü | `PostRepository.getFollowingFeed` |

### 1b. Mobil (plan Bölüm 4)

**Post**

| # | Madde | Durum | Kanıt |
|---|---|---|---|
| 1 | api.js: yalnız 401/403'te oturum biter, refresh zaman aşımı | Çözüldü | `api.js:198-209`. Zaman aşımı planda 15 sn, kodda 60 sn: bilinçli sapma (Render soğuk başlangıç), gerekçe yorumda; plan metni eskimiş |
| 2 | `ReportSheet` | Çözüldü | `ReportSheet.js`; PostCard, PostDetail, UserProfile, Chat, CommunityDetail, Buddy kullanıyor |
| 3 | `usePostActions` | Çözüldü | `components/feed/usePostActions.js` (yol `hooks/` değil, önemsiz) |
| 4 | PostCard: iyimser beğeni, menü, 44 pt, Kaydet pasif, "düzenlendi" | Çözüldü | `PostCard.js:75-130`, `PostEditModal.js:27-30` |
| 5 | PostDetail: menü, yorum şikâyet ve sil, PollCard, tekrar dene, memo, avatar, tek sayaç | Çözüldü | `PostDetailScreen.js:52-61, 159-173, 220-323, 325-338` |
| 6 | FeedScreen | Çözüldü | `FeedScreen.js:33-37, 70-90, 218-226` (küçük kusur: F-3) |
| 7 | CreatePost | Çözüldü | `CreatePostScreen.js:36-59, 93-140` (küçük kusur: F-5) |
| 8 | HomePostCard tema rengi | Çözüldü | `HomePostCard.js` farkı |
| 9 | UserProfile "yüklenemedi" | Çözüldü | `UserProfileScreen.js:87, 364`; tekrar dene düğmesi yok (Düşük) |
| 10 | `CommentModal.js` silindi | Çözüldü | `git status` çıktısında `D` |
| 11 | PollCard erişilebilirlik | Çözüldü | `PollCard.js:44-50` |

**Konser Arkadaşı**

| # | Madde | Durum | Kanıt |
|---|---|---|---|
| 1 | Kartta menü (Profil, Şikâyet, Engelle), engellenen çıkar | Çözüldü | `ConcertBuddyMatchScreen.js:402-416, 487-497` |
| 2 | Kaydırma hatası: kart geri döner, `NOT_ELIGIBLE` ve `BLOCKED` kart kalkar, undo mesajları | Kısmen | Mantık var; F-2 ve F-4 |
| 3 | İlk yükleme hata paneli | Çözüldü | `:574-590` |
| 4 | Odakta `removed` ve `lastSwipe` korunur, uçuşta yenileme ertelenir | Kısmen | Korunuyor ama undo sonrası kart geri gelmiyor (F-1) |
| 5 | Yeni eşleşme iki kez görünmez, menü ve a11y eylemi | Çözüldü | `:712-745` |
| 6 | Unmatch metni, Chat kapalı bant, `BUDDY_UNMATCHED` çevirisi | Çözüldü | `translations.js:449, 854`; `ChatScreen.js` closedBar |
| 7 | Uyum skoru açıklaması | Çözüldü | `:418, 474-485` |
| 8 | A11y (switch adı, çip rolü, sekme 44, en küçük 11 pt, satır sınırı) | Kısmen | 11 pt kuralı tutmuyor (F-6) |
| 9 | SwipeShell yorumu ve karar notu | Çözüldü | `:55-62` |
| 10 | Açık tema sabit renkleri | Kısmen | Kart üstü kaplama renkleri bilinçli sabit; kalanlar F-6'da |
| 11 | ChatScreen ilk yükleme hatası, gereksiz state yazmama | Çözüldü | `ChatScreen.js` fetchMessages |

---

## 2. Yeni regresyon taraması (sorulan noktalar tek tek)

| Nokta | Sonuç | Kanıt ve açıklama |
|---|---|---|
| FlashList geri dönüşümü ve `usePostActions` state'i | Büyük sorun yok, küçük kusur (F-7) | Beğeni ve sayı state'i `useRecyclingState` ile `[item.id, ...]` anahtarlı (`PostCard.js:75-77`). `usePostActions` içindeki `editing` ve `useReport` içindeki `target`/`sending` düz `useState`. Şikâyet hedefi açılışta `targetId` ile saklandığı için doğru. `PostEditModal` ise `post` prop'una bağlı: modal açıkken hücre başka gönderiye geri dönüştürülürse PATCH yanlış gönderiye gider. Modal ekranı kapattığı için ancak eşzamanlı liste değişiminde (ör. `onCreated` ekleme) olur |
| `MODAL_AFTER_ALERT_MS` (300 ms) | Sorun yok | `ReportSheet.js:76`, `usePostActions.js:44`. Zamanlayıcı temizlenmiyor ama ayrılmış bileşene setState zararsız. iOS'ta Alert kapanış animasyonuna bağımlı bir sihirli sayı; cihazda doğrulanmadı (Bölüm 5) |
| `usePostUpdates`, `onCreated`, tekilleştirme | Sorun yok | `onCreated` `useCallback` ile kararlı (`FeedScreen.js:33-35`), effect bağımlılığı doğru, `create` olayı `setPosts`'a girmiyor, `onPostCreated` kimliğe göre tekilleştiriyor. Küçük kusur: F-3 |
| PostDetail `listHeader` useMemo, bayat closure | **Yok** | `handleLike`'ın okuduğu `liked`, `likeCount`, `likeLoading`, `post.id`, `t` bağımlılıkta (`:323`); `onVoted` yalnız `post.id` kullanıyor; `inputRef` ve `scaleAnim` ref. `eslint-disable` gerekçesi doğru |
| CreatePost `beforeRemove` ve başarı sonrası çıkış | Sorun yok | `submittedRef` Alert'ten önce set ediliyor (`:128`), "Tamam" `goBackOrFallback` çağırınca dinleyici geçiyor. Küçük kusur: F-5 |
| Chat yoklama birleştirmesi | Sorun yok | Sunucu cevabında olmayan ve `id > lastServerId` olan yerel mesaj korunuyor; aynı uzunluk ve aynı son id ise state yazılmıyor. Arayüzde okundu bilgisi olmadığı için bu kısa devre veri kaybettirmiyor (`ChatScreen.js` içinde `isRead` yok) |
| Buddy: hata sonrası kart geri gelmesi, `flyRef`, SwipeShell | **Kusurlar var** | F-2 (kilitlenme), F-4 (geri dönüş döngüsü). `flyRef` bağlama ve çözme sırası doğru (cleanup'lar yeni effect'lerden önce çalışır); anahtar `card.userId` olduğu için arka kart öne geçerken kayma değerleri zaten sıfır |
| Buddy: odakta `swipingRef` | Sorun yok | `:228-229, 263`. Uçuş animasyonu sürerken odak yenilemesi atlanıyor; ağ isteği sürerken yenileme olabilir ama `removed` kümesi kartı gizli tutuyor |
| api.js refresh dalında orijinal 401'in reddi | Sorun yok | `:198-209`. Sunucu 401/403 verirse `refreshError` ile oturum biter (`BadCredentialsException` 401, banlı 403: `AuthService.java:222-233`). `return API(originalRequest)` `await`'siz olduğu için yeniden denemenin 5xx'i catch'e düşmüyor. Kuyruktaki istekler ham axios hatasıyla (kullanıcı mesajsız) reddediliyor: Düşük |
| Backend: like `ON CONFLICT DO NOTHING` | Kod doğru, **çalıştırılmadı** | B-1 |
| Advisory lock transaction içinde | Kod doğru | `swipe` `@Transactional`; `pg_advisory_xact_lock` commit'e kadar tutulur; READ COMMITTED'da ikinci istek kilitten sonra birincinin satırını görür. Mock testi yalnız servis mantığını kanıtlar (B-1) |
| Unmatch sonrası tekrar beğeni (403) | Backend doğru, mobil eşlemesi eksik | `BuddyMatchService.swipe` kilitten sonra `existsUnmatchedBetween`. Çift iki desteden de zaten çıkıyor (iki taraf da kaydırmış), erişilmesi zor. Mobil bu kodu `sendSwipe` içinde tanımıyor (F-4) |
| `/events/*/buddies` güvenlik sırası | Doğru | `SecurityConfig.java:84`, `GET /api/events/**` `permitAll` kuralından önce; `SecurityRoutesTest` anonim 401 doğruluyor |
| Yorum Asc'nin başka tüketicisi | Yok | Bölüm 1a |

---

## 3. Bulgular

### Orta

**F-1 · Orta · Odak yenilemesinden sonra "Geri al" kartı geri getirmiyor** (`ConcertBuddyMatchScreen.js:243-260, 334-350`; sunucuda `BuddyMatchService.java` deste `alreadySwiped`)
Sunucu kaydırılan her kişiyi (beğeni de geçme de) desteden eler. Kullanıcı kaydırır, profile ya da sohbete gider, döner: `fetchAll()` yeni `cards` listesini yazar ve o kart artık listede yoktur. `lastSwipe` korunduğu için Geri al düğmesi etkin kalır, sunucuda geri alma başarılı olur, ama `undo` yalnızca `removed` kümesinden çıkarır (`:341`); kart `cards` içinde olmadığı için ekrana gelmez. Kullanıcı "geri aldım" sanır, kişi kayıp. Planın 4. maddesinin (lastSwipe korunur) yarım kalan tarafı.
**Öneri:** Başarılı undo'da kartı listeye geri koy: `setCards(prev => prev.some(c => c.userId === card.userId) ? prev : [card, ...prev])` (`lastSwipe.card` tüm kartı taşıyor).

**F-2 · Orta (düşük olasılık, yüksek etki) · Uçuştaki kartı sürüklemek desteyi kilitleyebilir** (`ConcertBuddyMatchScreen.js:76-83, 91-98, 325-331`)
`fly()` 280 ms'lik `withTiming` başlatır ve `done` yalnızca `finished === true` ise çağrılır. Uçuş sırasında kullanıcı kartın üstüne parmak koyup yatay sürüklerse `onPanResponderMove` `x.value = g.dx` yazar; bu animasyonu iptal eder (`finished=false`), `sendSwipe` hiç çağrılmaz, `swiping` `true` kalır. Sonrasında `flyCard` hep `false` döner, düğmeler `disabled={swiping}` olur ve odak yenilemesi `swipingRef` yüzünden atlanır. Ekran kapatılıp açılana kadar deste donuk. Pencere dar (kart ilk ~100 ms'de hâlâ merkeze yakın) ama çıkış yolu yok.
**Öneri:** `onMoveShouldSetPanResponder` içinde uçuş sürerken `false` dön (ör. bir `flying` ref'i), ya da `withTiming` geri çağrısında `finished` değerine bakmadan `done` işlevini idempotent biçimde çağır.

**B-1 · Orta · Yeni native SQL'ler hiçbir testte gerçek Postgres'te çalışmadı** (`LikeRepository.insertIfAbsent`, `BuddySwipeRepository.lockPair`)
İlgili testlerin tamamı Mockito'dur; `contextLoads` JPQL'i doğrular ama `nativeQuery` metinlerini çalıştırmaz. `concurrentMutualLikes...` testi kilidi `ReentrantLock` ile taklit eder ve bunu kendi dokümanında belirtir (`PostBuddyIntegrityTest.java:585-593`). Okuma sonucu iki sorgu da PostgreSQL için geçerli görünüyor (`INSERT ... ON CONFLICT DO NOTHING`; `SELECT 1 FROM (SELECT pg_advisory_xact_lock(:key)) AS t`), ama beğeni ve kaydırma sıcak yollardır: sözdizimi ya da tip hatası olursa tüm beğeniler ve kaydırmalar 500 verir.
**Öneri (deploy öncesi zorunlu):** Yerel backend'de `sim_*` hesaplarıyla bir beğeni, bir tekrar beğeni, bir kaydırma ve iki istemciden eşzamanlı karşılıklı kaydırma duman testi.

### Düşük

**B-2 · Düşük (operasyonel, sonucu ağır) · V20 sırası ve doğrulanmamışlığı**
Bölüm 6'ya bakın. `unmatched_at` sütunu yoksa yalnızca `validate` modunda açılış değil, `existsUnmatchedBetween` her mesaj gönderiminde (`requireCanMessage`) ve her kaydırmada çalıştığı için **mesajlaşmanın tamamı** 500 verir.

**F-3 · Düşük · Akış küçük tutarsızlıkları** (`FeedScreen.js:33-35, 70-90`)
(a) Yeni paylaşım Trend sekmesindeyken de başa ekleniyor; Trend sıralı bir listedir. (b) Yenileme başarısız olup liste doluysa hata sessiz geçer (`error` yalnız `posts.length === 0` iken gösteriliyor). **Öneri:** `onPostCreated` yalnız takip sekmesinde ekle; yenileme hatasında kısa bildirim.

**F-4 · Düşük · Kaydırma hatasında "kart geri döner" kuralı fazla geniş** (`ConcertBuddyMatchScreen.js:310-321`)
Yalnız `BUDDY_NOT_ELIGIBLE` ve `BLOCKED` kartı kaldırır; `BUDDY_UNMATCHED`, 404 (hesap silinmiş) gibi kalıcı 4xx'ler kartı geri koyar, kullanıcı aynı hatayı tekrar alır. İstek 100 sn zaman aşımına (`API_TIMEOUT_MS`) kadar sürebilir; bu sürede kullanıcı sonraki kartlara geçmiştir ve başarısızlıkta eski kart beklenmedik biçimde öne gelir. **Öneri:** Kartı yalnızca ağ hatası ve 5xx'te geri koy; diğer 4xx'te kaldır.

**F-5 · Düşük · `beforeRemove` programatik çıkışları da yakalar** (`CreatePostScreen.js:49-59`)
Oturum süresi dolup Login'e `reset` yapılırken form doluysa "Taslağı at?" çıkar ve reset askıya alınır. Onaylanınca devam eder; tehlike yok, beklenmedik diyalog.

**F-6 · Düşük · Tasarım sistemi sapmaları**
- En küçük yazı 11 pt kuralı: `eventMonth` 9,5, `eventLabel` 10,5, `tabCountText` 10,5 (`ConcertBuddyMatchScreen.js` stil bloğu).
- `LIKE`, `PASS`, `compatColor` sabitleri fotoğraf ve koyu rozet üstünde olduğu için kabul edilebilir; `likesBanner` kalp simgesi tema yüzeyinde sabit `PASS` kullanıyor (marka kırmızısı, okunur). `CommunityDetailScreen.js` `bannerRejected` sabit `#E94560` bu turdan önce de vardı.
- Başlıklar `fonts.heading` kuralına büyük ölçüde uyuyor (CommunityDetail, UserProfile, Buddy, ReportSheet, PostEditModal).

**F-7 · Düşük · `PostEditModal` `maxLength`** (`PostEditModal.js:56`)
`maxLength={1000}`; sunucu `POST_MAX = 500` (`ContentLimits.java`), CreatePost 500. 501–1000 karakter yazan kullanıcı `CONTENT_TOO_LONG` alır ("Metin çok uzun" mesajı çevrili, veri kaybı yok). **Öneri:** 500 yap. Geri dönüşüm kusuru için Bölüm 2'ye bakın.

**F-8 · Düşük · Engelleme yayını eksik** (`UserProfileScreen.js` handleModeration, `ChatScreen.js` handleModeration)
PostDetail ve PostCard engellemede `publishUserHidden` yayınlıyor; UserProfile ve Chat'ten engelleyince Akış ve Ana sayfadaki o kişinin gönderileri yenileme olana kadar kalıyor. **Öneri:** `confirmBlock` geri çağrısında `publishUserHidden(userId)`.

**F-9 · Düşük · Testlerin kanıtlamadığı iddialar**
- "Eşzamanlı karşılıklı beğenide tek eşleşme": gerçek kilit değil, `ReentrantLock` taklidi (B-1).
- "Beğeni yarış güvenli": `insertIfAbsent` mock; gerçek unique ihlali yolu çalışmadı.
- V20 SQL'ini hiçbir test çalıştırmıyor.
- `SecurityRoutesTest` yalnız anonim 401 doğruluyor, girişli 200 yok.
- Mobil davranışlar (F-1, F-2) otomatik test dışı; projede mobil test altyapısı yok (plan da belirtmişti).
- `status` uç noktasının HTTP düzeyi test edilmedi, yalnız servis kuralı.

**F-10 · Düşük · Belgeler**
`CLAUDE.md` "Public routes include ... `GET /api/events/**`" cümlesini güncellemiyor: `GET /api/events/*/buddies` artık girişli. V20 için `CLAUDE.md`'de göç notu yok. `implementation-plan.md` §3 unmatch için `POST /api/buddy/unmatch` yazıyor; gerçek uç `DELETE /api/buddy/matches/{userId}` (mobil ve backend tutarlı, yalnız plan eskimiş). Plan refresh zaman aşımını 15 sn diyor, kod 60 sn.

**Öneri (hata değil):** V20 `uq_poll_votes_user_post` ile Hibernate `ddl-auto=update`'in yerelde eklediği `(user_id, post_id)` unique kısıtı aynı sütunlarda iki indeks oluşturur; zararsız, canlıda yalnız V20 çalışırsa tek olur.

---

## 4. Kullanıcı akışları: gereksiz karmaşıklık var mı?

Genel olarak hayır; "menü + ortak ReportSheet" modeli tutarlı ve akışları kısaltıyor. Gözlemler:
- Yorum satırı menüsü rol bazlı üç biçim alıyor (kendi yorum: doğrudan sil onayı; gönderi sahibi başkasının yorumunda: Şikâyet ve Sil; diğerleri: Şikâyet ve Engelle). Android'in 3 düğme sınırı nedeniyle gerekli, kabul edilebilir. Gönderi sahibi bir yorumcuyu buradan engelleyemez (yalnız profilinden), küçük boşluk.
- Eşleşmeyi kaldırma iki Alert (menü ve onay) gerektiriyor; geri alınamaz eylem için doğru.
- Unmatch sonrası sohbetin kapalı bantla, geçmişiyle kalması planlanan karar; tutarlı.
- "Taslağı at?" yalnız dolu formda çıkıyor, doğru.

---

## 5. Cihazda doğrulanması gerekenler (statik inceleme kanıtlayamaz)

1. iOS: Alert'ten ReportSheet ve PostEditModal açılışı (300 ms yeterli mi), sheet kapanınca "Şikâyetin alındı" Alert'i (350 ms).
2. Android: Alert 3 düğme sınırı (kart menüsü, yorum menüsü) ve geri tuşuyla modal kapanışı.
3. Buddy: F-1 ve F-2 senaryoları, hızlı çift kaydırma, kart menü düğmesinin pan hareketiyle çakışmaması.
4. FlashList'te hızlı kaydırırken beğeni animasyonu; düzenle ya da şikâyet açıkken liste güncellemesi.
5. Açık tema: ReportSheet, PostEditModal, kapalı sohbet bandı, Buddy kart gövdesi.
6. Chat: unmatch sonrası bant, yoklama sırasında gönderim.

---

## 6. Üretime çıkış: engel var mı, sıra ve uyumluluk

**Kodda engelleyen sorun yok.** Dikkat edilecek operasyonel noktalar:

1. **V20, backend'den önce (en az aynı anda) canlıda çalıştırılmalı.** Dosya eklemeli ve yeniden çalıştırılabilir (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`); eski backend ile birlikte sorunsuz yaşar.
   - Canlıda `DDL_AUTO=validate` ise V20'siz yeni backend açılmaz. `update` ise sütun otomatik eklenir, ama `poll_votes` yinelenenleri temizlenmediği için unique kısıt eklenemez (Hibernate hatayı loglar, açılışı durdurmaz) ve indeksler eksik kalır. Canlıdaki `DDL_AUTO` değeri bu incelemede doğrulanamadı; Render ortam değişkeni kontrol edilmeli.
   - V20'nin `DELETE ... USING` adımı yinelenen anket oylarını kalıcı siler (en yeni kalır). Önce `SELECT count(*)` ile kaç satırın etkileneceğine bakılmalı.
   - İnce nokta: eski backend `votePoll`'u "önce sil, sonra ekle" yapıyordu; unique indeks varken IDENTITY ekleme silmeden önce çalıştığı için aynı kullanıcının ikinci oyu eski backend'de 500 verebilir. Eski mobil bunu arayüzde engelliyor (oy verilmişse seçenekler pasif), pratik etki yok.
2. **Deploy öncesi duman testi (B-1).**
3. **Sıra:** backend ve V20, ardından mobil (OTA ya da EAS).

**Uyumluluk**

| Kombinasyon | Sonuç |
|---|---|
| **Yeni mobil, eski backend** | Çalışır, küçük gerilemeyle. `GET /messages/status` hatası sessizce yutuluyor (yazma alanı açık kalır). Yorumlar eski sırada (yeni önce) gelir ama yeni mobil yeni yorumu sona ekler: karışık sıra. Gönderi sahibi başkasının yorumunu silmeyi dener, eski backend 400 döner (genel hata). "Düzenlendi" etiketi ve yorumcu fotoğrafı görünmez. Beğeni 409'u başarı sayıldığı için çift beğeni sorunsuz. Veri bozulmaz |
| **Eski mobil, yeni backend** | Çalışır. Beğeni tekrarı 204. Yorumlar eskiden yeniye gelir; eski ekran yeni yorumu başa ekliyorsa sıra görsel olarak karışır. Unmatch sonrası sohbette yazma alanı açık kalır, gönderim 403 `BUDDY_UNMATCHED` ile genel hata gösterir (neden görünmez). `EVENT_NOT_JOINABLE` eski mobilde genel hata. Anonim kullanılan eski yol yok |

İki yönde de kırılma yok; en iyi sıra: backend ve V20, sonra mobil.

---

## 7. Düzeltilmesi gerekenler (önem sırasıyla)

1. **(Orta, mobil, F-1)** Buddy `undo` başarısında kartı `cards`'a geri ekle.
2. **(Orta, mobil, F-2)** Uçuş sırasında pan'i devre dışı bırak ya da `done` işlevini `finished` değerinden bağımsız çağır; `swiping` kilidi takılı kalmasın.
3. **(Orta, backend ve QA, B-1)** Deploy öncesi `insertIfAbsent` ve `lockPair` için gerçek Postgres duman testi.
4. **(Operasyonel, B-2)** Canlıda `DDL_AUTO` değerini doğrula; V20'yi önce `SELECT count(*)` ile dene, backend'den önce çalıştır.
5. (Düşük) F-4: Kalıcı 4xx'te kartı geri koyma; `BUDDY_UNMATCHED` tanı.
6. (Düşük) F-3, F-7, F-8: Trend'e ekleme, edit `maxLength` 500, UserProfile ve Chat engellemede `publishUserHidden`.
7. (Düşük) F-6, F-10: En küçük yazı boyutları, `CLAUDE.md` events/buddies girişli notu ve V20 notu, plan metni güncellemesi.

**REVIEW: PASS (koşullu): 1–4 numaralı maddeler kapanmadan TestFlight ya da canlıya çıkılmamalı.**
