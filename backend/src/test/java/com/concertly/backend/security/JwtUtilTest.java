package com.concertly.backend.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-characters-long";
    private static final long ONE_HOUR_MS = 3_600_000L;

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(SECRET, ONE_HOUR_MS);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void generatedTokenIsValid() {
        String token = jwtUtil.generateToken(42L, "user@example.com");

        assertNotNull(token);
        assertTrue(jwtUtil.isTokenValid(token));
    }

    @Test
    void extractEmailReturnsEmailFromSubject() {
        String token = jwtUtil.generateToken(42L, "user@example.com");

        assertEquals("user@example.com", jwtUtil.extractEmail(token));
    }

    @Test
    void expiredTokenIsInvalid() {
        JwtUtil expiredUtil = new JwtUtil(SECRET, -1000L);
        String token = expiredUtil.generateToken(1L, "user@example.com");

        assertFalse(expiredUtil.isTokenValid(token));
    }

    @Test
    void tokenSignedWithDifferentKeyIsInvalid() {
        JwtUtil otherUtil = new JwtUtil("another-secret-key-that-is-also-32-chars-long!!", ONE_HOUR_MS);
        String token = otherUtil.generateToken(1L, "user@example.com");

        assertFalse(jwtUtil.isTokenValid(token));
    }

    @Test
    void malformedTokenIsInvalid() {
        assertFalse(jwtUtil.isTokenValid("not-a-jwt"));
        assertFalse(jwtUtil.isTokenValid(""));
    }

    @Test
    void getCurrentUserIdParsesAuthenticatedPrincipal() {
        var auth = new UsernamePasswordAuthenticationToken("42:user@example.com", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        assertEquals(42L, JwtUtil.getCurrentUserId());
    }

    @Test
    void getCurrentUserIdReturnsNullWithoutAuthentication() {
        assertNull(JwtUtil.getCurrentUserId());
    }
}
