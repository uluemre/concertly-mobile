package com.concertly.backend.repository;

import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EventSourceLinkRepository extends JpaRepository<EventSourceLink, Long> {

    /**
     * Etkinlik (sanatçı ve mekânıyla) aynı sorguda gelir. Senkron, gece zamanlayıcısında
     * açık bir oturum olmadan çalışır; tembel yüklenen etkinliğe dokunmak orada
     * LazyInitializationException veriyordu ve Ticketmaster her kaydı atlıyordu.
     */
    @EntityGraph(attributePaths = {"event", "event.artist", "event.venue"})
    Optional<EventSourceLink> findBySourceAndExternalId(EventSource source, String externalId);

    List<EventSourceLink> findByEventId(Long eventId);

    /** Liste ucu icin toplu yukleme; etkinlik basina ayri sorgu (N+1) olmasin. */
    List<EventSourceLink> findByEventIdIn(java.util.Collection<Long> eventIds);

    boolean existsBySourceAndExternalId(EventSource source, String externalId);

    /** Backfill icin: kaynak satiri olmayan etkinlik kimlikleri. */
    @Query("SELECT e.id FROM Event e WHERE e.externalId IS NOT NULL AND NOT EXISTS "
            + "(SELECT 1 FROM EventSourceLink l WHERE l.event.id = e.id)")
    List<Long> findEventIdsWithoutSourceLink();
}
