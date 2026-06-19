// Uygulama içi gösterilen yasal metinler (LegalScreen tarafından kullanılır).
// Hosting gerektirmez — internet olmadan da gösterilir.
// Aynı metinlerin Markdown sürümü repodaki legal/ klasöründe (App Store Connect'in
// istediği public URL için onları yayınlayabilirsin).

export const LEGAL_CONTENT = {
  tr: {
    privacy: {
      title: 'Gizlilik Politikası',
      updated: 'Son güncelleme: 19.06.2026',
      sections: [
        { h: '', b: 'Concertly ("uygulama", "biz") gizliliğine önem verir. Bu politika hangi verileri topladığımızı, neden topladığımızı ve haklarını açıklar.' },
        { h: '1. Topladığımız veriler', b: '• Hesap bilgileri: kullanıcı adı, e-posta, şifre (şifrelenmiş saklanır).\n• Profil: şehir, profil fotoğrafı, takip ettiğin sanatçı/etkinlikler.\n• Kullanıcı içeriği: gönderiler, yorumlar, beğeniler, mesajlar, yüklediğin görseller.\n• Konum: yalnızca izin verirsen, yakındaki etkinlikleri göstermek için.\n• Cihaz/kullanım: uygulamanın çalışması için gerekli temel teknik veriler.' },
        { h: '2. Verileri ne için kullanırız', b: '• Hesabını oluşturmak ve oturumunu yönetmek,\n• Sana uygun etkinlik ve içerikleri göstermek,\n• Sosyal özellikleri (takip, yorum, mesaj) çalıştırmak,\n• Güvenliği sağlamak ve kötüye kullanımı önlemek.' },
        { h: '3. Veri paylaşımı', b: 'Verilerini üçüncü taraflara satmıyoruz. Yalnızca uygulamanın çalışması için gerekli servislerle (sunucu barındırma, e-posta gönderimi, Spotify/Ticketmaster gibi etkinlik/sanatçı sağlayıcıları) sınırlı ölçüde paylaşılır.' },
        { h: '4. Veri saklama ve silme', b: 'Hesabını uygulama içinden Ayarlar > Hesabımı Sil yolundan kalıcı olarak silebilirsin. Sildiğinde verilerin (gönderiler, yorumlar, beğeniler, takipler, mesajlar) kalıcı olarak silinir.' },
        { h: '5. Güvenlik', b: 'Şifreler şifrelenerek (hash) saklanır, iletişim HTTPS üzerinden şifrelenir.' },
        { h: '6. Çocukların gizliliği', b: 'Concertly 13 yaşından küçük kullanıcılara yönelik değildir.' },
        { h: '7. İletişim', b: 'Sorularını emre.emre.emre366@gmail.com adresine iletebilirsin.' },
      ],
    },
    terms: {
      title: 'Kullanım Şartları',
      updated: 'Son güncelleme: 19.06.2026',
      sections: [
        { h: '', b: 'Concertly\'yi kullanarak aşağıdaki şartları kabul etmiş olursun.' },
        { h: '1. Hesap', b: 'Doğru bilgilerle kayıt olmak ve hesabının güvenliğinden sen sorumlusun. 13 yaşından büyük olmalısın.' },
        { h: '2. Kullanıcı içeriği', b: 'Paylaştığın gönderi, yorum ve görsellerden sen sorumlusun. Sana ait olmayan ya da paylaşma hakkın olmayan içerikleri yüklememelisin.' },
        { h: '3. Uygunsuz içeriğe sıfır tolerans', b: 'Şunlar kesinlikle yasaktır:\n• Taciz, nefret söylemi, tehdit veya zorbalık,\n• Spam, dolandırıcılık veya yanıltıcı içerik,\n• Yasa dışı, müstehcen veya başkalarının haklarını ihlal eden içerik.\nBu kurallara uymayan içerik ve hesaplar uyarısız kaldırılabilir/askıya alınabilir.' },
        { h: '4. Şikayet ve engelleme', b: '• Herhangi bir gönderiyi uygulama içinden şikayet edebilirsin.\n• İstemediğin kullanıcıları engelleyebilirsin.\n• Bize ulaşan şikayetleri 24 saat içinde inceler, gerekli içeriği kaldırır ve ihlalde bulunan hesaplara işlem yaparız.' },
        { h: '5. Hesabın askıya alınması/silinmesi', b: 'Bu şartları ihlal eden hesapları askıya alma veya silme hakkımız saklıdır. Sen de dilediğin an hesabını uygulama içinden silebilirsin.' },
        { h: '6. Sorumluluğun sınırlandırılması', b: 'Concertly "olduğu gibi" sunulur. Üçüncü taraf etkinlik verilerinin (tarih, mekan vb.) doğruluğunu garanti etmeyiz.' },
        { h: '7. İletişim', b: 'emre.emre.emre366@gmail.com' },
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy Policy',
      updated: 'Last updated: 19.06.2026',
      sections: [
        { h: '', b: 'Concertly ("the app", "we") respects your privacy. This policy explains what data we collect, why, and your rights.' },
        { h: '1. Data we collect', b: '• Account info: username, email, password (stored hashed).\n• Profile: city, profile photo, artists/events you follow.\n• User content: posts, comments, likes, messages, images you upload.\n• Location: only with your permission, to show nearby events.\n• Device/usage: basic technical data required to run the app.' },
        { h: '2. How we use data', b: '• To create your account and manage your session,\n• To show you relevant events and content,\n• To power social features (follow, comment, message),\n• To keep the service safe and prevent abuse.' },
        { h: '3. Data sharing', b: 'We do not sell your data. It is shared only to the limited extent needed to run the app (server hosting, email delivery, event/artist data providers such as Spotify/Ticketmaster).' },
        { h: '4. Data retention and deletion', b: 'You can permanently delete your account in-app via Settings > Delete My Account. Deleting removes your data (posts, comments, likes, follows, messages) permanently.' },
        { h: '5. Security', b: 'Passwords are stored hashed; communication is encrypted over HTTPS.' },
        { h: '6. Children\'s privacy', b: 'Concertly is not directed to children under 13.' },
        { h: '7. Contact', b: 'Questions: emre.emre.emre366@gmail.com' },
      ],
    },
    terms: {
      title: 'Terms of Service',
      updated: 'Last updated: 19.06.2026',
      sections: [
        { h: '', b: 'By using Concertly, you agree to the following terms.' },
        { h: '1. Account', b: 'You are responsible for registering with accurate information and keeping your account secure. You must be over 13 years old.' },
        { h: '2. User content', b: 'You are responsible for the posts, comments and images you share. Do not upload content you do not own or have no right to share.' },
        { h: '3. Zero tolerance for objectionable content', b: 'The following are strictly prohibited:\n• Harassment, hate speech, threats or bullying,\n• Spam, fraud or misleading content,\n• Illegal, obscene content or content violating others\' rights.\nContent and accounts that violate these rules may be removed/suspended without notice.' },
        { h: '4. Reporting and blocking', b: '• You can report any post from within the app.\n• You can block users you don\'t want to interact with.\n• We review reports within 24 hours, remove offending content, and act on violating accounts.' },
        { h: '5. Suspension/deletion of accounts', b: 'We reserve the right to suspend or delete accounts that violate these terms. You may also delete your account at any time from within the app.' },
        { h: '6. Limitation of liability', b: 'Concertly is provided "as is". We do not guarantee the accuracy of third-party event data (dates, venues, etc.).' },
        { h: '7. Contact', b: 'emre.emre.emre366@gmail.com' },
      ],
    },
  },
};
