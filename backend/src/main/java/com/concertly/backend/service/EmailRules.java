package com.concertly.backend.service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * E-posta kuralı (N-22) — kayıtta ve e-posta değişikliğinde uygulanır.
 *
 * Girdi kırpılır ve küçük harfe çevrilir ("Emre@Mail.com " → "emre@mail.com"); böylece
 * aynı adres farklı yazımla ikinci kez kaydedilemez. Biçim kontrolü bilerek basit
 * tutuldu: "@" öncesi ve sonrası boşluksuz, alan adında nokta, en fazla 254 karakter.
 * Mevcut kayıtlar değiştirilmez; aramalar UserRepository.findByEmailNormalized ile
 * büyük/küçük harf duyarsız yapılır.
 */
public final class EmailRules {

    private static final Pattern VALID = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    static final String MESSAGE = "Geçerli bir e-posta adresi girin.";

    private EmailRules() {}

    public static String normalize(String raw) {
        return raw == null ? null : raw.trim().toLowerCase(Locale.ROOT);
    }

    /** Kurala uyan, sadeleştirilmiş adresi döner; uymuyorsa 400 (IllegalArgumentException). */
    public static String requireValid(String raw) {
        String email = normalize(raw);
        if (email == null || email.length() > 254 || !VALID.matcher(email).matches()) {
            throw new IllegalArgumentException(MESSAGE);
        }
        return email;
    }
}
