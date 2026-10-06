package com.concertly.backend.repository;

import com.concertly.backend.model.ConcertBuddy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ConcertBuddyRepository extends JpaRepository<ConcertBuddy, Long> {
    List<ConcertBuddy> findByEventIdOrderByCreatedAtDesc(Long eventId);
    Optional<ConcertBuddy> findByUserIdAndEventId(Long userId, Long eventId);
    boolean existsByUserIdAndEventId(Long userId, Long eventId);

    /** Kullanıcının "arkadaş arıyorum" dediği, henüz olmamış konserler (Konser Arkadaşı destesi). */
    @Query("SELECT b FROM ConcertBuddy b JOIN FETCH b.event e " +
           "WHERE b.user.id = :userId AND e.eventDate > :now AND e.mergedIntoEventId IS NULL")
    List<ConcertBuddy> findUpcomingForUser(@Param("userId") Long userId, @Param("now") LocalDateTime now);

    /** Verilen konserlerde "arkadaş arıyorum" diyenler — tüm tablo taranmaz. */
    @Query("SELECT b FROM ConcertBuddy b JOIN FETCH b.user JOIN FETCH b.event e WHERE e.id IN :eventIds")
    List<ConcertBuddy> findForEvents(@Param("eventIds") Collection<Long> eventIds);
}
