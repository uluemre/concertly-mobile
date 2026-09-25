package com.concertly.backend.service;

import com.concertly.backend.dto.response.BadgeResponse;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Badge;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.User;
import com.concertly.backend.model.UserBadge;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.BadgeRepository;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserBadgeRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Konser istatistiklerinin tek tanımı: "Gidiyorum" + geçmiş = katıldığı,
 * "Gidiyorum" + gelecek = katılacağı. Profil, pasaport ve rozetler aynı sayıyı görür.
 */
class ConcertAttendanceStatsTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 25, 12, 0);

    private static long ids = 1;

    private static Event event(LocalDateTime date, String city) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", ids++);
        e.setEventDate(date);
        Venue v = new Venue();
        v.setCity(city);
        e.setVenue(v);
        return e;
    }

    private static EventAttendance going(Event e) {
        EventAttendance a = new EventAttendance();
        a.setEvent(e);
        a.setStatus(AttendanceStatus.GOING);
        return a;
    }

    private static ConcertAttendanceService serviceWith(Event... events) {
        EventAttendanceRepository repo = mock(EventAttendanceRepository.class);
        List<EventAttendance> list = new ArrayList<>();
        for (Event e : events) list.add(going(e));
        when(repo.findByUserIdAndStatus(anyLong(), eq(AttendanceStatus.GOING))).thenReturn(list);
        return new ConcertAttendanceService(repo);
    }

    @Test
    void A_onePastGoingIsAttended() {
        ConcertAttendanceService s = serviceWith(event(NOW.minusDays(10), "Ankara"));
        assertEquals(1, s.attended(1L, NOW).size());
        assertEquals(0, s.upcoming(1L, NOW).size());
    }

    @Test
    void B_oneFutureGoingIsUpcoming() {
        ConcertAttendanceService s = serviceWith(event(NOW.plusDays(10), "Ankara"));
        assertEquals(0, s.attended(1L, NOW).size());
        assertEquals(1, s.upcoming(1L, NOW).size());
    }

    @Test
    void C_twoPastThreeFutureSplitCorrectlyAndOrdered() {
        Event p1 = event(NOW.minusDays(40), "Ankara");
        Event p2 = event(NOW.minusDays(5), "Ankara");
        Event f1 = event(NOW.plusDays(30), "Ankara");
        Event f2 = event(NOW.plusDays(2), "Ankara");
        Event f3 = event(NOW.plusDays(9), "Ankara");
        ConcertAttendanceService s = serviceWith(p1, f1, p2, f2, f3);

        List<Event> attended = s.attended(1L, NOW);
        List<Event> upcoming = s.upcoming(1L, NOW);
        assertEquals(2, attended.size());
        assertEquals(3, upcoming.size());
        assertEquals(List.of(p2, p1), attended, "katıldıkları en yeni önce");
        assertEquals(List.of(f2, f3, f1), upcoming, "katılacakları en yakın önce");
    }

    @Test
    void D_istanbulSpellingsAreOneCity() {
        List<Event> events = List.of(
                event(NOW.minusDays(1), "Istanbul"),
                event(NOW.minusDays(2), "İstanbul"),
                event(NOW.minusDays(3), " İSTANBUL "),
                event(NOW.minusDays(4), "Ankara"),
                event(NOW.minusDays(5), null));
        assertEquals(2, ConcertAttendanceService.countCities(events));
        assertEquals(ConcertAttendanceService.cityKey("Istanbul"), ConcertAttendanceService.cityKey("İstanbul"));
        assertNull(ConcertAttendanceService.cityKey("  "));
    }

    // ── Rozetler ────────────────────────────────────────────────────────────

    private static Badge badge(String code) {
        Badge b = new Badge();
        b.setCode(code);
        b.setName(code);
        return b;
    }

    @Test
    void F_futureGoingDoesNotCountTowardsBadges() {
        UserBadgeRepository userBadges = mock(UserBadgeRepository.class);
        BadgeRepository badges = mock(BadgeRepository.class);
        UserRepository users = mock(UserRepository.class);
        when(badges.findAll()).thenReturn(List.of(badge("ilk_konser"), badge("konser_kurdu")));
        when(badges.findByCode(anyString())).thenAnswer(inv -> Optional.of(badge(inv.getArgument(0))));
        when(users.findById(anyLong())).thenReturn(Optional.of(new User()));
        when(userBadges.findByUserId(anyLong())).thenReturn(List.of());

        // 0 geçmiş, 3 gelecek "Gidiyorum"
        ConcertAttendanceService stats = serviceWith(
                event(LocalDateTime.now().plusDays(3), "Ankara"),
                event(LocalDateTime.now().plusDays(4), "Ankara"),
                event(LocalDateTime.now().plusDays(5), "Ankara"));
        BadgeService service = new BadgeService(badges, userBadges, users, stats, mock(PostRepository.class));

        List<BadgeResponse> result = service.getAllBadgesWithStatus(7L);

        BadgeResponse ilk = result.stream().filter(b -> "ilk_konser".equals(b.getCode())).findFirst().orElseThrow();
        assertEquals(0, ilk.getProgress(), "gelecekteki konser katılım sayılmaz");
        assertFalse(ilk.isEarned());
        verify(userBadges, never()).save(argThat(ub -> "ilk_konser".equals(ub.getBadge().getCode())));
    }

    @Test
    void G_previouslyEarnedBadgesAreKept() {
        UserBadgeRepository userBadges = mock(UserBadgeRepository.class);
        BadgeRepository badges = mock(BadgeRepository.class);
        Badge festival = badge("festival_sezonu");
        when(badges.findAll()).thenReturn(List.of(festival));
        UserBadge earned = new UserBadge();
        earned.setBadge(festival);
        when(userBadges.findByUserId(anyLong())).thenReturn(List.of(earned));
        when(userBadges.existsByUserIdAndBadgeCode(anyLong(), anyString())).thenReturn(true);

        // Eski kuralla (gelecek dahil) kazanılmış ama şu an yalnızca 1 geçmiş konser var
        ConcertAttendanceService stats = serviceWith(event(LocalDateTime.now().minusDays(1), "Ankara"));
        BadgeService service = new BadgeService(badges, userBadges, mock(UserRepository.class), stats, mock(PostRepository.class));

        BadgeResponse r = service.getAllBadgesWithStatus(7L).get(0);

        assertTrue(r.isEarned(), "önceden kazanılmış rozet korunur");
        assertEquals(1, r.getProgress());
        verify(userBadges, never()).delete(any());
        verify(userBadges, never()).deleteAll(any());
    }
}
