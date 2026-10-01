package com.concertly.backend.security;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** SEC-01: Spotify callback tek yeni permitAll olmali; /api/spotify/** altinda baska acik yol olmamali. */
class SecurityConfigPermitAllTest {

    private static final Path SRC = Path.of("src/main/java/com/concertly/backend/security/SecurityConfig.java");

    @Test
    void spotifyCallbackIsTheOnlyPermitAllUnderSpotify() throws Exception {
        int spotify = 0;
        for (String l : Files.readAllLines(SRC)) {
            String s = l.trim();
            if (s.startsWith("//") || !s.contains("spotify")) continue;
            if (s.contains("permitAll")) {
                spotify++;
                assertTrue(s.contains("HttpMethod.GET, \"/api/spotify/callback\""), s);
            }
        }
        assertEquals(1, spotify);
    }

    /** N-25: oturumlu e-posta doğrulama anyRequest().authenticated() altında kalmalı (permitAll yok). */
    @Test
    void meVerifyEmailIsNotPermitAll() throws Exception {
        for (String l : Files.readAllLines(SRC)) {
            String s = l.trim();
            if (s.startsWith("//") || !s.contains("permitAll")) continue;
            assertFalse(s.contains("/api/users/me"), s);
            assertFalse(s.contains("/api/users/**"), s);
            assertFalse(s.contains("/api/users/*/verify-email"), s);
        }
        assertTrue(Files.readString(SRC).contains(".anyRequest().authenticated()"));
    }

    @Test
    void noWildcardPermitAllOnApiRoot() throws Exception {
        String src = Files.readString(SRC);
        assertFalse(src.contains("\"/api/**\").permitAll()"));
        assertFalse(src.contains("\"/api/spotify/**\")"));
    }
}
