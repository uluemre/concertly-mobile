# Concertly Mobile: UX/UI Denetimi (Post / Sosyal Akış ve Konser Arkadaşı)

**Tarih:** 2026-10-11
**Denetçi:** Bağımsız UX/UI denetçisi (Haiku 5.5)
**Kapsam:** Akış (Trend/Takip), PostCard, CommentModal, PollCard, PostDetail, CreatePost, HomePostCard; Konser Arkadaşı (ConcertBuddyMatch), Sohbet (Chat, ChatList); ilgili backend servisleri.

---

## YÖNTEM VE SINIRLAR (ÖNEMLİ)

- Bu bir **STATİK KOD İNCELEMESİDİR.** Uygulama çalıştırılmadı; simülatör, cihaz veya ekran görüntüsü kullanılmadı.
- Sunucuya ağ isteği atılmadı, sunucu başlatılmadı, git komutu çalıştırılmadı. Kod değiştirilmedi.
- Dokunma alanı boyutları, metin taşması, dinamik yazı boyutu, klavye davranışı ve iOS/Android farkları **yalnızca kod okumasından** çıkarıldı. Bu konularda gerçek davranış **Varsayım** olarak işaretlidir.
- Cihaz ölçüsü varsayımları: iPhone ~390 x 844 pt (Varsayım).
- Kontrast oranları yaklaşık hesaplardır (Varsayım, sayısal).
- "Kanıt: dosya:satır" ifadesi okunan koda dayanır. Yol kısaltmaları: `mobile/src/...` ve `backend/src/main/java/com/concertly/backend/...`.

---

## BULGULAR: POST / SOSYAL AKIŞ

### [P-01] Beğeni anında geri bildirim vermiyor; hata sessiz
- **Yer:** Gönderi kartı `mobile/src/components/feed/PostCard.js:75-106` (handleLike); gönderi detayı `mobile/src/screens/PostDetailScreen.js:62-83`
- **Kullanıcıya etkisi:** Kalbe basınca titreşim ve yüzen kalp animasyonu çalışır (PostCard:77, 87), ama kalbin dolması ve sayının değişmesi sunucu yanıtından sonra olur (PostCard:95-98, PostDetail:73-75). Yavaş bağlantıda kalp boş kalır. İstek başarısız olursa animasyon yanlış bir başarı izlenimi verir ve kullanıcıya hiçbir mesaj gösterilmez.
- **Önem:** Yüksek
- **Kanıt:** PostCard:101-103 `catch (err) { console.log('Like hatası:', err.message); }`; PostDetail:78-80 aynı desen.
- **Çözüm önerisi:** Beğeniyi iyimser güncelle (liked ve likeCount hemen değişsin). Hata olursa eski değere dön ve "Beğenilemedi, tekrar dene" bildirimi göster. Mevcut `likeLoading` kilidi çift dokunmayı zaten engeller.
- **Neden daha iyi:** Beğeni en sık yapılan etkileşimdir. Gecikme ve sessiz hata güveni azaltır. İyimser güncelleme ve geri alma, mevcut yapıyla çakışmadan eklenebilir.
- **Doğrulama testi:** Ağ gecikmesini artırıp beğeniye bas: sayı anında değişmeli. Sunucuyu 500 döndürecek şekilde dene: sayı eski değere dönmeli ve uyarı görünmeli.

### [P-02] Yorum listesi yüklenemezse "ilk yorumu sen yaz" boş durumu görünüyor
- **Yer:** `mobile/src/components/feed/CommentModal.js:32-42` (fetchComments), `:72-76` (boş durum); `mobile/src/screens/PostDetailScreen.js:51-60` ve `:278-283` (ListEmptyComponent)
- **Kullanıcıya etkisi:** Ağ hatasında veya sunucu 500 döndüğünde kullanıcı "henüz yorum yok" mesajını görür. Yeniden deneme yolu yoktur. Yanlış bilgi verilir.
- **Önem:** Orta
- **Kanıt:** CommentModal:37-38 ve PostDetail:55-56 hatayı yalnızca `console.log` ile yazar. İki bileşende de hata durumu (error state) yoktur. Akış ekranında (`FeedScreen.js:170-191`) ise `load_failed` + "Tekrar dene" deseni vardır; tutarsızlık oluşur.
- **Çözüm önerisi:** Hata durumu ekle: "Yorumlar yüklenemedi" metni ve "Tekrar dene" düğmesi. Boş durumu yalnızca başarılı ve boş yanıtta göster.
- **Neden daha iyi:** Hata ile boş durum ayrılır, kullanıcının kurtarma yolu olur ve Akış ekranıyla tutarlı olur.
- **Doğrulama testi:** Yorum uç noktasını 500 döndürecek şekilde dene. Boş durum yerine hata ve yeniden deneme görünmeli.

### [P-03] Yorum gönderilince veya yenilenince liste spinner'a dönüyor
- **Yer:** `mobile/src/components/feed/CommentModal.js:33` (setLoading), `:50` (gönderim sonrası fetchComments), `:70-71` (loading ? spinner : liste)
- **Kullanıcıya etkisi:** Yorum gönderilince mevcut liste kaybolur, spinner görünür, sonra liste geri gelir. Sheet içeriği zıplar. Yeni yorum iyimser eklenmez. PostDetail (`PostDetailScreen.js:94`) ise yeni yorumu hemen listeye ekliyor. İki yorum yüzeyi farklı davranıyor.
- **Önem:** Düşük
- **Kanıt:** CommentModal:70-71 ve :50; PostDetail:94 `setComments(prev => [...prev, res.data])`.
- **Çözüm önerisi:** Yükleme göstergesini yalnızca ilk yüklemede göster. Gönderimde yeni yorumu listeye ekle (PostDetail deseni), sonra sessizce yenile.
- **Neden daha iyi:** Akıcılık ve tutarlılık sağlar. Zaten PostDetail'de kullanılan desen yaygınlaştırılır.
- **Doğrulama testi:** Yorum gönder. Spinner görünmemeli, yeni yorum anında listenin sonunda olmalı.

### [P-04] Yorumlar moderasyon dışında: yorum şikâyet edilemiyor, gönderi sahibi yorum silemiyor
- **Yer:** Backend `service/CommentService.java:107-117` (silme yalnızca yorum sahibine izinli); mobil `PostDetailScreen.js:155-164` (Sil düğmesi yalnızca `item.userId === session.userId`); `CommentModal.js:84-93` (yorumda hiç eylem yok).
- **Kullanıcıya etkisi:** Hakaret veya spam içeren yorumu gören kullanıcı bunu bildiremez. Gönderi sahibi kendi gönderisindeki yorumu kaldıramaz. Yorumlar için kullanıcı tarafında şikâyet yolu yoktur. Sosyal güvenlik açığıdır.
- **Önem:** Yüksek
- **Kanıt:** Mobilde `targetType: 'COMMENT'` ile `/reports` çağrısı yoktur (kod araması). Gönderi ve kullanıcı şikâyetleri `PostCard.js:135-142` ve `ChatScreen.js:90-93` içinde vardır. Admin tarafında `AdminReportsScreen.js:83` COMMENT gizlemeyi destekliyor; ancak kullanıcı bu kuyruğa yorum gönderemiyor. `CommentService.java:114` sahip dışı silmeyi reddeder.
- **Çözüm önerisi:** Yorumda "⋯" menüsü ekle: "Şikâyet et" (targetType COMMENT). Gönderi sahibine, kendi gönderisindeki yorumları silme yetkisi ver (backend kuralı genişletilir).
- **Neden daha iyi:** Gönderi sahibine kontrol verir, şikâyet kanalını açar ve admin kuyruğunun zaten beklediği veriyi üretir.
- **Doğrulama testi:** Başka birinin yorumunda "Şikâyet et" görünmeli ve rapor admin kuyruğuna düşmeli. Gönderi sahibi kendi gönderisindeki yorumu silebilmeli. Varsayım: `/reports` COMMENT hedefini kabul ediyor; bu backend'de doğrulanmalı.

### [P-05] Gönderi detayında şikâyet, engelle, düzenle/sil menüsü yok
- **Yer:** `mobile/src/screens/PostDetailScreen.js:169-251` (ListHeader yalnızca beğeni ve yorum sayısı içerir); karşılaştırma: `PostCard.js:170-184` (handleOptions).
- **Kullanıcıya etkisi:** Kullanıcı gönderiyi en çok detayda inceler; ama burada şikâyet veya engelleme yapamaz. Gönderi sahibi düzenleyip silemez. Bu seçenekler yalnızca akıştaki kartta vardır.
- **Önem:** Orta
- **Kanıt:** PostDetail'de `handleOptions`, `handleReport` veya `mod_*` çağrısı yoktur (kod araması). PostCard:173-181 menüyü tanımlar.
- **Çözüm önerisi:** ListHeader'a "⋯" düğmesi ekle. PostCard'daki handleOptions, handleReport ve handleBlock mantığını ortak bir hook'a (ör. `usePostActions`) çıkarıp iki yerde kullan.
- **Neden daha iyi:** Kod tekrarını önler; moderasyon her gönderi yüzeyinde aynı olur.
- **Doğrulama testi:** Detayda ⋯ menüsü açılmalı. Kendi gönderisinde Düzenle/Sil, başkasınınkinde Şikâyet/Engelle görünmeli.

### [P-06] Light temada avatar harfi okunmuyor (beyaz harf, açık zemin)
- **Yer:** `mobile/src/screens/PostDetailScreen.js:343-347` (postAvatar, `backgroundColor: colors.cardAlt`), `:349` (postAvatarText, `color: '#fff'`); yorum avatarı `:389-393` ve `:395` (commentAvatarText `#fff`).
- **Kullanıcıya etkisi:** Profil fotoğrafı olmayan kullanıcıda, light temada baş harf neredeyse görünmez. Dark temada sorun yoktur. CLAUDE.md'deki "light palet okunabilir olmalı" kuralına aykırıdır.
- **Önem:** Yüksek
- **Kanıt:** `mobile/src/theme.js:27` light `cardAlt: '#F5F6FA'`. Beyaz (#FFFFFF) ile #F5F6FA arasındaki kontrast yaklaşık 1.1:1 (Varsayım, sayısal hesap). Feed kartının avatarı (`PostCard.js:383`) `colors.text` kullanıyor; bu bilinçli bir tutarsızlıktır.
- **Çözüm önerisi:** Metin rengini `colors.text` yap, ya da avatar zeminini `colors.primary` yapıp `#fff` kullan (PostCard ile aynı desen).
- **Neden daha iyi:** Tema tokenlarıyla çalışır ve Feed kartıyla tutarlı olur.
- **Doğrulama testi:** Light temada fotoğrafsız gönderi ve yorumda harf okunmalı (WCAG AA için kontrast en az 4.5:1).

### [P-07] Ana sayfa trend kartında sabit renkler; light temada zayıf kontrast
- **Yer:** `mobile/src/components/home/HomePostCard.js:10` (ACCENT_COLORS, sabit hex), `:24-25` (`accent + '28'` zemin, `color: accent` yazı), `:86` (içerik `opacity: 0.75`).
- **Kullanıcıya etkisi:** Light temada `#F5A623` baş harf ve %75 opaklıkta içerik zayıf okunur. Renk, kartın index'ine göre döndüğü için anlam taşımaz; liste sıralanınca renk değişir.
- **Önem:** Orta
- **Kanıt:** Light `card` beyaz (theme.js:26); #F5A623 ile beyaz arasında kontrast yaklaşık 2:1 (Varsayım, sayısal hesap). CLAUDE.md, accent/secondary yerine tema tokenı kullanılmasını istiyor.
- **Çözüm önerisi:** Yazı için `colors.text` ve light'ta `colors.secondary` kullan. Accent'i yalnızca dekoratif şeritte kullan. `opacity` yerine `colors.textSecondary` tokenı.
- **Neden daha iyi:** Tasarım sistemiyle uyumlu olur, iki temada da okunur.
- **Doğrulama testi:** Light temada ana sayfa kartlarında baş harf ve içerik okunmalı.

### [P-08] Sayfalama hatasında sonsuz kaydırma sessizce duruyor
- **Yer:** `mobile/src/screens/FeedScreen.js:74` (setError), `:103` (onEndReached koşulunda `|| error`), `:172` (hata ekranı yalnızca `posts.length === 0` iken).
- **Kullanıcıya etkisi:** 2. sayfa yüklenemezse liste sessizce durur. Hata yok, "daha fazla" göstergesi yok. Kullanıcı yalnızca aşağı çekip yenilemeyi denerse kurtulur.
- **Önem:** Orta
- **Kanıt:** FeedScreen:103 `if (loadingMore || !hasMoreRef.current || loading || error) return;`. Hata, liste doluyken hiçbir yerde gösterilmez.
- **Çözüm önerisi:** Sayfalama hatası için ayrı state (ör. `loadMoreError`). ListFooterComponent'te "Yüklenemedi, tekrar dene" göster.
- **Neden daha iyi:** Liste ortasında kurtarma yolu sağlar; hata gizlenmez.
- **Doğrulama testi:** 2. sayfa isteğini hataya düşür. Footer'da yeniden dene çıkmalı ve tıklanınca sayfa yüklenmeli.

### [P-09] "Takip" sekmesi boşsa açıklama olmadan "Trend"e geçiliyor
- **Yer:** `mobile/src/screens/FeedScreen.js:62-67` (autoSwitchedRef, `switchTab('trending')`); boş durum CTA'sı `:225`.
- **Kullanıcıya etkisi:** Kullanıcı Takip sekmesindeyken sekme sessizce Trend'e geçer. Neden söylenmez. Yeni kullanıcı için kafa karıştırıcıdır.
- **Önem:** Düşük
- **Kanıt:** FeedScreen:63-66; geçiş öncesi veya sonrası açıklayıcı metin yoktur.
- **Çözüm önerisi:** Takip boşsa önce açıklayıcı boş durum göster ("Takip ettiklerin henüz paylaşım yapmadı") ve tek dokunuşla Trend'e geçiş sun. Otomatik geçişi kaldır ya da en azından kısa bir ipucu göster.
- **Neden daha iyi:** Geçiş kullanıcının kararıyla olur ve neden olduğu açıktır.
- **Doğrulama testi:** Yeni hesapla Akış'ı aç. Takip boşken açıklama ve Trend'e tek dokunuş görünmeli.

### [P-10] Gönderi oluşturma: vazgeçince yazı onaysız kayboluyor; "Paylaş" her zaman aktif görünüyor
- **Yer:** `mobile/src/screens/CreatePostScreen.js:116-118` (Vazgeç doğrudan geri döner, taslak kontrolü yok), `:242-246` (Paylaş her zaman aktif, doğrulama yalnızca basınca), `:67-82` (doğrulama sonrası Alert).
- **Kullanıcıya etkisi:** Uzun yazılmış metin yanlışlıkla "Vazgeç"e basılınca kaybolur. Boş formda da Paylaş aynı görünür; basınca uyarı çıkar. Geri bildirim geç gelir.
- **Önem:** Orta
- **Kanıt:** CreatePostScreen:116-118; :242-246 `TouchableOpacity` koşulsuz aktif.
- **Çözüm önerisi:** Dolu içerik varsa "Taslağı at?" onayı göster. Geçerli içerik yokken Paylaş'ı devre dışı (disabled, soluk) yap ve `accessibilityState` ile bildir.
- **Neden daha iyi:** Veri kaybını önler ve geri bildirimi işlem öncesinde verir.
- **Doğrulama testi:** Metin yazıp Vazgeç'e bas: onay çıkmalı. Boş formda Paylaş pasif görünmeli.

### [P-11] Android'de dörtten fazla düğme olan Alert (Varsayım: platform sınırı)
- **Yer:** `mobile/src/components/feed/PostCard.js:145-150` (3 neden + iptal = 4 düğme); `mobile/src/screens/ChatScreen.js:102-106` (aynı desen).
- **Kullanıcıya etkisi:** React Native dokümanına göre Android'de Alert en fazla 3 düğme destekler (Varsayım; bu ortamda doğrulanamadı). Bu durumda "İptal" düğmesi görünmeyebilir ve kullanıcı seçeneklerden birinde sıkışabilir.
- **Önem:** Orta (platforma bağlı)
- **Kanıt:** Kod satırları yukarıda. Platform sınırı Varsayım.
- **Çözüm önerisi:** Şikâyet nedenleri için ortak bir alt sayfa (bottom sheet) kullan. Projede zaten sheet deseni var. Alternatif: iOS için ActionSheet, Android için sheet.
- **Neden daha iyi:** Platformdan bağımsız olarak tüm seçenekler görünür ve kullanıcı her zaman kapatabilir.
- **Doğrulama testi:** Android'de Şikâyet menüsünü aç: dört seçeneğin tümü görünmeli ve dışa dokunarak kapanmalı.

### [P-12] Sabit üst boşluklar (52/56/60) çentik ve Dynamic Island'a duyarsız
- **Yer:** `FeedScreen.js:260` (60); `CreatePostScreen.js:257` (60); `PostDetailScreen.js:323` (56); `ChatScreen.js:263` (56); `ChatListScreen.js:168` (56); `ConcertBuddyMatchScreen.js:778` (52).
- **Kullanıcıya etkisi:** Bazı cihazlarda başlık gereğinden aşağıda kalır, bazılarında durum çubuğuna yakın durur. ChatScreen `useSafeAreaInsets` kullanıyor (`ChatScreen.js:35`) ama üst boşluk için kullanmıyor; tutarsızdır.
- **Önem:** Orta (Varsayım: cihaz ölçüleri)
- **Kanıt:** Satırlar yukarıda. ChatScreen:35 `insets` tanımlı, header'da kullanılmıyor (`:263`).
- **Çözüm önerisi:** `paddingTop: insets.top + 12` deseni. ChatScreen'deki mevcut kullanımdan yararlan.
- **Neden daha iyi:** Her cihazda tutarlı üst boşluk sağlar ve projede zaten kullanılan bir desendir.
- **Doğrulama testi:** Çentiksiz (ör. SE) ve çentikli bir cihazda başlık konumunu karşılaştır.

### [P-13] Akış FAB'ı listenin son kartındaki aksiyon satırını örtebilir
- **Yer:** `mobile/src/screens/FeedScreen.js:280` (listContent `paddingBottom: 32`), `:242-252` (FAB, absolute, bottom 24, 60x60), `:288-289`.
- **Kullanıcıya etkisi:** FAB ekranın sağ altında yaklaşık 84 pt alan kaplar. Liste altındaki boşluk 32 pt olduğu için son kartın beğeni/yorum/paylaş satırı FAB'ın altında kalabilir (Varsayım: konum hesabı).
- **Önem:** Düşük
- **Kanıt:** FeedScreen:280 ve :288-289 ölçüleri.
- **Çözüm önerisi:** `paddingBottom: 110 + insets.bottom` gibi bir değer.
- **Neden daha iyi:** Son kart her zaman FAB'dan bağımsız erişilebilir olur.
- **Doğrulama testi:** Listenin sonuna kaydır: son kartın aksiyon satırı FAB'a değmeden görünmeli.

### [P-14] Dokunma hedefleri ve erişilebilirlik etiketleri eksik (emoji, anket, gönderi içeriği)
- **Yer:** `CreatePostScreen.js:226-233` (emoji düğmeleri, etiket yok; padding 10 + 20 pt emoji ≈ 40 pt, stil `:321-325`); `CreatePostScreen.js:209-211` (anket sil düğmesi 36x36, stil `:309-310`); `PollCard.js:36-42` (seçenek düğmesinde rol ve seçili/oy durumu yok); `PostCard.js:311-313` (içerik dokunma alanı etiket ve rol içermiyor).
- **Kullanıcıya etkisi:** Emoji ve anket düğmeleri 44 pt'nin altında. Ekran okuyucu emoji karakterini okur; "emoji ekle" bilgisi yok. Anket seçenekleri seçili veya oy verildi durumunu duyurmaz.
- **Önem:** Orta
- **Kanıt:** Satırlar yukarıda. Anket seçenekleri `accessibilityRole` ve `accessibilityState` taşımıyor.
- **Çözüm önerisi:** Emoji düğmelerine `accessibilityLabel` ve `hitSlop` 6 (toplam ≥ 44). Anket seçeneklerine `accessibilityRole="button"` ve `accessibilityState={{ selected: opt.voted, disabled: hasVoted }}`. Sil düğmesine `hitSlop` 6. Oy sürerken seçeneğe spinner göster.
- **Neden daha iyi:** Düşük maliyetli ve tekrar kullanılabilir düzeltmeler.
- **Doğrulama testi:** VoiceOver veya TalkBack ile odak sırası ve duyuruları kontrol et. Dokunma alanı ölçümü yap.

### [P-15] Gönderi düzenleme modalı: Android'de klavye alanı örtebilir; boş kayıt sessiz
- **Yer:** `mobile/src/components/feed/PostCard.js:280-307` (Modal içinde `KeyboardAvoidingView`; `behavior` yalnızca iOS'ta `padding`, diğerinde `undefined`, `:282`); `:186-188` (boş metinde sessiz return); `:297-303` (Kaydet her zaman aktif görünür).
- **Kullanıcıya etkisi:** Android'de klavye, düzenleme alanını örtebilir (Varsayım: Android pencere ayarına bağlı). Boş kaydetme hiçbir şey yapmaz ve geri bildirim vermez.
- **Önem:** Düşük
- **Kanıt:** PostCard:282. Projede `components/keyboard` (PostDetail:7, CreatePost:7) zaten var ama PostCard bunu kullanmıyor; tutarsızlık.
- **Çözüm önerisi:** Kaydet'i boş metinde devre dışı yap. Projedeki `components/keyboard` yapısını (KeyboardAwareScrollView/KeyboardAvoidingView) bu modalda da kullan.
- **Neden daha iyi:** Platform bağımsız klavye davranışı ve tutarlı bileşen kullanımı.
- **Doğrulama testi:** Android'de uzun bir gönderiyi düzenle: alan klavyenin altında kalmamalı.

### [P-16] Düzenlenmiş gönderi için belirti yok
- **Yer:** Backend `dto/response/PostResponse.java:14-26` (updatedAt veya edited alanı yok); mobil `PostCard.js:186-198`.
- **Kullanıcıya etkisi:** Başka kullanıcılar gönderinin değiştirildiğini anlayamaz. Düşük önemli, ama güven ve dürüstlük açısından eksik.
- **Önem:** Düşük
- **Kanıt:** PostResponse'ta düzenleme alanı yok; mobilde "düzenlendi" metni yok (kod araması).
- **Çözüm önerisi:** PostResponse'a `updatedAt` ekle; kartta i18n'li "düzenlendi" etiketi göster.
- **Neden daha iyi:** Kullanıcıya bilgi verir; küçük ve düşük riskli bir değişikliktir.
- **Doğrulama testi:** Düzenlemeden sonra kartta etiket görünmeli.

---

## BULGULAR: KONSER ARKADAŞI (BUDDY) VE SOHBET

### [B-01] Engelle ve şikâyet deste kartından erişilemez; güvenlik metni buna yönlendiriyor
- **Yer:** `mobile/src/screens/ConcertBuddyMatchScreen.js:398-482` (renderCard; kart hero'su ve gövdesinde profile gitme yok); profil yönlendirmesi yalnızca eşleşme menüsünde: `:343-363` ve `:345`. Güvenlik bandı: `:535-546`. Metin: `mobile/src/i18n/translations.js:2012` ("...profilden engelle ya da şikâyet et"; TR `:438`).
- **Kullanıcıya etkisi:** Tanımadığı biri karşısında kullanıcı, kişinin profiline gidip engelleyemez veya şikâyet edemez. Deste kartında yalnızca "Geç" vardır. Uygulamanın kendi uyarısı anlatılan yolu sunmuyor. Eşleşmeden önce profil de açılamıyor.
- **Önem:** Yüksek
- **Kanıt:** Buddy ekranında `UserProfile` navigasyonu yalnızca `:345`'te (eşleşme menüsü) geçiyor. Backend'de engelleme ve deste filtresi çalışıyor (`BuddyMatchService.java:70` ve `:117`, `ModerationService.java:94`), ama mobilde erişim yolu yok.
- **Çözüm önerisi:** Kartın üstüne "⋯" menüsü ekle (Profili gör, Şikâyet et, Engelle). Hero'ya dokunmayı profile yönlendir. Engelleme sonrası kart desteden çıksın (backend zaten bunu yapıyor).
- **Neden daha iyi:** Arayüz, güvenlik metniyle verilen vaadi karşılar. Backend'in mevcut `/users/{id}/block` ve `/reports` uç noktaları yeniden kullanılır.
- **Doğrulama testi:** Karttaki menüden engelle. Kart desteden kaybolmalı ve kişi tekrar görünmemeli.

### [B-02] "Eşleşmeyi kaldır" sohbeti kapatmıyor; uyarı metni ile sistem davranışı çelişiyor
- **Yer:** Backend `service/BuddyMatchService.java:218-223` (unmatch yalnızca kendi beğenimi `liked=false` yapar); `service/ModerationService.java:52-53` (mevcut sohbet her zaman sürer: `requireCanMessage` erken döner); `service/MessageService.java:55`; mobil `ConcertBuddyMatchScreen.js:343-363` ve `ChatListScreen.js` (sohbet listesi `/messages/conversations` ile buddy eşleşmesine bağlı değil); uyarı metni `translations.js:2023` ("Bir daha destende görünmez").
- **Kullanıcıya etkisi:** Kullanıcı eşleşmeyi kaldırdığını düşünür. Ancak sohbet, sohbet listesinde kalır ve karşı taraf mesaj göndermeye devam edebilir. Kötü niyetli bir kişiyle bağı koparmak isteyen kullanıcı korunmuş olmaz.
- **Önem:** Kritik
- **Kanıt:** ModerationService:52-53 yorumu açıkça "Devam eden bir sohbet her zaman sürer" diyor. BuddyMatchService:218-223 yalnızca beğeni bayrağını değiştirir.
- **Çözüm önerisi:** Kaldırma akışına açık seçenek ekle: sohbeti de kapat (yeni mesaj yok, sohbet listeden gizlenir). Backend'de buddy kaynaklı sohbetler için unmatch sonrası mesajı reddet. Uyarı metnini "Sohbet geçmişi kalır, artık mesaj gönderemezsiniz" gibi netleştir.
- **Neden daha iyi:** Kullanıcı beklentisi ile sistem davranışı eşitlenir. Güvenlik vaadi gerçekten yerine gelir.
- **Doğrulama testi:** A, B'yi kaldırsın. B'den A'ya mesaj 403 dönmeli veya sohbet arşivlenmiş olmalı. Varsayım: sohbetin buddy eşleşmesine bağlı sayılması ürün kararıdır.

### [B-03] Uyum yüzdesi açıklanmıyor
- **Yer:** `ConcertBuddyMatchScreen.js:386-387` (score), `:419-422` (`%{score}` + "uyum" etiketi), `:391-396` (nedenler skorla bağlantısız listelenir). Hesap: `BuddyMatchService.java` içindeki `compatibility` mantığı.
- **Kullanıcıya etkisi:** "%72 uyum" neye göre hesaplanıyor belli değil. Kullanıcı skorun güvenilirliğini bilemez. Yüzde, karşıdakini "puanlanmış" gibi hissettirebilir.
- **Önem:** Orta
- **Kanıt:** Satırlar yukarıda; skor ile neden listesi arasında açıklayıcı bağ yok.
- **Çözüm önerisi:** Skora dokununca açıklama göster (ör. "ortak sanatçı, tür, şehir ve birlikte gidilen konserlere göre; bir tahmindir"). Alternatif: yüzdeyi "ortak zevk" etiketine çevir.
- **Neden daha iyi:** Güven ve belirsizlik sorunu çözülür; kullanıcı neye baktığını bilir.
- **Doğrulama testi:** Kullanıcı testi: skorun ne olduğunu beş saniye içinde anlayabiliyor mu.

### [B-04] Ağ hatası "deste bitti" paneline dönüşüyor
- **Yer:** `ConcertBuddyMatchScreen.js:231-245` (fetchAll; catch yalnızca `console.log`, deste boş kalır); `:580-606` (desteye kart kalmayınca "Bitti" paneli).
- **Kullanıcıya etkisi:** Bağlantı koptuğunda kullanıcı "herkesi gezdin" mesajını görür. Hata açıklaması yoktur. Yeniden denemek için yalnızca küçük bir yenile ikonu (`:588`) vardır.
- **Önem:** Yüksek
- **Kanıt:** `:240-242` catch yalnızca `console.log('Buddy fetch error:')` yazar; panel koşulu `currentCard` yokluğuna bağlı.
- **Çözüm önerisi:** `error` state ekle. Hata panelinde "Bağlantı kurulamadı" ve "Tekrar dene" göster. "Bitti" paneli yalnızca başarılı ve boş yanıtta görünsün.
- **Neden daha iyi:** Kullanıcı yanlış bir "bitti" bilgisi almaz ve kurtarma yolunu bilir.
- **Doğrulama testi:** `/buddy/discover` isteğini 500 döndür: hata paneli görünmeli, "bitti" görünmemeli.

### [B-05] Kaydırma, geri alma ve eşleşme hataları sessiz; kart kaybolur
- **Yer:** `ConcertBuddyMatchScreen.js:280-298` (sendSwipe: kart `removed`'a eklenir; hata `console.log`, `:295-296`); `:310-321` (undo: hata `console.log`, `:319`); backend `BuddyMatchService.java:191` (BUDDY_NOT_ELIGIBLE) ve `ModerationService.java:127-129` (BLOCKED).
- **Kullanıcıya etkisi:** "Birlikte gidelim" dedikten sonra istek başarısız olursa kişi listeden kaybolur ve uyarı çıkmaz. Geri alma da başarısızsa kişi sessizce kaybolmuş kalır. Backend'in hata kodları (BUDDY_NOT_ELIGIBLE, BLOCKED) bu ekranda çevrilmiyor.
- **Önem:** Yüksek
- **Kanıt:** `:294-296` ve `:318-320` yalnızca `console.log`. Ekranda `apiErrorMessage` (`communityErrors.js`) hiç kullanılmıyor.
- **Çözüm önerisi:** Hata durumunda kartı desteye geri koy (`removed`'dan çıkar) ve `apiErrorMessage` ile uyarı göster. Geri alma hatasında "geri alınamadı" bildirimi ver.
- **Neden daha iyi:** Kullanıcı ne olduğunu anlar; kart yanlışlıkla kaybolmaz.
- **Doğrulama testi:** Engelli bir kişiye kaydır: uyarı görünmeli ve kart geri gelmeli.

### [B-06] "Yeni eşleşmeler" iki kez görünüyor; alt liste başlıksız
- **Yer:** `ConcertBuddyMatchScreen.js:617-631` (yatay şerit: newMatches); `:632-633` (`(chats.length ? chats : newMatches).map` — sohbet yoksa newMatches tekrar listelenir; başlık yalnızca `chats.length > 0` iken, `:632`).
- **Kullanıcıya etkisi:** Sohbeti olmayan eşleşmeler hem yatay şeritte hem alt listede görünür. Alt liste başlıksız kaldığı için bölüm anlamı belirsizdir.
- **Önem:** Orta
- **Kanıt:** `:633` ternary; `:632` başlık koşulu.
- **Çözüm önerisi:** Sohbet yoksa alt listeyi gizle, ya da başlık ekleyip tek kez göster.
- **Neden daha iyi:** Yinelenen içerik kalkar; bölüm yapısı açık olur.
- **Doğrulama testi:** Yalnızca yeni eşleşme varken her kişi bir kez görünmeli.

### [B-07] Eşleşme menüsü gizli uzun basışa bağlı; kaldırma hatası sessiz
- **Yer:** `ConcertBuddyMatchScreen.js:622` (`onLongPress={openMatchMenu}`), `:649` (⋯ düğmesi), `:356` (`catch { fetchAll(); }`; hata bildirimi yok).
- **Kullanıcıya etkisi:** Yeni eşleşme öğesinde kaldırma yalnızca uzun basışla yapılır; keşfedilemez. Kaldırma başarısız olursa kişi listeye geri döner ve nedeni söylenmez.
- **Önem:** Orta
- **Kanıt:** `:622` tek yol uzun basış; `:356` hata uyarısı yok.
- **Çözüm önerisi:** Yeni eşleşme öğesine de görünür ⋯ düğmesi ekle. Kaldırma hatasında `Alert` göster.
- **Neden daha iyi:** Eylem görünür olur; hata sessiz kalmaz.
- **Doğrulama testi:** Yeni eşleşmede ⋯ görünmeli. Kaldırma hatasında uyarı çıkmalı.

### [B-08] "Konserlerim" anahtarlarında erişilebilirlik etiketi tüm konserler için aynı
- **Yer:** `ConcertBuddyMatchScreen.js:692-698` (Switch, `accessibilityLabel={t('detail_buddy_title')}` = "Konser Arkadaşı"); konser adı `:680` ile aynı satırda ama anahtara bağlı değil.
- **Kullanıcıya etkisi:** Ekran okuyucu kullanıcısı hangi konserin anahtarında olduğunu duymaz. Anahtar hangi konseri açtığını bilmez.
- **Önem:** Orta
- **Kanıt:** `:697` sabit etiket; satırda `TouchableOpacity` ayrı odak olarak duruyor.
- **Çözüm önerisi:** `accessibilityLabel={`${ev.name}: ${t('detail_buddy_title')}`}` ve `accessibilityHint` (açık/kapalı). Satırı tek odak haline getir.
- **Neden daha iyi:** Her anahtar kendi konserini tanımlar.
- **Doğrulama testi:** VoiceOver veya TalkBack ile satırın tek cümlede okunduğunu kontrol et.

### [B-09] Filtre çipleri küçük ve semantik rolleri eksik
- **Yer:** `ConcertBuddyMatchScreen.js:517-531` (filtre çipi `TouchableOpacity`, rol ve seçili durum yok); stil `:800-806` (`paddingVertical: 7`, font 12.5; yükseklik yaklaşık 28 pt, Varsayım).
- **Kullanıcıya etkisi:** Dokunma alanı 44 pt'nin altında. Ekran okuyucu seçili filtreyi duymaz.
- **Önem:** Düşük
- **Kanıt:** `:522-527` içinde `accessibilityRole` ve `accessibilityState` yok.
- **Çözüm önerisi:** `accessibilityRole="radio"` (veya button), `accessibilityState={{ selected: active }}`, `hitSlop` 8.
- **Neden daha iyi:** Küçük ve düşük riskli düzeltme.
- **Doğrulama testi:** Dokunma alanı ölçümü ve ekran okuyucu duyurusu.

### [B-10] Sekme başlıkları sabit yükseklikte ve tek satır; büyük yazı tipinde kesilir
- **Yer:** `ConcertBuddyMatchScreen.js:790` (tab `height: 38`), `:792` (tabText 12.5), `:738` (`numberOfLines={1}`), `:793` (sayaç rozeti).
- **Kullanıcıya etkisi:** Sistem yazı boyutu büyüdüğünde metin 38 pt sınırını aşar; etiketler "..." ile kesilir veya taşar. Dar ekranda üç sekme sığmayabilir (Varsayım).
- **Önem:** Orta
- **Kanıt:** Ekranda `allowFontScaling`, `maxFontSizeMultiplier` kullanımı yok (kod araması, Varsayım: uygulama genelinde de yok).
- **Çözüm önerisi:** `minHeight: 44`. Etiketleri kısalt veya iki satıra izin ver. Sınır için `maxFontSizeMultiplier` (ör. 1.3) kullan.
- **Neden daha iyi:** Büyük yazı kullanan kullanıcılar da sekmeleri okuyabilir.
- **Doğrulama testi:** En büyük yazı boyutunda üç sekmenin okunabilir olduğunu kontrol et.

### [B-11] Kart gövdesi sabit yükseklikte ve kaydırılamaz; küçük ekranda içerik kırpılır
- **Yer:** `ConcertBuddyMatchScreen.js:823-827` (card: absoluteFill, `overflow: hidden`), `:828` (hero `flex: 1`, `minHeight: 180`), `:851-875` (cardBody: etkinlik satırı, alıntı, nedenler, biyografi). Kaydırma yok.
- **Kullanıcıya etkisi:** Kısa veya dar ekranda (Varsayım) ya da büyük yazı tipinde alt kısımdaki nedenler veya biyografi görünmez. Kırpılma sessizdir.
- **Önem:** Orta
- **Kanıt:** `overflow: 'hidden'` (`:824`) ve gövde için kaydırma kabı yok.
- **Çözüm önerisi:** Hero yüksekliğini ekran yüksekliğine oranla (ör. %45). Gövdeyi ScrollView içine al.
- **Neden daha iyi:** İçerik her cihazda ulaşılabilir olur.
- **Doğrulama testi:** 375 x 667 boyutunda ve büyük yazı tipinde kartın tüm bilgilerini kontrol et.

### [B-12] Küçük metin boyutları: uyum etiketi 9.5 pt, ay etiketi 7.5 pt
- **Yer:** `ConcertBuddyMatchScreen.js:842` (compatLabel 9.5), `:859` (eventMonth 7.5), `:858` (eventDay 12). Sohbet zamanı `ChatScreen.js:286-287` (10).
- **Kullanıcıya etkisi:** Okunması zor. Dinamik yazı boyutu ile ölçeklenme tabanı düşük.
- **Önem:** Düşük
- **Kanıt:** Stil değerleri yukarıda.
- **Çözüm önerisi:** Minimum 11 pt. Ay etiketi için 9-10 pt ve kontrast kontrolü.
- **Neden daha iyi:** Okunabilirlik.
- **Doğrulama testi:** Kartta etiketlerin okunabildiğini kontrol et.

### [B-13] Sabit renkler ve light tema uyumsuzluğu (eşleşme ekranı)
- **Yer:** `ConcertBuddyMatchScreen.js:32-33` (LIKE, PASS), `:35-40` (compatColor: #00D4AA, #F5A623, #A78BFA, #A0A0B0), `:930` (avatarRing `#1A0A24`), `:952` (matchLink border `#1A0A24`).
- **Kullanıcıya etkisi:** Kullanım yerlerinin çoğu koyu zemin (kart hero'su, overlay) olduğu için kabul edilebilir. Ancak `#A0A0B0` gri bir tema tokenı değildir. `avatarRing` koyu mor çerçeve, light temada açık kart zemininde görünümü bozar (Varsayım).
- **Önem:** Düşük
- **Kanıt:** Satırlar yukarıda; CLAUDE.md tasarım sistemi kuralı.
- **Çözüm önerisi:** Gri ve çerçeve renklerini `colors.border`, `colors.textSecondary` tokenlarıyla değiştir. Koyu zemin dışındaki renkleri temaya bağla.
- **Neden daha iyi:** Tasarım sistemi tutarlılığı.
- **Doğrulama testi:** Light temada eşleşme ekranının görsel kontrolü.

### [B-14] Keşif kartında profil fotoğrafı gizli hesaplarda da gösteriliyor
- **Yer:** Backend `service/BuddyMatchService.java:136` (`card.put("profileImageUrl", ...)` koşulsuz; `isPrivate` yalnızca şehir, biyografi, tür ve konser sayısını gizliyor, `:137-140`). Mobil `ConcertBuddyMatchScreen.js:410-411`.
- **Kullanıcıya etkisi:** Gizli hesabın sahibi desteye girdiğinde fotoğrafı, aynı konserde arkadaş arayan herkese açık hale gelir. Gizlilik beklentisi ile tutarsızdır (Varsayım: "gizli hesap" tanımı ürün kararıdır).
- **Önem:** Orta
- **Kanıt:** `:136` koşulsuz; `:137-140` gizli kontrolü yalnızca diğer alanlara uygulanıyor.
- **Çözüm önerisi:** Gizli hesapta fotoğrafı da gizle (baş harf fallback'i) ya da ürün kararı al. Kartta "gizli hesap" rozeti göster.
- **Neden daha iyi:** Gizlilik ayarı tüm verilere tutarlı uygulanır.
- **Doğrulama testi:** Gizli hesap sahibi desteye girince fotoğraf yerine baş harf görünmeli.

### [B-15] Sohbet hatası "henüz mesaj yok" gibi görünüyor; 4 saniyede bir tüm konuşma çekiliyor
- **Yer:** `mobile/src/screens/ChatScreen.js:47-56` (fetchMessages; catch yalnızca `console.log`), `:210-218` (ListEmptyComponent: "chat_empty"), `:58-72` (4 sn'de bir tüm mesajları yeniden çekme; sayfalama yok).
- **Kullanıcıya etkisi:** Ağ koptuğunda sohbet boş görünür ve yeniden deneme yoktur. Uzun konuşmalarda her 4 saniyede tüm mesajlar indirilir; pil ve veri tüketimi artar.
- **Önem:** Orta
- **Kanıt:** `ChatScreen.js:51-52` yalnızca log; `:63` `setInterval(fetchMessages, 4000)`; `setMessages(res.data)` her seferinde tüm diziyi değiştirir.
- **Çözüm önerisi:** Hata durumu ve "Tekrar dene". Yeni veri yoksa state güncellemesini atla. Uzun vadede son mesaj kimliğinden sonrasını çeken uç nokta (Varsayım: backend desteği gerekir).
- **Neden daha iyi:** Hata gizlenmez; ağ ve pil kullanımı azalır.
- **Doğrulama testi:** Sohbeti açıkken ağı kapat: hata ve yeniden dene görünmeli. Ağ açılınca liste yenilenmeli.

---

## ÖZET TABLO (önem derecesine göre)

| Önem | Adet | Bulgular |
|------|------|----------|
| Kritik | 1 | B-02 |
| Yüksek | 6 | P-01, P-04, P-06, B-01, B-04, B-05 |
| Orta | 16 | P-02, P-05, P-07, P-08, P-10, P-11, P-12, P-14, B-03, B-06, B-07, B-08, B-10, B-11, B-14, B-15 |
| Düşük | 8 | P-03, P-09, P-13, P-15, P-16, B-09, B-12, B-13 |

Toplam 31 bulgu: Post/sosyal akış 16 (P-01 ... P-16), Konser Arkadaşı ve sohbet 15 (B-01 ... B-15).

---

## EN ÖNEMLİ 5 SORUN

1. **B-02 (Kritik):** Konser arkadaşı eşleşmesini kaldırmak sohbeti kapatmıyor; karşı taraf mesaj göndermeye devam edebiliyor. Uyarı metni ("bir daha görünmez") bu davranışı yansıtmıyor.
2. **B-01 (Yüksek):** Deste kartında engelle ve şikâyet yolu yok; güvenlik metni "profilden engelle" diyor ama profile gitmenin yolu eşleşmeden sonra açılıyor.
3. **P-04 (Yüksek):** Yorumlar şikâyet edilemiyor; gönderi sahibi kendi gönderisindeki yorumu silemiyor. Admin kuyruğu yorum raporu bekliyor ama kullanıcı üretemiyor.
4. **P-01 (Yüksek):** Beğeni geri bildirimi gecikmeli ve hata sessiz; animasyon başarısız istekte de çalışıyor.
5. **P-06 (Yüksek):** Light temada profil harfi (beyaz, #F5F6FA zemin) okunmuyor. CLAUDE.md'deki light palet okunabilirlik kuralına aykırı.

Ek olarak Yüksek seviyede: **B-04** (ağ hatası "deste bitti" olarak görünüyor) ve **B-05** (kaydır/geri al hataları sessiz, kart kayboluyor).

---

## Kapsam dışı / bilinçli olarak alınmayanlar

- Zevk meselesi olan renk tonları ve boşluk tercihleri (ör. kart gölgeleri) çıkarıldı.
- Ürün yönü kararları (ör. yorumlara yanıt özelliği eksikliği, anket sonuçlarının oy öncesi gösterilmesi) bulgu olarak alınmadı; yalnızca etkisi olan kısımlar (P-15) Düşük kapsamda tutuldu.
- Dinamik yazı, klavye ve cihaz boyutu konularındaki tüm yorumlar Varsayım olarak işaretlidir ve cihazda doğrulanmalıdır.
