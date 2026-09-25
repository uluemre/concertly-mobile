package com.concertly.backend.service;

import com.concertly.backend.model.Event;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** N-06: sanatçı sayfası ve aramanın ortak sıralaması. */
class EventOrderTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 9, 25, 12, 0);

    private static Event event(long id, LocalDateTime date) {
        Event e = new Event();
        ReflectionTestUtils.setField(e, "id", id);
        e.setEventDate(date);
        return e;
    }

    private static List<Long> ids(List<Event> events) {
        return events.stream().map(Event::getId).toList();
    }

    @Test
    void upcomingNearestFirstThenPastNewestFirst() {
        Event far = event(1, NOW.plusDays(80));
        Event near = event(2, NOW.plusDays(2));
        Event mid = event(3, NOW.plusDays(20));
        Event recentPast = event(4, NOW.minusDays(3));
        Event oldPast = event(5, NOW.minusDays(90));

        List<Event> sorted = List.of(oldPast, far, recentPast, near, mid).stream()
                .sorted(EventOrder.nearestFirst(NOW)).toList();

        assertEquals(List.of(2L, 3L, 1L, 4L, 5L), ids(sorted));
    }

    @Test
    void sameDateIsOrderedByIdSoPagesAreStable() {
        LocalDateTime d = NOW.plusDays(5);
        Event b = event(20, d);
        Event a = event(10, d);
        Event c = event(30, d);

        assertEquals(List.of(10L, 20L, 30L),
                ids(List.of(c, a, b).stream().sorted(EventOrder.nearestFirst(NOW)).toList()));
        assertEquals(List.of(30L, 20L, 10L),
                ids(List.of(a, c, b).stream().sorted(EventOrder.NEWEST_FIRST).toList()));
    }
}
