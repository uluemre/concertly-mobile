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
            case "event_cancelled" -> new String[] {
                    en ? "Concert cancelled" : "Konser iptal edildi",
                    en ? "\"" + extra + "\" has been cancelled." : "\"" + extra + "\" iptal edildi." };
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
    private static final java.util.Map<String, String[]> BADGE_NAMES = java.util.Map.ofEntries(
            java.util.Map.entry("ilk_konser", new String[] { "İlk Konser", "First Concert" }),
            java.util.Map.entry("konser_kurdu", new String[] { "Konser Kurdu", "Concert Buff" }),
            java.util.Map.entry("festival_sezonu", new String[] { "Festival Sezonu", "Festival Season" }),
            java.util.Map.entry("efsane_seyirci", new String[] { "Efsane Seyirci", "Legendary Fan" }),
            java.util.Map.entry("ilk_paylasim", new String[] { "Hikaye Anlatıcısı", "Storyteller" }),
            java.util.Map.entry("sosyal_kelebek", new String[] { "Sosyal Kelebek", "Social Butterfly" }),
            java.util.Map.entry("icerik_ustasi", new String[] { "İçerik Ustası", "Content Master" }),
            java.util.Map.entry("yeni_uye", new String[] { "Yeni Üye", "New Member" }),
            java.util.Map.entry("yola_cikan", new String[] { "Yola Çıkan", "On the Road" }),
            java.util.Map.entry("sehir_gezgini", new String[] { "Şehir Gezgini", "City Hopper" }),
            java.util.Map.entry("turkiye_turu", new String[] { "Türkiye Turu", "Turkey Tour" }),
            java.util.Map.entry("sadik_hayran", new String[] { "Sadık Hayran", "Loyal Fan" }),
            java.util.Map.entry("gercek_fan", new String[] { "Gerçek Fan", "True Fan" }),
            java.util.Map.entry("muzik_kasifi", new String[] { "Müzik Kâşifi", "Music Explorer" }),
            java.util.Map.entry("kesif_tutkunu", new String[] { "Keşif Tutkunu", "Avid Explorer" }),
            java.util.Map.entry("koleksiyoncu", new String[] { "Koleksiyoncu", "Collector" }),
            java.util.Map.entry("kulak_misafiri", new String[] { "Kulak Misafiri", "Eavesdropper" }),
            java.util.Map.entry("kulagi_delik", new String[] { "Kulağı Delik", "Sharp Ears" }),
            java.util.Map.entry("muzik_dahisi", new String[] { "Müzik Dahisi", "Music Genius" }),
            java.util.Map.entry("topluluk_ruhu", new String[] { "Topluluk Ruhu", "Community Spirit" }),
            java.util.Map.entry("kurucu", new String[] { "Kurucu", "Founder" }));

    static String badgeName(String code, boolean en) {
        String[] names = code == null ? null : BADGE_NAMES.get(code);
        if (names == null) return code == null ? "" : code;
        return en ? names[1] : names[0];
    }
}
