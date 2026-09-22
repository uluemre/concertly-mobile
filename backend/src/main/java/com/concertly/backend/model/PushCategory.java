package com.concertly.backend.model;

/**
 * Bildirim tiplerini kullanıcının kapatabildiği kategorilere eşler.
 * Tip listesi büyüdükçe burayı güncellemek yeterli — gönderim tarafı
 * kategoriyi sorar, tip adını bilmez.
 */
public enum PushCategory {
    SOCIAL,
    MESSAGES,
    EVENTS,
    COMMUNITIES,
    GAMES;

    public static PushCategory of(String type) {
        if (type == null) return SOCIAL;
        if (type.startsWith("community")) return COMMUNITIES;
        return switch (type) {
            case "message" -> MESSAGES;
            case "event_reminder", "new_event" -> EVENTS;
            case "daily_song" -> GAMES;
            default -> SOCIAL;
        };
    }

    /** Kullanıcının bu kategoriyi açık bırakıp bırakmadığı. */
    public boolean isEnabledFor(User user) {
        if (!Boolean.TRUE.equals(user.getPushEnabled())) return false;
        return switch (this) {
            case SOCIAL -> Boolean.TRUE.equals(user.getPushSocial());
            case MESSAGES -> Boolean.TRUE.equals(user.getPushMessages());
            case EVENTS -> Boolean.TRUE.equals(user.getPushEvents());
            case COMMUNITIES -> Boolean.TRUE.equals(user.getPushCommunities());
            case GAMES -> Boolean.TRUE.equals(user.getPushGames());
        };
    }
}
