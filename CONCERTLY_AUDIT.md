# 🔍 Concertly Master Audit

> Amaç: Yeni özellik değil — mevcut ürünü en iyi hale getirmek.
> Mod: 10 turluk denetim, her tur farklı perspektif. Önemsiz UI detayları raporlanmaz.

## Tur İlerleme Takibi
- [x] Tur 1 — Product Audit
- [x] Tur 2 — UX Audit
- [x] Tur 3 — User Journey Audit
- [x] Tur 4 — QA Audit
- [x] Tur 5 — Retention Audit
- [x] Tur 6 — Community Audit
- [x] Tur 7 — Artist & Venue Audit
- [x] Tur 8 — Gamification Audit
- [x] Tur 9 — Growth Audit
- [x] Tur 10 — Technical Debt Audit

---

## TUR 1 — PRODUCT AUDIT

### Bulgu 1.1 — Ürünün ana değeri (konser keşfi) tab bar'da yok

**Problem**
Tab bar: Home · Explore(menü ☰) · Notifications · Profile. "Etkinlikler / Konserler" birinci sınıf bir sekme değil. Konsere ulaşmanın yolu ya Home'daki max 6 "öne çıkan" kart ya da Explore menüsünden Events'e gitmek. Bir konser-keşif uygulamasında konser listesi 2. kademe navigasyonda.

**Neden Önemli**
Uygulamanın çekirdek işi "konser bul". Çekirdek işin sekmede olmaması, kullanıcının ne için açtığı şeyi 1 tıkla bulamaması demek.

**Kullanıcıya Etkisi**
İlk açılışta "burada konser nasıl bulurum?" sorusu net cevaplanmıyor; keşif eylemi gizleniyor.

**Çözüm**
Explore (menü) sekmesini "Events/Keşfet" (gerçek etkinlik listesi) ile değiştir; menüdeki diğer araçları Profil veya Home başlığı altındaki bir "daha fazla" girişine taşı. Tab bar: Home · Events · Notifications · Profile.

**Tahmini Efor:** 1 gün

---

### Bulgu 1.2 — ✅ UYGULANDI (15 Haz) — Home, konser uygulamasını "oyun" gibi gösteriyor
> Daily Song widget'ı Öne Çıkan Etkinlikler'in **altına** alındı; hero artık konserler.

**Problem**
HomeScreen'de içerik sırası: brand → şehir → arama → **Günün Şarkısı oyun widget'ı** → Öne Çıkan Etkinlikler → Trend Postlar. Yani ekrandaki ilk büyük renkli kart bir şarkı tahmin oyunu; konserler onun altında.

**Neden Önemli**
İlk 30 saniye testi: kullanıcı "bu bir konser uygulaması" yerine "bu bir müzik oyunu mu?" tereddüdü yaşıyor. Konumlandırma bulanıklaşıyor.

**Kullanıcıya Etkisi**
Yeni kullanıcı ana değeri geç fark ediyor; oyun, keşfin önüne geçiyor.

**Çözüm**
Daily Song widget'ını Öne Çıkan Etkinlikler'in **altına** al (retention aracı olarak kalsın ama hero olmasın). Hero alan = öne çıkan konserler.

**Tahmini Efor:** 30 dk

---

### Bulgu 1.3 — Aynı içeriğe 3 ayrı kapı (Home / Feed / Explore→Feed) — navigasyon kafa karışıklığı

**Problem**
Postlara erişim: (1) Home'daki "Trend Postlar" + "Tümünü gör" → FeedTab, (2) Explore menüsündeki "Feed" kartı → FeedTab. Etkinliklere erişim: (1) Home öne çıkanlar, (2) Home "Tümünü gör" → Events, (3) Explore "Events" kartı. Aynı 2 hedefe 5 farklı giriş.

**Neden Önemli**
Tekrarlı girişler kullanıcının zihinsel haritasını bozar; "bunu daha önce görmemiş miydim?" hissi yaratır, bilgi mimarisini zayıflatır.

**Kullanıcıya Etkisi**
Gezinme güveni düşer; içerik tekrarı algısı oluşur (Home trend postları = Feed'in bir alt kümesi).

**Çözüm**
Explore menüsünü araç-merkezli sadeleştir: Events ve Feed kartlarını menüden çıkar (zaten Home + tab üzerinden erişiliyor). Menü yalnızca Home'da yeri olmayan araçları (Communities, Buddy, Map, Wrapped, Games) barındırsın.

**Tahmini Efor:** 2 saat

---

### Bulgu 1.4 — ✅ UYGULANDI (15 Haz) — Menüde "yakında" kartları ürünü yarım gösteriyor
> Explore menüsünden "Canlı Odalar" ve "Bilet Uyarıları" (`available:false`) kartları kaldırıldı.

**Problem**
Explore menüsünde "Canlı Odalar" ve "Bilet Uyarıları" kartları görünür ama tıklayınca sadece "yakında" Alert'i çıkıyor. Ana hub'da çalışmayan iki kart duruyor; footer da "yeni özellikler hazır oldukça açılacak" diyor.

**Neden Önemli**
Demo/yatırımcı sunumunda ve ilk izlenimde ürünü "tamamlanmamış" gösterir. Tıklayıp boşa düşen kullanıcı güven kaybeder.

**Kullanıcıya Etkisi**
Hayal kırıklığı + ölü tıklama; özellik bolluğu izlenimi gerçek değerle örtüşmüyor.

**Çözüm**
İki "yakında" kartını menüden tamamen kaldır (kod tarafında `available:false` tanımları zaten var, sadece listeden çıkar). Hazır olunca geri ekle.

**Tahmini Efor:** 30 dk

---

# Yeni Bulunan Kritik Problemler
- **1.1** Konser keşfi tab bar'da birinci sınıf değil (en kritik konumlandırma sorunu).
- **1.3** Aynı 2 hedefe 5 giriş → bilgi mimarisi karışık.

# Hızlı Kazanımlar
- **1.2** Daily Song widget'ını etkinliklerin altına al (30 dk).
- **1.4** "Yakında" kartlarını menüden kaldır (30 dk).

# Yüksek Etki / Düşük Efor Görevleri
1. **1.2** Home hero'sunu konsere çevir (30 dk, yüksek etki — ilk izlenim).
2. **1.4** Ölü "yakında" kartlarını kaldır (30 dk).
3. **1.3** Menüyü sadeleştir (2 saat, orta-yüksek etki).

# Bir Sonraki En Mantıklı Görev
**Bulgu 1.2 — Daily Song widget'ını Öne Çıkan Etkinlikler'in altına taşı.** 30 dakikalık, tek dosyada (HomeScreen.js), risksiz ve ilk-izlenim/konumlandırma üzerinde en yüksek getirili değişiklik. 1.4 ile birlikte yapılabilir.

---

## TUR 2 — UX AUDIT

### Bulgu 2.1 — ❎ REDDEDİLDİ (bilinçli tasarım) — Post mekana kilitli

> **Karar (15 Haziran 2026 — Emre):** Bu bir hata değil, çekirdek tasarım kararı. Concertly'de herkes post atabilir ama herkes her konser için atamaz — yalnızca o konsere fiziksel olarak gidenler o konser hakkında paylaşım yapabilir. Bu, feed'in özgünlüğünü/güvenilirliğini koruyan ayırt edici özellik. "Yine de paylaş (doğrulamasız)" kaçışı **uygulanmayacak**. Aşağıdaki orijinal bulgu kayıt için bırakıldı.

---

### (Orijinal bulgu) Post atmak fiziksel olarak mekanda olmaya kilitli — pre-concert paylaşım imkânsız

**Problem**
`EventDetailScreen.handlePostAt` (satır 254): etkinliğin koordinatı varsa, "Post At" GPS izni ister, konum alır, mekana uzaklık > 200m ise **"çok uzaktasın" alert'i verip durur ve CreatePost'a gitmez**. Yani kullanıcı konsere gitmeden (evdeyken) o etkinlik hakkında hiç post atamıyor. "Doğrulanmadan yine de paylaş" gibi bir kaçış yolu yok.

**Neden Önemli**
Sosyal bir uygulamada içerik üretiminin önündeki en büyük engel: kullanıcıların büyük çoğunluğu konser öncesi heyecan/anticipation postu atmak ister. Bu akış onları tamamen blokluyor. Feed'in boş kalmasının muhtemel kök nedeni bu.

**Kullanıcıya Etkisi**
Coğrafi olarak mekanda olmayan herkes "Post At"e basıp duvara toslar; içerik üretimi sadece konser anına ve oraya gidenlere sıkışır → feed cansız.

**Çözüm**
"Çok uzaktasın" alert'ine ikinci buton ekle: **"Yine de paylaş (doğrulamasız)"** → `navigation.navigate('CreatePost', { event, verified: false })`. Doğrulanmış rozet sadece 200m içindekilere verilsin; ama paylaşım herkese açık olsun.

**Tahmini Efor:** 2 saat

---

### Bulgu 2.2 — ✅ UYGULANDI (15 Haz) — EventDetail'de eşit ağırlıkta CTA yığını
> Setlist butonu kaldırıldı; Bilet Al + Takvime Ekle hero sağ-üstte ikon butonlara taşındı (🎟️ 📅 🔖). İçerikteki büyük CTA yığını belirgin şekilde azaldı.

**Problem**
Yaklaşan bir etkinlik ekranında alt alta neredeyse aynı stilde tam-genişlik butonlar: Katılım (Gidiyorum/İlgileniyorum), Konser Arkadaşı katıl, Bilet Al, Takvime Ekle, Setlist Tahmin Ligi, Post At. Görsel hiyerarşi yok — birincil eylem (bilet/gidiyorum) ile ikincil/oyun eylemi (setlist tahmini) aynı boyut ve ağırlıkta.

**Neden Önemli**
6+ eşit CTA, kullanıcının "şimdi ne yapmalıyım?" kararını zorlaştırır. Önemli eylem (bilet alma → dönüşüm) gürültüde kaybolur.

**Kullanıcıya Etkisi**
Karar yorgunluğu; bilet tıklama oranı ve katılım işaretleme düşer, ekran "kalabalık/karmaşık" hissettirir.

**Çözüm**
Hiyerarşi kur: Bilet Al = tek baskın (dolu, parlak) buton. Takvime Ekle / Setlist / Post At = ikincil (outline veya ikon satırı). Setlist ve Takvim'i tek satırda yan yana ikincil aksiyon olarak grupla.

**Tahmini Efor:** 1 gün

### Bulgu 2.3 — Oyunlar 3 kat derinde gömülü (gereksiz tıklama)

**Problem**
Bir oyuna ulaşmak: Explore sekmesi (1) → Games kartı (2) → ilgili oyun (3). Explore zaten bir menü olduğu için oyunlar menü-içinde-menü konumunda. Home'daki tek kısayol yalnızca Daily Song için var; Blind Rank/Quiz/Setlist/Bingo için ana yüzeyden giriş yok.

**Neden Önemli**
Gamification retention aracı; 3 tıklama uzaktaki özelliğin günlük kullanımı düşer. Yapılan oyun yatırımı (5+ oyun) keşfedilmeden kalır.

**Kullanıcıya Etkisi**
Kullanıcı oyunların çoğunun varlığını fark etmez; emek harcanmış özellikler ölü kalır.

**Çözüm**
Games'i Explore menüsünden çıkarıp doğrudan erişilebilir bir yüzeye taşımak yerine (yeni ekran değil), Home'daki mevcut Daily Song widget'ını "Oyun Merkezi" girişine dönüştür (tek tık → Games). Böylece menü-içinde-menü 1 kata iner.

**Tahmini Efor:** 2 saat

---

# Yeni Bulunan Kritik Problemler
- **2.1** 🔴 Post atmak GPS ile mekana kilitli → pre-concert paylaşım imkânsız, feed cansız (muhtemel kök neden).

# Hızlı Kazanımlar
- **2.1** "Yine de paylaş (doğrulamasız)" butonu ekle (2 saat) — içerik üretimini açar.

# Yüksek Etki / Düşük Efor Görevleri
1. **2.1** Post konum kilidine kaçış yolu (2 saat, çok yüksek etki — feed canlanır).
2. **2.3** Daily Song widget'ını Oyun Merkezi girişi yap (2 saat).

# Bir Sonraki En Mantıklı Görev
**Bulgu 2.1 — "Yine de paylaş" kaçış yolu.** Tek dosya (EventDetailScreen.js), 2 saat, ve doğrudan ana sosyal döngüyü (içerik üretimi → feed → retention) besler. Tüm denetimdeki en yüksek etki/efor oranı şu ana kadar bu.

---

## TUR 3 — USER JOURNEY AUDIT

### Bulgu 3.1 — ✅ UYGULANDI (15 Haz 2026) — Şehir onboarding'de sorulmuyordu

> Onboarding'in tür adımına şehir seçimi eklendi (`GenreSelectionScreen` — `CITIES` chip'leri, şehir zorunlu), `ArtistSelectionScreen` `/auth/onboarding`'e `city` gönderiyor ve session'a `userCity` yazıyor. Backend `OnboardingRequest.city` + `AuthService` kaydediyor. Derleme ✅.

**Problem**
Kayıt akışı (`RegisterScreen`) yalnızca kullanıcı adı + email + şifre alıyor. Onboarding 2 adım: Tür seçimi → Sanatçı seçimi (`/auth/onboarding` payload'ı yalnızca `genres` + `artistIds`). Hiçbir adımda **şehir** sorulmuyor. `AuthContext` şehri login yanıtındaki `data.city`'den okuyor; yeni kullanıcıda bu boş. Sonuç: HomeScreen `selectedCity = session.userCity || null` → `null` → "Tüm Türkiye". Yani konser-keşif uygulamasının çekirdek filtresi (kullanıcının şehri) ilk günden devre dışı.

**Neden Önemli**
Ürünün ana vaadi "senin şehrindeki konserler". Onboarding tür/sanatçı gibi ikincil tercihleri soruyor ama en kritik filtreyi atlıyor. Kullanıcı bunu manuel olarak Profil → şehir ayarına gidip düzeltene kadar alakasız (başka şehir) içerikle karşılaşıyor.

**Kullanıcıya Etkisi**
İlk izlenimde "bana uzak/alakasız konserler" → ilk konser bulma akışı zayıf, aktivasyon düşük. Çoğu kullanıcı şehir ayarının var olduğunu bile fark etmez.

**Çözüm**
Onboarding'e tür seçiminden önce/sonra tek bir "şehrin?" adımı ekle (HomeScreen'deki mevcut `CITIES` listesini yeniden kullan, yeni ekran tasarımı gerekmez) ve `/auth/onboarding` payload'ına `city` ekleyip session'a yaz. Adım göstergesi zaten 2 nokta; 3'e çıkar.

**Tahmini Efor:** 2 saat

---

### Bulgu 3.2 — ✅ UYGULANDI (15 Haz) — İlk pasaport: sıfırlar duvarı, rehber yok
> `totalConcerts === 0` ve kendi pasaportunda: stats kartının altında yönlendirici boş-durum kartı ("Pasaportun seni bekliyor" + nasıl mühür kazanılır + "🎟️ Konserleri Keşfet" → Events).

**Problem**
Yeni kullanıcı pasaportu açtığında stats kartı 0/0/0/0, yıllık hedef %0, tüm rozetler kilitli, top sanatçı/tür listeleri boş (koşullu render edildiği için hiç görünmüyor). Hiçbir boş-durum yönlendirmesi yok: "Pasaportunu başlatmak için bir konsere "Gidiyorum" işaretle / mekanda doğrula" gibi bir CTA mevcut değil.

**Neden Önemli**
Pasaport ürünün vitrin (flagship) gamification özelliği. İlk karşılaşma "bomboş ve ne yapacağımı bilmiyorum" hissi veriyor; kullanıcı özelliğin değerini hiç görmeden çıkıyor. Kişiselleştirme emeği (rozetler, hedef, istatistik) ilk anda ölü.

**Kullanıcıya Etkisi**
Flagship özellik ilk açılışta soğuk; kullanıcı geri dönmek için sebep edinmiyor → erken terk.

**Çözüm**
`totalConcerts === 0` durumunda pasaportun üstüne tek bir boş-durum kartı: kısa açıklama + "Konserleri Keşfet" (→ Events) ve "İlk rozetini nasıl kazanırsın?" mini ipucu. Yeni özellik değil; mevcut boş ekrana yönlendirme.

**Tahmini Efor:** 2 saat

> **Not (tekrar değil):** "İlk post paylaşma" akışı Bulgu **2.1**'e takılıyor (post mekana kilitli). "İlk buddy eşleşmesi" akışı (`ConcertBuddyMatchScreen` swipe → eşleşme → mesaj) sağlıklı çalışıyor; ayrıca buddy'nin iki ayrı yüzeyde olması (swipe ekranı + EventDetail listesi) Tur 6'da incelenecek.

---

# Yeni Bulunan Kritik Problemler
- **3.1** 🔴 Şehir onboarding'de hiç sorulmuyor → çekirdek "şehrindeki konserler" filtresi ilk gün devre dışı, aktivasyon düşük.

# Hızlı Kazanımlar
- **3.2** Pasaport boş-durum yönlendirme kartı (2 saat).

# Yüksek Etki / Düşük Efor Görevleri
1. **3.1** Onboarding'e şehir adımı (2 saat, çok yüksek etki — aktivasyon + çekirdek vaat).
2. **3.2** Pasaport boş-durum CTA (2 saat).

# Bir Sonraki En Mantıklı Görev
**Bulgu 3.1 — Onboarding'e şehir adımı ekle.** Mevcut `CITIES` listesi yeniden kullanılarak 2 saatte yapılır, çekirdek değer vaadini ilk günden devreye sokar. 2.1 ile birlikte ilk iki uygulama görevi olmalı (biri keşfi, diğeri içerik üretimini açar).

---

## TUR 4 — QA AUDIT

### Bulgu 4.1 — ✅ KISMEN UYGULANDI (15 Haz) — Hata durumları sessizce yutuluyor (Home + Feed yapıldı)
> Home ve Feed artık `getErrorMessage(err)` ile hata state'i tutuyor; veri yoksa "İçerik yüklenemedi" + mesaj + **Tekrar Dene** ekranı gösteriyor (boş ≠ hata). Kalan: EventDetail/diğer GET'ler hâlâ yutuyor (ArtistProfile için bkz. 7.1).

**Problem**
Ana liste ekranları ağ/sunucu hatalarını yutuyor ve boş-durum gösteriyor. `HomeScreen.fetchData` → `.catch(err => console.log(...))` ve sonra "🎭 Etkinlik yok" gösterir. `FeedScreen` → catch sadece `console.log`, ardından `ListEmptyComponent` ("Henüz post yok") render edilir. `EventDetailScreen`'deki tüm GET'ler `.catch(() => {})`. Hâlbuki `api.js` içinde tam da bunun için `getErrorMessage()` + `error.userMessage` ("Sunucuya ulaşılamıyor", "Zaman aşımı") altyapısı var ama bu ekranlarda **hiç kullanılmıyor**.

**Neden Önemli**
Backend kapalıyken / IP yanlışken / internet yokken kullanıcı, uygulamayı "tamamen boş / içeriksiz" sanıyor. Tekrar deneme (retry) yolu da yok — ekranı kapatıp açmaktan başka çare kalmıyor. Bu, kalıcı "ürün boş/bozuk" algısı yaratır.

**Kullanıcıya Etkisi**
Geçici bir ağ hatası, kalıcı terk sebebine dönüşür; özellikle demo/ilk kullanımda "burada hiçbir şey yok" izlenimi felakettir.

**Çözüm**
Home, Feed ve diğer ana fetch'lerde hata state'i tut (`error` + `loading` + `data`). Hata varsa boş-durum yerine "Yüklenemedi — Tekrar Dene" kartı göster (`getErrorMessage(err)` mesajıyla). Altyapı hazır; sadece bağlanması gerekiyor.

**Tahmini Efor:** 1 gün (tek başına en kritik ekran Home için 2 saat)

---

### Bulgu 4.2 — ✅ UYGULANDI (15 Haz) — HomeScreen'de zorunlu 600ms skeleton gecikmesi
> `fetchData` `.finally` içindeki `setTimeout(...600)` kaldırıldı; skeleton artık yalnızca veri gelene kadar.

**Problem**
`HomeScreen.fetchData` → `.finally` içinde `setTimeout(() => setLoading(false), 600)`. Veri anında gelse bile skeleton en az 600ms zorla gösteriliyor ("animasyon görünsün" yorumu). En sık ziyaret edilen ekran her seferinde yapay olarak yavaşlatılıyor.

**Neden Önemli**
Algılanan performans, gerçek performanstan önemli. Ana ekrana her dönüşte 600ms gecikme, uygulamayı "ağır" hissettirir; bu his bütün ürüne yayılır.

**Kullanıcıya Etkisi**
Akıcılık kaybı, özellikle hızlı sekme geçişlerinde fark edilir takılma hissi.

**Çözüm**
Zorunlu gecikmeyi kaldır ya da yalnızca ilk yükte ve maksimum 200-250ms ile sınırla. Skeleton zaten veri gelene kadar görünüyor; ekstra `setTimeout` gereksiz.

**Tahmini Efor:** 30 dk

### Bulgu 4.3 — ✅ UYGULANDI (15 Haz) — Home `limit=40` + istemci geçmiş filtresi edge case
> `/events`'e `upcoming=true` parametresi eklendi; geçmiş, limit'ten ÖNCE sunucuda eleniyor. Home çağrısı `limit=40&upcoming=true` → 40 kayıt yalnızca yaklaşan etkinliklerden dolar.

**Problem**
`HomeScreen.fetchData` sunucudan `limit=40` etkinlik çekiyor, sonra istemcide `filteredEvents` geçmiş tarihlileri eliyor (`new Date(e.eventDate) < today` → çıkar). Sunucu sıralaması "yaklaşan önce" değilse, dönen 40 kaydın çoğu/hepsi geçmiş olabilir; bu durumda istemci hepsini eler ve ileri tarihli konserler 40'ın ötesinde kaldığı için ekran "Etkinlik yok" gösterir — aslında gelecekte konser olmasına rağmen.

**Neden Önemli**
Şehir/tür filtresiyle birleşince (az kayıt dönen durumlar) çekirdek keşif ekranı yanlışlıkla boş görünebilir; kullanıcı "şehrimde konser yok" sanır.

**Kullanıcıya Etkisi**
Yanlış "boş" algısı → keşif değeri kaybı.

**Çözüm**
Geçmiş filtresini sunucuya taşı (`/events` zaten parametre alıyor: `upcoming=true` veya `fromDate`), böylece `limit=40` yalnızca yaklaşan etkinliklerden dolar. Mümkün değilse istemci filtresinden sonra yetersizse otomatik ikinci sayfa çek.

**Tahmini Efor:** 2 saat

---

# Yeni Bulunan Kritik Problemler
- **4.1** 🔴 Hatalar sessizce yutuluyor → geçici ağ sorunu "ürün boş/bozuk" algısına dönüşüyor, retry yok.

# Hızlı Kazanımlar
- **4.2** Home'daki zorunlu 600ms gecikmeyi kaldır (30 dk) — anında daha hızlı his.

# Yüksek Etki / Düşük Efor Görevleri
1. **4.2** 600ms skeleton gecikmesini kaldır (30 dk).
2. **4.1** (Home dilimi) Home'a hata+retry state'i (2 saat) — `getErrorMessage` zaten hazır.
3. **4.3** Geçmiş filtresini sunucuya taşı (2 saat).

# Bir Sonraki En Mantıklı Görev
**Bulgu 4.2 — Home'daki zorunlu 600ms gecikmeyi kaldır.** 30 dk, tek satır, risksiz; en sık görülen ekranı anında hızlandırır. Hemen ardından 4.1'in Home dilimi (hata+retry) yapılmalı.

---

## TUR 5 — RETENTION AUDIT

### Bulgu 5.1 — 🔴 Tüm geri-getirme borusu kurulu ama teslimat kanalı yok (push eksik)

**Problem**
Backend'de retention için ciddi altyapı var: `ReminderService` her sabah 09:00 yaklaşan konser hatırlatması üretiyor; sanatçı turne duyuruları takipçilere bildiriliyor; beğeni/yorum/mesaj bildirimleri üretiliyor; Daily Song streak mekaniği çalışıyor. **Ama hepsi yalnızca uygulama-içi DB satırı.** `index.js` düz; mobilde `expo-notifications`/FCM/Expo push token yok; backend Expo/FCM'e hiçbir şey göndermiyor. Yani kullanıcı kendiliğinden uygulamayı açıp `/notifications`'ı poll etmedikçe (rozet yalnızca uygulama açıkken 20 sn'de bir güncelleniyor) bu sinyallerin hiçbiri ona ulaşmıyor.

**Neden Önemli**
Retention'ın can damarı outbound geri-getirme sinyalidir. Şu an "yarın geri gel" diyen tek şey kullanıcının kendi hafızası. Emek harcanmış hatırlatma/duyuru/bildirim sistemi, teslimat kanalı olmadığı için boşa çalışıyor — yarısı yapılmış bir boru. ROADMAP da bunu "en kritik DAU sorunu" diye işaretlemiş.

**Kullanıcıya Etkisi**
Konser hatırlatması telefona düşmüyor → kullanıcı bilet almayı/gitmeyi unutuyor. Mesaj/beğeni geldiğinde haberi olmuyor → sosyal döngü kopuyor. D1/D7 retention taban seviyede kalıyor.

**Çözüm**
Yeni özellik değil — mevcut bildirim borusuna teslimat ucu tak: `expo-notifications` ekle, açılışta Expo push token al ve backend'e kaydet (`User.pushToken`), `NotificationService.sendSystem` çağrılarının yanına Expo Push API'sine HTTP gönderim ekle. EAS development build gerekiyor (Expo Go push'u sınırlı).

**Tahmini Efor:** 1 hafta

---

### Bulgu 5.2 — ✅ UYGULANDI (15 Haz) — Ana sosyal yüzey (Feed) yeni kullanıcıda boş açılıyor
> FeedScreen takip akışı ilk yüklemede boşsa bir kez otomatik `trending`'e geçiyor (`autoSwitchedRef`), böylece yeni kullanıcı dolu içerik görüyor.

**Problem**
`FeedScreen` varsayılan sekmesi `activeTab='following'`. Yeni kullanıcı kimseyi takip etmediği için ana sosyal akış bomboş açılıyor (yalnızca "trending'e geç" CTA'sı görünüyor). Onboarding'de seçilen sanatçılar da kullanıcı postu üretmediğinden following feed'i doldurmuyor.

**Neden Önemli**
Feed, kullanıcıyı ertesi gün geri getirmesi beklenen taze-içerik yüzeyi. İlk açılışta boşsa, kullanıcı "burada akış yok" deneyimiyle çıkıyor; geri dönüş sebebi oluşmuyor.

**Kullanıcıya Etkisi**
Day-2 dönüş değeri düşük; sosyal kanıt (başkaları aktif) hiç görülmüyor.

**Çözüm**
Takip sayısı 0 ise Feed'i otomatik `trending` ile aç (dolu, canlı içerik). Kullanıcı birini takip ettiğinde varsayılan `following`'e dönsün. Tek koşullu başlangıç state'i.

**Tahmini Efor:** 2 saat

### Bulgu 5.3 — ✅ UYGULANDI (15 Haz) — Daily Song streak'inde kayıp-kaçınma kullanılmıyor
> Home widget metni: streak>0 & oynanmadıysa "X günlük serini kaybetme — bugün oyna!"; çözülünce "🔥 X günlük seri! Yarın da gel".

**Problem**
Streak (🔥) en güçlü günlük-alışkanlık mekaniği ama Home widget'ı oynanmadığında yalnızca nötr "bekleniyor" durumu gösteriyor. "X günlük serini bugün kaybetme" gibi bir aciliyet/kayıp-kaçınma çerçevesi yok. Streak sessizce kırılıyor.

**Neden Önemli**
Loss aversion, streak ürünlerinde (Duolingo vb.) geri dönüşün ana motorudur; mevcut streak verisi elde varken kullanılmıyor.

**Kullanıcıya Etkisi**
Streak'ler fark edilmeden ölüyor; günlük dönüş alışkanlığı pekişmiyor.

**Çözüm**
Home widget kopyasını streak > 0 ve bugün oynanmadıysa "🔥 {streak} — serini kaybetme, bugün oyna" yap; bittiğinde "🔥 {streak} gün! Yarın da gel" pozitif pekiştirme. (Push gelince aynı mesaj akşam hatırlatması olur — bkz. 5.1.)

**Tahmini Efor:** 30 dk

---

# Yeni Bulunan Kritik Problemler
- **5.1** 🔴 Push teslimat kanalı yok → kurulu tüm geri-getirme sistemi (hatırlatma/duyuru/sosyal bildirim/streak) kullanıcıya hiç ulaşmıyor. Retention'ın #1 kaldıracı.

# Hızlı Kazanımlar
- **5.2** Feed'i 0 takipte trending ile aç (2 saat).
- **5.3** Streak widget'ına kayıp-kaçınma kopyası (30 dk).

# Yüksek Etki / Düşük Efor Görevleri
1. **5.3** Streak loss-aversion kopyası (30 dk).
2. **5.2** Feed boş-default düzeltmesi (2 saat).
3. **5.1** Push teslimatı (1 hafta — yüksek efor ama en yüksek retention etkisi; tek başına bir sprint).

# Bir Sonraki En Mantıklı Görev
**Bulgu 5.2 — Feed'i 0 takipte trending ile aç.** 2 saat, tek koşul, ana sosyal yüzeyin ilk açılışta dolu görünmesini sağlar; düşük efor/yüksek etki. Push (5.1) stratejik olarak en kritik ama bir sprintlik iş — ayrı planlanmalı.

---

## TUR 6 — COMMUNITY AUDIT

### Bulgu 6.1 — ✅ UYGULANDI (15 Haz 2026) — Moderasyon (şikayet + engelleme)

> Backend: `Block` + `Report` entity/repo, `ModerationService`, `ModerationController` (`POST /api/reports`, `POST/DELETE /api/users/{id}/block`, `GET /api/users/{id}/block-status`). Engellenen + engelleyen kullanıcılar feed (trending & following) ve DM sohbet listesinden filtreleniyor; engellenenle mesajlaşma backend'de bloke. Mobil: PostCard "⋯" artık herkese açık (kendi postu → düzenle/sil, başkası → şikayet/engelle), ChatScreen header ⋯ ve UserProfile ⋯ menüleri. Derleme ✅. **Kalan (opsiyonel):** admin panelde açık şikayetleri listeleme (`ModerationService.getOpenReports()` hazır, UI yok).

**Problem**
`PostCard`'daki "⋯" menüsü yalnızca `isOwner` true ise görünüyor (kendi postun → düzenle/sil). Başkasının postunu **şikayet etme** seçeneği yok. `ChatScreen`'de mesaj/kullanıcı için engelle/şikayet yok. DM gönderimi (`/messages`, `receiverId`) istemci tarafında hiçbir eşleşme/izin koşuluna bağlı değil — yani herkes herkese mesaj atabiliyor, üstelik engelleme imkânı yokken.

**Neden Önemli**
İki katmanlı kritik sorun: (1) **Güvenlik/topluluk sağlığı** — taciz/spam/uygunsuz içeriğe karşı kullanıcının hiçbir çaresi yok. (2) **Yayın engeli** — Apple App Store Guideline 1.2 ve Google Play, kullanıcı içeriği barındıran (UGC) uygulamalarda şikayet + engelleme + içerik gizleme mekanizmasını **zorunlu** tutar. Bunlar olmadan uygulama mağaza onayından döner.

**Kullanıcıya Etkisi**
Taciz edilen kullanıcı uygulamayı bırakır ve kötü itibar yayar; daha da önemlisi ürün mağazaya çıkamaz → tüm kazanım hunisi kapalı.

**Çözüm**
Yeni ekran gerekmez: (a) PostCard "⋯" menüsünü herkes için göster, sahibi olmayanlara "Şikayet Et" + "Engelle"; (b) ChatScreen header'ına ve UserProfile'a "Engelle/Şikayet"; (c) backend'de `report` + `block` endpoint'i, engellenen kullanıcının post/mesajlarını feed ve DM'den filtrele. Min. uygulanabilir set öncelik.

**Tahmini Efor:** 3 gün

---

### Bulgu 6.2 — "Konser Arkadaşı" iki kopuk yüzeyde yaşıyor → havuz bölünüyor, kafa karışıyor

**Problem**
Buddy iki ayrı mekanizma: (a) `ConcertBuddyMatchScreen` — Explore → Buddy'den açılan Tinder tarzı kaydırmalı eşleştirici (eşleşince → Chat); (b) `EventDetailScreen` içindeki etkinliğe özel "Konser Arkadaşı" katıl-listesi (katılan kişiler listelenir, profile gidilir). Aynı amaç ("birlikte gidecek birini bul") için iki farklı zihinsel model. Bir etkinlikte buddy listesine katılan kullanıcı, swipe ekranındaki havuzda görünmeyebilir; iki taraf birbirini beslemiyor.

**Neden Önemli**
Buddy, uygulamanın ayırt edici sosyal özelliği. İki kopuk yüzey kullanıcı havuzunu bölüyor — her ikisi de seyrek görünüyor, "kimse yok" hissi doğuyor. Hangi yöntemin "doğru" olduğu belirsiz.

**Kullanıcıya Etkisi**
Eşleşme olasılığı düşüyor (havuz bölünmüş), kullanıcı özelliği "boş/çalışmıyor" sanıyor → ayırt edici değer kayboluyor.

**Çözüm**
İki yüzeyi tek havuza bağla: EventDetail "Konser Arkadaşı" katılımı, swipe ekranının da çektiği aynı buddy havuzuna yazsın; EventDetail kartına "Bu etkinlik için eşleş →" kısayolu ekleyerek swipe ekranını o etkinliğe filtreli aç. Yeni özellik değil, mevcut iki akışı birleştirme.

**Tahmini Efor:** 3 gün

### Bulgu 6.3 — ✅ KISMEN UYGULANDI (15 Haz) — Değerlendirmeler katılıma bağlı değil (event yapıldı)
> **Event reviews:** Backend yalnızca katılanların (Gidiyorum / konumla doğrulanmış) puan vermesine izin veriyor (POST 403'le korunuyor); GET her review'a `attended` flag'i dönüyor. EventDetail: katılmayana form yerine "katılanlar değerlendirebilir" kartı, listede katılanlara "✅ Katıldı" rozeti. **Kalan:** ArtistProfile + VenueProfile review yüzeyleri (sanatçı/mekan için "katıldı" semantiği daha karmaşık — ayrı ele alınacak).

**Problem**
`EventDetailScreen` geçmiş etkinliklerde herkese puan+yorum bırakmaya izin veriyor; kullanıcının o konsere "Gidiyorum" demiş veya konumla doğrulanmış olması koşulu yok. Konsere gitmemiş biri de etkinliği/sanatçıyı puanlayabiliyor.

**Neden Önemli**
Review sistemi mekan/sanatçı keşfinde güven sinyali. Katılımdan bağımsız puanlar manipülasyona ve gürültüye açık → ortalama puan anlamını yitirir.

**Kullanıcıya Etkisi**
Güvenilmez puanlar; kullanıcı review'lara göre karar veremez, özelliğin değeri düşer.

**Çözüm**
Puan vermeyi en az "Gidiyorum" işaretlemiş (tercihen konumla doğrulanmış) kullanıcılarla sınırla; doğrulanmış yorumlara "✅ Katıldı" rozeti ekle (zaten `verifiedConcerts` verisi var).

**Tahmini Efor:** 2 saat

---

# Yeni Bulunan Kritik Problemler
- **6.1** 🔴 Şikayet/engelleme yok → topluluk güvenliği savunmasız VE App Store/Play onay engeli (yayın blokeri).

# Hızlı Kazanımlar
- **6.3** Review'ları katılımcılara sınırla + "Katıldı" rozeti (2 saat).

# Yüksek Etki / Düşük Efor Görevleri
1. **6.3** Review katılım koşulu (2 saat).
2. **6.1** Şikayet/engelleme min. set (3 gün — yüksek efor ama yayın için zorunlu).
3. **6.2** Buddy havuzlarını birleştir (3 gün).

# Bir Sonraki En Mantıklı Görev
**Bulgu 6.1 — Şikayet/engelleme mekanizması.** Efor yüksek (3 gün) ama bu bir tercih değil: UGC moderasyonu olmadan uygulama mağazaya çıkamaz, yani diğer tüm büyüme işleri bununla kilitli. Stratejik olarak yayın öncesi zorunlu iş. (Düşük eforlu hızlı kazanım isteniyorsa önce 6.3 yapılabilir.)

---

## TUR 7 — ARTIST & VENUE AUDIT

### Bulgu 7.1 — ✅ UYGULANDI (15 Haz) — ArtistProfile/VenueProfile tek hatada tüm sayfadan atıyor
> `Promise.all` → `Promise.allSettled`; ana sanatçı/mekan verisi gelirse sayfa açılır, ikincil çağrı (post/yorum/etkinlik) hatası sadece o bölümü boş bırakır.

**Problem**
`ArtistProfileScreen.fetchAll` 5 endpoint'i `Promise.all` ile paralel çekiyor (artist, events, posts, reviews, past-events). `Promise.all` ilk reddedişte tümden reddeder; `catch` bloğu ise hata alert'i gösterip `navigation.goBack()` yapıyor. Yani ikincil bir endpoint (örn. `/reviews` veya `/past-events`) tek seferlik hata/timeout verirse, sanatçının tüm profili açılmıyor ve kullanıcı geri atılıyor — oysa ana sanatçı verisi başarıyla gelmiş olabilir.

**Neden Önemli**
Sanatçı sayfası keşfin ve takip (retention) eyleminin merkezi. En kırılgan ikincil çağrı, en kritik birincil içeriği rehin alıyor. Tek bir yavaş sorgu koca sayfayı çökertiyor.

**Kullanıcıya Etkisi**
Sanatçıya tıklayan kullanıcı sebepsiz yere geri atılıyor, "uygulama bozuk/sanatçı yok" sanıyor; takip etme fırsatı kayboluyor.

**Çözüm**
`Promise.all` yerine `Promise.allSettled` kullan; ana artist verisi geldiyse sayfayı render et, başarısız olan sekmeler (posts/reviews) kendi boş/hata durumunu göstersin. Yalnızca ana `/artists/{id}` çağrısı başarısızsa geri dön. (Aynı desen VenueProfile için de geçerli ama orada 3 çağrı tek catch'te yutuluyor — en azından parçalı render uygula.)

**Tahmini Efor:** 2 saat

---

### Bulgu 7.2 — ✅ UYGULANDI (15 Haz) — Sanatçı "Takip Et" eyleminin somut karşılığı yok
> Home, takip edilen sanatçıların yaklaşan etkinliklerini öne sıralıyor + FeaturedCard'da "🔔 Takip ettiğin" rozeti.

**Problem**
Kullanıcı bir sanatçıyı takip edebiliyor ama bunun uygulama-içi görünür getirisi yok: HomeScreen etkinlikleri `favoriteGenres` + şehir ile filtreliyor, **takip edilen sanatçılara göre değil**. Takipçilere turne duyurusu bildirimi üretiliyor ama o da push olmadığı için ulaşmıyor (bkz. 5.1). Sonuçta "Takip Et" butonuna basmanın kullanıcıya dönen anlamlı bir faydası kalmıyor.

**Neden Önemli**
Takip, hem retention hem kişiselleştirme sinyali; karşılığı olmayan bir eylem hem boşa hem de kullanıcının "neden takip edeyim?" demesine yol açar.

**Kullanıcıya Etkisi**
Takip oranı ve kişiselleştirme değeri düşük; sanatçı sayfası "bilgi kartı"ndan öteye geçmiyor.

**Çözüm**
Mevcut Home etkinlik sıralamasında takip edilen sanatçıların yaklaşan etkinliklerini öne al (yeni ekran değil — `/events` sonucunu `followedArtistIds`'e göre sırala/etiketle, kartta "🔔 Takip ettiğin sanatçı" rozeti). Push gelince (5.1) duyuru da gerçek değer kazanır.

**Tahmini Efor:** 1 gün

> **Not (tekrar değil):** Bulgu **6.3** (review'ları katılımcılara sınırla) sanatçı ve mekan puanlaması için de birebir geçerli — şu an `ArtistProfile` ve `VenueProfile`'da herkes katılmadan puan verebiliyor. Aynı düzeltme üç review yüzeyini (event/artist/venue) kapsamalı.

---

# Yeni Bulunan Kritik Problemler
- **7.1** 🔴 ArtistProfile'da tek yan-endpoint hatası tüm sayfayı çökertip kullanıcıyı geri atıyor.

# Hızlı Kazanımlar
- **7.1** `Promise.allSettled` + parçalı render (2 saat).

# Yüksek Etki / Düşük Efor Görevleri
1. **7.1** Sanatçı/mekan sayfasını parçalı render et (2 saat) — keşif merkezini sağlamlaştırır.
2. **6.3 (genişletilmiş)** Üç review yüzeyini katılımcılara sınırla (2 saat).

# Bir Sonraki En Mantıklı Görev
**Bulgu 7.1 — ArtistProfile/VenueProfile parçalı render (`allSettled`).** 2 saat, izole, yüksek getiri: keşfin ve takip eyleminin merkezindeki sayfayı kırılgan ikincil çağrılardan koruyor. 4.1 (hata yutma) ile aynı kalite ailesinden — birlikte ele alınabilir.

---

## TUR 8 — GAMIFICATION AUDIT

### Bulgu 8.1 — ✅ UYGULANDI (15 Haz) — Oyun başarıları profile bağlı değil
> Profile "🎮 Oyun Başarıların" kartı: 🔥 günlük seri, 🎤 quiz oyunu, 🏆 en yüksek skor; karttan Games'e kısayol. Backend `GET /api/quiz/my-stats`.

**Problem**
Daily Song streak'i, Song Quiz skoru, Blind Rank sıralamaları üretiliyor ama hiçbiri profilde görünmüyor. `ProfileScreen` yalnızca konser rozetlerini (`BadgeGrid`, katılım kaynaklı) ve Pasaport kısayolunu gösteriyor; oyun çıktıları yalnızca Home widget'ı ve Games hub'ında, kişiye özel ve geçici. Sonuç: oyunlar status üretmiyor, başkalarına görünmüyor, Pasaport/profil kimliğini beslemiyor.

**Neden Önemli**
Gamification'ın retention ve büyüme değeri, çabanın **statüye/sosyal kanıta** dönüşmesinden gelir. Streak/skor görünmezse oyun oynamak tek seferlik eğlence olarak kalır; tekrar gelme ve "göster-öv" döngüsü oluşmaz. Ciddi oyun yatırımı (5 oyun) düşük getiriyle çalışıyor.

**Kullanıcıya Etkisi**
Oyunlar oynanıp unutuluyor; profil "kim olduğumu" (müzik kültürü, streak'im) yansıtmıyor → bağlılık ve gösterme motivasyonu zayıf.

**Çözüm**
Yeni oyun değil — mevcut çıktıları mevcut profile bağla: Profil'e "🔥 {streak} günlük seri", "🎤 Quiz en yüksek skor", quiz/streak rozetlerini ekle (var olan `BadgeGrid` genişletilir). Pasaport rozet sistemine oyun rozetleri dahil edilsin.

**Tahmini Efor:** 1 gün

---

### Bulgu 8.2 — ✅ UYGULANDI (15 Haz) — Games "Setlist" kartı yanıltıcı dead-end
> Kart Events'i "setlist seçim modu"nda açıyor (banner + konsera dokun → SetlistPrediction). Ek olarak EventDetail'deki setlist butonu kaldırıldı (tek giriş Games).

**Problem**
`GamesScreen` GAME_DEFS'te setlist kartının `screen: 'Events'`. Yani "Setlist Tahmin Ligi" oyununa tıklayan kullanıcı bir oyuna değil, ham etkinlik listesine düşüyor; oradan bir etkinlik bulup EventDetail'den setlist'e girmesi gerektiğini bilmiyor. Hiçbir açıklama/yönlendirme yok.

**Neden Önemli**
Diğer 3 oyun doğrudan açılırken bu kart kullanıcıyı alakasız bir ekrana atıyor → "bu oyun çalışmıyor/bozuk" algısı. Oyun keşfi kırılıyor.

**Kullanıcıya Etkisi**
Kafa karışıklığı ve terk; setlist özelliği (topluluk doğrulamalı, değerli) hiç keşfedilmiyor.

**Çözüm**
Kart navigasyonuna bağlam ekle: Events'e `{ pickForSetlist: true }` parametresiyle git ve listenin üstünde "Tahmin etmek için bir konser seç" başlığı göster; ya da en yakın yaklaşan etkinliğin SetlistPrediction'ına doğrudan götür.

**Tahmini Efor:** 2 saat

---

# Yeni Bulunan Kritik Problemler
- **8.1** 🔴 Oyun başarıları profile/kimliğe bağlı değil → gamification kapalı döngü, retention/statüs değeri kaybediliyor.

# Hızlı Kazanımlar
- **8.2** Setlist kartına bağlam ekle / doğru yönlendir (2 saat).

# Yüksek Etki / Düşük Efor Görevleri
1. **8.2** Setlist kartı yönlendirmesi (2 saat).
2. **8.1** Streak + oyun rozetlerini profile/pasaporta bağla (1 gün).

# Bir Sonraki En Mantıklı Görev
**Bulgu 8.1 — Oyun çıktılarını profile/pasaporta bağla.** 1 gün, mevcut `BadgeGrid`/pasaport sistemi üzerine; oyunlara harcanan yatırımı statü ve retention döngüsüne çevirir. Hızlı bir kazanım önce isteniyorsa 8.2 (2 saat) yapılabilir.

---

## TUR 9 — GROWTH AUDIT

### Bulgu 9.1 — 🔴 Paylaşımlar linksiz düz metin → paylaşım sıfır kazanım getiriyor (viral döngü kapalı)

**Problem**
`PostCard.handleShare` ve `ConcertPassportScreen.handleShare` yalnızca düz metin paylaşıyor (`Share.share({ message })`); ne uygulama linki, ne App Store/Play linki, ne de paylaşılan içeriğe (etkinlik/pasaport) bir bağlantı var. Pasaport paylaşımı "Concertly ile müziği yaşa" diyor ama alıcının uygulamayı nereden indireceğini söylemiyor.

**Neden Önemli**
Paylaşım, organik kazanımın bedava kanalıdır. Linksiz paylaşım, alıcıyı uygulamaya dönüştüremez — mevcut paylaşım butonları kazanım üretmeyen ölü jestler. Kullanıcının ürettiği her içerik (pasaport kartı, post) büyüme fırsatı kaçırıyor.

**Kullanıcıya Etkisi (büyüme)**
Word-of-mouth bir tıklamayla kurulum/etkinlik görüntüleme üretmiyor; K-faktörü ~0.

**Çözüm**
Hızlı: tüm `Share.share` mesajlarına Concertly indirme linkini (App Store/Play veya web) ekle. Stratejik: 9.3 ile birlikte paylaşılan etkinliğe/pasaporta deep link koy.

**Tahmini Efor:** 30 dk (link ekleme) / tam deep link için bkz. 9.3

---

### Bulgu 9.2 — Hiçbir yerde "Arkadaşını davet et" yok

**Problem**
Uygulamada davet/referral mekanizması tamamen yok (kod taramasında 0 sonuç). Kullanıcı bir arkadaşını çağırmak istese bunu yapacağı bir giriş noktası (Profil/Ayarlar/boş feed) bulamıyor. Buddy eşleşmesi mevcut kullanıcılarla sınırlı; ürüne dışarıdan kullanıcı çekmenin yolu yok.

**Neden Önemli**
Davet, sosyal bir uygulamada en güçlü kazanım kaldıracı. Buddy/DM/feed gibi özelliklerin değeri ağ etkisiyle artar; ağ büyümeden bu özellikler "boş" kalır (bkz. 5.2, 6.2 "kimse yok" hissi).

**Kullanıcıya Etkisi (büyüme)**
Mevcut kullanıcılar tatmin olsa bile büyüme tek kullanıcıda tıkanıyor; ağ etkisi hiç tetiklenmiyor.

**Çözüm**
Yeni ekran gerekmez: Profil ve/veya boş Feed/Buddy durumlarına "Arkadaşını davet et" butonu ekle → `Share.share` ile davet metni + indirme linki (9.1 ile aynı altyapı). İleride referral kodu eklenebilir.

**Tahmini Efor:** 2 saat

### Bulgu 9.3 — Deep linking altyapısı yok (paylaşım + push için temel)

**Problem**
`app.json`'da `scheme`, `associatedDomains`, `intentFilters` yok; `expo-linking` kullanılmıyor. Bir etkinliğe/sanatçıya/posta/pasaporta dışarıdan link verilemiyor. Bu, hem 9.1'deki paylaşım linklerinin bir hedefe açılmasını hem de (push gelince, 5.1) bildirimlerin ilgili içeriğe götürmesini engelleyen eksik temel.

**Neden Önemli**
Deep link, hem viral kazanım (paylaşılan içerik → o içeriği aç) hem de retention (bildirim → ilgili ekran) için zorunlu altyapı. Olmadan paylaşım ve push'un büyüme/dönüş etkisi yarıda kalıyor.

**Kullanıcıya Etkisi**
Paylaşılan bağlantı en iyi ihtimalle ana ekrana düşer (içeriğe değil); push bildirimi tıklanınca bağlam kaybolur → dönüşüm düşer.

**Çözüm**
`app.json`'a `scheme: "concertly"` + universal/app links ekle; `expo-linking` ile `NavigationContainer`'a `linking` config tanımla (Event/Artist/Post/Passport rotalarını eşle). Paylaşım ve push bu rotaları kullanır.

**Tahmini Efor:** 3 gün

---

# Yeni Bulunan Kritik Problemler
- **9.1** 🔴 Paylaşımlar linksiz → organik kazanım kanalı tamamen ölü (K-faktörü ~0).

# Hızlı Kazanımlar
- **9.1** Tüm paylaşım metinlerine indirme linki ekle (30 dk).
- **9.2** Profil/boş-durumlara "Davet et" butonu (2 saat).

# Yüksek Etki / Düşük Efor Görevleri
1. **9.1** Paylaşımlara link (30 dk — anında organik kazanım açar).
2. **9.2** Davet butonu (2 saat).
3. **9.3** Deep linking altyapısı (3 gün — paylaşım + push'un ortak temeli).

# Bir Sonraki En Mantıklı Görev
**Bulgu 9.1 — Paylaşım metinlerine indirme linki ekle.** 30 dk, iki dosya (PostCard + Passport), risksiz; ölü paylaşım butonlarını anında bir kazanım kanalına çevirir. Hemen ardından 9.2 (davet) ve stratejik olarak 9.3 (deep link) gelir.

---

## TUR 10 — TECHNICAL DEBT AUDIT

> **Önce olumlu (güvenlik):** Kimlik sunucu-taraflı türetiliyor — like/follow/yorum uçları client'ın `?userId=` parametresini **yok sayıp** `JwtUtil.getCurrentUserId()` kullanıyor (21 controller). Korkulan IDOR/kimlik sahteleme yok. (Mobildeki `?userId=` parametreleri artık ölü/gereksiz; temizlik işi, güvenlik açığı değil.)

### Bulgu 10.1 — ✅ KOD TARAFI UYGULANDI (15 Haz) — Gizli anahtarlar repoya gömülü
> `application.properties` takipten çıkarıldı (`git rm --cached`; .gitignore zaten kapsıyordu, dosya diskte duruyor). Placeholder'lı `application.properties.example` eklendi (show-sql=false dahil). **KALAN — sadece Emre yapabilir:** anahtarlar git geçmişinde olduğu için Spotify/Ticketmaster panelinden YENİ anahtar üret (rotate), JWT secret'ı değiştir, DB şifresini güncelle. Geçmişten tamamen silmek istersen `git filter-repo`/BFG gerekir.

**Problem**
`application.properties` env değişkeni yoksa devreye giren **çalışır defaultlar** içeriyor: `jwt.secret` ("...change-in-production..."), Spotify client id/secret, Ticketmaster API key, DB şifresi — hepsi git'e commit'li ve anahtarlar gerçek görünüyor. Prod'da env set edilmezse JWT default secret ile token'lar taklit edilebilir (tüm hesaplar tehlikeye girer).

**Neden Önemli**
Repoya erişen herkes canlı API anahtarlarını ele geçirir (Spotify/Ticketmaster kotası kötüye kullanılabilir/iptal edilir). Default JWT secret prod'a sızarsa kimlik doğrulamanın tamamı çöker — kritik güvenlik açığı.

**Kullanıcıya Etkisi**
Hesap ele geçirme riski; üçüncü-parti entegrasyonların (sanatçı/etkinlik verisi) anahtar iptaliyle çökmesi.

**Çözüm**
Anahtarları repodan çıkar, gerçek değerleri rotate et, yalnızca env/secret manager'dan oku (default verme veya açıkça "boşsa başlatma" yap). `application.properties`'i örnek (`.example`) haline getir, gerçeğini `.gitignore`'a al.

**Tahmini Efor:** 2 saat (rotasyon + env)

---

### Bulgu 10.2 — Feed/etkinlik uçlarında sayfalama yok → veri büyüdükçe ölçeklenmez

**Problem**
`/posts/feed/trending`, `/posts/feed/following` ve `/events` tüm listeyi tek seferde dönüyor (HomeScreen yorumu etkinlik listesinin ≈1MB olduğunu not ediyor; Home `limit=40` ile sınırlıyor ama Feed hiç sınırlamıyor). Sayfalama/sonsuz kaydırma yok. Ayrıca prod'da `spring.jpa.show-sql=true` (her sorguyu loglar) ve `ddl-auto=update` (şema otomatik mutasyonu, migration aracı yok).

**Neden Önemli**
Veri/kullanıcı arttıkça payload ve sunucu belleği doğrusal şişer; mobilde liste render'ı ağırlaşır, açılış yavaşlar. `ddl-auto=update` prod veri bütünlüğü için riskli; `show-sql` gereksiz I/O ve log gürültüsü.

**Kullanıcıya Etkisi**
Büyüdükçe yavaşlayan feed/keşif; ileride ani performans duvarı.

**Çözüm**
Feed/event uçlarına `page`+`size` (Spring `Pageable`) ekle, mobilde `onEndReached` ile sayfalı yükle. Prod profilinde `show-sql=false`; orta vadede Flyway/Liquibase ile `ddl-auto=validate`'e geç.

**Tahmini Efor:** 1 gün (sayfalama) + 30 dk (prod ayarları)

### Bulgu 10.3 — Polling tabanlı "gerçek zamanlı" katman QPS tavanına çarpar

**Problem**
Chat 4 sn, bildirim sayacı 20 sn, okunmamış mesaj 15 sn'de bir poll ediyor. Her aktif istemci, çoğu boş dönen sabit bir istek akışı üretiyor. N kullanıcıda bu, sürekli yüksek ve büyük ölçüde israf olan bir QPS demek — üstelik hâlâ gerçek-zamanlı değil.

**Neden Önemli**
Kullanıcı sayısı arttıkça sunucu yükü kullanıcı başına sabit poll'larla doğrusal büyür; maliyet ve gecikme tavanı. (Planlanan WebSocket sprinti bunu çözer.)

**Kullanıcıya Etkisi**
Ölçekte gecikmeli mesaj/bildirim ve yüksek altyapı maliyeti.

**Çözüm**
Kısa vade: poll aralıklarını ekran görünürlüğüne göre uyarla, sayaç poll'unu tek uçta birleştir. Orta vade: planlanan WebSocket sprintiyle push/realtime'a geç (5.1 push teslimatıyla aynı altyapı ailesi).

**Tahmini Efor:** 1 hafta (WebSocket) / kısa vade ayarlama 2 saat

---

# Yeni Bulunan Kritik Problemler
- **10.1** 🔴 Gerçek gizli anahtarlar repoda + default JWT secret → hesap ele geçirme / anahtar sızması riski.

# Hızlı Kazanımlar
- **10.1** Anahtarları env'e taşı + rotate (2 saat).
- **10.2** Prod'da `show-sql=false` (30 dk).

# Yüksek Etki / Düşük Efor Görevleri
1. **10.1** Secret rotasyonu + env (2 saat — güvenlik).
2. **10.2** Feed sayfalama (1 gün — ölçeklenebilirlik).

# Bir Sonraki En Mantıklı Görev
**Bulgu 10.1 — Gizli anahtarları rotate et + env'e taşı.** 2 saat, güvenlik kritik, yayın öncesi zorunlu. 6.1 (moderasyon) ile birlikte "mağazaya çıkış" blokerleri kümesini oluşturur.

---

# 🏁 NİHAİ ÖZET — 10 Turun Önceliklendirilmiş Çıktısı

**Kapsam:** 10 tur, 26 bulgu. Aşağıda etki/efor ve bağımlılığa göre dört dalga halinde sıralandı. Amaç: yüzlerce öneri değil, ürünü gerçekten ilerletecek sıra.

## Concertly'nin tek cümlelik teşhisi
Ürün **özellik açısından zengin ama döngüleri kapalı**: keşif, içerik üretimi, retention ve büyüme için altyapı büyük ölçüde kurulu — ancak son-metre bağlantılar eksik olduğu için değer kullanıcıya akmıyor (post konuma kilitli, push teslimatı yok, paylaşımlar linksiz, oyunlar profile bağlı değil, şehir hiç sorulmuyor).

## DALGA 1 — Hızlı Kazanımlar (toplam ~1 gün, hepsi bugün yapılabilir)
| Bulgu | İş | Efor | Neden ilk |
|---|---|---|---|
| 4.2 | Home'daki zorunlu 600ms gecikmeyi kaldır | 30 dk | En sık ekran anında hızlanır |
| 9.1 | Paylaşım metinlerine indirme linki ekle | 30 dk | Ölü paylaşımı kazanım kanalı yapar |
| 5.3 | Streak widget'ına kayıp-kaçınma kopyası | 30 dk | Günlük dönüş dürtüsü |
| 1.2 | Daily Song widget'ını etkinliklerin altına al | 30 dk | İlk-izlenim/konumlandırma |
| 1.4 | "Yakında" kartlarını menüden kaldır | 30 dk | Ürün "yarım" görünmesin |
| 10.2b | Prod'da `show-sql=false` | 30 dk | Gereksiz I/O |

## DALGA 2 — Yüksek Etki / Orta Efor (çekirdek döngüleri açar, ~1 hafta)
| Bulgu | İş | Efor |
|---|---|---|
| 2.1 | Post konum kilidine "Yine de paylaş" kaçışı | 2 saat |
| 3.1 | Onboarding'e şehir adımı | 2 saat |
| 5.2 | Feed'i 0 takipte trending ile aç | 2 saat |
| 4.1 | Home'a hata+retry state'i (`getErrorMessage`) | 2 saat |
| 7.1 | Artist/Venue parçalı render (`allSettled`) | 2 saat |
| 6.3 | Review'ları katılımcılara sınırla (3 yüzey) | 2 saat |
| 9.2 | Profil/boş-durumlara "Davet et" | 2 saat |
| 10.1 | Gizli anahtar rotasyonu + env | 2 saat |

## DALGA 3 — Yayın Blokerleri (mağazaya çıkış için zorunlu)
| Bulgu | İş | Efor |
|---|---|---|
| 6.1 | Şikayet + engelleme (UGC moderasyonu) | 3 gün |
| 10.1 | (yukarıda) güvenlik | — |

## DALGA 4 — Stratejik Altyapı (sprint düzeyi, en yüksek tavan)
| Bulgu | İş | Efor |
|---|---|---|
| 5.1 | Push teslimatı (expo-notifications + Expo Push) | 1 hafta |
| 9.3 | Deep linking (scheme + linking config) | 3 gün |
| 8.1 | Oyun başarılarını profile/pasaporta bağla | 1 gün |
| 7.2 | Takip edilen sanatçı etkinliklerini Home'da öne al | 1 gün |
| 6.2 | Buddy havuzlarını birleştir | 3 gün |
| 10.3 | Polling → WebSocket | 1 hafta |

## Tek bir öneri seçilecekse
**DALGA 1'i bugün bitir (~3 saatlik 6 küçük iş), sonra 2.1 + 3.1 + 5.2'yi yap.** Bu üç orta-efor iş, ürünün üç temel döngüsünü (içerik üretimi, keşif aktivasyonu, sosyal akış) ilk kez uçtan uca çalışır hale getirir — yeni hiçbir özellik eklemeden.
