package com.concertly.backend.model;

/** Kullanıcıya kimin direkt mesaj atabileceği. */
public enum MessagePrivacy {
    /** Herkes yazabilir (varsayılan). */
    EVERYONE,
    /** Yalnızca kullanıcının takip ettiği kişiler yazabilir. */
    FOLLOWING,
    /** Kimse yeni sohbet başlatamaz. */
    NOBODY
}
