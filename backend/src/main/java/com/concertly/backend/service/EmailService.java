package com.concertly.backend.service;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Doğrulama ve şifre sıfırlama kodlarını e-posta ile gönderir.
 *
 * Sırayla denenen yollar:
 *  1. BREVO_API_KEY verilmişse Brevo HTTP API'si. Render'ın ücretsiz planı
 *     SMTP portlarını engellediği için production'da kullanılan yol bu.
 *  2. MAIL_ENABLED=true ise SMTP (JavaMailSender).
 *  3. İkisi de yoksa kod yalnızca sunucu loguna yazılır (yerel geliştirme).
 */
@Service
public class EmailService {

    private static final Pattern NAMED_ADDRESS = Pattern.compile("^\\s*(.*?)\\s*<\\s*([^>]+?)\\s*>\\s*$");

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.mail.from:Concertly <no-reply@concertly.app>}")
    private String from;

    @Value("${app.mail.brevo-api-key:}")
    private String brevoApiKey;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    public void sendPasswordResetCode(String to, String code) {
        String subject = "Concertly şifre sıfırlama kodu";
        String body = "Merhaba,\n\n"
                + "Concertly şifre sıfırlama kodun: " + code + "\n\n"
                + "Bu kod 30 dakika geçerlidir. Bu isteği sen yapmadıysan görmezden gelebilirsin.\n\n"
                + "Concertly";
        send(to, subject, body, codeHtml("Şifre sıfırlama kodun", code,
                "Bu kod 30 dakika geçerlidir. Bu isteği sen yapmadıysan görmezden gelebilirsin."),
                "ŞİFRE SIFIRLAMA KODU", code);
    }

    public void sendVerificationCode(String to, String username, String code, int validMinutes) {
        String subject = "Concertly doğrulama kodun: " + code;
        String body = "Merhaba " + username + ",\n\n"
                + "Concertly'ye hoş geldin! Hesabını doğrulamak için bu kodu uygulamaya gir:\n\n"
                + code + "\n\n"
                + "Kod " + validMinutes + " dakika geçerlidir. Bu kaydı sen yapmadıysan bu e-postayı görmezden gelebilirsin.\n\n"
                + "Concertly";
        send(to, subject, body, codeHtml("Hoş geldin " + username + "! Doğrulama kodun", code,
                "Kod " + validMinutes + " dakika geçerlidir. Bu kaydı sen yapmadıysan bu e-postayı görmezden gelebilirsin."),
                "E-POSTA DOĞRULAMA KODU", code);
    }

    /** @return e-posta gerçekten bir sağlayıcıya teslim edildiyse true */
    private boolean send(String to, String subject, String text, String html, String logTitle, String code) {
        if (brevoApiKey != null && !brevoApiKey.isBlank()) {
            try {
                sendViaBrevo(to, subject, text, html);
                System.out.println("📧 " + logTitle + " Brevo ile gönderildi: " + to);
                return true;
            } catch (Exception e) {
                System.out.println("⚠️ Brevo e-postası gönderilemedi (" + e.getMessage() + ")");
            }
        } else if (mailEnabled) {
            JavaMailSender sender = mailSenderProvider.getIfAvailable();
            if (sender != null) {
                try {
                    SimpleMailMessage msg = new SimpleMailMessage();
                    msg.setFrom(from);
                    msg.setTo(to);
                    msg.setSubject(subject);
                    msg.setText(text);
                    sender.send(msg);
                    System.out.println("📧 " + logTitle + " SMTP ile gönderildi: " + to);
                    return true;
                } catch (Exception e) {
                    System.out.println("⚠️ SMTP e-postası gönderilemedi (" + e.getMessage() + ")");
                }
            }
        }
        // Mail kapalı veya hata → koda log (yerel geliştirme / fallback)
        System.out.println("===== " + logTitle + " =====");
        System.out.println("Kullanıcı: " + to);
        System.out.println("Kod: " + code);
        System.out.println("================================");
        return false;
    }

    private void sendViaBrevo(String to, String subject, String text, String html) {
        String senderName = "Concertly";
        String senderEmail = from.trim();
        Matcher m = NAMED_ADDRESS.matcher(from);
        if (m.matches()) {
            if (!m.group(1).isBlank()) senderName = m.group(1);
            senderEmail = m.group(2);
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("api-key", brevoApiKey);

        Map<String, Object> payload = Map.of(
                "sender", Map.of("name", senderName, "email", senderEmail),
                "to", List.of(Map.of("email", to)),
                "subject", subject,
                "textContent", text,
                "htmlContent", html);

        restTemplate.postForEntity("https://api.brevo.com/v3/smtp/email",
                new HttpEntity<>(payload, headers), String.class);
    }

    private static String codeHtml(String heading, String code, String footnote) {
        return "<div style=\"font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e\">"
                + "<div style=\"font-size:22px;font-weight:700;margin-bottom:16px\">🎟️ Concertly</div>"
                + "<p style=\"font-size:16px;margin:0 0 16px\">" + escape(heading) + ":</p>"
                + "<div style=\"font-size:34px;font-weight:700;letter-spacing:8px;background:#f3f0ff;border-radius:12px;"
                + "padding:16px;text-align:center;margin-bottom:16px\">" + escape(code) + "</div>"
                + "<p style=\"font-size:13px;color:#666;margin:0\">" + escape(footnote) + "</p>"
                + "</div>";
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
