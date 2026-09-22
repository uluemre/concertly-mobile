3. “Konsere gerçekten gitmek” deneyimi kusursuz çalışırsa

Mevcut kodda önemli bir teknik/ürün riski var:

 EventVerificationController  konum almıyor;  EventVerificationService  de kullanıcının gerçekten etkinlik mekanında olup olmadığını doğrulamadan doğrulama kaydı oluşturuyor.

Yani ürün “GPS ile konsere gittiğini kanıtla” diyor, fakat backend tarafında doğrulama şu anda authenticated bir kullanıcının endpoint çağırmasına dayanıyor.

Bu mutlaka düzeltilmeli:

• Mobil konum koordinatı backend’e gönderilmeli.
• Backend etkinlik mekan koordinatıyla mesafe hesaplamalı.
• Maksimum mesafe sınırı olmalı.
• Etkinlik tarihi ve zaman aralığı kontrol edilmeli.
• Aynı etkinlik için tek doğrulama tutulmalı.
• GPS sahteciliği ve emulator riski en azından izlenmeli.
• Doğrulama sonucunda  distance ,  verifiedAt ,  method  gibi alanlar tutulmalı.

Bu özellik ürünün ana farklılaştırıcısı olduğu için burada güven kaybı oluşması çok kritik.


A. Push notification yok

Backend’de bildirim altyapısı var:

• Konser hatırlatmaları
• Sanatçı turne duyuruları
• Beğeni ve yorum bildirimleri
• Mesaj bildirimleri

Fakat bildirimler yalnızca veritabanına yazılıyor. Mobilde:

•  expo-notifications  yok
• Push token kaydı yok
• FCM/APNs/Expo Push gönderimi yok

Kullanıcı uygulamayı açmadığı sürece haber alamıyor.

Bu, retention açısından en kritik eksiklerden biri.

Öncelik: Çok yüksek.

B. Paylaşım mekanizması büyüme üretmiyor

Post ve Passport paylaşımında düz metin paylaşımı var, ancak:

• Uygulama indirme linki yok.
• Etkinliğe doğrudan link yok.
• Paylaşılan Passport’a doğrudan link yok.
• Deep link sistemi yok.

Bu nedenle kullanıcı bir şey paylaşsa bile karşı taraf uygulamaya geçemiyor.

Öncelik sırası:

1. Paylaşıma App Store/Google Play/promosyon linki eklemek
2. Deep linking eklemek
3. Event, Artist, Post ve Passport için paylaşılabilir URL oluşturmak
4. Link uygulama yüklüyse uygulamayı, değilse web/store sayfasını açmalı

C. Etkinlik içeriği tek kaynağa fazla bağlı

Ticketmaster verisi başlangıç için iyi ancak Türkiye’de tüm konserleri kapsamayabilir.

Bu nedenle şu veri kanalları kurulmalı:

• Organizatör paneli
• Mekan hesabı
• Sanatçı/menajer doğrulama hesabı
• Kullanıcı etkinlik önerisi
• Admin onay kuyruğu
• Instagram/website üzerinden etkinlik bildirme
• Etkinlik mükerrer kontrolü
• Etkinlik doğrulama rozeti

Concertly’nin uzun vadeli savunulabilirliği, yalnızca Ticketmaster verisine bağlı kalmamasından geçer.

D. Sosyal ağ güvenliği

Raporlama, engelleme ve moderasyon altyapısının önemli bölümü eklenmiş. Ancak mutlaka tamamlanmalı:

• Admin tarafında açık raporları listeleme
• İçerik gizleme
• Kullanıcı güvenlik ayarları
• DM izinleri
• Yeni hesaplara spam limiti
• Fotoğraf ve profil doğrulama seçenekleri
• Taciz/rahatsız etme akışı
• Kullanıcı sözleşmesi ve gizlilik metinlerinin gerçek akışla uyumu

UGC içeren bir mobil uygulama için bu konu sadece teknik kalite değil, App Store ve Google Play yayın gerekliliğidir.

E. Kullanıcı tokenlarının AsyncStorage’da tutulması

Access ve refresh token’lar  AsyncStorage  ile saklanıyor. Bu mobil uygulamalarda yaygın olsa da hassas tokenlar için daha güvenli tercih:

• iOS Keychain
• Android Keystore
• Expo SecureStore

Özellikle refresh token  SecureStore  üzerinde tutulmalı.

F. Üretim yapılandırması ve gizli anahtarlar

Proje denetim dokümanında da belirtilmiş:

• API anahtarları geçmişte repoda bulunmuş.
• JWT default secret mevcut.
• Spotify/Ticketmaster anahtarlarının rotate edilmesi gerekiyor.
• Production’da  ddl-auto=update  yerine migration +  validate  kullanılmalı.
•  show-sql  production’da kapalı olmalı.

Bu işlemler yayın öncesi zorunlu:

1. Spotify anahtarlarını rotate et
2. Ticketmaster anahtarını rotate et
3. JWT secret değiştir
4. DB şifresini değiştir
5. Git geçmişindeki secret’ları temizle
6. Production env değişkenlerini doğrula
7. Flyway migration sistemini etkinleştir
8. Canlı endpoint smoke testleri ekle

G. Canlı servis şu anda doğrulanamıyor

Kontrol sırasında şu uçlar 404 döndü:

•  /actuator/health 
•  /promo/ 
•  /api/events 

Bu durum:

• Railway deploy’unun yanlış branch’ten yapılması,
• uygulamanın farklı port/path ile açılması,
• route mapping sorunu,
• deploy’un güncel olmaması,
• Railway servisinin değişmiş olması

gibi sebeplerden kaynaklanabilir.

Bu çözülmeden App Store başvurusu, reklam kampanyası ve yatırımcı demosu riskli olur.