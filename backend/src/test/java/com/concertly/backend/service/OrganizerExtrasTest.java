package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Organizatör profili/takip, katılımcılara duyuru ve etkinlik sahiplenme kuralları. */
class OrganizerExtrasTest {

    private final OrganizerService organizerService = mock(OrganizerService.class);
    private final OrganizerRepository organizers = mock(OrganizerRepository.class);
    private final EventRepository events = mock(EventRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);

    private Organizer org;
    private Event event;

    @BeforeEach
    void setUp() {
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 7L);
        org = new Organizer();
        ReflectionTestUtils.setField(org, "id", 3L);
        org.setOwner(owner);
        org.setName("Pozitif");
        when(organizerService.requireOrganizer(7L)).thenReturn(org);
        when(organizers.findById(3L)).thenReturn(Optional.of(org));

        event = new Event();
        ReflectionTestUtils.setField(event, "id", 100L);
        event.setName("Konser");
        event.setOrganizerId(3L);
        event.setEventDate(LocalDateTime.now().plusDays(5));
        when(events.findById(100L)).thenReturn(Optional.of(event));
    }

    private static String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    // ── Duyuru ───────────────────────────────────────────────────────────────

    private OrganizerAnnouncementService announcer(OrganizerAnnouncementRepository repo) {
        return new OrganizerAnnouncementService(organizerService, events, repo, notifications, jdbc);
    }

    @Test
    void announcementGoesToEveryAttendeeWithoutDedupe() {
        OrganizerAnnouncementRepository repo = mock(OrganizerAnnouncementRepository.class);
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(jdbc.queryForList(contains("'GOING'"), eq(Long.class), eq(100L), eq(7L))).thenReturn(List.of(20L, 21L));
        var out = announcer(repo).announce(7L, 100L, "  Kapılar   20:00'de açılıyor ", "GOING");
        assertEquals(2, out.get("recipients"));
        verify(notifications).sendSystemAlways(20L, "event_announcement", "event", 100L, "Pozitif: Kapılar 20:00'de açılıyor");
        verify(notifications).sendSystemAlways(eq(21L), anyString(), anyString(), anyLong(), anyString());
        verify(notifications, never()).sendSystem(anyLong(), anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void announcementRules() {
        OrganizerAnnouncementRepository repo = mock(OrganizerAnnouncementRepository.class);
        assertEquals("MESSAGE_INVALID", reason(() -> announcer(repo).announce(7L, 100L, "ok", "GOING")));
        when(repo.existsByEventIdAndCreatedAtAfter(eq(100L), any())).thenReturn(true);
        assertEquals("ANNOUNCE_LIMIT", reason(() -> announcer(repo).announce(7L, 100L, "Yarın görüşürüz", "GOING")));
        org.setCanAnnounce(false);
        assertEquals("ANNOUNCE_DISABLED", reason(() -> announcer(repo).announce(7L, 100L, "Yarın görüşürüz", "GOING")));
        org.setCanAnnounce(true);
        event.setOrganizerId(9L);
        assertEquals("NOT_YOUR_EVENT", reason(() -> announcer(repo).announce(7L, 100L, "Yarın görüşürüz", "GOING")));
        verifyNoInteractions(notifications);
    }

    @Test
    void pastAndCancelledEventsCannotBeAnnounced() {
        OrganizerAnnouncementRepository repo = mock(OrganizerAnnouncementRepository.class);
        event.setEventDate(LocalDateTime.now().minusDays(2));
        assertEquals("EVENT_PAST", reason(() -> announcer(repo).announce(7L, 100L, "Teşekkürler", "GOING")));
        event.setEventDate(LocalDateTime.now().plusDays(1));
        event.setDelistedReason(EventCancellationService.REASON);
        assertEquals("EVENT_CANCELLED", reason(() -> announcer(repo).announce(7L, 100L, "Teşekkürler", "GOING")));
    }

    // ── Sahiplenme ───────────────────────────────────────────────────────────

    private EventClaimService claims(EventClaimRepository repo) {
        return new EventClaimService(organizerService, organizers, events, repo, notifications, jdbc);
    }

    @Test
    void onlyOrganizerlessFutureEventsCanBeClaimed() {
        EventClaimRepository repo = mock(EventClaimRepository.class);
        assertEquals("EVENT_HAS_ORGANIZER", reason(() -> claims(repo).claim(7L, 100L, null)));
        event.setOrganizerId(null);
        when(repo.existsByEventIdAndOrganizerIdAndStatus(100L, 3L, EventClaim.Status.PENDING)).thenReturn(true);
        assertEquals("CLAIM_PENDING", reason(() -> claims(repo).claim(7L, 100L, null)));
        event.setEventDate(LocalDateTime.now().minusDays(1));
        assertEquals("EVENT_PAST", reason(() -> claims(repo).claim(7L, 100L, null)));
    }

    @Test
    void approvalBindsEventAndRejectsCompetingClaims() {
        EventClaimRepository repo = mock(EventClaimRepository.class);
        event.setOrganizerId(null);
        EventClaim mine = new EventClaim(100L, 3L, "Biz düzenliyoruz");
        ReflectionTestUtils.setField(mine, "id", 1L);
        EventClaim other = new EventClaim(100L, 4L, null);
        ReflectionTestUtils.setField(other, "id", 2L);
        Organizer otherOrg = new Organizer();
        User otherOwner = new User();
        ReflectionTestUtils.setField(otherOwner, "id", 8L);
        otherOrg.setOwner(otherOwner);
        when(repo.findById(1L)).thenReturn(Optional.of(mine));
        when(repo.findByEventIdAndStatus(100L, EventClaim.Status.PENDING)).thenAnswer(inv -> new ArrayList<>(List.of(other)));
        when(organizers.findById(4L)).thenReturn(Optional.of(otherOrg));

        claims(repo).approve(1L, "d");
        assertEquals(3L, event.getOrganizerId());
        assertTrue(event.getIsVerified());
        assertEquals(EventClaim.Status.APPROVED, mine.getStatus());
        assertEquals(EventClaim.Status.REJECTED, other.getStatus());
        verify(notifications).sendSystem(eq(7L), eq("claim_approved"), eq("event"), eq(100L), anyString());
        verify(notifications).sendSystem(eq(8L), eq("claim_rejected"), eq("event"), eq(100L), anyString());
        assertEquals("CLAIM_ALREADY_REVIEWED", reason(() -> claims(repo).approve(1L, "d")));
    }

    // ── Takip ────────────────────────────────────────────────────────────────

    @Test
    void ownerCannotFollowOwnOrganizerAndSuspendedIsHidden() {
        OrganizerFollowRepository follows = mock(OrganizerFollowRepository.class);
        OrganizerProfileService profiles = new OrganizerProfileService(organizers, follows, organizerService, notifications, jdbc);
        assertEquals("CANNOT_FOLLOW_SELF", reason(() -> profiles.follow(3L, 7L, true)));
        when(follows.findByOrganizerIdAndUserId(3L, 20L)).thenReturn(Optional.empty());
        profiles.follow(3L, 20L, true);
        verify(follows).save(any(OrganizerFollow.class));
        org.setActive(false);
        assertThrows(RuntimeException.class, () -> profiles.follow(3L, 20L, true));
    }

    @Test
    void newEventNotifiesFollowersOnce() {
        OrganizerFollowRepository follows = mock(OrganizerFollowRepository.class);
        when(follows.findByOrganizerId(3L)).thenReturn(List.of(new OrganizerFollow(3L, 20L), new OrganizerFollow(3L, 21L)));
        new OrganizerProfileService(organizers, follows, organizerService, notifications, jdbc).notifyFollowers(org, event);
        verify(notifications).sendSystem(20L, "organizer_event", "event", 100L, "Pozitif — Konser");
        verify(notifications).sendSystem(eq(21L), eq("organizer_event"), eq("event"), eq(100L), anyString());
    }
}
