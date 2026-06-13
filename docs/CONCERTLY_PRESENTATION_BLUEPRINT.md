# CONCERTLY — Sunum Blueprint
## Canva / Figma'da Doğrudan Uygulanabilir Tasarım Rehberi

**Format:** 16:9 yatay · 1920×1080 px  
**Toplam slayt:** 12  
**Tahmini süre:** 14–18 dakika  
**Tasarım ruhu:** Apple Keynote sadeliği + Airbnb duygusallığı + Spotify Wrapped renk enerjisi

---

## GLOBAL TASARIM SİSTEMİ

### Renk Paleti
```
Arka plan (primary)   #0D0D1A   ← Tüm slaytlarda zemin
Arka plan (surface)   #1A1A2E   ← Kart ve panel zeminleri
Kırmızı-pembe         #E94560   ← Ana vurgu, CTA, başlık aksanları
Teal-yeşil            #00D4AA   ← İkincil vurgu, pozitif mesajlar
Mor                   #7C3AED   ← Üçüncül vurgu, gradient partner
Turuncu               #F5A623   ← Uyarı, rozet, dikkat çekme
Metin (beyaz)         #FFFFFF   ← Tüm başlıklar
Metin (soluk)         #8B8BA0   ← Alt başlık, açıklama
Gradient 1            #E94560 → #7C3AED  (kırmızı-mor)
Gradient 2            #7C3AED → #00D4AA  (mor-teal)
Gradient 3            #F5A623 → #E94560  (turuncu-kırmızı)
```

### Tipografi
```
Başlık (H1)    Inter ExtraBold / Poppins Black · 64–80px · #FFFFFF
Başlık (H2)    Inter Bold · 40–52px · #FFFFFF
Alt başlık     Inter Medium · 24–32px · #8B8BA0
Vurgu metni    Inter Bold · 28–36px · gradient veya #E94560
Küçük not      Inter Regular · 18–22px · #8B8BA0
```

### Telefon Mockup Kuralı
- Her mockup: **iPhone 15 Pro çerçevesi** (siyah, köşeleri yuvarlak)
- Ekran görüntüleri bu çerçeveye oturtularak kullanılır
- "Kod Tarayıcı" ve saat/batarya çubuğu **kırpılır veya karartılır**
- Mockup gölgesi: `box-shadow: 0 40px 80px rgba(0,0,0,0.6)`
- Canva'da: Elements → Frames → Phone frame

### Layout Kuralı
- Sol kenar boşluğu: 80px minimum
- Güvenli alan (metin): slayt genişliğinin %60'ı geçmez
- Telefon mockupları slaytın %60–70'ini kaplayabilir

---

## SLAYT 1 — KAPAK

### Amaç
İlk izlenimi belirlemek. Bir cümleyle platform ruhunu vermek.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                    ┌──────────┐ │
│  CONCERTLY                         │          │ │
│                                    │  [LOGIN  │ │
│  Müziği birlikte yaşa.             │  SCREEN  │ │
│                                    │  MOCKUP] │ │
│  ── ── ── ──                       │          │ │
│                                    └──────────┘ │
│  Mobil · Türkiye · 2026                         │
└─────────────────────────────────────────────────┘
  40% metin bloğu          60% görsel alan
```

### Slaytta Görünen Metinler
- **CONCERTLY** · 80px · ExtraBold · #FFFFFF
- *Müziği birlikte yaşa.* · 32px · Medium · #8B8BA0
- Küçük ayırıcı çizgi · 2px · #E94560 · 60px genişlik
- `Mobil · Türkiye · 2026` · 18px · Regular · #8B8BA0

### Kullanılacak Ekran
**`11.15.41` — Login Screen**
Güçlü tercih nedeni: Logo büyük ve net, gradient buton çarpıcı, arka plan sunumla tam uyumlu. Saat çubuğundaki "59%" batarya küçük ama kırpılabilir.

### Arka Plan Tasarımı
Sol yarıda: `#0D0D1A` düz siyah  
Sol alt köşede: `#E94560` ile çok hafif radial glow (opacity %15)  
Sağ yarıda: telefon mockupu zemine hafif gölge ile yerleşir

### Konuşmacı Notu
> "Müziği seviyoruz. Ama onu nasıl yaşadığımız, nerede sakladığımız ve kiminle paylaştığımız hâlâ çözülmemiş. Concertly bu sorudan doğdu."

---

## SLAYT 2 — İNSAN GEREKÇESİ

### Amaç
Duygusal zemin kurmak. Teknik bir konuşma öncesi insanı merkeze almak. İzleyiciyi "ben de böyle hissettim" dedirtmek.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│        [TAM EKRAN KONSER KALABALIĞİ             │
│         FOTOĞRAFI — KOYU OVERLAY ile]           │
│                                                 │
│                                                 │
│    İnsanlar neden konsere gider?                │
│                                                 │
│    Müzik için değil.                            │
│    O an için.                                   │
│                                                 │
└─────────────────────────────────────────────────┘
         Tam ekran görsel · Metin altta ortada
```

### Slaytta Görünen Metinler
- *İnsanlar neden konsere gider?* · 28px · Regular · #8B8BA0
- **Müzik için değil.** · 72px · ExtraBold · #FFFFFF
- **O an için.** · 72px · ExtraBold · #E94560

### Kullanılacak Görsel
**Feed ekranındaki konser fotoğrafı (`11.04.58 (2)`)** — @x'in paylaşımındaki sahne fotoğrafı (sanatçı sahnede, arka ışık dramatik). Fotoğrafı kırpın, tam arka plan yapın, üzerine `rgba(13,13,26,0.65)` overlay uygulayın. Fotoğraf ham halde yeterince güçlü.

**Alternatif:** Unsplash'tan "concert crowd dark stage" — lisanssız kullanım için.

### Tasarım Detayı
Metin bloğu dikey olarak slaytın alt üçte birinde, yatay ortada.  
İki satır arasında 16px boşluk.  
"O an için." satırının altında: ince kırmızı yatay çizgi, 80px, ortalı.

### Konuşmacı Notu
> "Spotify'da her şarkıyı dinleyebilirsiniz. Ama yine de konsere gidersiniz. Çünkü konser, müziği dinlemek için değil — onu yaşamak, hissetmek, birileriyle aynı anda aynı şeyi yaşamak için gidilen bir yerdir. Bu ayrım, Concertly'nin tüm tasarımının temelidir."

---

## SLAYT 3 — PROBLEM

### Amaç
Bugünün kırık deneyimini somut ve tanıdık biçimde göstermek. İzleyicinin "evet, bunu yaşıyorum" demesini sağlamak.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│  Bugün bir konser planlamak için...             │
│                                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──┐ │
│  │Bilet │→ │ Insta│→ │Whtsp │→ │Takv. │→ │24│ │
│  │  ix  │  │      │  │      │  │      │  │sa│ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──┘ │
│                                           kayıp │
│                                                 │
│         5 platform · 1 deneyim · 0 iz           │
└─────────────────────────────────────────────────┘
```

### Slaytta Görünen Metinler
- *Bugün bir konser planlamak için...* · 28px · Regular · #8B8BA0
- Beş ikon bloğu: Biletix → Instagram → WhatsApp → Takvim → 🕐 (24s)
- Her ikonun altında tek kelime etiket · 16px · #8B8BA0
- Oklar arasında: `→` · #E94560
- Alt büyük metin: **5 platform · 1 deneyim · 0 iz** · 52px · ExtraBold
  - "0 iz" kısmı #E94560 renk

### Kullanılacak Görsel
**Ekran görüntüsü yok** — bu slayt tamamen infografik.  
İkon önerileri (Canva'da hazır):
- Biletix yerine genel "bilet" ikonu
- Instagram için camera/grid ikonu  
- WhatsApp için mesaj balonu
- Takvim için calendar ikonu
- Son kutu: kırmızı saat ikonu + "24s" metni, soluklaşıyor

Her ikon kartı: `#1A1A2E` zemin, `#2A2A3E` border, 120×120px, rounded 16px.

### Konuşmacı Notu
> "Şu an bir konser planlamak istesen kaç uygulamayı açman gerekir? Biletix, Instagram, WhatsApp, takvim... Ve o gece bittikten sonra? Instagram hikayesi 24 saatte siliniyor. O deneyimin dijital hiçbir kalıcı izi kalmıyor. Bu bir teknoloji sorunu değil — bir anlam sorunudur."

---

## SLAYT 4 — VİZYON

### Amaç
Geçiş anı. Concertly'nin ne olduğunu tek cümleyle, hiç görsel gürültü olmadan yerleştirmek. Apple Keynote "one more thing" enerjisi.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│                                                 │
│         Keşfet.  Birlikte yaşa.  Biriktir.     │
│                                                 │
│                    ────                         │
│                                                 │
│        Canlı müzik deneyiminin                 │
│        dijital katmanı.                         │
│                                                 │
│                                                 │
└─────────────────────────────────────────────────┘
              Tam ekran · Siyah zemin · Ortalı
```

### Slaytta Görünen Metinler
- **Keşfet. · Birlikte yaşa. · Biriktir.** · 42px · Bold
  - "Keşfet." → `#00D4AA`
  - "Birlikte yaşa." → `#E94560`  
  - "Biriktir." → `#7C3AED`
- Yatay ayırıcı: 80px · 2px · `#2A2A3E`
- **Canlı müzik deneyiminin** · 56px · ExtraBold · #FFFFFF
- **dijital katmanı.** · 56px · ExtraBold · gradient `#E94560 → #7C3AED`

### Kullanılacak Görsel
**Ekran görüntüsü yok.** Tam siyah arka plan `#0D0D1A`.  
Sol alt köşede çok hafif: `#E94560` radial glow · opacity %8  
Sağ üst köşede: `#7C3AED` radial glow · opacity %8

### Konuşmacı Notu
> "Concertly bir etkinlik uygulaması değil. Bir bilet platformu değil. Bir sosyal ağ değil. Canlı müzik deneyiminin dijital katmanını inşa ediyoruz. Bu üç kelime her şeyi özetliyor: keşfet, birlikte yaşa, biriktir."

Bu slayta 10 saniye verin. Sessizlik güçlü.

---

## SLAYT 5 — ÜRÜN: ANA EKRAN

### Amaç
Platformu ilk kez göstermek. "Bu nasıl görünüyor?" sorusunu yanıtlamak. Ana ekranın tasarım kalitesini öne çıkarmak.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                      ┌─────────────────────────┐│
│  Şehrine göre        │                         ││
│  etkinlikler.        │   [HOME SCREEN MOCKUP]  ││
│                      │                         ││
│  Tür filtrele.       │   Ana ekran tam         ││
│  Arkadaşların        │   boy · sağ hizalı      ││
│  planlarını gör.     │                         ││
│                      └─────────────────────────┘│
│  99 etkinlik ·                                  │
│  Tek platform.                                  │
└─────────────────────────────────────────────────┘
  35% metin                65% mockup
```

### Slaytta Görünen Metinler
- **Şehrine göre etkinlikler.** · 40px · Bold · #FFFFFF
- *Tür filtrele. Arkadaşların planlarını gör.* · 22px · Regular · #8B8BA0
- Alt istatistik: **99 etkinlik · Tek platform.** · 32px · ExtraBold · #E94560

### Kullanılacak Ekran
**`11.04.56` — Home Screen**  
Bu ekranın neden güçlü olduğu:
- "Maymun Collective" featured kartının görseli dramatik ve dikkat çekici
- Kategori filtreleri (Tümü, Konser, Festival) profesyonel görünüyor
- "Öne Çıkanlar" ve "Yaklaşan Etkinlikler" hiyerarşisi çok net
- Koyu tema sunum arka planıyla mükemmel uyumlu

**Kırpma talimatı:** Status bar'ı (saat, batarya, "Kod Tarayıcı") mockup çerçevesinin içinde gizleyin.

### Konuşmacı Notu
> "Kullanıcı uygulamayı açtığında şehrini görüyor, türünü seçiyor, öne çıkan etkinlikleri görüyor. Arkadaşlarının hangi etkinliklere gittiğini görebiliyor. Bilet linkine tek tıkla ulaşıyor. Bu, kullanıcının bugün 5 uygulamada yaptığı şeyin tek bir ekranda karşılığı."

---

## SLAYT 6 — CONCERT BUDDY

### Amaç
Platformun en özgün özelliğini bağımsız bir slayta taşımak. "Yalnız gitme" sorununu tek ekranla çözmek.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Yalnız                ┌──────────────────┐   │
│   gitme.                │                  │   │
│                         │  [CONCERT BUDDY  │   │
│                         │   SCREEN MOCKUP] │   │
│   Müzik zevkin seni     │                  │   │
│   doğru insana          │  Tam boy         │   │
│   götürür.              │  sağ taraf       │   │
│                         └──────────────────┘   │
│   Dünyada bir ilk.                             │
└─────────────────────────────────────────────────┘
```

### Slaytta Görünen Metinler
- **Yalnız** · 80px · ExtraBold · #FFFFFF
- **gitme.** · 80px · ExtraBold · #E94560
- Küçük ayırıcı çizgi · 2px · #E94560 · 60px
- *Müzik zevkin seni doğru insana götürür.* · 24px · Regular · #8B8BA0
- Küçük badge: `DÜNYADA BİR İLK` · 14px · Bold · #00D4AA · `#00D4AA20` zemin · rounded

### Kullanılacak Ekran
**`11.04.57 (2)` — Concert Buddy Screen**  
Neden güçlü:
- @mert_indie kartı gerçekçi görünüyor (gerçek bir kullanıcı gibi)
- "Farklı tatlar" uyumluluk badge'i anında anlaşılıyor
- "Ortak Konserler: Mor ve Ötesi Akustik Gece" — somut, inandırıcı
- "Geç" ve "Birlikte Git" butonları özelliği açıklıyor
- Indie + Alternatif Rock etiketleri renkli ve görsel

**Kırpma talimatı:** Başlık barındaki "← Geri" ve "Konser Arkadaşı" yazısı mockup çerçevesi içinde kalabilir — gerçeklik hissi veriyor.

### Ek Tasarım Unsuru
Sol metni sol tarafta aşağı yukarı ortalarken, sağdaki telefon mockupunun solundan hafif bir glow efekti ekleyin:
`radial-gradient(#E94560, transparent)` · opacity %20 · telefonun sol kenarından yayılan

### Konuşmacı Notu
> "Konser planlamanın önündeki en büyük engel biliyor musunuz nedir? 'Birlikte gidecek biri yok.' Dünyada bu sorunu doğrudan çözen büyük bir platform yok. Concert Buddy, müzik zevki uyumluluğuna göre sizi aynı etkinliğe gidecek biriyle eşleştiriyor. Kaydırın, eşleşin, birlikte gidin."

---

## SLAYT 7 — CONCERT PASSPORT

### Amaç
Kimlik ve birikim fikrini somutlaştırmak. "Spotify Wrapped" hissini yaratmak. En duygusal slayt bu olmalı.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│  ┌──────────────────┐                           │
│  │                  │   Her konser,             │
│  │  [PASSPORT       │   kalıcı.                 │
│  │   SCREEN         │                           │
│  │   MOCKUP]        │   Kimin gittiğin          │
│  │                  │   kim olduğunu anlatır.   │
│  │  Tam boy         │                           │
│  │  sol taraf       │   🎟  2  Konser           │
│  │                  │   🎤  2  Sanatçı          │
│  └──────────────────┘   📍  2  Şehir            │
│                                                 │
└─────────────────────────────────────────────────┘
    65% mockup              35% metin
```

### Slaytta Görünen Metinler
- **Her konser,** · 56px · ExtraBold · #FFFFFF
- **kalıcı.** · 56px · ExtraBold · gradient `#7C3AED → #00D4AA`
- *Kimin gittiğin kim olduğunu anlatır.* · 22px · Regular · #8B8BA0
- Üç istatistik ikonu (emojili) · 24px · Bold · #FFFFFF

### Kullanılacak Ekran
**`11.04.56 (2)` — Concert Passport Screen**  
Neden en güçlü ekran:
- Mor-pembe-teal gradient kart başı görsel olarak çarpıcı
- 2 Konser / 0 Doğrulanmış / 2 Sanatçı / 2 Şehir istatistikleri net
- Yıl bazlı liste (2026 - 2 konser) kronolojik anlatı hissi veriyor
- Bengü Beker fotoğrafı gerçek bir sanatçı — inandırıcılık katıyor
- "Paylaş ↑" butonu sağ üstte — paylaşım özelliği görünür

**Önemli not:** "0 Doğrulanmış" değeri zayıf görünüyor. Sunum için bu ekranı ya gerçek doğrulanmış kayıtlarla güncelleyin ya da bu istatistiği cropping ile gizleyin.

### Ek Tasarım Unsuru
Sağ taraf metin bloğunun arka planına çok hafif bir `#7C3AED` glow ekleyin — Passport ekranının gradient rengiyle uyum.

### Konuşmacı Notu
> "Bir müzisyenin diskografisi onun kim olduğunu anlatır. Concert Passport, bir dinleyicinin kim olduğunu anlatır. Kaç konser, kaç sanatçı, kaç şehir — ve bunların hepsi doğrulanabilir. Bu, dijital dünyada ilk kez müzik kimliğinin gerçek bir arşive dönüştüğü an."

---

## SLAYT 8 — ETKİNLİK KEŞFİ + HARİTA

### Amaç
Platformun ölçeğini göstermek. "Bu sadece birkaç etkinlik değil" mesajını vermek. Görsel çarpıcılık.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   ┌─────────────┐        ┌─────────────────┐   │
│   │             │        │                 │   │
│   │  [ETKİNLİK  │        │  [TÜRKİYE       │   │
│   │   GRID      │        │   HARİTA        │   │
│   │   MOCKUP]   │        │   MOCKUP]       │   │
│   │             │        │                 │   │
│   └─────────────┘        └─────────────────┘   │
│         ↑                        ↑              │
│      Etkinlikler              986 etkinlik      │
│                                                 │
└─────────────────────────────────────────────────┘
     İki mockup yan yana · Alt etiketler
```

### Slaytta Görünen Metinler
- Slayt başlığı yok — görseller konuşuyor
- Sol altında: **Etkinlikler** · 22px · Bold · #8B8BA0
- Sağ altında: **986 etkinlik** · 22px · Bold · #E94560 + *· Türkiye geneli* · #8B8BA0
- En altta ortada: **Biletinden haritasına, tek platform.** · 32px · ExtraBold · #FFFFFF

### Kullanılacak Ekranlar
**Sol mockup:** `11.04.58 (1)` — Etkinlikler grid (Leman Sam, Koray Avcı, Paradise Lost, Sibel Can fotoğrafları çok güçlü, ızgara düzeni profesyonel)

**Sağ mockup:** `11.04.57 (3)` — Türkiye haritası (986 etkinlik pinleri büyük etki yaratıyor, ülke ölçeğini hissettiriyor)

İki telefon mockupu hafifçe birbirine doğru eğdirilmiş (`rotate: -3deg` sol, `+3deg` sağ) — dinamik görünüm.

### Konuşmacı Notu
> "Platform bugün 986 etkinliği takip ediyor. İstanbul'dan Ankara'ya, Antalya'dan Bursa'ya. Etkinlikler ızgara görünümde, sanatçı fotoğraflarıyla, tarih ve tür etiketleriyle. Haritada konumunuza göre filtreleyebiliyorsunuz. Bu içeriğin bir kısmı Ticketmaster'dan otomatik geliyor, bir kısmı kullanıcı ekleme."

---

## SLAYT 9 — TOPLULUK VE KİMLİK

### Amaç
Platformun sosyal boyutunu göstermek. Üç ekranı birlikte "müzik kimliği" hikayesi olarak sunmak.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Müzik                                         │
│  kimliğin.          ┌────┐  ┌────┐  ┌────┐    │
│                     │MÜZ │  │TOP │  │ROZ │    │
│                     │İK  │  │LUL │  │ET  │    │
│  Türler.            │PRF │  │LAR │  │LER │    │
│  Sanatçılar.        │    │  │    │  │    │    │
│  Topluluklar.       └────┘  └────┘  └────┘    │
│  Rozetler.            ↑       ↑       ↑        │
│                    Profil  Topluluk  Başarı    │
│                                                 │
└─────────────────────────────────────────────────┘
  30% metin sol          70% üç küçük mockup sağ
```

### Slaytta Görünen Metinler
- **Müzik kimliğin.** · 52px · ExtraBold · gradient `#E94560 → #7C3AED`
- *Türler. Sanatçılar. Topluluklar. Rozetler.* · 24px · Regular · #8B8BA0 (her kelime alt satırda)
- Her mockup altında: küçük etiket · 16px · #8B8BA0

### Kullanılacak Ekranlar
**Sol mockup (küçük):** `11.04.56 (3)` — Müzik Profili (mor-kırmızı gradient header çok güçlü, "Techno / Classical / Lo-fi" türler, Hande Yener vb. sanatçılar görünür)

**Orta mockup (küçük):** `11.04.57` — Topluluklar (Caz Severler, Elektronik Gece, Istanbul Rock Sahne kartları, "Canlı" badge güzel)

**Sağ mockup (küçük):** `11.04.56 (1)` — Rozet grid (İlk Konser, Konser Kurdu, Festival Sezonu kartları görsel ve anlaşılır, progress bar "Efsane Seyirci 12/25" gamification hissini veriyor)

Üç mockup normalize edilmiş boyutta (`%28 genişlik`), hafif üst üste bindirilmiş fan düzeni.

### Konuşmacı Notu
> "Platform yalnızca etkinlik listesi değil. Müzik profili, favori türler, takip ettiğin sanatçılar — bunlar kim olduğunuzu anlatıyor. Tür bazlı topluluklar ortak zevkli insanları bir araya getiriyor. Rozetler, katılımı oyun haline getiriyor — ilk konser, beş konser, yirmi beş konser. Bu, müzik kimliğinin dijital yansıması."

---

## SLAYT 10 — REKABET POZİSYONU

### Amaç
"Rakipler yok mu?" sorusunu dürüst ve özgüvenli yanıtlamak. Farkı görsel olarak kanıtlamak.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│  Nerede duruyoruz?                              │
│                                                 │
│         YÜKSEK SOSYAL                           │
│              │                                  │
│    Concertly ★         ← Boş alan              │
│              │                                  │
│  ────────────┼────────────                     │
│  DÜŞÜK ETK.  │              YÜKSEK ETK.         │
│   Instagram  │  Songkick                        │
│   WhatsApp   │  Biletix                         │
│              │                                  │
│         DÜŞÜK SOSYAL                            │
│                                     ┌─────────┐ │
│                          Türkiye'de │  RAKIP  │ │
│                          bu nişi   │   YOK   │ │
│                          dolduran  └─────────┘ │
└─────────────────────────────────────────────────┘
```

### Slaytta Görünen Metinler
- *Nerede duruyoruz?* · 28px · Regular · #8B8BA0
- Eksen etiketleri · 16px · #8B8BA0
- **Concertly** · büyük yıldız · #E94560
- Rakip isimler · küçük gri noktalar · #4A4A6A
- Badge: **Türkiye'de rakip yok** · #00D4AA zemin · koyu metin

### Kullanılacak Görsel
**Ekran görüntüsü yok** — tamamen grafik slayt.

Matris tasarımı:
- Arka plan: `#0D0D1A`
- Eksen çizgileri: `#2A2A3E` · 1px
- Concertly yıldızı: 32px · `#E94560` · halo efekti `rgba(233,69,96,0.3)` · 64px
- Rakip noktalar: 12px · `#4A4A6A`
- "Türkiye'de rakip yok" badge: sağ üst köşe · `#00D4AA` · bold

### Konuşmacı Notu
> "Songkick ve Bandsintown var. Ama Türkiye'de, Türkçe içerikle çalışmıyorlar. Instagram var ama canlı müzik odaklı değil. Biletix var ama sosyal boyutu yok. Bu matriste yüksek sosyal boyut ve yüksek etkinlik odağının kesiştiği alan — boş. Concertly oraya konumlanıyor."

---

## SLAYT 11 — YOL HARİTASI

### Amaç
Büyümenin aşamalı ve gerçekçi olduğunu göstermek. "Nereye gidiyorsunuz?" sorusunu yanıtlamak.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│  Nereden nereye?                                │
│                                                 │
│  ●━━━━━━━━━━━●━━━━━━━━━━━●━━━━━━━━━━━●         │
│  FAZ 1       FAZ 2       FAZ 3       FAZ 4      │
│  0–3 Ay      3–6 Ay      6–12 Ay    12–24 Ay   │
│                                                 │
│  Stabilizasyon  İçerik   Ölçeklenme  Ekosistem │
│                                                 │
│  · Mesajlaşma  · Organiz. · Backend  · Bilet    │
│  · Bildirimler · Canlı   · ML öneri  · Premium  │
│  · Güvenlik      Odalar  · Yeni şeh. · Dash.    │
│                                                 │
│           Önce derinlik. Sonra genişlik.         │
└─────────────────────────────────────────────────┘
```

### Slaytta Görünen Metinler
- *Nereden nereye?* · 28px · Regular · #8B8BA0
- **FAZ 1–4** · 18px · ExtraBold · renk sırayla: `#00D4AA` `#7C3AED` `#E94560` `#F5A623`
- Zaman etiketleri · 14px · #8B8BA0
- Ana başlıklar (Stabilizasyon vs.) · 20px · Bold · #FFFFFF
- Madde işaretleri · 14px · #8B8BA0
- **Önce derinlik. Sonra genişlik.** · 28px · ExtraBold · #FFFFFF

### Kullanılacak Görsel
**Ekran görüntüsü yok** — tamamen infografik.

Timeline tasarımı:
- Yatay çizgi: `#2A2A3E` · 2px
- Her faz düğümü: 16px daire, faza özgü renk
- Aktif faz (Faz 1): daire + dış halo ring `opacity: 0.3`
- Faz kartları: `#1A1A2E` zemin · rounded 12px · 1px border `#2A2A3E`

### Konuşmacı Notu
> "Dört fazda büyüyoruz. İlk üç ayda açık riskleri kapatıyoruz — platform içi mesajlaşma, bildirimler, güvenlik. Üç ila altı ayda içerik sorununu çözüyoruz — organizatör hesabı, yerel etkinlik ekleme. Sonra altyapı, sonra ekosistem. Tek ilkemiz var: önce tek bir şehirde kritik kitleye ulaş, sonra genişle."

---

## SLAYT 12 — KAPANIŞ

### Amaç
Teknik olmayan, duygusal, hatırda kalan bir kapanış. Son cümle tek başına akılda kalmalı.

### Yerleşim
```
┌─────────────────────────────────────────────────┐
│                                                 │
│   [TAM EKRAN TÜRKİYE HARİTASI — OVERLAY ile]   │
│                                                 │
│         ──────────────────────────              │
│                                                 │
│         Spotify müziği nasıl                    │
│         dinlediğimizi değiştirdi.               │
│                                                 │
│         Concertly, müziği nasıl                 │
│         yaşadığımızı değiştirmeye aday.         │
│                                                 │
│         ──────────────────────────              │
│                                                 │
│              CONCERTLY                          │
│         Müziği birlikte yaşa.                   │
└─────────────────────────────────────────────────┘
             Tam ekran görsel · Overlay · Ortalı metin
```

### Slaytta Görünen Metinler
- İki satır karşılaştırma:
  - *Spotify müziği nasıl dinlediğimizi değiştirdi.* · 32px · Regular · #8B8BA0
  - **Concertly, müziği nasıl yaşadığımızı değiştirmeye aday.** · 40px · ExtraBold · #FFFFFF
- Ayırıcı çizgi: `#E94560` · 2px · 120px genişlik
- **CONCERTLY** · 52px · ExtraBold · gradient `#E94560 → #7C3AED`
- *Müziği birlikte yaşa.* · 24px · Regular · #8B8BA0

### Kullanılacak Ekran
**`11.04.57 (3)` — Türkiye haritası (zoom-out görünümü)**  
Üzerine `rgba(13,13,26,0.72)` koyu overlay.  
Haritanın üzerinde hâlâ 986 pin noktacığı seçilebilir görünür — bu ölçek hissi güçlü bir kapanış görseli.

**Alternatif:** Slayt 2'deki konser fotoğrafını tekrar kullanın — anlatısal bir "daire tamamlandı" hissi verir.

### Konuşmacı Notu
> "Concertly'nin özünde şu yatıyor: Milyonlarca insan her yıl konserlere gidiyor. Bu insanlar o deneyimi neden biriktiremiyor, neden doğru insanlarla buluşamıyor, neden dijital dünya bu deneyimi görmezden geliyor? Biz bu soruyu soruyoruz. Ve cevabı inşa ediyoruz. Teşekkürler."

Son cümle bittikten sonra konuşmayı kesin. Soru bekliyoruz deyin — özür diler gibi değil.

---

---

# EKRAN DEĞERLENDİRMESİ

## ✅ SUNUM İÇİN HAZIR (Doğrudan kullanılabilir)

| Ekran | Dosya | Neden Güçlü | Hangi Slayt |
|-------|-------|-------------|-------------|
| **Login** | 11.15.41 | Logo net, gradient buton çarpıcı, tema uyumlu | Slayt 1 |
| **Home Screen** | 11.04.56 | Featured kart, kategori filtresi, koyu tema — çok olgun | Slayt 5 |
| **Concert Buddy** | 11.04.57 (2) | Gerçekçi kullanıcı, uyumluluk badge, ortak konser — benzersiz | Slayt 6 |
| **Concert Passport** | 11.04.56 (2) | Gradient header Spotify Wrapped kalitesinde, Bengü Beker fotoğrafı | Slayt 7 |
| **Müzik Profili** | 11.04.56 (3) | Mor-kırmızı gradient header, sanatçı grid temiz | Slayt 9 |
| **Etkinlikler Grid** | 11.04.58 (1) | Gerçek sanatçı fotoğrafları, ızgara düzeni profesyonel | Slayt 8 |
| **Türkiye Haritası** | 11.04.57 (3) | 986 etkinlik pini — ölçek hissini veriyor | Slayt 8, 12 |
| **Rozet Grid** | 11.04.56 (1) | Gamification görsel, progress bar, karikatürize ikonlar | Slayt 9 |
| **Topluluklar** | 11.04.57 | Canlı badge, kategori filtreleri, kart düzeni temiz | Slayt 9 |

---

## ⚠️ SUNUM ÖNCESİ DÜZENLENMESİ GEREKEN EKRANLAR

### 1. Profil Ekranı (@x username)
**Sorun:** `@x` kullanıcı adı ve boş profil fotoğrafı test hesabı görünümü veriyor. Jüriye güven sorunu yaratır.  
**Düzeltme:** Gerçek bir kullanıcı adı (@emremusic, @aysekonser gibi) ve bir profil fotoğrafı ekleyin. Mevcut ekranda bu değiştirilebilir düzeyde küçük bir değişiklik.  
**Öncelik:** Yüksek

### 2. Feed Ekranı
**Sorun:** @x test hesabı görünür. "Test Konseri - Ankara" başlığı sahte içerik hissi veriyor.  
**Düzeltme:** @x'in postunu çerçeve dışında bırakın; sadece @elif_konser'in gerçekçi postunu gösterin. Bu post ("Can Bonomo akustik gece, küçük mekanda 200 kişiyle...") çok inandırıcı.  
**Öncelik:** Orta

### 3. Concert Passport — "0 Doğrulanmış"
**Sorun:** Doğrulama özelliğini anlatan slayta "0 Doğrulanmış" içeren pasaport koyulması özelliği zayıf gösteriyor.  
**Düzeltme:** Sunumdan önce gerçek bir etkinliğe GPS doğrulaması yapın ve o ekranı yakalayın. Ya da bu istatistiği kırparak gizleyin.  
**Öncelik:** Yüksek

### 4. Status Bar (tüm ekranlarda)
**Sorun:** "Kod Tarayıcı" etiketi geliştirici modunu açığa çıkarıyor. Profesyonel sunum için uygun değil.  
**Düzeltme:** Tüm ekranları mockup çerçevesine yerleştirirken status bar'ı kırpın ya da Figma'da siyah dikdörtgenle kapatın.  
**Öncelik:** Yüksek · Tüm slaytlar için geçerli

### 5. Ankara Haritası (zoom-in görünümü)
**Sorun:** Türkiye genel haritasına kıyasla daha az etkili. Ölçek hissi zayıf.  
**Düzeltme:** Bu ekranı kullanmayın. Türkiye genel görünümü çok daha güçlü.  
**Öncelik:** Düşük (kullanım dışı bırakabilirsiniz)

### 6. Kayıt Ekranı
**Sorun:** Alt yazı "Festival deneyimini paylaş" — platformun ana tagline'ı "Müziği yaşa, anları paylaş" ile çelişiyor. Marka tutarsızlığı.  
**Düzeltme:** Tagline'ı "Müziği yaşa, anları paylaş" ile değiştirin.  
**Öncelik:** Orta

---

## ❌ SUNUMDA KULLANILMAMASI GEREKENLER

| Ekran | Neden |
|-------|-------|
| **Admin Paneli** | Backend yönetim ekranı, izleyici için anlamsız ve güven zedeleyici |
| **Ankara Haritası (zoom)** | Türkiye haritasının tekrarı ama daha az etkili |
| **Profil (Postlar tab)** | Test hesabı görünümü, "Çıkış Yap" butonu çerçevede görünüyor |

---

## HIZLI ÖNCELIK LİSTESİ (Sunumdan Önce Yapılacaklar)

```
□  1. Status bar'ları tüm ekranlarda maskele / kırp
□  2. @x → gerçek kullanıcı adı ve profil fotoğrafı ekle
□  3. Passport'ta GPS doğrulamalı yeni ekran yakala
□  4. Register ekranında tagline güncelle
□  5. Feed'de yalnızca @elif_konser postunu kullan
□  6. Tüm ekranları iPhone 15 Pro mockup çerçevesine oturt
□  7. Canva'da renk sistemini global stil olarak kaydet
```

---

*Bu blueprint Canva veya Figma'da doğrudan uygulanabilir. Her slayttaki ekran yerleşimi ve koordinat oranları 1920×1080 px format için hesaplanmıştır.*
