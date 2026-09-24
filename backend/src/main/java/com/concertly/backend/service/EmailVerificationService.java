package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Kayıttan sonra e-postaya gönderilen 6 haneli doğrulama kodu.
 *
 * Kod yalnızca BCrypt özeti olarak saklanır, süresi dolar ve sınırlı sayıda
 * denenebilir; sınır aşılınca yeni kod istenmesi gerekir. Hata nedenleri
 * mobilin çevirebileceği sabit kodlar olarak döner (CODE_INVALID vb.).
 *
 * Metotlar bilerek @Transactional DEĞİL: yanlış denemede artırılan sayaç,
 * ardından fırlatılan hata yüzünden geri alınmamalı.
 */
@Service
public class EmailVerificationService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    /** Kapalıyken yeni kayıtlar kod beklemeden açılır (e-posta sağlayıcısı kurulana kadar). */
    @Value("${app.email-verification.enabled:false}")
    private boolean enabled;

    @Value("${app.email-verification.code-minutes:15}")
    private int codeMinutes;

    @Value("${app.email-verification.resend-seconds:60}")
    private int resendSeconds;

    @Value("${app.email-verification.max-attempts:5}")
    private int maxAttempts;

    public EmailVerificationService(UserRepository userRepository,
                                    PasswordEncoder passwordEncoder,
                                    EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** Hesabı doğrulanmamış işaretler, yeni kod üretip e-postalar. */
    public void start(User user) {
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        LocalDateTime now = LocalDateTime.now();
        user.setEmailVerified(false);
        user.setEmailVerificationCodeHash(passwordEncoder.encode(code));
        user.setEmailVerificationExpiry(now.plusMinutes(codeMinutes));
        user.setEmailVerificationSentAt(now);
        user.setEmailVerificationAttempts(0);
        userRepository.save(user);
        emailService.sendVerificationCode(user.getEmail(), user.getUsername(), code, codeMinutes);
    }

    /**
     * Kodu yeniden gönderir. Kayıtlı olmayan ya da zaten doğrulanmış adreslerde
     * sessizce hiçbir şey yapmaz (e-posta varlığı dışarıya sızmasın). Bekleme
     * süresi dolmadan gelen istek de sessizce yok sayılır; mobil kendi geri
     * sayımını gösterir.
     */
    public void resend(String email) {
        if (email == null || email.isBlank()) return;
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            if (!user.isEmailVerificationPending()) return;
            LocalDateTime sentAt = user.getEmailVerificationSentAt();
            if (sentAt != null && sentAt.plusSeconds(resendSeconds).isAfter(LocalDateTime.now())) return;
            start(user);
        });
    }

    /** Kod doğruysa hesabı doğrulanmış yapar ve kullanıcıyı döner. */
    public User verify(String email, String code) {
        if (email == null || code == null || code.isBlank()) throw invalid();
        User user = userRepository.findByEmail(email.trim()).orElseThrow(EmailVerificationService::invalid);
        if (!user.isEmailVerificationPending() || user.getEmailVerificationCodeHash() == null) throw invalid();

        int attempts = user.getEmailVerificationAttempts() == null ? 0 : user.getEmailVerificationAttempts();
        if (attempts >= maxAttempts) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "CODE_ATTEMPTS_EXCEEDED");
        }
        if (user.getEmailVerificationExpiry() == null
                || user.getEmailVerificationExpiry().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODE_EXPIRED");
        }
        if (!passwordEncoder.matches(code.trim(), user.getEmailVerificationCodeHash())) {
            user.setEmailVerificationAttempts(attempts + 1);
            userRepository.save(user);
            throw invalid();
        }

        user.setEmailVerified(true);
        user.setEmailVerificationCodeHash(null);
        user.setEmailVerificationExpiry(null);
        user.setEmailVerificationSentAt(null);
        user.setEmailVerificationAttempts(null);
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODE_INVALID");
    }
}
