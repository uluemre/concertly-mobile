# Sonnet bağımsız denetim raporu: Post/Sosyal Akış ve Konser Arkadaşı

**Denetçi:** Sonnet 5.5 (ikinci, bağımsız denetçi) · **Tarih:** 11 Ekim 2026 · **Kapsam:** Post/sosyal akış, Konser Arkadaşı, sohbet, moderasyon

> **Yöntem notu.** Bu **statik bir kod incelemesidir; cihaz/simülatör yoktur.** Hiçbir davranış gerçek cihazda çalıştırılmadı. Her iddia için `dosya:satır` kanıtı verilmiştir; yalnızca koddan çıkarım olan veya çalıştırılarak doğrulanmamış maddeler **"Varsayım"** olarak işaretlidir. Yerel PostgreSQL'e yalnızca okuma sorgusu atıldı (indeks listesi, yinelenen/çapraz oy kontrolü). Uygulama koduna dokunulmadı. Yol kısaltmaları: `B/` = `backend/src/main/java/com/concertly/backend/`, `M/` = `mobile/src/`.

## Özet

- 41 bulgu: 7 Yüksek, 25 Orta, 9 Düşük (Kritik yok: toplu veri ele geçirten veya kimlik doğrulamayı aşan bir açık görmedim). Aşama B'de Haiku'nun 31 bulgusu doğrulandı; 3 yeni bulgu (S-B-15, S-B-16, S-P-24/25) onlardan geldi.
- Backend yetkilendirmesi genel olarak sağlam: tek-gönderi uçları `requireViewable` ile engel/gizli/özel hesabı uygular (`B/service/PostService.java:196-208`), `likes(user_id,post_id)` ve `buddy_swipes(swiper_id,target_id)` unique'tir, deste sunucuda karşılıklı opt-in ile sınırlıdır (`B/service/BuddyMatchService.java:84-122`), beğeni yalnız aynı konserde arayanlarla mümkündür (`:177-179`), engelleme swipe satırlarını siler (`B/service/ModerationService.java:94`). `toggleLooking` iyimser güncelleme + geri alma örneği olarak doğru yazılmış (`M/screens/ConcertBuddyMatchScreen.js:324-340`).
- En ciddi sorunlar: token yenilemesinin her hatada oturumu kapatması, anket oyunun başka gönderinin seçeneğine yazılabilmesi, unmatch sonrası sohbetin açık kalması, swipe hatasının sessizliği, herkese açık `GET /events/{id}/buddies` sızıntısı, PostDetail ve yorumlarda şikâyet yolunun olmaması, deste kartında engel/şikâyet yolunun olmaması.

### İki Buddy controller'ının ilişkisi

| Controller | Yol | Rol | Mobil kullanımı |
|---|---|---|---|
| `ConcertBuddyController` (`B/controller/ConcertBuddyController.java:211`) | `/api/events/{eventId}/buddies` | Konser başına "arkadaş arıyorum" opt-in CRUD (`GET` liste, `POST` katıl, `DELETE` ayrıl, `GET /me`) | `M/screens/EventDetailScreen.js:159,165,400-407`; Buddy ekranındaki aç/kapa `ConcertBuddyMatchScreen.js:331-332` |
| `BuddyMatchController` (`B/controller/BuddyMatchController.java:142`) | `/api/buddy/*` | Deste, swipe, undo, eşleşmeler, unmatch (kurallar `BuddyMatchService`'te) | `ConcertBuddyMatchScreen.js:233,284,316,356` |

Eski/ölü değil, **ikisi de canlı ve birbirini tamamlıyor**: opt-in satırı (`ConcertBuddy`) birincide yazılır, ikinci bu satırlardan deste üretir. Sorun şurada: birincinin `GET` listesi gizlilik kurallarının dışında kalmış (S-B-02).

---

# A. Bağımsız bulgular

## A.1 Post / sosyal akış

### A.1.1 Teknik riskler

### [S-P-01] Token yenileme herhangi bir hatada oturumu kapatıyor
- **Yer:** `M/services/api.js:180-195` (ayrıca `:201`)
- **Sorun:** `/auth/refresh` çağrısının `catch` bloğu hata türüne bakmadan `_onSessionExpired()` çağırıyor. Ağ yok (`ERR_NETWORK`), zaman aşımı, 5xx de "oturum bitti" sayılıyor. Erişim jetonu 1 saat (`backend/src/main/resources/application.properties:160`), yani bir saatten uzun arka plandaki uygulama her açılışta bu yola girer. Çağrı `axios.post` ile (instance değil) yapıldığından `API_TIMEOUT_MS` uygulanmıyor (Varsayım: global axios varsayılanı sınırsız).
- **Etki:** Metroda/uçakta/zayıf çekimde uygulamayı açan kullanıcı Login'e atılır; `M/navigation/AppNavigator.js:240-245` `logout()` + `reset(Login)` yapar. Render free soğuk başlangıcında da aynı risk.
- **Önem:** Yüksek
- **Kanıt:** `catch (refreshError) { processQueue(refreshError,null); if (_onSessionExpired) _onSessionExpired(); ... }`.
- **Mimari/Backend etkisi:** Backend 401 (geçersiz/süresi dolmuş) ve 403 `ACCOUNT_BANNED` ayrımını zaten yapıyor (`B/service/AuthService.java:220-235`); ek backend işi yok.
- **Önerilen çözüm:** Yalnız `response.status` 401/403 ise oturumu kapat; ağ/zaman aşımı/5xx'te hatayı reddet, oturumu koru. Refresh'e açık timeout ver. Kuyruktan çıkan istekleri de `_retry=true` işaretle (`:163-167`).
- **Kabul kriteri:** Uçak modunda, süresi dolmuş erişim jetonuyla ekran açılınca kullanıcı Login'e atılmaz, ağ hatası görür (birim testi: refresh mock'u `ERR_NETWORK` → `_onSessionExpired` çağrılmaz; mock 401 → çağrılır). Refresh çağrısı ≤ 15 sn'de sonlanır.

### [S-P-02] Anket oyu, seçeneğin gönderiye ait olduğunu doğrulamıyor (oy şişirme)
- **Yer:** `B/service/PostService.java:279-309`
- **Sorun:** `votePoll` seçeneği `findById(optionId)` ile alıyor (`:282`); `option.getPost().getId().equals(postId)` ve gönderinin `POLL` olması kontrol edilmiyor. Önceki oy `findByUserIdAndPostId(userId, postId)` ile bulunuyor (`:290`), yani anahtar URL'deki postId. `poll_votes`'ta unique kısıt yok (`B/model/PollVote.java`; yerel DB'de yalnız `poll_votes_pkey`). Sayım seçenek bazlı (`:305`).
- **Etki:** Saldırgan görebildiği N farklı gönderinin `postId`'siyle aynı hedef seçeneğe N oy verebilir. Eşzamanlı iki istek de aynı kullanıcıdan çift oy bırakabilir (sil-sonra-ekle, kısıt yok).
- **Önem:** Yüksek (oylamanın bütünlüğü)
- **Kanıt:** Yerel DB: `poll_votes` üzerinde yalnız pkey; mevcut veride yinelenen oy 0 ve çapraz-gönderi oy 0 (şu an istismar edilmemiş, açık kodda).
- **Mimari/Backend etkisi:** Flyway göçü: `poll_votes(user_id, post_id)` unique + `poll_votes(post_id)` indeksi.
- **Önerilen çözüm:** Seçeneğin gönderiye aitliğini ve `POLL` türünü doğrula (aksi 400); unique ekle; çakışmada upsert.
- **Kabul kriteri:** Başka gönderinin `optionId`'siyle oy isteği 400 döner (servis testi); iki eşzamanlı oy en fazla 1 satır bırakır; `SELECT count(*) FROM poll_votes v JOIN poll_options o ON o.id=v.poll_option_id WHERE v.post_id<>o.post_id` = 0.

### [S-P-03] Akış sayfalaması kopya kayıt üretebilir, istemci tekilleştirmiyor
- **Yer:** `M/screens/FeedScreen.js:69` (`[...prev, ...data]`), `:196` (`keyExtractor`); `B/repository/PostRepository.java:27-37` (offset sayfalama), `B/service/PostService.java:247-262` (sıralama her istekte yeniden hesaplanıyor)
- **Sorun:** Takip akışı `ORDER BY createdAt DESC` + offset. Kaydırırken takip edilen biri paylaşım yaparsa sayfa sınırındaki gönderi iki kez gelir. Trend puanı `now()` ve değişen beğeni/yorum sayısına bağlı; her sayfada 500'lük pencere yeniden sıralanıyor, sayfalar arası kopya/atlama oluşur.
- **Etki:** Aynı `id` iki kez listelenirse FlashList'te yinelenen anahtar, kartın iki kez görünmesi.
- **Önem:** Orta
- **Kanıt:** Kod yolu; dedupe/imleç yok (Varsayım: cihazda gözlenmedi).
- **Mimari/Backend etkisi:** Kalıcı çözüm imleç sayfalama (`beforeCreatedAt,beforeId`); trend için sayfa-arası kararlı anlık görüntü (`asOf`/seed).
- **Önerilen çözüm:** Kısa vadede istemcide `id` ile tekilleştir; uzun vadede imleç.
- **Kabul kriteri:** İki sayfa arasında takip edilen biri gönderi atsa da 5 sayfa kaydırmada `id`'ler benzersizdir (bileşen testi: aynı `id` içeren ikinci sayfa → liste uzunluğu artmaz).

### [S-P-04] Sayfa yükleme hatası sessiz ve sayfalamayı kilitliyor
- **Yer:** `M/screens/FeedScreen.js:73-75, 102-107, 172`
- **Sorun:** `loadFeed` hatada `setError` yapıyor; `onEndReached` `error` doluyken hiç istek atmıyor (`:103`); hata paneli yalnız `posts.length === 0` iken çiziliyor (`:172`). 2. sayfa düşerse kullanıcı hiçbir şey görmez ve kaydırma bir daha yükleme yapmaz. Çek-yenile hatası da sessiz.
- **Etki:** "Akış bitti" izlenimi.
- **Önem:** Orta
- **Kanıt:** Yukarıdaki satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Liste altına "Yüklenemedi, tekrar dene" satırı; `onEndReached` için `error`'ı kalıcı engel yapma; yenileme hatasında toast.
- **Kabul kriteri:** 2. sayfa isteği reddedilince listenin altında yeniden-dene satırı görünür, dokununca yükleme tekrarlanır (bileşen testi).

### [S-P-05] Beğeni iyimser değil; hata yutuluyor, 409'da arayüz takılıyor
- **Yer:** `M/components/feed/PostCard.js:75-106`, `M/screens/PostDetailScreen.js:62-83`; `B/service/PostService.java:322-324`
- **Sorun:** (a) Kalp/sayaç yalnız sunucu cevabından sonra değişir (`PostCard.js:94-98`), animasyon istekten önce oynar (`:79-87`). (b) `catch` yalnız `console.log` (`:101-102`). (c) Sunucu zaten beğenilmişse `AlreadyExistsException` (409) döner; istemci `liked=false` sanıp her dokunuşta yine 409 alır, kalp hiç dolmaz (başka cihazda beğenilmişse/liste bayatsa). (d) `?userId=` sorgu parametresi sunucuda yok sayılıyor (`:92-93`).
- **Etki:** Yavaş ağda gecikmeli geri bildirim; "takılı" beğeni durumu.
- **Önem:** Orta
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** Like/unlike idempotent olmalı (zaten beğenilmişse 204). `likePost` `@Transactional` değil; yarışta DB unique ihlali genel "Bu veri zaten kullanılıyor" 409'una çevriliyor (`B/exception/GlobalExceptionHandler.java:92-104`).
- **Önerilen çözüm:** İyimser güncelle + hatada geri al + kısa bildirim; 409'u "zaten beğenilmiş" say; sunucuda idempotent.
- **Kabul kriteri:** Beğeni isteği ağ hatası verirse kalp ve sayaç ≤ 300 ms'de eski değere döner ve hata bildirimi görünür; sunucu 409 dönerse kalp dolu kalır.

### [S-P-06] Yorum sayısı gizlenen/engelli yorumları da sayıyor; trend puanı da
- **Yer:** `B/repository/CommentRepository.java:22`; kullanım `B/service/PostService.java:77, 246-251`; liste `B/service/CommentService.java:97-102`
- **Sorun:** Sayım sorgusu `Comment.isHidden`'ı dışlamıyor, liste dışlıyor. Kartta "5 yorum", detayda 3 yorum görünür; PostDetail başlığı da `comments.length` ile `commentCount`'u farklı kaynaktan gösteriyor (`M/screens/PostDetailScreen.js:240,247`). Moderatörün gizlediği spam yorumlar trend puanını yükseltmeye devam eder.
- **Etki:** Tutarsız sayaç, moderasyonun trend üzerinde etkisizliği.
- **Önem:** Orta
- **Kanıt:** Sorguda `isHidden` filtresi yok.
- **Mimari/Backend etkisi:** `countByPostIdIn`'e `AND c.isHidden = false`. Engel filtresi izleyiciye özel olduğundan sayaçta uygulanamaz; fark belgelenmeli.
- **Önerilen çözüm:** Sorguyu düzelt; başlıkta tek kaynak kullan.
- **Kabul kriteri:** 1 gizli yorumlu gönderide `commentCount` görünür yorum sayısına eşit (repository testi); gizli yorum trend skorunu değiştirmez.

### [S-P-07] `CommentResponse`'ta profil fotoğrafı alanı yok; mobil bekliyor (sessiz boş UI)
- **Yer:** `M/screens/PostDetailScreen.js:137` (`item.userProfileImageUrl`) ↔ `B/dto/response/CommentResponse.java:8-13`
- **Sorun:** Mobil yorum avatarında `userProfileImageUrl` okuyor; DTO bu alanı göndermiyor (yalnız `userId`, `username`). Yorumcuların fotoğrafı hiç görünmez, hata da vermez.
- **Etki:** Gönderi yazarında fotoğraf var (`PostResponse.userProfileImageUrl`), yorumcularda yok.
- **Önem:** Orta
- **Kanıt:** DTO alan listesi + mobil okuma satırı.
- **Mimari/Backend etkisi:** DTO'ya alan eklenmeli.
- **Önerilen çözüm:** `userProfileImageUrl` ekle.
- **Kabul kriteri:** Fotoğraflı kullanıcının yorumu `GET /posts/{id}/comments` yanıtında `userProfileImageUrl` içerir ve PostDetail'de görüntü çizilir.

### [S-P-08] Yorum sırası sunucuda yeni→eski, istemci yeni yorumu sona ekliyor
- **Yer:** `B/service/CommentService.java:97` (`...OrderByCreatedAtDesc`), `M/screens/PostDetailScreen.js:94, 98` (`[...prev, res.data]` + `scrollToEnd`)
- **Sorun:** İlk yüklemede en yeni yorum üstte; yorum yazınca yenisi en alta eklenip ekran en alta kaydırılıyor; yeniden açınca aynı yorum en üstte.
- **Etki:** Kafa karıştırıcı akış.
- **Önem:** Orta (UX)
- **Kanıt:** İki satır.
- **Mimari/Backend etkisi:** Sıralama kararı (konuşma için eski→yeni daha doğal).
- **Önerilen çözüm:** Tek yön seç; sunucu `Asc` ya da istemci başa ekleme.
- **Kabul kriteri:** Yeni yorum yeniden yüklemeden önce ve sonra listede aynı konumdadır (bileşen testi).

### [S-P-09] PostDetail anket kartını çizmiyor
- **Yer:** `M/screens/PostDetailScreen.js:192-198` (yalnız içerik+görsel); karşılaştır `M/components/feed/PostCard.js:226-234`
- **Sorun:** Kart anketi gösterir ama dokununca açılan detay yalnız soru metnini gösterir; seçenekler yok, oy verilemez. Bildirim/paylaşım bağlantısıyla doğrudan PostDetail'e gelen kullanıcı anketi hiç göremez.
- **Etki:** Anket gönderilerinin detayı işlevsiz.
- **Önem:** Orta
- **Kanıt:** Dosyada `Poll` geçmiyor (grep boş). `getPost` zaten `pollOptions` döndürüyor (`B/service/PostService.java:100-117`).
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `PollCard`'ı PostDetail'e ekle.
- **Kabul kriteri:** `postType==='POLL'` gönderisinin detayında tüm seçenekler çizilir, oy verilince sayılar güncellenir.

### [S-P-10] Gönderi oluşturma: sunucu doğrulaması eksik
- **Yer:** `B/service/PostService.java:135-176`, `B/dto/request/CreatePostRequest.java`
- **Sorun:** (a) `postType` serbest metin. (b) POLL için seçenek sayısı/uzunluğu sınırsız, en az 2 seçenek zorunlu değil (`ContentLimits.POLL_OPTIONS_MAX/POLL_OPTION_TEXT_MAX` yalnız topluluk anketinde). (c) `IMAGE` için `imageUrl` herhangi bir dış URL olabilir. (d) Boş içerikli TEXT gönderisi API ile kaydedilebilir. (e) `eventId` verilince "katılım/konum kilidi" yalnız mobilde (yorum `:142-143`).
- **Etki:** API'yi doğrudan çağıran kuralları aşar; sahte "konser postu".
- **Önem:** Orta
- **Kanıt:** Kod yolu; (e) kasıtlı ürün kararı olabilir (Varsayım).
- **Mimari/Backend etkisi:** Servis katmanında beyaz liste.
- **Önerilen çözüm:** `postType ∈ {TEXT,IMAGE,POLL}`; POLL 2-4 seçenek ≤ 60 karakter; `imageUrl` yalnız kendi `/uploads/` veya R2 alan adı; TEXT/POLL'de boş olmayan içerik.
- **Kabul kriteri:** Her ihlal 400 döner (parametrik servis testi, ≥ 6 senaryo).

### [S-P-11] Çift tıklama ile çift gönderi riski; paylaşım sonrası akış yenilenmiyor
- **Yer:** `M/screens/CreatePostScreen.js:67-110, 239-247`; `M/screens/FeedScreen.js` (odak yenilemesi yok); `B/repository/PostRepository.java:27-37`
- **Sorun:** `handlePost`'ta `loading` koruması yok; düğme yalnız re-render sonrası spinner ile değişir. Aynı karede iki dokunuş iki `POST /posts` atabilir; sunucu idempotent değil (`PostService.java:132-134` yorumu "tekrar deneyince mükerrer" sorununu zaten anıyor). Yükleme sürerken çıkıp yeniden denenirse görsel iki kez yüklenir. Paylaşım sonrası `goBack` var ama `FeedScreen` `useFocusEffect` kullanmıyor; **Takip akışı kullanıcının kendi gönderisini de içermiyor** (sorgu yalnız takip edilenler), yani paylaşan kişi gönderisini hemen göremez.
- **Etki:** Yinelenen gönderi; "paylaştım ama yok" algısı.
- **Önem:** Orta
- **Kanıt:** Kod yolu; `FeedScreen.js`'te `useFocusEffect` yok.
- **Mimari/Backend etkisi:** İsteğe bağlı `Idempotency-Key`; Takip sorgusuna `OR p.user.id = :userId`.
- **Önerilen çözüm:** `useRef` kilidi; başarıdan sonra akışa yeni gönderiyi başa ekle.
- **Kabul kriteri:** 50 ms arayla iki dokunuş tek `POST /posts` üretir (bileşen testi, mock sayacı = 1); paylaşım sonrası akış açıldığında yeni gönderi ilk sıradadır.

### [S-P-12] Yorum silme yetkisi ve hata kodu
- **Yer:** `B/service/CommentService.java:106-118`, `B/controller/CommentController.java:121-129`
- **Sorun:** Yalnız yorum sahibi silebilir; gönderi sahibi kendi gönderisindeki yorumu silemez (yalnız admin gizler). Yetkisiz silme `IllegalArgumentException` → **400** (403 olmalı). `postId` yol parametresi kullanılmıyor.
- **Etki:** Gönderi sahibi taciz yorumuna karşı çaresiz; yanlış HTTP kodu.
- **Önem:** Orta
- **Kanıt:** `:113-115`, `:128`.
- **Mimari/Backend etkisi:** Ürün kararı: gönderi sahibine silme yetkisi (öneri: evet).
- **Önerilen çözüm:** `comment.getPost().getId().equals(postId)`; `post.owner || comment.user` izni; 403.
- **Kabul kriteri:** Gönderi sahibi başkasının yorumunu silebilir (204), üçüncü kişi 403, yanlış `postId` 404 alır (servis testi).

### [S-P-13] `PATCH` boş/null içeriği kabul ediyor; "düzenlendi" göstergesi yok
- **Yer:** `B/controller/PostController.java:80-84`, `B/service/PostService.java:350-360`, `B/dto/response/PostResponse.java`
- **Sorun:** Gövdede `content` yoksa `null` ile güncellenir; boşluk-only da kabul. `updatedAt` DTO'da yok. Gizlenmiş gönderi sahibi tarafından düzenlenebilir.
- **Etki:** İçeriksiz gönderi; moderasyon atlatma ihtimali (Varsayım: ürün akışına bağlı).
- **Önem:** Düşük
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** İstek DTO'su + `@NotBlank`; DTO'ya `updatedAt`.
- **Önerilen çözüm:** İçerik zorunlu; DTO'ya düzenlenme zamanı.
- **Kabul kriteri:** `PATCH {}` ve `{"content":"  "}` 400 döner.

### [S-P-14] Ana akış tabloları için eksik indeksler
- **Yer:** Yerel DB indeks listesi; `B/repository/CommentRepository.java:22`, `LikeRepository.java:18-20`; V10 göçü yalnız topluluk tablolarına indeks ekliyor (`backend/src/main/resources/db/migration/V10__add_community_notification_and_username_indexes.sql:21-33`)
- **Sorun:** `comments`, `likes`, `posts`, `poll_votes`, `buddy_swipes`, `concert_buddies` için yalnız pkey/unique var. `likes` unique'i `(user_id, post_id)` olduğundan `GROUP BY post_id` sayımı (her akış sayfasında) yararlanamaz; `comments(post_id)`, `posts(user_id,created_at)`, `posts(created_at)`, `poll_votes(post_id)`, `buddy_swipes(target_id)` tam tarama yapar.
- **Etki:** Veri büyüdükçe akış gecikmesi artar.
- **Önem:** Orta (ölçek)
- **Kanıt:** `pg_indexes`: `comments_pkey`, `likes_pkey`, `likes_user_id_post_id_key`, `posts_pkey`, `poll_votes_pkey`, `buddy_swipes_pkey` ve 3 anonim unique.
- **Mimari/Backend etkisi:** Yeni göç.
- **Önerilen çözüm:** `likes(post_id)`, `comments(post_id)`, `posts(user_id, created_at DESC)`, `posts(created_at DESC)`, `poll_votes(post_id)`, `buddy_swipes(target_id) WHERE liked`.
- **Kabul kriteri:** 100k gönderilik test verisinde akış sayım sorgularında `Seq Scan` yok; `getTrendingFeed` p95 < 200 ms.

### [S-P-15] Sayfa boyutu sınırsız; trend her istekte 500 gönderiyi bellekte sıralıyor
- **Yer:** `B/controller/PostController.java:37-57`; `B/service/PostService.java:226-262`; `B/service/UserService.java:237-246` (profil gönderileri sayfasız); `M/screens/UserProfileScreen.js:391`
- **Sorun:** `size=100000` ile tüm tablo dönebilir; trend sayfası her çağrıda 500 satır + iki sayım + bellekte sıralama yapar. Profil `GET /users/{id}/posts` tüm gönderileri tek yanıtta döner ve mobilde `ScrollView` içinde `map` ile çizilir.
- **Etki:** Hatalı/kötü niyetli istemciyle yük; çok gönderili profilde yavaşlama.
- **Önem:** Orta
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** `size = min(size, 50)`; trend penceresi için kısa süreli önbellek.
- **Önerilen çözüm:** Üst sınır, trend önbelleği, profil sayfalaması.
- **Kabul kriteri:** `?size=100000` en fazla 50 kayıt döner; ardışık 5 trend sayfası tek hesaplamadan beslenir.

### [S-P-16] Hata durumunda "boş" ekran yalan söylüyor
- **Yer:** `M/screens/PostDetailScreen.js:51-60, 278-283`; `M/screens/UserProfileScreen.js:82` (`postsRes.status==='fulfilled' ? ... : []`)
- **Sorun:** Yorumlar/profil gönderileri yüklenemezse hata yalnız `console.log`; ekran "ilk yorumu sen yaz" / "henüz gönderi yok" gösterir. (`M/components/feed/CommentModal.js` da aynı hatayı taşıyor ama ölü kod, bkz. S-P-17.)
- **Etki:** Yanlış bilgi, tekrar deneme yolu yok.
- **Önem:** Orta
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `error` durumu + "Tekrar dene" (Feed'deki desen).
- **Kabul kriteri:** Ağ kesikken PostDetail "yüklenemedi + yeniden dene" gösterir, boş-durum metni görünmez.

### [S-P-17] PostDetail başlığı her tuş vuruşunda yeniden monte ediliyor; `CommentModal` ölü kod
- **Yer:** `M/screens/PostDetailScreen.js:169, 275` (`const ListHeader = () => ...` ve `ListHeaderComponent={ListHeader}`); `M/components/feed/CommentModal.js` (hiçbir yerden import edilmiyor, `grep CommentModal` boş)
- **Sorun:** `ListHeader` her render'da yeni bileşen tanımı; yorum kutusuna yazarken (`setText`) başlık (avatar, görsel, beğeni animasyonu) sökülüp yeniden kurulur: görsel yeniden yüklenir/titrer, `scaleAnim` kaybolur.
- **Etki:** Yazarken titreme ve gereksiz iş (Varsayım: cihazda doğrulanmadı).
- **Önem:** Orta (performans/UX)
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Başlığı eleman olarak (`useMemo`) ver ya da memo'lu bileşen yap; giriş alanını ayrı bileşene taşı; `CommentModal.js`'i sil.
- **Kabul kriteri:** 20 karakter yazarken başlık bileşeni 0 kez yeniden monte edilir (test: mount sayacı = 1); `CommentModal.js` repoda yok.

### [S-P-18] Görsel yükleme: küçültme yok, MIME uzantıdan türetiliyor
- **Yer:** `M/screens/CreatePostScreen.js:41-46`, `M/services/api.js:222-240`; `M/components/feed/PostCard.js:384` (`height: 220`)
- **Sorun:** `quality:0.8` dışında küçültme yok; 12 MP fotoğraf (3-6 MB) 220 pt'lik kartta tam boyutta iniyor. `type: image/${ext}` uzantıdan türüyor (`.heic` → `image/heic`; sunucu kabul listesi incelenmedi, Varsayım). Gönderi oluşturma düşerse yetim dosya kalır (gece temizliği var).
- **Etki:** Veri/depolama maliyeti, yavaş akış.
- **Önem:** Düşük
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** İsteğe bağlı küçük resim türetimi.
- **Önerilen çözüm:** `expo-image-manipulator` ile uzun kenar 1600 px; MIME'ı `asset.mimeType`'tan al.
- **Kabul kriteri:** 12 MP girdi için yükleme gövdesi ≤ 1 MB; ortalama gönderi görseli ≤ 400 KB.

### [S-P-19] Test kapsamı: Post/Comment/Like/Poll servislerinde davranış testi yok
- **Yer:** `backend/src/test/java/com/concertly/backend/service/` (yalnız `PostTrendingScoreTest`; `PrivateAccountTest` ve Community* testleri kısmen); `BuddyMatchServiceTest.java` (8 test, eşzamanlılık/yasaklı kullanıcı yok)
- **Sorun:** `votePoll`, `likePost/unlikePost`, `deleteComment`, `updatePost`, `deletePost` için doğrudan servis testi yok; S-P-02 tipi hatalar bu yüzden yakalanmıyor.
- **Etki:** Regresyon riski.
- **Önem:** Orta
- **Kanıt:** Dizin listesi ve `grep`.
- **Mimari/Backend etkisi:** —
- **Önerilen çözüm:** S-P-02/05/06/12 ve S-B-04 için regresyon testleri.
- **Kabul kriteri:** Bu bulgular için ≥ 10 yeni test, `./mvnw test` yeşil.

### A.1.2 UX / erişilebilirlik / tasarım sistemi

### [S-P-20] Şikâyet/engel yolu PostDetail'de ve yorumlarda yok (App Store 1.2 riski)
- **Yer:** `M/screens/PostDetailScreen.js:41` (`isOwner` tanımlı, hiç kullanılmıyor), `:155-164` (yalnız kendi yorumu için Sil); şikâyet yalnız `M/components/feed/PostCard.js:137` (`POST`) ve `M/screens/ChatScreen.js:92` (`USER`); backend `COMMENT`/`MESSAGE` türlerini destekliyor (`B/model/Report.java:7`)
- **Sorun:** Bildirimden/paylaşım bağlantısından doğrudan PostDetail'e gelen kullanıcı gönderiyi şikâyet edemez, kullanıcıyı engelleyemez, kendi gönderisini düzenleyip silemez. Yorumlar için mobilde hiçbir şikâyet yolu yok. Apple 1.2, kullanıcı üretimli içerikte (yorumlar dâhil) şikâyet mekanizması bekler.
- **Etki:** İnceleme reddi ve moderasyon kör noktası.
- **Önem:** Yüksek
- **Kanıt:** Satırlar; mobilde `targetType` yalnız `POST`, `USER` ve topluluk türleri (`grep targetType`).
- **Mimari/Backend etkisi:** Uç hazır; yorum silme yetkisi için bkz. S-P-12; rapor doğrulaması S-B-12.
- **Önerilen çözüm:** PostDetail başlığına "⋯" menüsü (PostCard ile ortak hook); yorum satırında "Şikâyet et / Engelle".
- **Kabul kriteri:** PostDetail'de başkasının gönderisi ve yorumu için ≤ 2 dokunuşla şikâyet gönderilir (`POST /reports` `targetType=POST|COMMENT`); sahibi PostDetail'den düzenleyip silebilir.

### [S-P-21] Dokunma alanları ve geri düğmeleri küçük
- **Yer:** `M/components/feed/PostCard.js:406` (`actionBtn` dolgu/`hitSlop` yok, ~22 pt), `M/screens/FeedScreen.js:151,262`, `M/screens/PostDetailScreen.js:257` (yalnız metin geri düğmesi), `PostDetailScreen.js:156-163` (Sil)
- **Sorun:** Beğeni/yorum/paylaş düğmeleri 44 pt asgarinin yarısı; geri düğmeleri yalnız metin ve `hitSlop`'suz. (Boyutlar koddan çıkarım: Varsayım.)
- **Etki:** Yanlış dokunuş; erişilebilirlik testi başarısız.
- **Önem:** Orta
- **Kanıt:** Stil satırları.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `minHeight:44` / `hitSlop`.
- **Kabul kriteri:** Etkileşimli öğelerin dokunma alanı ≥ 44×44 pt.

### [S-P-22] Tasarım sistemi uyumu (açık tema)
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:32,35-39` (sabit `#00D4AA`, `#F5A623`, `#A78BFA`, `#A0A0B0`), `M/screens/PostDetailScreen.js:349,395` (avatar harfi `#fff`), `M/components/home/HomePostCard.js:10` ve `CLAUDE.md` kuralı
- **Sorun:** Sabit renkler açık temada düşük kontrast üretir; PostDetail avatar harfi beyaz, zemin `colors.cardAlt` (`#F5F6FA`, `M/theme.js:27`). Bkz. B bölümü P-06/P-07/B-13.
- **Etki:** Açık temada okunmayan harf/etiket.
- **Önem:** Düşük
- **Kanıt:** Satırlar (Varsayım: kontrast oranı hesaplanmadı).
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Tema anahtarlarına (`colors.text`, `colors.secondary`, `colors.accent`) taşı.
- **Kabul kriteri:** Her iki temada metin/arka plan kontrastı ≥ 4.5:1 (dekoratif hariç).

### [S-P-23] Doküman sapmaları (CLAUDE.md)
- **Yer:** `CLAUDE.md` "Refresh-token rotation" ve "comments/replies"; gerçek: `B/service/AuthService.java:236-247` yenilemede **aynı** refresh token'ı döndürüyor, istemci yalnız `accessToken` saklıyor (`M/services/api.js:185`); `B/model/Comment.java`'da üst yorum alanı yok
- **Sorun:** Rotasyon yok: çalınan refresh token 30 gün (`application.properties:161`) çalınma tespiti olmadan kullanılabilir; "yanıtlar" özelliği yok.
- **Etki:** Belge yanıltıcı; güvenlik beklentisi karşılanmıyor.
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Rotasyon istenirse yeni token + eskisini silme + eski token tekrar gelirse aileyi iptal.
- **Önerilen çözüm:** Belgeyi düzelt veya rotasyonu uygula.
- **Kabul kriteri:** Belge gerçeği yansıtır; rotasyon seçilirse aynı refresh token iki kez kullanılınca ikincisi 401 döner.

### [S-P-24] Gönderi oluşturmada taslak kaybı ve her zaman aktif "Paylaş" (Haiku P-10'dan)
- **Yer:** `M/screens/CreatePostScreen.js:116-118, 242-246`
- **Sorun:** "Vazgeç" içerik doluyken onay sormadan geri döner; "Paylaş" geçersiz formda da aktif görünür, doğrulama yalnız basınca Alert ile gelir.
- **Etki:** Uzun yazının yanlışlıkla kaybı; geç geri bildirim.
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** İçerik varsa "Taslağı at?" onayı; geçersizken `disabled` + `accessibilityState`.
- **Kabul kriteri:** Dolu formda Vazgeç onay ister; boş formda Paylaş `disabled`.

### [S-P-25] Android'de 4 düğmeli `Alert` (Haiku P-11'den, Varsayım)
- **Yer:** `M/components/feed/PostCard.js:145-150`, `M/screens/ChatScreen.js:102-106`
- **Sorun:** Şikâyet nedeni menüsü 3 neden + iptal = 4 düğme. React Native dokümanına göre Android `Alert` en fazla 3 düğme destekler; dördüncü (iptal) düşebilir. Dışa dokunarak kapanma davranışı koddan belli değil (Varsayım).
- **Etki:** Android'de iptal seçeneğinin kaybı.
- **Önem:** Orta (platforma bağlı, cihazda doğrulanmadı)
- **Kanıt:** Satırlar; düğme sayısı koddan, platform sınırı dokümandan.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Ortak alt sayfa (sheet) kullan.
- **Kabul kriteri:** Android'de şikâyet menüsünde 3 neden ve kapatma yolu birlikte görünür.

---

## A.2 Konser Arkadaşı

### A.2.1 Teknik riskler

### [S-B-01] Unmatch sonrası sohbet açık kalıyor, karşı taraf yazmaya devam edebiliyor
- **Yer:** `B/service/BuddyMatchService.java:216-223` (unmatch yalnız kendi swipe'ının `liked=false`'u), `B/service/ModerationService.java:56-57` (`conversationExists` DM kontrolünü atlatıyor), `B/service/MessageService.java:80-92` (sohbet listesi yalnız engellilere göre süzülüyor)
- **Sorun:** Unmatch mevcut mesaj geçmişini ve sohbet listesini etkilemez. `requireCanMessage` mevcut sohbet varsa DM tercihini (`NOBODY`/`FOLLOWING`) hiç kontrol etmez. Eşleşmeyi kaldıran kişiye karşı taraf sınırsız yazmaya devam eder; kurtulmak için **engellemek** gerekir (ChatScreen menüsünde var ama unmatch ile bağlı değil). Unmatch karşı tarafa bildirilmez; eşleşme onun listesinden sessizce kaybolur.
- **Etki:** Güvenlik beklentisi ile gerçek davranış çelişir: "eşleşmeyi kaldır" koruma sağlıyormuş gibi görünür ama sağlamaz.
- **Önem:** Yüksek
- **Kanıt:** `requireCanMessage` ilk satırı `if (messageRepository.conversationExists(...)) return;`; unmatch yalnız `s.setLiked(false)`.
- **Mimari/Backend etkisi:** Ürün kararı: unmatch sonrası karşı taraf yeni mesaj gönderemesin (öneri). Çifte kalıcı işaret (`unmatchedAt/By`) gerekir.
- **Önerilen çözüm:** Unmatch'ı kalıcı işaretle; `requireCanMessage` bu çift için 403 `BUDDY_UNMATCHED` döndürsün; sohbet listesinde gizle/salt-okunur.
- **Kabul kriteri:** A, B ile eşleşip yazıştıktan sonra A unmatch ederse B'nin `POST /messages` isteği 403 döner (servis testi), A'nın sohbet listesinde B görünmez.

### [S-B-02] `GET /events/{id}/buddies` anonim ve özel hesap gizliliğini deliyor
- **Yer:** `B/controller/ConcertBuddyController.java:230-251`; yol `GET /api/events/**` herkese açık (CLAUDE.md "Public routes")
- **Sorun:** (a) Giriş yapmamış istemci de `userId`, `username`, `profileImageUrl`, `createdAt` alır (`:238-247`): "bu konserde kim arkadaş arıyor" kazınabilir. (b) Giriş yapmış **herhangi** bir kullanıcı (opt-in etmemiş olsa da) her arayanın `city` ve `message`'ını görür; hesap **gizliyse** bile (`PrivacyService.isPrivate` kontrolü yok), oysa deste gizli hesapta şehir/bio/türü gizliyor (`B/service/BuddyMatchService.java:127-140`). (c) Sınıf yorumundaki "yalnız isteyen ve karşılıklı olan görünür" kararını (`:19-21`) dolaşıyor; `isActive` süzgeci de yok.
- **Etki:** Yabancılarla buluşma bağlamında kullanıcı adı + şehir + mesaj sızıntısı; SEC-05 ile tutarsız.
- **Önem:** Yüksek
- **Kanıt:** Satırlar; `PrivacyService` bu controller'a enjekte değil.
- **Mimari/Backend etkisi:** Uç, `EventDetailScreen`'de "n kişi arıyor" sayısı ve avatar yığını için kullanılıyor (`M/screens/EventDetailScreen.js:165,712,764`); kısıtlama bu UI'ı da etkiler.
- **Önerilen çözüm:** Anonimde yalnız sayı; girişli kullanıcıya yalnız kendisi o konserde arıyorsa liste; gizli hesapta `city/message` boş; `isActive=false` süz.
- **Kabul kriteri:** Token'sız istek yalnız sayı döner (kimlik alanı yok); gizli hesabın `city/message`'ı hiçbir izleyiciye sızmaz; opt-in etmemiş kullanıcı listeyi göremez (controller testi, ≥ 3 senaryo).

### [S-B-03] Swipe hatası sessiz; kart iyimser silinip kayboluyor
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:280-299`
- **Sorun:** `sendSwipe` kartı önce yerelden kaldırır (`:281`), `setSwiping(false)` yapar (`:282`), sonra isteği atar. İstek düşerse `catch` yalnız `console.log` (`:294-296`); kart geri gelmez, `lastSwipe` null. Kullanıcı "beğendim" sanır, sunucuda kayıt yoktur. `403 BUDDY_NOT_ELIGIBLE`, `403 BLOCKED`, 409, 429 da aynı şekilde yutulur. `setSwiping(false)` istekten önce çağrıldığından birden çok swipe aynı anda uçuşta olabilir; `lastSwipe` son gelen cevaba göre set edilir (sıra bozulabilir).
- **Etki:** Çekirdek aksiyonda sessiz veri kaybı.
- **Önem:** Yüksek
- **Kanıt:** Satırlar; ekranda `apiErrorMessage` kullanımı yok (`grep` boş).
- **Mimari/Backend etkisi:** Yok; 409 için sunucu tarafı idempotent upsert (S-B-04).
- **Önerilen çözüm:** Hatada kartı geri koy + mesaj; `BUDDY_NOT_ELIGIBLE/BLOCKED`'ta kartı kaldır ve açıkla; swipe'ları sıraya al.
- **Kabul kriteri:** `/buddy/swipe` ağ hatası verirse kart ≤ 500 ms içinde destede geri görünür ve hata bildirimi çıkar; 403'te kart kalkar ve uygun mesaj gösterilir (bileşen testi).

### [S-B-04] Karşılıklı beğeni yarışı: eşleşme bildirimi kaçabilir; ilk-swipe yarışı genel 409
- **Yer:** `B/service/BuddyMatchService.java:168-203`; `B/model/BuddySwipe.java:6-10`
- **Sorun:** İki kullanıcı aynı anda birbirini beğenirse iki ayrı transaction (READ COMMITTED) birbirinin commit edilmemiş satırını göremez: ikisi de `matched=false` döner, `buddy_match` bildirimi/push **hiç gitmez**; eşleşme yalnız sonraki `GET /buddy/matches`'te görünür (veri tutarlı, "eşleşme anı" kaçar). `findBySwiperIdAndTargetId(...).orElse(new)` + `save` kontrol-sonra-yaz; hızlı çift istek unique ihlali verir, `GlobalExceptionHandler` bunu "Bu veri zaten kullanılıyor" 409'una çevirir (`:99`), mobil de yutar (S-B-03).
- **Etki:** Düşük olasılıklı ama gerçek kaçırılmış eşleşme; kafa karıştıran hata.
- **Önem:** Orta
- **Kanıt:** Kod yolu (Varsayım: yarış gerçek çift istemciyle denenmedi).
- **Mimari/Backend etkisi:** Çift için sıralı kilit.
- **Önerilen çözüm:** `pg_advisory_xact_lock(hash(min(a,b),max(a,b)))`; ardından upsert (`ON CONFLICT DO UPDATE`) ve eşleşme kontrolü.
- **Kabul kriteri:** İki iş parçacığıyla eşzamanlı `swipe(A,B,true)`/`swipe(B,A,true)` testinde tam bir yanıt `matched=true` döner ve tam 1 `buddy_match` bildirimi üretilir (100 tekrarda 0 kaçırma); aynı swipe'ın tekrarı 200 döner.

### [S-B-05] Keşif ekranı: yükleme hatası "arkadaş aramıyorsun" boş durumu gibi görünüyor
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:231-246, 499-512`
- **Sorun:** `fetchAll` hatasında yalnız `console.log` (`:241`); `loading=false` olur, `lookingEvents` boş kaldığından kullanıcı ilk yüklemede **"Arkadaş mı arıyorsun?"** boş durumunu görür (`:499`). Önceki başarılı yüklemeden sonraki hata ise eski veriyi sessizce tutar.
- **Etki:** Yanlış yönlendirme.
- **Önem:** Orta
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `error` durumu + yeniden dene paneli.
- **Kabul kriteri:** `discover` isteği başarısızken "tekrar dene" paneli görünür, "arkadaş aramıyorsun" metni görünmez.

### [S-B-06] Her odakta `fetchAll`: undo geçmişi ve uçuştaki swipe'lar sıfırlanıyor
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:238-239, 248, 310-322, 334`
- **Sorun:** `useFocusEffect` ile her odaklanmada (profil/etkinlik/sohbetten dönünce) `removed` ve `lastSwipe` sıfırlanır: geri al kaybolur; uçuştaki swipe commit olmadan yenileme gelirse kart destede yeniden belirip aynı kişiye ikinci swipe (S-B-04'teki 409) doğurabilir. Geri al hatası yutulur (`:318-320`) ve `lastSwipe` zaten null olduğundan tekrar denenemez. Sunucu tek-son-kaydırma sınırı uygulamıyor: `undo` herhangi bir geçmiş swipe'ı siler (`B/service/BuddyMatchService.java:207-214`), zaman sınırı yok.
- **Etki:** Tutarsız geri al; yarış penceresi.
- **Önem:** Orta
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** İsteğe bağlı: undo yalnız son N saniye/son kayıt.
- **Önerilen çözüm:** Odak yenilemesinde `removed`/`lastSwipe`'ı koru ve yeni desteyle birleştir; uçuşta swipe varken yenilemeyi ertele; undo hatasında mesaj.
- **Kabul kriteri:** Kartı kaydırıp profil açıp dönünce geri al hâlâ aktiftir ve aynı kart destede görünmez (bileşen testi).

### [S-B-07] Yasaklı/pasif hesaplar destede, eşleşmelerde ve akışta görünmeye devam ediyor
- **Yer:** `B/service/BuddyMatchService.java:88-91, 235-251`; `B/service/PostService.java:237-241, 266-275`; yasaklama `B/controller/AdminController.java:305`; `isActive` hiçbir repository süzgecinde yok (`grep` boş)
- **Sorun:** `isActive=false` kullanıcılar deste adayı, eşleşme ve akış gönderisi olmaya devam eder; yalnız giriş/refresh engellenir (`B/service/AuthService.java:166,231`). Elde geçerli erişim jetonu olan yasaklı kullanıcı ≤ 1 saat işlem yapabilir (Varsayım: `JwtFilter` davranışı incelenmedi).
- **Etki:** Yasaklanan kullanıcının kartı/gönderisi gösterilmeye devam eder.
- **Önem:** Orta
- **Kanıt:** `isActive` süzgeci yok.
- **Mimari/Backend etkisi:** Ürün kararı (yasak = içerik gizlensin mi).
- **Önerilen çözüm:** Deste/eşleşme/akış sorgularına `u.isActive = true`.
- **Kabul kriteri:** Yasaklı kullanıcı hiçbir destede, eşleşme listesinde veya akışta görünmez (servis testi).

### [S-B-08] Deste ve eşleşmeler N+1; adaylar sınırlanmadan hesaplanıyor
- **Yer:** `B/service/BuddyMatchService.java:108-149` (her aday için `profileOf` → 2 sorgu; `MAX_CARDS=50` kırpması hesaptan sonra: `:155`), `:229-251` (her eşleşme için `findById`, `sharedGoingEvents` (4 sorgu), `conversationExists`), `:108-111` (tüm swipe geçmişi belleğe)
- **Sorun:** Popüler konserde yüzlerce aday olduğunda her çağrı yüzlerce sorgu atar; Buddy ekranı her odakta `discover` + `matches` çağırır (S-B-06).
- **Etki:** Ölçekte gecikme ve DB yükü.
- **Önem:** Orta
- **Kanıt:** Kod yolu (Varsayım: ölçüm yok).
- **Mimari/Backend etkisi:** Toplu sorgular, aday penceresini önce kırp.
- **Önerilen çözüm:** Önce adayları (beni beğenenler + en yeni) kırp, profilleri toplu çek; `matches()` için tek JOIN'li sorgu.
- **Kabul kriteri:** 500 adaylı konserde `discover` ≤ 10 SQL sorgusu ve p95 < 300 ms (Hibernate istatistik testi).

### [S-B-09] "Geçtim" bir kişiyi tüm konserler için kalıcı gizliyor; eşleşmeler hiç eskimiyor
- **Yer:** `B/service/BuddyMatchService.java:108-109, 117` (`alreadySwiped` konserden bağımsız), `:218-223` (unmatch geri alınamaz), `:246, 339` (eşleşme konsere bağlı değil)
- **Sorun:** Swipe anahtarı `(swiper,target)`; konser X'te geçilen kişi, ortak yeni konser Y'de de görünmez. Eşleşme konser geçtikten sonra da listede kalır (`sharedEvents` boş).
- **Etki:** Aynı iki kişi başka konserde yeniden denk gelemez; eski eşleşmeler birikir.
- **Önem:** Orta (ürün kararı)
- **Kanıt:** Kod yolu.
- **Mimari/Backend etkisi:** Swipe'a `eventId` boyutu veya süreli "geçti"; şema değişikliği.
- **Önerilen çözüm:** Pass'i konser-bazlı veya süreli yap; eşleşmeyi son ortak konserden 30 gün sonra arşivle.
- **Kabul kriteri:** Konser X'te geçilen kişi, ortak yeni konser Y'de destede yeniden görünür (servis testi).

### [S-B-10] Sohbet: 4 sn'de bir tam konuşma çekimi + okundu yazımı, sayfalama yok, yarış
- **Yer:** `M/screens/ChatScreen.js:44-72`; `B/service/MessageService.java:68-76` (`getConversation` `@Transactional` yazıyor + tüm mesajları döndürüyor); `M/screens/ChatListScreen.js:44` ↔ `MessageService.java:80-92` (tüm mesajları yüklüyor)
- **Sorun:** (a) Açık sohbet 4 sn'de bir tüm geçmişi çeker, her seferinde `markConversationRead` UPDATE'i çalışır. (b) Sohbet listesi 8 sn'de bir kullanıcının tüm mesajlarını belleğe alır. (c) `handleSend` yeni mesajı listeye ekler (`ChatScreen.js:84`); uçuştaki bir poll cevabı sonra gelirse listeyi onsuz yazar, mesaj ≤ 4 sn kaybolup geri gelir (Varsayım: zamanlama koşulu). (d) Sunucuda mesaj uzunluğu sınırı yok; yalnız mobil `maxLength={1000}`, `Message.content` `TEXT` (`B/model/Message.java:25`). (e) `MessageController.java:27` `receiverId` yoksa NPE→500.
- **Etki:** Pil/veri/DB yükü; kaybolan mesaj hissi; API ile sınırsız boyutlu mesaj.
- **Önem:** Orta
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** `?afterId=` artımlı çekim; mesaj sınırı.
- **Önerilen çözüm:** Artımlı + sayfalı çekim; poll cevabında yerel "gönderiliyor" mesajlarını birleştir; sunucu 1000 karakter sınırı.
- **Kabul kriteri:** 1000 mesajlık sohbette poll yanıt gövdesi ≤ 5 KB; 1001 karakterlik mesaj 400 döner.

### [S-B-11] Katılım ucu doğrulamaları ve yarış
- **Yer:** `B/controller/ConcertBuddyController.java:253-282`
- **Sorun:** Kontrol-sonra-ekle yarışta unique ihlali → genel 409; etkinliğin iptal/birleştirilmiş (`mergedIntoEventId`) veya listelenmeyen olup olmadığı kontrol edilmiyor (deste bu etkinlikleri süzer: `ConcertBuddyRepository.findUpcomingForUser`), yani iptal edilmiş konserde "arkadaş arıyorum" açılabilir ve destede kimse görünmez.
- **Etki:** Küçük tutarsızlık.
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `Event.listedPublicly()` + birleştirme kontrolü; upsert.
- **Kabul kriteri:** İptal/listelenmeyen etkinlikte `POST` 400 döner.

### [S-B-12] Şikâyet uç noktası hedef türü ve varlığını doğrulamıyor
- **Yer:** `B/service/ModerationService.java:149-165`, `B/controller/ModerationController.java:27-38`
- **Sorun:** `targetType` beyaz listede değil (yalnız topluluk türleri kontrol ediliyor), `POST/COMMENT/USER/MESSAGE` için hedefin varlığı ve şikâyet edenin görebilirliği doğrulanmıyor; `reason` uzunluğu sınırsız. Var olmayan `targetId` ile admin kuyruğuna çöp satır eklenebilir.
- **Etki:** Moderasyon kuyruğu kirlenmesi.
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Tür beyaz listesi + hedef varlığı + `reason` ≤ 500.
- **Kabul kriteri:** Geçersiz tür 400, olmayan hedef 404, `reason` 501+ karakter 400.

### A.2.2 UX / erişilebilirlik

### [S-B-13] Swipe kabuğu JS-thread PanResponder; sabit ekran genişliği
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:28` (`Dimensions.get('window')` modül yüklenirken), `:51-52` ("UI thread'inde" yorumu), `:81-95` (`PanResponder` + `x.value = g.dx`)
- **Sorun:** Hareket RN `PanResponder` (JS thread) ile alınıp paylaşımlı değerlere JS'ten yazılıyor; JS meşgulken kart takılabilir. Yorum yanıltıcı (yalnız animasyon stili UI thread'de). `width` sabit: döndürme/split-view'da eşik yanlış (Varsayım).
- **Etki:** Takılan kaydırma hissi (Varsayım: cihazda ölçülmedi).
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `Gesture.Pan()` + worklet; `useWindowDimensions`.
- **Kabul kriteri:** Orta seviye Android'de kaydırma sırasında JS FPS ≥ 55; genişlik `useWindowDimensions`'tan gelir.

### [S-B-14] Erişilebilirlik ve büyük yazı boyutu
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:622` (yeni eşleşme şeridinde unmatch yalnız `onLongPress`), `:697` (tüm Switch'lerde aynı etiket), `:790` (`tab` `height: 38` sabit, `numberOfLines={1}`), `:823-828` (kart `overflow:hidden`, kaydırma yok), `:803-806` (filtre çipi ~28 pt, rol/seçili durum yok), `:842, 859` (9.5 pt ve 7.5 pt yazılar)
- **Sorun:** (a) Yeni eşleşmeyi kaldırma yolu yalnız uzun basma; ekran okuyucu kullanıcıları ulaşamaz. (b) Switch'ler hangi konser olduğunu söylemiyor. (c) Büyük yazı boyutunda sekme etiketleri ve kart gövdesi (etkinlik satırı + alıntı + nedenler + bio) kırpılır (Varsayım: cihaz testi yok). (d) Filtre çipleri küçük ve rolsüz. (e) 7.5/9.5 pt metinler okunmaz.
- **Etki:** Yardımcı teknoloji engelleri; küçük ekranda kırpılmış içerik.
- **Önem:** Orta
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** `accessibilityActions` (unmatch), Switch etiketine konser adı, sekmede `minHeight`, kart gövdesi kaydırılabilir, çiplere `accessibilityRole/State` + `hitSlop`, minimum 11 pt.
- **Kabul kriteri:** TalkBack/VoiceOver ile her eşleşme için unmatch bulunabilir; her Switch `"<konser adı>, arkadaş arıyorum"` okur; yazı %200'de sekme etiketleri ≤ 2 satırda kesilmeden görünür.

### [S-B-15] Deste kartından engelle/şikâyet/profil yolu yok (Haiku B-01'den)
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:380-482` (`renderCard`: kartta `UserProfile` gezinmesi yok; yalnız etkinlik satırı `openEvent`), `:343-363` (profil yalnız eşleşme menüsünde); güvenlik bandı `:535-546`; metin `M/i18n/translations.js:438` / `:2012` ("Rahatsız olursan profilden engelle ya da şikâyet et")
- **Sorun:** Tanımadığı biri karşısında kullanıcı, eşleşmeden önce o kişinin profiline gidip engelleyemez/şikâyet edemez; uygulamanın kendi uyarısı anlattığı yolu sunmuyor.
- **Etki:** Güvenlik vaadi karşılanmıyor; yabancılarla buluşma bağlamında riskli.
- **Önem:** Yüksek
- **Kanıt:** Kartta profil gezinmesi yok (grep: `UserProfile` yalnız `:345`); backend `/users/{id}/block` ve `/reports` hazır.
- **Mimari/Backend etkisi:** Yok (yalnız mobil).
- **Önerilen çözüm:** Karta "⋯" menüsü (Profili gör / Şikâyet et / Engelle); engel sonrası kart destenden çıkar.
- **Kabul kriteri:** Destedeki her karttan ≤ 2 dokunuşla şikâyet/engel yapılır; engellenen kişi bir daha destede görünmez (bileşen testi + servis testi).

### [S-B-16] "Yeni eşleşmeler" iki kez görünüyor (Haiku B-06'dan)
- **Yer:** `M/screens/ConcertBuddyMatchScreen.js:617-633` (`{(chats.length ? chats : newMatches).map(...)}`; başlık yalnız `chats.length > 0`)
- **Sorun:** Hiç sohbet yoksa aynı kişiler hem yatay şeritte hem başlıksız alt listede görünür.
- **Etki:** Kopya içerik, belirsiz bölüm yapısı.
- **Önem:** Düşük
- **Kanıt:** Satırlar.
- **Mimari/Backend etkisi:** Yok.
- **Önerilen çözüm:** Sohbet yoksa alt listeyi gizle.
- **Kabul kriteri:** Yalnız yeni eşleşme varken her kişi ekranda bir kez görünür.

---

# B. Haiku bulgularının doğrulanması

Kaynak: `docs/audits/haiku-ux-audit.md` (31 bulgu). Durumlar: Doğrulandı / Kısmen doğrulandı / Reddedildi / Yeni bulgu ile örtüşüyor. Haiku'nun satır numaraları birkaç yerde kaymış (özellikle `CommentModal.js`); doğrulama gerçek satırlarla yapıldı.

| Haiku | Karar | Özet |
|---|---|---|
| P-01 | Doğrulandı (önem düşürüldü) | S-P-05 ile örtüşüyor |
| P-02 | Kısmen doğrulandı | PostDetail doğru; CommentModal ölü kod (S-P-16/17) |
| P-03 | Reddedildi | Yalnız ölü kod (CommentModal) için geçerli |
| P-04 | Doğrulandı | S-P-20 + S-P-12 |
| P-05 | Doğrulandı | S-P-20 |
| P-06 | Doğrulandı (önem düşürüldü) | S-P-22 |
| P-07 | Doğrulandı (önem düşürüldü) | S-P-22 |
| P-08 | Doğrulandı | S-P-04 |
| P-09 | Doğrulandı | Yeni değil, küçük UX |
| P-10 | Doğrulandı | S-P-24 |
| P-11 | Kısmen doğrulandı | S-P-25 (platform varsayımı) |
| P-12 | Kısmen doğrulandı | Sabit değerler doğru, etki Varsayım |
| P-13 | Reddedildi | Aksiyon satırı sola dayalı, FAB sağda |
| P-14 | Doğrulandı | S-P-21 / S-B-14 ile örtüşüyor |
| P-15 | Kısmen doğrulandı | Boş kayıt sessiz doğru; Android klavye Varsayım |
| P-16 | Doğrulandı | S-P-13 |
| B-01 | Doğrulandı | S-B-15 (benim ilk turda kaçırdığım) |
| B-02 | Doğrulandı (önem Kritik→Yüksek; "uyarı metni çelişiyor" kısmı Reddedildi) | S-B-01 |
| B-03 | Kısmen doğrulandı | Ürün/UX yorumu |
| B-04 | Kısmen doğrulandı | Panel yanlış tanımlanmış; S-B-05 |
| B-05 | Doğrulandı | S-B-03, S-B-06 |
| B-06 | Doğrulandı | S-B-16 |
| B-07 | Kısmen doğrulandı | S-B-14 |
| B-08 | Doğrulandı | S-B-14 |
| B-09 | Doğrulandı | S-B-14 |
| B-10 | Doğrulandı | S-B-14 |
| B-11 | Doğrulandı (Varsayım) | S-B-14 |
| B-12 | Doğrulandı | S-B-14 |
| B-13 | Kısmen doğrulandı | Çoğu koyu zeminde |
| B-14 | Kısmen doğrulandı | Davranış doğru; ürün kararı |
| B-15 | Doğrulandı | S-B-10 |

## Ayrıntılı gerekçeler

### P-01 Beğeni geri bildirimi: **Doğrulandı, önem Yüksek→Orta** (S-P-05 ile örtüşüyor)
`PostCard.js:94-98` ve `PostDetailScreen.js:73-75`: durum yalnız yanıttan sonra değişir; `:101-102` hata yutulur. Haiku'nun "animasyon başarısız istekte de çalışıyor" iddiası doğru (`:79-87` istekten önce). Önem itirazım: veri kaybı yok, kalp kısa gecikmeyle yine doğru duruma gelir; asıl sorun hata sessizliği ve 409'da takılma (Haiku bunu görmemiş, bkz. S-P-05c). `likeLoading` kilidinin çift dokunmayı engellediği doğru (`:76`).

### P-02 Yorum yüklenemezse boş durum: **Kısmen doğrulandı**
`PostDetailScreen.js:51-60, 278-283` için doğru (S-P-16). `CommentModal.js` için de kodda doğru, ama dosya hiçbir yerden import edilmiyor (`grep CommentModal` boş); dolayısıyla kullanıcıya etkisi yok. Haiku'nun `CommentModal.js:32-42, 72-76` satırları dosyayla uyuşmuyor (gerçek: `:108-118`, `:148-152`).

### P-03 Yorum gönderince spinner: **Reddedildi (kullanıcıya etkisi yok)**
İddia yalnız `CommentModal`'daki davranışı anlatıyor (gerçek satırlar `:109`, `:126`, `:146`); bileşen ölü kod. Canlı yüzey PostDetail yeni yorumu iyimser ekler (`PostDetailScreen.js:94`), zaten Haiku da öyle diyor. Önerilecek tek iş CommentModal'ı silmek (S-P-17). PostDetail'in asıl yorum sorunu sıra tutarsızlığıdır (S-P-08), Haiku bunu yakalamamış.

### P-04 Yorum moderasyonu: **Doğrulandı** (S-P-20 + S-P-12)
`CommentService.java:113-115` yalnız yorum sahibine izin verir; mobilde `COMMENT` raporu yok (`grep targetType`: `POST`, `USER`, topluluk). Haiku'nun "Varsayım: `/reports` COMMENT kabul ediyor" kısmını doğruladım: `ModerationController.java:27-38` tür sınırlaması yapmıyor, `Report.java:7` türü `POST|COMMENT|MESSAGE|USER` olarak tanımlıyor. Ek: yetkisiz silme 400 dönüyor (S-P-12) ve rapor doğrulaması gevşek (S-B-12). Önemi Yüksek kabul ediyorum (App Store 1.2).

### P-05 PostDetail'de menü yok: **Doğrulandı** (S-P-20)
`PostDetailScreen.js:41` `isOwner` tanımlı ama kullanılmıyor; `handleOptions` yok. Haiku "Orta" demiş; ben Yüksek: bildirim ve paylaşım bağlantıları doğrudan PostDetail'e açıyor ve inceleme riski var.

### P-06 Light temada avatar harfi: **Doğrulandı, önem Yüksek→Orta** (S-P-22)
`PostDetailScreen.js:344-349` (`backgroundColor: colors.cardAlt`, `color: '#fff'`) ve `:390-395`; light `cardAlt: '#F5F6FA'` (`theme.js:27`). Beyaz harf ~1.1:1, yani okunmaz. PostCard `colors.text` kullanıyor (`PostCard.js:383`), tutarsızlık gerçek. Önem itirazım: yalnız fotoğrafsız kullanıcıda ve baş harfte; kullanıcı adı ayrıca yazılı, bilgi kaybı yok. Dekoratif/kozmetik, Orta.

### P-07 HomePostCard sabit renkler: **Doğrulandı, önem Orta→Düşük** (S-P-22)
`HomePostCard.js:10, 24-25`: renk `index % 6` ile atanıyor, `#F5A623`/`#00D4AA` açık zeminde zayıf. `content opacity: 0.75` (`:86`) koyu metinde sorun değil (açık temada `#1A1A2E` %75 hâlâ yüksek kontrast). Yalnız avatar harfi etkileniyor.

### P-08 Sayfalama hatası: **Doğrulandı** (S-P-04)
`FeedScreen.js:103, 172` birebir. Ek bulgu (Haiku'da yok): kopya kayıt riski (S-P-03).

### P-09 Takip boşsa sessiz geçiş: **Doğrulandı (Düşük)**
`FeedScreen.js:62-67`. Geçiş sekme göstergesi animasyonuyla görünür olduğu için "sessiz" tam doğru değil, ama neden açıklanmıyor. Tek seferlik (`autoSwitchedRef`).

### P-10 Taslak kaybı ve her zaman aktif Paylaş: **Doğrulandı** (S-P-24)
`CreatePostScreen.js:116-118` `goBackOrFallback` doğrudan; `:242-246` koşulsuz aktif. Haiku'nun atladığı daha önemli risk: çift dokunuşla çift gönderi (S-P-11).

### P-11 Android 4 düğmeli Alert: **Kısmen doğrulandı** (S-P-25)
Düğme sayısı doğru (`PostCard.js:145-150`: 3 neden + iptal; `ChatScreen.js:102-106`). Android sınırı RN dokümanından, cihazda doğrulanmadı; "sıkışma" iddiasını Varsayım olarak bırakıyorum.

### P-12 Sabit üst boşluklar: **Kısmen doğrulandı**
Sabit değerler gerçek: `FeedScreen.js:260` (60), `CreatePostScreen.js` (60), `PostDetailScreen.js` (56), `ConcertBuddyMatchScreen.js:~779` (52). Cihazda bozulma Varsayım; bu değerler çoğu çentikli iPhone'da dar da olsa çalışır. Orta yerine Düşük.

### P-13 FAB son kartın aksiyonlarını örter: **Reddedildi**
FAB `right:20`, genişlik 60 (`FeedScreen.js:288-297`). Aksiyon satırı `flexDirection:'row', gap:20` ve `justifyContent` yok, yani sola dayalı (`PostCard.js:402-406`); 3 düğme toplam ~200 pt, FAB ise 390 pt ekranda x≈310-370 aralığında. Satır FAB'la yatayda kesişmez. FAB'ın örtebileceği tek şey son kartın sağ alt köşesi (kenarlık/metin sonu); fonksiyonel sorun yok.

### P-14 Dokunma hedefleri ve etiketler: **Doğrulandı** (S-P-21, S-B-14 ile örtüşüyor)
`CreatePostScreen.js:226-233` emoji düğmelerinde etiket/`hitSlop` yok; `PollCard.js:36-42` rol ve `accessibilityState` yok (doğrulandı: `TouchableOpacity` yalnız `disabled`). Boyut sayıları Varsayım.

### P-15 Düzenleme modalı: **Kısmen doğrulandı**
`PostCard.js:187` boş metinde sessiz `return` doğru; `:282` Android'de `behavior: undefined`. Klavyenin alanı örtmesi Varsayım (Modal ayrı pencere, `adjustResize` davranışı cihaza bağlı). Düşük.

### P-16 "Düzenlendi" belirteci yok: **Doğrulandı** (S-P-13)
`PostResponse.java`'da `updatedAt` yok. Not: `Post.updatedAt` yaratılışta `now()` alıyor (`B/model/Post.java:59`), "düzenlendi" kararı için `updatedAt > createdAt + tolerans` gerekir.

### B-01 Deste kartından engel/şikâyet yok: **Doğrulandı** (S-B-15), benim ilk turda kaçırdığım gerçek bir bulgu
`ConcertBuddyMatchScreen.js` içinde `UserProfile` gezinmesi yalnız eşleşme menüsünde (`:345`); `renderCard` yalnız etkinliğe gidiyor. `translations.js:438/2012` metni "profilden engelle ya da şikâyet et" diyor. Önem Yüksek (Haiku ile aynı).

### B-02 Unmatch sohbeti kapatmıyor: **Doğrulandı, önem Kritik→Yüksek** (S-B-01); "uyarı metni çelişiyor" kısmı **Reddedildi**
Çekirdek doğru: `BuddyMatchService.java:218-223` yalnız `liked=false`; `ModerationService.java:56-57` mevcut sohbette DM tercihini atlatıyor; `MessageService.getConversations` yalnız engellileri süzüyor. Haiku'nun gösterdiği "ModerationService:52-53" yorumu da aynı fikri doğruluyor. İki itirazım:
1. **Önem.** Kritik değil, Yüksek: istismar, ön koşul olarak karşılıklı onay (iki taraf da beğenmiş) gerektiriyor; mağdur ChatScreen menüsünden engelleyebiliyor (`ChatScreen.js:113-129`); veri sızıntısı veya hesap ele geçirme yok. Bir güvenlik beklentisi boşluğu, ama kullanıcının elinde alternatif var.
2. **Metin iddiası yanlış.** `translations.js:449` "Bir daha destende görünmez" diyor ve bu doğru: unmatch'ten sonra kişi `alreadySwiped` içinde kalıyor (`BuddyMatchService.java:108-117`). Metin sohbetten söz etmiyor, dolayısıyla "çelişki" yok; eksik olan sohbet davranışı hakkında hiçbir bilgi verilmemesi. Çözümde metin güncellemesi (ör. "Sohbet kapanır") yine gerekli.
Ayrıca Haiku "ChatList buddy'ye bağlı değil" diyor: doğru, `ChatListScreen.js:28` genel `/messages/conversations`. Bu nedenle sohbet kapatma backend'de yapılmalı.

### B-03 Uyum yüzdesi açıklanmıyor: **Kısmen doğrulandı**
Skor bileşenleri kartta nedenler olarak gösteriliyor (`ConcertBuddyMatchScreen.js:391-396`) ve bunlar `compatibility()` girdileriyle aynı (`BuddyMatchService.java:271-289`: ortak sanatçı, tür, şehir, birlikte gidilen konser). "Nedenler skorla bağlantısız" iddiası bu yüzden zayıf; ağırlıklar (14/30/10/10) gösterilmiyor ve "tahmin" olduğu belirtilmiyor. Ürün/UX yorumu, Orta yerine Düşük.

### B-04 Ağ hatası "deste bitti": **Kısmen doğrulandı** (S-B-05)
Çekirdek doğru (`:241` yalnız `console.log`, yeniden dene yok). Ancak yanlış panel tanımlanmış: hata yalnız `cards`/`myEvents` boşken yüklenen ilk yüklemede olur ve o durumda `lookingEvents.length === 0` olduğundan görünen ekran "Bitti" paneli (`:580-606`) değil, **"Arkadaş mı arıyorsun?" paneli** (`:499-512`). Daha önce başarılı yüklenmişse hata eski veriyi sessizce tutar. Önem Yüksek→Orta.

### B-05 Swipe/undo hataları sessiz: **Doğrulandı** (S-B-03, S-B-06)
`:294-296`, `:318-320` birebir; ekranda `apiErrorMessage` yok. Haiku'nun atladığı: odak yenilemesinde `lastSwipe` sıfırlanması (S-B-06) ve çoklu uçuştaki swipe sırası.

### B-06 Yeni eşleşmeler iki kez: **Doğrulandı** (S-B-16)
`:632-633`: `chats.length ? chats : newMatches` ve başlık `chats.length > 0` koşullu. Benim ilk turda kaçırdığım doğru bir gözlem.

### B-07 Eşleşme menüsü uzun basış: **Kısmen doğrulandı** (S-B-14)
Yeni eşleşme şeridinde (`:622`) yalnız `onLongPress` var, doğru. Ancak alt listedeki satırlarda görünür "⋯" düğmesi var (`:649`), ve sohbetli eşleşmeler yalnız o listede olduğundan menü keşfedilebilir. "Kaldırma hatasında sessiz": `catch { fetchAll(); }` kişiyi geri getirir (kullanıcı bunu görür) ama neden söylenmez; doğru, Düşük.

### B-08 Switch etiketi aynı: **Doğrulandı** (S-B-14)
`:697` sabit `t('detail_buddy_title')`.

### B-09 Filtre çipleri: **Doğrulandı (Düşük)** (S-B-14)
`:517-531` rol/durum yok; `paddingVertical: 7`, `fontSize: 12.5` (`:800-806`). Yükseklik Varsayım.

### B-10 Sekme yüksekliği: **Doğrulandı** (S-B-14)
`:790` `height: 38`, `numberOfLines={1}`. `maxFontSizeMultiplier` uygulama genelinde yok (`App.js`/ekranda grep boş).

### B-11 Kart gövdesi kırpılır: **Doğrulandı (Varsayım)** (S-B-14)
`:823-828` `absoluteFill` + `overflow:hidden`, hero `flex:1 minHeight:180`; gövde için kaydırma yok. Gerçek kırpılma cihaz testi olmadan Varsayım.

### B-12 Küçük metinler: **Doğrulandı** (S-B-14)
`:842` `fontSize: 9.5`, `:859` `fontSize: 7.5` birebir.

### B-13 Sabit renkler (Buddy): **Kısmen doğrulandı**
`LIKE/PASS/compatColor` sabit (`:32-39`). Ama `avatarRing '#1A0A24'` (`:930`) yalnız koyu gradyanlı `MatchOverlay`'de kullanılıyor (`Avatar ... ring` yalnız `:164,168`), yani açık tema sorunu değil. Gerçek risk `compatColor`'un açık kart zemininde metin rengi olarak kullanılması (S-P-22). Düşük.

### B-14 Gizli hesapta profil fotoğrafı: **Kısmen doğrulandı**
`BuddyMatchService.java:136` fotoğraf koşulsuz, `:137-140` diğerleri gizli hesapta boş: doğru. Ancak uygulamanın başka yüzeylerinde de gizli hesapların avatarı görünür (`PostResponse.userProfileImageUrl`, gönderi kartı), ve kullanıcı deste için kendisi opt-in etti. Bu bir ürün kararıdır, tutarsızlık hatası değil. Asıl gizlilik sorunu `GET /events/{id}/buddies` uç noktasıdır (S-B-02): orada gizli hesabın şehir ve mesajı da herkese açık. Haiku bunu fark etmemiş. Önem Orta→Düşük (B-14 için).

### B-15 Sohbet hatası ve polling: **Doğrulandı** (S-B-10)
`ChatScreen.js:47-56` yalnız `console.log`, `:63` `setInterval(..., 4000)`. Haiku'nun atladığı: `getConversation`'ın her poll'da yazma yapması, sohbet listesinin tüm mesajları yüklemesi, sunucuda mesaj uzunluğu sınırı olmaması.

## Haiku'nun kaçırdığı, benim bulduğum önemli konular
S-P-01 (refresh → oturum kapanması), S-P-02 (anket oy bütünlüğü), S-B-02 (herkese açık opt-in listesi), S-B-04 (eşleşme yarışı), S-B-07 (yasaklı hesaplar), S-P-06/07 (sayaç ve alan uyuşmazlığı), S-P-14/15 (indeks ve sayfa boyutu), S-P-09 (PostDetail'de anket yok), S-P-11 (çift gönderi).

---

# C. Birleşik öncelik listesi

Yalnız doğrulanmış bulgular; iki rapordan birleştirilmiş, önem sırasına göre. "Platform" sütunu: **M** mobil, **B** backend, **M+B** ikisi.

| # | Bulgu | Önem | Platform | Kabul kriteri |
|---|---|---|---|---|
| 1 | S-B-01 / Haiku B-02: unmatch sonrası sohbet açık, karşı taraf yazabiliyor | Yüksek | M+B | A unmatch edince B'nin `POST /messages` isteği 403 döner; sohbet A'nın listesinde görünmez; onay metni sohbet kapanışını söyler |
| 2 | S-B-15 / Haiku B-01: deste kartında engelle/şikâyet/profil yok | Yüksek | M | Her karttan ≤ 2 dokunuşla şikâyet/engel; engellenen kişi bir daha destede çıkmaz |
| 3 | S-B-02: `GET /events/{id}/buddies` anonim ve gizli hesap sızıntısı | Yüksek | B (+M EventDetail) | Token'sız istek yalnız sayı; gizli hesabın şehir/mesajı sızmaz; opt-in etmeyen listeyi göremez |
| 4 | S-P-02: anket oyu seçenek-gönderi doğrulaması yok | Yüksek | B | Başka gönderinin `optionId`'si 400; `(user_id,post_id)` unique; çapraz oy sayısı 0 |
| 5 | S-P-20 / Haiku P-04, P-05: PostDetail ve yorumlarda şikâyet/engel/düzenle-sil yok; gönderi sahibi yorum silemiyor | Yüksek | M+B | PostDetail'de ≤ 2 dokunuşla POST/COMMENT şikâyeti; sahibi düzenler/siler; gönderi sahibi yorum siler (204), üçüncü kişi 403 |
| 6 | S-P-01: refresh hatasında oturum kapanıyor | Yüksek | M | Uçak modunda süresi dolmuş jetonla Login'e atılmaz; yalnız 401/403'te oturum kapanır; refresh ≤ 15 sn |
| 7 | S-B-03 / Haiku B-05: swipe/undo hataları sessiz, kart kayboluyor | Yüksek | M | Swipe ağ hatasında kart ≤ 500 ms'de geri gelir + hata bildirimi; 403'te anlamlı mesaj |
| 8 | S-B-04: karşılıklı beğeni yarışı, bildirim kaçar; çift istekte genel 409 | Orta | B | Eşzamanlı çift swipe testinde tam 1 `matched=true` ve 1 bildirim (100 tekrar); tekrar eden swipe 200 |
| 9 | S-P-11: çift gönderi riski; paylaşım sonrası kendi gönderisi görünmüyor | Orta | M+B | 50 ms arayla iki dokunuş = 1 `POST`; paylaşım sonrası akışta yeni gönderi ilk sırada (Takip sorgusu kendi gönderilerini içerir) |
| 10 | S-P-05 / Haiku P-01: beğeni iyimser değil, hata sessiz, 409'da takılma | Orta | M+B | Hatada ≤ 300 ms geri alma + bildirim; sunucu like/unlike idempotent |
| 11 | S-B-05 / Haiku B-04: yükleme hatası boş durum gibi görünüyor | Orta | M | Hata panelinde "tekrar dene", yanlış boş-durum metni yok |
| 12 | S-B-06: odakta undo/swipe durumu sıfırlanıyor | Orta | M | Profil/sohbetten dönünce geri al aktif, aynı kart tekrar görünmez |
| 13 | S-P-04 / Haiku P-08 ve S-P-03: sayfalama hatası sessiz; kopya kayıt | Orta | M (+B imleç) | Yeniden-dene satırı; `id`'ler benzersiz |
| 14 | S-P-06: yorum sayısı gizli yorumları sayıyor, trend de | Orta | B | `commentCount` görünür yorum sayısına eşit; gizli yorum skoru değiştirmez |
| 15 | S-P-07: `CommentResponse`'ta `userProfileImageUrl` yok | Orta | B | Yanıtta alan var, PostDetail'de görüntü çizilir |
| 16 | S-P-08: yorum sırası tutarsız | Orta | M veya B | Yeni yorum yeniden yüklemeden önce/sonra aynı konumda |
| 17 | S-P-09: PostDetail'de anket yok | Orta | M | POLL detayında seçenekler çizilir, oy çalışır |
| 18 | S-P-10: gönderi oluşturma sunucu doğrulaması | Orta | B | Geçersiz tür/seçenek/imageUrl/boş içerik 400 (≥ 6 senaryo) |
| 19 | S-P-12: yorum silme yetkisi ve 400/403 | Orta | B | Bkz. #5 (sahibi siler, üçüncü kişi 403, yanlış `postId` 404) |
| 20 | S-P-14: eksik indeksler | Orta | B | Akış sayım sorgularında `Seq Scan` yok; trend p95 < 200 ms |
| 21 | S-P-15: sınırsız `size`, trend 500 satır/istek, sayfasız profil | Orta | B (+M) | `size` ≤ 50; 5 ardışık trend sayfası tek hesaplama; profil sayfalı |
| 22 | S-B-07: yasaklı hesaplar destede/akışta | Orta | B | Yasaklı kullanıcı hiçbir yüzeyde görünmez |
| 23 | S-B-08: deste/eşleşme N+1 | Orta | B | 500 adayda ≤ 10 sorgu, p95 < 300 ms |
| 24 | S-B-09: "geçtim" kalıcı; eşleşmeler eskimiyor | Orta | B (+ürün kararı) | Pass konser-bazlı/süreli; ortak yeni konserde kişi yeniden görünür |
| 25 | S-B-10 / Haiku B-15: sohbet polling, tam çekim, mesaj sınırı yok | Orta | M+B | 1000 mesajda poll yanıtı ≤ 5 KB; 1001 karakter 400; hata paneli |
| 26 | S-P-16 / Haiku P-02: hata = "boş" ekran | Orta | M | Ağ kesikken "yüklenemedi + yeniden dene" |
| 27 | S-P-17: PostDetail başlığı yeniden monte; CommentModal ölü kod | Orta | M | Yazarken başlık mount sayacı = 1; `CommentModal.js` silinmiş |
| 28 | S-P-19: Post/Comment/Poll/Buddy test boşluğu | Orta | B | ≥ 10 yeni regresyon testi, `./mvnw test` yeşil |
| 29 | S-P-21, S-B-14 / Haiku P-14, B-07..B-12: dokunma alanı, etiket, büyük yazı | Orta | M | Dokunma alanı ≥ 44 pt; Switch/çip etiketleri; yazı %200'de kırpılma yok; ≥ 11 pt |
| 30 | S-P-25 / Haiku P-11: Android 4 düğmeli Alert (Varsayım) | Orta | M | Android'de neden menüsü kapatma yoluyla birlikte görünür |
| 31 | S-B-16 / Haiku B-06: yeni eşleşmeler iki kez | Düşük | M | Her kişi bir kez görünür |
| 32 | S-P-24 / Haiku P-10: taslak kaybı, hep aktif Paylaş | Düşük | M | Dolu formda Vazgeç onay ister; geçersizken Paylaş `disabled` |
| 33 | S-P-22 / Haiku P-06, P-07, B-13: açık tema renkleri | Düşük (P-06 Orta olabilir) | M | Kontrast ≥ 4.5:1 iki temada |
| 34 | S-P-13 / Haiku P-16: `PATCH` boş içerik; "düzenlendi" yok | Düşük | M+B | `PATCH {}` 400; kartta "düzenlendi" |
| 35 | S-B-11, S-B-12: katılım ve rapor doğrulamaları | Düşük | B | İptal etkinlikte katılım 400; geçersiz rapor türü 400/404 |
| 36 | S-P-18, S-B-13, S-P-23 | Düşük | M / B / belge | Görsel ≤ 400 KB; swipe JS FPS ≥ 55; belge doğru |
| 37 | Haiku P-09, P-12, P-15, B-03, B-14 (kısmen doğrulanan, düşük etkili) | Düşük | M | Takip boşken açıklama; `insets.top`; boş kayıt `disabled`; skor açıklaması; gizli hesap fotoğrafı kararı |

**Reddedilenler listeye alınmadı:** Haiku P-03 (ölü kod), P-13 (FAB örtmüyor).
