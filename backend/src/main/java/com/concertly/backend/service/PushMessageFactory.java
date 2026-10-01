package com.concertly.backend.service;

import com.concertly.backend.model.Notification;
import org.springframework.stereotype.Component;

/**
 * Bildirim kaydını cihazda görünecek başlık/metne çevirir.
 *
 * Metin SUNUCUDA üretilir çünkü push uygulama kapalıyken gelir; istemcinin
 * çeviri sözlüğü o anda çalışmıyor. Dil, cihaz token'ı kaydedilirken
 * bildirilen uygulama dilidir.
 */
@Component
public class PushMessageFactory {

    /** [başlık, gövde] — gövde boşsa bildirim gönderilmez. */
    public String[] build(Notification n, String language) {
        boolean en = "en".equalsIgnoreCase(language);
        String actor = n.getActor() != null ? n.getActor().getUsername() : null;
        String extra = n.getMessage();
        String type = n.getType() == null ? "" : n.getType();

        return switch (type) {
            case "like" -> new String[] {
                    en ? "New like" : "Yeni beğeni",
                    en ? actor + " liked your post" : actor + " gönderini beğendi" };
            case "comment" -> new String[] {
                    en ? "New comment" : "Yeni yorum",
                    en ? actor + " commented on your post" : actor + " gönderine yorum yaptı" };
            case "follow" -> new String[] {
                    en ? "New follower" : "Yeni takipçi",
                    en ? actor + " started following you" : actor + " seni takip etmeye başladı" };
            case "follow_request" -> new String[] {
                    en ? "Follow request" : "Takip isteği",
                    en ? actor + " wants to follow you" : actor + " seni takip etmek istiyor" };
            case "follow_accepted" -> new String[] {
                    en ? "Request accepted" : "İstek kabul edildi",
                    en ? actor + " accepted your follow request" : actor + " takip isteğini kabul etti" };
            case "message" -> new String[] {
                    en ? "New message" : "Yeni mesaj",
                    en ? actor + " sent you a message" : actor + " sana mesaj gönderdi" };
            case "event_reminder" -> new String[] {
                    en ? "Your concert is coming up 🎤" : "Konserin yaklaşıyor 🎤",
                    extra };
            case "new_event" -> new String[] {
                    en ? "New concert 🎶" : "Yeni konser 🎶",
                    extra };
            case "daily_song" -> new String[] {
                    en ? "Song of the day 🎧" : "Günün şarkısı 🎧",
                    extra };
            case "community_invite" -> new String[] {
                    en ? "Community invite" : "Topluluk daveti",
                    en ? actor + " invited you to a community" : actor + " seni bir topluluğa davet etti" };
            case "community_comment" -> new String[] {
                    en ? "New comment" : "Yeni yorum",
                    en ? actor + " commented on your community post"
                       : actor + " topluluk gönderine yorum yaptı" };
            case "community_join_request" -> new String[] {
                    en ? "Join request" : "Katılım isteği",
                    en ? actor + " wants to join your community"
                       : actor + " topluluğuna katılmak istiyor" };
            case "community_request_approved", "community_approved" -> new String[] {
                    en ? "Community approved ✅" : "Topluluk onaylandı ✅", extra };
            case "community_rejected" -> new String[] {
                    en ? "Community rejected" : "Topluluk reddedildi", extra };
            case "badge" -> new String[] {
                    en ? "New badge! 🏅" : "Yeni rozet! 🏅",
                    en ? "You earned the \"" + badgeName(extra, true) + "\" badge."
                       : "\"" + badgeName(extra, false) + "\" rozetini kazandın!" };
            case "community_ownership" -> new String[] {
                    en ? "Community ownership" : "Topluluk sahipliği", extra };
            default -> new String[] { "Concertly", extra };
        };
    }

    /** Rozet kodu → görünen ad (N-38). Veritabanındaki ad yalnızca Türkçe olduğundan burada tutulur. */
    private static final java.util.Map<String, String[]> BADGE_NAMES = java.util.Map.of(
            "ilk_konser",      new String[] { "İlk Konser",        "First Concert" },
            "konser_kurdu",    new String[] { "Konser Kurdu",      "Concert Buff" },
            "festival_sezonu", new String[] { "Festival Sezonu",   "Festival Season" },
            "efsane_seyirci",  new String[] { "Efsane Seyirci",    "Legendary Fan" },
            "ilk_paylasim",    new String[] { "Hikaye Anlatıcısı", "Storyteller" },
            "sosyal_kelebek",  new String[] { "Sosyal Kelebek",    "Social Butterfly" },
            "icerik_ustasi",   new String[] { "İçerik Ustası",     "Content Master" },
            "yeni_uye",        new String[] { "Yeni Üye",          "New Member" });

    static String badgeName(String code, boolean en) {
        String[] names = code == null ? null : BADGE_NAMES.get(code);
        if (names == null) return code == null ? "" : code;
        return en ? names[1] : names[0];
    }
}
