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
import com.concertly.backend.security.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final ArtistRepository artistRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;

    public AuthService(UserRepository userRepository,
            ArtistRepository artistRepository,
            ArtistFollowRepository artistFollowRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            AuthenticationManager authenticationManager,
            RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.artistRepository = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.authenticationManager = authenticationManager;
        this.refreshTokenService = refreshTokenService;
    }

    // ✅ KAYIT — şifreyi hash'le, duplicate kontrolü yap
    public UserResponse register(RegisterRequest request) {

        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new AlreadyExistsException(
                    "Bu email zaten kullanılıyor: " + request.getEmail());
        }

        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new AlreadyExistsException(
                    "Bu kullanıcı adı zaten kullanılıyor: " + request.getUsername());
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setCity(request.getCity());
        // ✅ Plain text yerine BCrypt hash
        user.setPassword(passwordEncoder.encode(request.getPassword()));

        User saved = userRepository.save(user);
        return new UserResponse(saved.getId(), saved.getUsername(), saved.getEmail(), saved.getCity());
    }

    // ✅ GİRİŞ — kimlik doğrula, JWT üret
    public AuthResponse login(LoginRequest request) {

        try {
            // Spring Security ile doğrulama yap — hatalıysa exception fırlatır
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getEmail(),
                            request.getPassword()));
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Email veya şifre hatalı.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + request.getEmail()));

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

    public AuthResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenService.findByToken(refreshTokenStr)
                .orElseThrow(() -> new BadCredentialsException("Geçersiz refresh token."));

        if (refreshTokenService.isExpired(refreshToken)) {
            refreshTokenService.delete(refreshToken);
            throw new BadCredentialsException("Refresh token süresi dolmuş, lütfen tekrar giriş yapın.");
        }

        User user = refreshToken.getUser();
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

    @Transactional
    public void forgotPassword(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Bu e-posta kayıtlı değil"));

        String token = String.format("%06d", new Random().nextInt(1_000_000));
        user.setResetToken(token);
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(30));
        userRepository.save(user);

        // Gerçek ortamda e-posta gönder; şimdilik konsola yaz
        System.out.println("===== ŞİFRE SIFIRLAMA KODU =====");
        System.out.println("Kullanıcı: " + email);
        System.out.println("Kod: " + token);
        System.out.println("================================");
    }

    @Transactional
    public void resetPassword(String email, String token, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı"));

        if (user.getResetToken() == null
                || !user.getResetToken().equals(token)
                || user.getResetTokenExpiry() == null
                || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Kod geçersiz veya süresi dolmuş");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}