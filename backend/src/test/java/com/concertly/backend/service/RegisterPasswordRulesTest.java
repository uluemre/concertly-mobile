package com.concertly.backend.service;

import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.UserRepository;
import com.concertly.backend.security.AuthRateLimiter;
import com.concertly.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** N-20: kayıtta şifre kuralı — en az 6 karakter (yalnızca boşluk sayılmaz), en fazla 72. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RegisterPasswordRulesTest {

    @Mock private UserRepository userRepository;
    @Mock private ArtistRepository artistRepository;
    @Mock private ArtistFollowRepository artistFollowRepository;
    @Mock private JwtUtil jwtUtil;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private EmailService emailService;
    @Mock private EmailVerificationService emailVerificationService;

    private AuthService service;

    @BeforeEach
    void setUp() {
        service = new AuthService(userRepository, artistRepository, artistFollowRepository,
                new BCryptPasswordEncoder(), jwtUtil, authenticationManager, refreshTokenService,
                emailService, emailVerificationService, new AuthRateLimiter());
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByUsername(anyString())).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(u, "id", 1L);
            return u;
        });
    }

    private static RegisterRequest request(String password) {
        RegisterRequest r = new RegisterRequest();
        r.setUsername("sim_test");
        r.setEmail("sim_test@test.local");
        r.setPassword(password);
        return r;
    }

    @Test
    void shortWhitespaceOnlyAndTooLongPasswordsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.register(request(null)));
        assertThrows(IllegalArgumentException.class, () -> service.register(request("12345")));
        assertThrows(IllegalArgumentException.class, () -> service.register(request("      ")), "6 boşluk");
        assertThrows(IllegalArgumentException.class, () -> service.register(request("  ab  ")), "boşluk sayılmaz");
        assertThrows(IllegalArgumentException.class, () -> service.register(request("a".repeat(73))));
        verify(userRepository, never()).save(any());
    }

    @Test
    void validPasswordsAreAccepted() {
        assertNotNull(service.register(request("abc123")));
        assertNotNull(service.register(request("a".repeat(72))));
        assertNotNull(service.register(request("şifre 12")), "arada boşluk olabilir");
        verify(userRepository, times(3)).save(any());
    }
}
