package com.concertly.backend.service;

import com.concertly.backend.model.Event;

import java.time.LocalDateTime;
import java.util.Comparator;

/**
 * Etkinlik listelerinin sıralama kuralı — sanatçı sayfası ve arama aynı kuralı kullanır.
 *
 * "En yakın önce": yaklaşan etkinlikler önce, en yakın tarih en üstte; ardından geçmiş
 * etkinlikler, en yeni en üstte. Aynı tarihli kayıtlarda id ile sabit sıra verilir ki
 * aynı istek her seferinde aynı sırayı döndürsün.
 *
 * "Yaklaşan" tanımı ConcertAttendanceService ile aynı: tarihi henüz geçmemiş (>= şimdi).
 */
public final class EventOrder {

    private EventOrder() {}

    /** Yaklaşanlar (en yakın önce), sonra geçmişler (en yeni önce); eşit tarihte id. */
    public static Comparator<Event> nearestFirst(LocalDateTime now) {
        return (a, b) -> {
            boolean aPast = isPast(a, now);
            boolean bPast = isPast(b, now);
            if (aPast != bPast) return aPast ? 1 : -1;
            return aPast ? NEWEST_FIRST.compare(a, b) : OLDEST_FIRST.compare(a, b);
        };
    }

    /** Tarihe göre artan; eşit tarihte küçük id önce. Tarihsiz kayıtlar sona. */
    public static final Comparator<Event> OLDEST_FIRST = Comparator
            .comparing(Event::getEventDate, Comparator.nullsLast(Comparator.<LocalDateTime>naturalOrder()))
            .thenComparing(Event::getId, Comparator.nullsLast(Comparator.<Long>naturalOrder()));

    /** Tarihe göre azalan (en yeni önce); eşit tarihte büyük id önce. Tarihsiz kayıtlar sona. */
    public static final Comparator<Event> NEWEST_FIRST = Comparator
            .comparing(Event::getEventDate, Comparator.nullsLast(Comparator.<LocalDateTime>reverseOrder()))
            .thenComparing(Event::getId, Comparator.nullsLast(Comparator.<Long>reverseOrder()));

    private static boolean isPast(Event e, LocalDateTime now) {
        return e.getEventDate() != null && e.getEventDate().isBefore(now);
    }
}
