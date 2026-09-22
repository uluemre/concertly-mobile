package com.concertly.backend.service;

import com.concertly.backend.model.Notification;
import com.concertly.backend.model.PushCategory;
import com.concertly.backend.model.User;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Push kategorileri ve metinleri.
 *
 * Kategori eşlemesi yanlışsa kullanıcı "mesaj bildirimini kapat" dediğinde
 * mesaj bildirimi almaya devam eder — güven kaybı.
 */
class PushNotificationTest {

    private final PushMessageFactory factory = new PushMessageFactory();

    private User user() {
        User u = new User();
        u.setPushEnabled(true);
        u.setPushSocial(true);
        u.setPushMessages(true);
        u.setPushEvents(true);
        u.setPushCommunities(true);
        u.setPushGames(true);
        return u;
    }

    private Notification notification(String type, String actorName, String message) {
        Notification n = new Notification();
        n.setType(type);
        n.setMessage(message);
        if (actorName != null) {
            User actor = new User();
            ReflectionTestUtils.setField(actor, "id", 9L);
            actor.setUsername(actorName);
            n.setActor(actor);
        }
        return n;
    }

    @Test
    void mapsTypesToCategories() {
        assertEquals(PushCategory.SOCIAL, PushCategory.of("like"));
        assertEquals(PushCategory.SOCIAL, PushCategory.of("follow"));
        assertEquals(PushCategory.MESSAGES, PushCategory.of("message"));
        assertEquals(PushCategory.EVENTS, PushCategory.of("event_reminder"));
        assertEquals(PushCategory.EVENTS, PushCategory.of("new_event"));
        assertEquals(PushCategory.GAMES, PushCategory.of("daily_song"));
        assertEquals(PushCategory.COMMUNITIES, PushCategory.of("community_invite"));
        assertEquals(PushCategory.COMMUNITIES, PushCategory.of("community_join_request"));
    }

    @Test
    void unknownTypeFallsBackToSocial() {
        assertEquals(PushCategory.SOCIAL, PushCategory.of("brand_new_type"));
        assertEquals(PushCategory.SOCIAL, PushCategory.of(null));
    }

    @Test
    void masterSwitchOverridesEveryCategory() {
        User u = user();
        u.setPushEnabled(false);
        for (PushCategory category : PushCategory.values()) {
            assertFalse(category.isEnabledFor(u), category + " kapalı olmalı");
        }
    }

    @Test
    void singleCategoryCanBeDisabled() {
        User u = user();
        u.setPushMessages(false);
        assertFalse(PushCategory.MESSAGES.isEnabledFor(u));
        assertTrue(PushCategory.SOCIAL.isEnabledFor(u));
    }

    @Test
    void buildsTurkishAndEnglishCopy() {
        Notification like = notification("like", "emre", null);
        assertEquals("emre gönderini beğendi", factory.build(like, "tr")[1]);
        assertEquals("emre liked your post", factory.build(like, "en")[1]);
    }

    @Test
    void systemNotificationUsesStoredMessageAsBody() {
        Notification reminder = notification("event_reminder", null, "Hadise · 24 Eylül 21:00");
        String[] text = factory.build(reminder, "tr");
        assertEquals("Konserin yaklaşıyor 🎤", text[0]);
        assertEquals("Hadise · 24 Eylül 21:00", text[1]);
    }

    /** Gövdesi olmayan bildirim cihaza gönderilmemeli (NotificationService boş gövdeyi atlar). */
    @Test
    void unknownTypeWithoutMessageHasEmptyBody() {
        String[] text = factory.build(notification("mystery", null, null), "tr");
        assertEquals("Concertly", text[0]);
        assertNull(text[1]);
    }
}
