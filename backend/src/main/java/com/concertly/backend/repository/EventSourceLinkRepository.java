package com.concertly.backend.repository;

import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.EventSourceLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EventSourceLinkRepository extends JpaRepository<EventSourceLink, Long> {

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
