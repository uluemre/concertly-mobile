# Concertly Yol Haritası

> Son güncelleme: 12 Haziran 2026

## ✅ Tamamlananlar

- [x] Konsere gideceğim / ilgileniyorum seçenekleri
- [x] Topluluklar
- [x] Giriş sayfası — Concertly logosu ve sloganı vurgulu açılış
- [x] Kayıt sayfası — "Concertly'ye hoş geldin" açılış/kapanış
- [x] Profil düzenlemesi
- [x] Ayarlar (tema değişimi dahil)
- [x] İşlevsel arama (Search)
- [x] Şehir seçeneği (kayıt + profil, içerik şehre göre)
- [x] Harita özelliği
- [x] Slogan (Find it, Feel it, Live it / Don't just listen. Be there / Live louder)
- [x] Demo
- [x] ConcertBuddy (konser arkadaşı eşleşmesi)
- [x] Admin panel
- [x] Şarkı Testi (quiz) — sanatçı seç, 10 şarkıyı süreyle bil, skor tablosu
- [x] Konsere giden arkadaşları görebilme
- [x] Fotoğraflı post + anket postu
- [x] Bilet/rozet ödüllendirme (Konser Pasaportu)
- [x] Post düzenle/sil/paylaş
- [x] Kaydedilenler (Bookmarks)
- [x] Seçilen sanatçının müzik testi
- [x] Spotify bağlantısı (bağlan/kopar + dinlemeye göre öneriler)
- [x] Mesajlaşma (DM) — buddy eşleşmesi sonrası sohbet, ana sayfada Instagram tarzı giriş
- [x] Günün Şarkısı (Heardle) — günlük şarkı tahmini, seri (streak), istatistikler
- [x] Blind Ranking — şarkıları geri dönüşsüz sırala
- [x] Setlist Tahmin Ligi — konser öncesi tahmin, topluluk doğrulamalı puanlama
- [x] Oyun Merkezi — tüm oyunlar tek 🎮 kartı altında, günlük şarkı durum rozeti
- [x] Müzik Kimliğim (Wrapped) — konser geçmişinden kişilik + istatistik kartları
- [x] Oyunlar için demo verisi (seed_games_data.sql)
- [x] TR/EN çoklu dil desteği (tüm ekranlar)

## 📋 Planlananlar

### Sosyal / İçerik
- [ ] Birlikte Müzik / Sesli Odalar *(WebSocket sprinti — aşağıdaki canlı özelliklerle birlikte)*
- [ ] Bugünkü konser paylaşımları sekmesi
- [ ] Hikayeler (Stories)
- [ ] En iyi konserleri profilde sabitleme (story highlights gibi)
- [ ] Pankartını yükle, puanlansın
- [ ] Haftanın şarkısını yorumla
- [ ] Yapay zeka yorum özetleyici

### Keşif / Bilgi
- [ ] Yaklaşan albüm ve yeni şarkılar
- [ ] Sanatçı turne duyuruları
- [ ] Smart Ticket Alerts (fiyat düşüşü bildirimi)
- [ ] Pre-Concert Hype Mode

### Altyapı / Teknik
- [ ] E-posta düzenlemesi
- [ ] Konser doğrulamayı tek seferlik yap, database'e işle (test et)
- [ ] Kaydedilen konser yaklaşınca bildirim
- [ ] Sanatçı profil görsellerini etkinliklere aktar
- [ ] Gideceğin konserleri takvime ekleyen eklenti
- [ ] Apple widgets
- [ ] Konser öncesi "Hangi şarkıyı duymak istiyorsun?" anketi (CreatePost'a seçenek)

### Yayın sonrası (paylaşım gerektirir)
- [ ] Fan Kartı — quiz sonrası paylaşılabilir skor kartı (Instagram Story / TikTok)
- [ ] Düello Sistemi — arkadaşına meydan oku, aynı quizde yarış
- [ ] Günün Şarkısı & Blind Ranking sonuçlarını paylaşma
- [ ] Müzik Uyum Testi — arkadaş/çift zevk karşılaştırması

## 💡 Yeni Fikirler (12 Haziran 2026)

### Pratik / Lojistik
- [ ] **Festival Modu** — çok sahneli festivallerde kişisel program oluşturucu: sanatçılarını seç, çakışmaları gör, kendi saat planını çıkar
- [ ] **Konser Yolculuğu** — aynı konsere gidenlerle araç/yol paylaşımı + buluşma noktası (sadece doğrulanmış kullanıcılar; ConcertBuddy + DM üstüne)

### Nostalji / Retention
- [ ] **Anı Kapsülü** — doğrulanmış konserde 10 sn ses/video kaydet, pasaporta mühürlensin; 1 yıl sonra "o gün bu konserdeydin" bildirimi

### Oyunlaştırma
- [x] ~~Setlist Tahmin Ligi~~ → tamamlandı (13 Haziran 2026)
- [ ] **Canlı Intro Savaşı** — gerçek zamanlı 1v1: şarkı çalar, önce basan puanı alır *(WebSocket — Sesli Odalar sprintiyle birlikte)*

### Topluluk Verisi
- [ ] **Canlı Setlist Takibi** — konserdekiler "şu an bu çalıyor" işaretler; setlist arşivi kendiliğinden oluşur
- [ ] **Mekan İpuçları** — mekan profillerinde kategorili öneriler: 🔊 ses, 👀 görüş, 🚇 ulaşım

### Önerilen sıra
1. **Anı Kapsülü** — retention mekaniği
2. **Festival Modu** — yaz/festival sezonu
3. **WebSocket sprinti** — Sesli Odalar + Canlı Intro Savaşı + Canlı Setlist birlikte
