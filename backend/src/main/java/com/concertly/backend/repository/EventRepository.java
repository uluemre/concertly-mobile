package com.concertly.backend.repository;

import com.concertly.backend.model.Event;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    // EventResponse.from artist/venue/createdBy alanlarına erişir; liste sorgularında
    // bu to-one ilişkileri join-fetch ederek event başına ekstra select'i (N+1) önlüyoruz.

    Optional<Event> findByExternalId(String externalId);

    // İçerik bazlı mükerrer kontrolü: aynı mekân + aynı tarih/saat = aynı etkinlik
    boolean existsByVenueIdAndEventDate(Long venueId, java.time.LocalDateTime eventDate);

    /**
     * Removes only an orphan duplicate. User activity is deliberately preserved:
     * an event with attendance, bookmarks, reviews, posts, buddy records,
     * verification records or setlists is never deleted by background sync.
     */
    @Modifying
    @Transactional
    @Query(value = """
            DELETE FROM events e
            WHERE e.id = :eventId
              AND NOT EXISTS (SELECT 1 FROM event_attendances ea WHERE ea.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM concert_buddies cb WHERE cb.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM event_verifications ev WHERE ev.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM event_bookmarks eb WHERE eb.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM event_reviews er WHERE er.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.event_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM setlist_submissions ss WHERE ss.event_id = e.id)
            """, nativeQuery = true)
    int deleteIfUnreferenced(@Param("eventId") Long eventId);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByArtistIdOrderByEventDateDesc(Long artistId);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByVenueIdOrderByEventDateAsc(Long venueId);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByEventDateBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    @Override
    List<Event> findAll();

    // 🔥 SEARCH QUERY EKLENDİ
    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    @Query("""
                SELECT e FROM Event e
                WHERE LOWER(e.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.artist.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.venue.city) LIKE LOWER(CONCAT('%', :q, '%'))
                ORDER BY e.eventDate DESC
            """)
    List<Event> search(@Param("q") String q);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    @Query("SELECT e FROM Event e WHERE LOWER(REPLACE(e.venue.city, 'İ', 'I')) = LOWER(REPLACE(:city, 'İ', 'I'))")
    List<Event> findByCityNormalized(@Param("city") String city);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByIsApproved(Boolean isApproved);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    @Query("""
                SELECT e FROM Event e
                WHERE LOWER(REPLACE(e.venue.city, 'İ', 'I')) = LOWER(REPLACE(:city, 'İ', 'I'))
                AND LOWER(e.genre) IN :genres
                ORDER BY e.eventDate DESC
            """)
    List<Event> findByVenueCityAndGenreIn(
        @Param("city") String city,
        @Param("genres") List<String> genres
    );
}
