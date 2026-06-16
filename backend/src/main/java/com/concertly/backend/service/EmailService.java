package com.concertly.backend.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Basit e-posta gönderimi (şifre sıfırlama kodu için).
 * app.mail.enabled=false ise (varsayılan / yerel) hiçbir şey göndermez, sadece
 * koda loglar — bu sayede SMTP kurulu olmadan da uygulama sorunsuz çalışır.
 * Railway'de MAIL_ENABLED=true + MAIL_USERNAME + MAIL_PASSWORD set edilince gönderir.
 */
@Service
public class EmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.mail.from:Concertly <no-reply@concertly.app>}")
    private String from;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    public void sendPasswordResetCode(String to, String code) {
        String subject = "Concertly şifre sıfırlama kodu";
        String body = "Merhaba,\n\n"
                + "Concertly şifre sıfırlama kodun: " + code + "\n\n"
                + "Bu kod 30 dakika geçerlidir. Bu isteği sen yapmadıysan görmezden gelebilirsin.\n\n"
                + "Concertly";

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (mailEnabled && sender != null) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(from);
                msg.setTo(to);
                msg.setSubject(subject);
                msg.setText(body);
                sender.send(msg);
                System.out.println("📧 Şifre sıfırlama kodu e-posta ile gönderildi: " + to);
                return;
            } catch (Exception e) {
                System.out.println("⚠️ E-posta gönderilemedi (" + e.getMessage() + "), koda log'a yazılıyor.");
            }
        }
        // Mail kapalı veya hata → koda log (yerel geliştirme / fallback)
        System.out.println("===== ŞİFRE SIFIRLAMA KODU =====");
        System.out.println("Kullanıcı: " + to);
        System.out.println("Kod: " + code);
        System.out.println("================================");
    }
}
