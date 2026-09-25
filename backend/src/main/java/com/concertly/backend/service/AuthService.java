package com.concertly.backend.service;

import com.concertly.backend.dto.request.LoginRequest;
import com.concertly.backend.dto.request.OnboardingRequest;
import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.response.AuthResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.ArtistFollow;
import com.concertly.backend.model.RefreshToken;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.security.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.security.SecureRandom;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final ArtistRepository artistRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;
    private final EmailVerificationService emailVerificationService;
    private final AuthRateLimiter rateLimiter;

    // Şifre sıfırlama: kod süresi ve deneme hakkı (e-posta doğrulamasıyla aynı desen)
    static final int RESET_CODE_MINUTES = 30;
    static final int RESET_MAX_ATTEMPTS = 5;
    // İstek sınırları — asıl koruma e-posta anahtarı; IP sınırları bilerek geniş
    private static final Duration WINDOW = Duration.ofMinutes(15);
    static final int LOGIN_PER_EMAIL = 10;
    static final int LOGIN_PER_IP = 100;
    static final int FORGOT_PER_EMAIL = 3;
    static final int FORGOT_PER_IP = 30;
    static final int RESET_PER_EMAIL = 10;
    static final int RESET_PER_IP = 60;

    private static final SecureRandom RANDOM = new SecureRandom();

    public AuthService(UserRepository userRepository,
            ArtistRepository artistRepository,
            ArtistFollowRepository artistFollowRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            AuthenticationManager authenticationManager,
            RefreshTokenService refreshTokenService,
            EmailService emailService,
            EmailVerificationService emailVerificationService,
            AuthRateLimiter rateLimiter) {
        this.userRepository = userRepository;
        this.artistRepository = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
        this.refreshTokenService = refreshTokenService;
        this.emailService = emailService;
        this.emailVerificationService = emailVerificationService;
        this.rateLimiter = rateLimiter;
    }

    // ✅ KAYIT — şifreyi hash'le, duplicate kontrolü yap
    public UserResponse register(RegisterRequest request) {

        if (request.getPassword() == null || request.getPassword().length() < 6) {
            throw new IllegalArgumentException("Şifre en az 6 karakter olmalı");
        }

        // Aynı e-postada 24 saattir doğrulanmamış bir kayıt varsa üzerine yazılabilir;
        // böylece başkasının adresiyle açılmış sahte kayıt adresi sonsuza kadar
        // kilitlemez. Daha yeni bekleyen kayıt korunur: sahibi giriş ekranından
        // kod ekranına döner. (Hemen üzerine yazmaya izin vermek, sahibi yeni
        // kodu girdiğinde hesabı başkasının belirlediği şifreyle açardı.)
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);
        boolean abandonedPending = user != null && user.isEmailVerificationPending()
                && (user.getEmailVerificationSentAt() == null
                    || user.getEmailVerificationSentAt().isBefore(LocalDateTime.now().minusHours(24)));
        if (user != null && !abandonedPending) {
            throw new AlreadyExistsException(
                    "Bu email zaten kullanılıyor: " + request.getEmail());
        }

        User usernameOwner = userRepository.findByUsername(request.getUsername()).orElse(null);
        if (usernameOwner != null && (user == null || !usernameOwner.getId().equals(user.getId()))) {
            throw new AlreadyExistsException(
                    "Bu kullanıcı adı zaten kullanılıyor: " + request.getUsername());
        }

        if (user == null) {
            user = new User();
            user.setEmail(request.getEmail());
        }
        user.setUsername(request.getUsername());
        user.setCity(request.getCity());
        // ✅ Plain text yerine BCrypt hash
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        User saved = userRepository.save(user);
        UserResponse response = new UserResponse(saved.getId(), saved.getUsername(), saved.getEmail(), saved.getCity());
        // Açıksa hesap, e-postaya giden kod girilene kadar giriş yapamaz
        if (emailVerificationService.isEnabled()) {
            emailVerificationService.start(saved);
            response.setEmailVerificationRequired(true);
        }
        return response;
    }

    // ✅ GİRİŞ — kimlik doğrula, JWT üret
    public AuthResponse login(LoginRequest request) {
        return login(request, null);
    }

    public AuthResponse login(LoginRequest request, String clientIp) {
        rateLimiter.check("login:ip:" + clientIp, LOGIN_PER_IP, WINDOW);
        rateLimiter.check("login:email:" + AuthRateLimiter.emailKey(request.getEmail()), LOGIN_PER_EMAIL, WINDOW);

        try {
            // Spring Security ile doğrulama yap — hatalıysa exception fırlatır
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()));
        } catch (DisabledException e) {
            // Şifre doğru ya da yanlış, yasaklı hesap açılmaz
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ACCOUNT_BANNED");
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Email veya şifre hatalı.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + request.getEmail()));

        // Şifre doğru ama e-posta doğrulanmamış → mobil kod ekranına yönlendirir
        if (user.isEmailVerificationPending()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED");
        }

        return issueTokens(user);
    }

    // ✅ E-POSTA DOĞRULAMA — kod doğruysa oturum açar (şifreyi tekrar sormadan)
    public AuthResponse verifyEmail(String email, String code) {
        User user = emailVerificationService.verify(email, code);
        return issueTokens(user);
    }

    public void resendVerification(String email) {
        emailVerificationService.resend(email);
    }

    private AuthResponse issueTokens(User user) {
        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ACCOUNT_BANNED");
        }
        String accessToken = jwtUtil.generateToken(user.getId(), user.getEmail());
        RefreshToken refreshToken = refreshTokenService.create(user);

        boolean isAdmin = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));

        return new AuthResponse(
                accessToken,
                refreshToken.getToken(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getCity(),
                user.getFavoriteGenres(),
                user.getOnboardingCompleted(),
                isAdmin);
    }

    // RefreshToken.user LAZY ve open-in-view kapalı: transaction olmadan user.getEmail()
    // "could not initialize proxy - no session" ile 500 veriyordu (her yenileme başarısız,
    // kullanıcı Login'e atılıyordu). noRollbackFor: süresi dolmuş/yasaklı yolda token
    // silinip hata fırlatılıyor; silme geri alınmasın.
    @Transactional(noRollbackFor = { BadCredentialsException.class, ResponseStatusException.class })
    public AuthResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenService.findByToken(refreshTokenStr)
                .orElseThrow(() -> new BadCredentialsException("Geçersiz refresh token."));

        if (refreshTokenService.isExpired(refreshToken)) {
            refreshTokenService.delete(refreshToken);
            throw new BadCredentialsException("Refresh token süresi dolmuş, lütfen tekrar giriş yapın.");
        }

        User user = refreshToken.getUser();
        if (Boolean.FALSE.equals(user.getIsActive())) {
            // Yasaklandıktan sonra elde kalan refresh token ile oturum yenilenemez
            refreshTokenService.delete(refreshToken);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ACCOUNT_BANNED");
        }
        String newAccessToken = jwtUtil.generateToken(user.getId(), user.getEmail());

        boolean isAdmin = user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));

        return new AuthResponse(
                newAccessToken,
                refreshToken.getToken(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getCity(),
                user.getFavoriteGenres(),
                user.getOnboardingCompleted(),
                isAdmin);
    }

    @Transactional
    public void logout(String refreshTokenStr) {
        refreshTokenService.findByToken(refreshTokenStr)
                .ifPresent(refreshTokenService::delete);
    }

    @Transactional
    public UserResponse saveOnboardingPreferences(Long userId, OnboardingRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanici bulunamadi: " + userId));

        if (request.getGenres() != null && !request.getGenres().isEmpty()) {
            user.setFavoriteGenres(String.join(",", request.getGenres()));
        }

        if (request.getCity() != null && !request.getCity().isBlank()) {
            user.setCity(request.getCity());
        }

        if (request.getArtistIds() != null) {
            for (Long artistId : request.getArtistIds()) {
                if (artistFollowRepository.findByUserIdAndArtistId(user.getId(), artistId).isEmpty()) {
                    artistRepository.findById(artistId).ifPresent(artist -> {
                        ArtistFollow af = new ArtistFollow();
                        af.setUser(user);
                        af.setArtist(artist);
                        artistFollowRepository.save(af);
                    });
                }
            }
        }

        user.setOnboardingCompleted(true);
        user.setUpdatedAt(LocalDateTime.now());
        User saved = userRepository.save(user);

        UserResponse response = new UserResponse(
                saved.getId(), saved.getUsername(), saved.getEmail(), saved.getCity());
        response.setFavoriteGenres(saved.getFavoriteGenres());
        response.setOnboardingCompleted(saved.getOnboardingCompleted());
        return response;
    }

    public void forgotPassword(String email) {
        forgotPassword(email, null);
    }

    public void forgotPassword(String email, String clientIp) {
        rateLimiter.check("forgot:ip:" + clientIp, FORGOT_PER_IP, WINDOW);
        // E-posta sınırı aşıldıysa sessizce hiçbir şey yapma: hem mail bombalamayı
        // hem de "bu e-posta kayıtlı mı" sızıntısını engeller.
        if (!rateLimiter.tryAcquire("forgot:email:" + AuthRateLimiter.emailKey(email), FORGOT_PER_EMAIL, WINDOW)) {
            return;
        }
        // Kullanıcı sayımına (enumeration) karşı: e-posta kayıtlı olsun olmasın
        // dışarıya aynı (boş) yanıt döner. Kod yalnızca kayıtlı kullanıcıya gider.
        if (email == null) return;
        userRepository.findByEmail(email.trim()).ifPresent(user -> {
            String token = String.format("%06d", RANDOM.nextInt(1_000_000));
            // Düz kod saklanmaz; yalnızca özeti. Yeni kod deneme sayacını sıfırlar.
            user.setResetToken(passwordEncoder.encode(token));
            user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(RESET_CODE_MINUTES));
            user.setResetTokenAttempts(0);
            userRepository.save(user);

            // Kodu e-posta ile gönder (mail kapalıysa EmailService log'a yazar)
            emailService.sendPasswordResetCode(email, token);
        });
    }

    // ✅ ŞİFRE DEĞİŞTİR (giriş yapmış kullanıcı, mevcut şifresini bilerek)
    @Transactional
    public void changePassword(Long userId, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Yeni şifre en az 6 karakter olmalı");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı"));

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Mevcut şifre yanlış");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        // Şifre değişti → mevcut tüm oturumları (refresh token'ları) geçersiz kıl
        refreshTokenService.deleteByUser(user);
    }

    public void resetPassword(String email, String token, String newPassword) {
        resetPassword(email, token, newPassword, null);
    }

    /**
     * Kodla yeni şifre belirler. Bilerek @Transactional DEĞİL: yanlış denemede
     * artırılan sayaç, ardından fırlatılan hata yüzünden geri alınmamalı
     * (EmailVerificationService ile aynı gerekçe).
     */
    public void resetPassword(String email, String token, String newPassword, String clientIp) {
        rateLimiter.check("reset:ip:" + clientIp, RESET_PER_IP, WINDOW);
        rateLimiter.check("reset:email:" + AuthRateLimiter.emailKey(email), RESET_PER_EMAIL, WINDOW);
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Yeni şifre en az 6 karakter olmalı");
        }
        // Kayıtlı olmayan e-posta da "kod geçersiz" gibi görünür (e-posta sızmasın)
        User user = email == null ? null : userRepository.findByEmail(email.trim()).orElse(null);
        if (user == null || user.getResetToken() == null || token == null || token.isBlank()) {
            throw resetInvalid();
        }

        int attempts = user.getResetTokenAttempts() == null ? 0 : user.getResetTokenAttempts();
        if (attempts >= RESET_MAX_ATTEMPTS) {
            // Kod yakıldı: doğru olsa bile kabul edilmez, yeni kod istenmeli
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "CODE_ATTEMPTS_EXCEEDED");
        }
        if (user.getResetTokenExpiry() == null || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODE_EXPIRED");
        }
        if (!passwordEncoder.matches(token.trim(), user.getResetToken())) {
            user.setResetTokenAttempts(attempts + 1);
            userRepository.save(user);
            throw resetInvalid();
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setResetTokenAttempts(null);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        // Şifre sıfırlandı → mevcut tüm oturumları geçersiz kıl
        refreshTokenService.deleteByUser(user);
    }

    private static ResponseStatusException resetInvalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "CODE_INVALID");
    }
}