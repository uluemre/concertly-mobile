package com.concertly.backend.model;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Kullanıcı metinlerinin uzunluk sınırları — mobildeki TextInput maxLength ile aynı.
 *
 * Veritabanı sütunları bilerek daha geniş (1000): emoji gibi çok baytlı
 * karakterler ve ileride sınırı büyütme payı için. Eskiden sütunlar 255'ti,
 * mobil 500'e izin veriyordu ve uzun gönderiler kaydedilemiyordu.
 */
public final class ContentLimits {

    public static final int POST_MAX = 500;
    public static final int COMMENT_MAX = 300;
    public static final int COMMUNITY_POST_MAX = 500;
    /** Sütun genişliği (posts / comments / community_posts .content). */
    public static final int COLUMN_LENGTH = 1000;

    private ContentLimits() {}

    public static void check(String text, int max) {
        if (text != null && text.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CONTENT_TOO_LONG");
        }
    }
}
