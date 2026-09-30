package com.concertly.backend.service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Kullanıcı adı kuralı (N-21) — kayıt ve kullanıcı adı değişikliğinde uygulanır.
 *
 * 3-20 karakter; yalnızca küçük harf, rakam, "_" ve "."; en az bir harf. Boşluk ve
 * Türkçe harf paylaşım linkini (/u/ad) ve @bahsetmeyi bozuyordu; yalnızca rakamdan
 * oluşan ad ise /user/12345 linkinde kullanıcı id'siyle karışıyordu.
 * Girdi kırpılır ve küçük harfe çevrilir ("Emre" → "emre"). Mevcut, kurala uymayan
 * adlar geçerli kalır: kural yalnızca yeni ad yazılırken çalışır.
 */
public final class UsernameRules {

    private static final Pattern VALID = Pattern.compile("^(?=.*[a-z])[a-z0-9_.]{3,20}$");

    static final String MESSAGE = "Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam, _ ve . "
            + "içerebilir ve en az bir harf içermeli.";

    private UsernameRules() {}

    public static String normalize(String raw) {
        return raw == null ? null : raw.trim().toLowerCase(Locale.ROOT);
    }

    /** Kurala uyan, sadeleştirilmiş adı döner; uymuyorsa 400 (IllegalArgumentException). */
    public static String requireValid(String raw) {
        String username = normalize(raw);
        if (username == null || !VALID.matcher(username).matches()) {
            throw new IllegalArgumentException(MESSAGE);
        }
        return username;
    }
}
