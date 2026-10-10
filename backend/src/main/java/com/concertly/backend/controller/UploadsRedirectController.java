package com.concertly.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Duration;
import java.util.regex.Pattern;

/**
 * R2 açıkken {@code /uploads/<anahtar>} isteğini kovanın herkese açık adresine
 * yönlendirir (302). Görsel baytları Render'dan değil Cloudflare'den akar.
 * Kalıcı (301) değil: kova adresi değişirse istemciler takılı kalmasın.
 */
@RestController
@ConditionalOnProperty(name = "app.storage.type", havingValue = "r2")
public class UploadsRedirectController {

    // MediaController'ın ürettiği adlar: <uuid>.<uzantı>
    private static final Pattern KEY = Pattern.compile("[A-Za-z0-9-]{1,64}\\.[a-z]{2,5}");

    private final String publicUrl;

    public UploadsRedirectController(@Value("${app.storage.r2.public-url}") String publicUrl) {
        String trimmed = publicUrl.trim();
        this.publicUrl = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    @GetMapping("/uploads/{key:.+}")
    public ResponseEntity<Void> redirect(@PathVariable String key) {
        if (!KEY.matcher(key).matches()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(publicUrl + "/" + key))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                .build();
    }
}
