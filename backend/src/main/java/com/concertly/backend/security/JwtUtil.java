package com.concertly.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtUtil(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration.ms}") long expirationMs
    ) {
        this.secretKey   = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(Long userId, String email) {
        return Jwts.builder()
                .subject(userId + ":" + email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(secretKey)
                .compact();
    }

    /**
     * Tek amaçlı, kısa ömürlü imzalı belirteç (ör. Spotify OAuth state). Erişim belirteciyle
     * karıştırılamaz: konu "id:email" biçiminde değil ve "purpose" talebi zorunlu.
     */
    public String generatePurposeToken(Long userId, String purpose, long ttlMs) {
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("purpose", purpose)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(secretKey)
                .compact();
    }

    /** İmza, süre ve amaç geçerliyse kullanıcı id'sini, değilse null döner. */
    public Long parsePurposeToken(String token, String purpose) {
        if (token == null || token.isBlank()) return null;
        try {
            Claims claims = parseClaims(token);
            if (!purpose.equals(claims.get("purpose", String.class))) return null;
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    public String extractEmail(String token) {
        String subject = parseClaims(token).getSubject();
        int colonIndex = subject.indexOf(':');
        return colonIndex > 0 ? subject.substring(colonIndex + 1) : subject;
    }

    /** Konudaki "id:email" önekinden kullanıcı id'sini döner; yoksa/sayısal değilse null. */
    public Long extractUserId(String token) {
        String subject = parseClaims(token).getSubject();
        if (subject == null) return null;
        int colonIndex = subject.indexOf(':');
        if (colonIndex <= 0) return null;
        try {
            return Long.parseLong(subject.substring(0, colonIndex));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public boolean isTokenValid(String token) {
        try {
            // Amaç (purpose) talebi taşıyan belirteçler erişim belirteci değildir
            return parseClaims(token).get("purpose") == null;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public static Long getCurrentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        String name = auth.getName();
        int colonIndex = name.indexOf(':');
        if (colonIndex > 0) {
            return Long.parseLong(name.substring(0, colonIndex));
        }
        return null;
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}