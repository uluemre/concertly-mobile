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

    /**
     * Mobil konser listesi: yayinda ve gelecekteki etkinlikler, istege bagli
     * sehir/sanatci suzmesiyle, sayfali.
     *
     * past=true verildiginde gecmis etkinlikler doner; mobil ekranin
     * "gecmis konserler" sekmesi bu sayede calismaya devam eder.
     *
     * Native sorgu kullaniliyor cunku Turkce karakter duyarsiz arama icin
     * Postgres translate() gerekiyor: JPQL tarafinda "Istanbul" ile "Istanbul"
     * eslesmesini guvenilir sekilde kuramiyoruz (lower() Turkce I harfini
     * beklendigi gibi katlamiyor).
     */
    @Query(value = """
            SELECT e.* FROM events e
            LEFT JOIN venues v ON v.id = e.venue_id
            LEFT JOIN artists a ON a.id = e.artist_id
            WHERE e.is_approved = true
              AND ((CAST(:past AS boolean) = false AND e.event_date >= :from)
                OR (CAST(:past AS boolean) = true  AND e.event_date <  :from))
              AND (CAST(:city AS text) IS NULL
                   OR lower(translate(v.city, 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa'))
                      LIKE '%' || lower(translate(CAST(:city AS text), 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa')) || '%')
              AND (CAST(:artist AS text) IS NULL
                   OR lower(translate(a.name, 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa'))
                      LIKE '%' || lower(translate(CAST(:artist AS text), 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa')) || '%')
            """,
            countQuery = """
            SELECT count(*) FROM events e
            LEFT JOIN venues v ON v.id = e.venue_id
            LEFT JOIN artists a ON a.id = e.artist_id
            WHERE e.is_approved = true
              AND ((CAST(:past AS boolean) = false AND e.event_date >= :from)
                OR (CAST(:past AS boolean) = true  AND e.event_date <  :from))
              AND (CAST(:city AS text) IS NULL
                   OR lower(translate(v.city, 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa'))
                      LIKE '%' || lower(translate(CAST(:city AS text), 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa')) || '%')
              AND (CAST(:artist AS text) IS NULL
                   OR lower(translate(a.name, 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa'))
                      LIKE '%' || lower(translate(CAST(:artist AS text), 'İIıŞşĞğÜüÖöÇçÂâ','IIiSsGgUuOoCcAa')) || '%')
            """,
            nativeQuery = true)
    org.springframework.data.domain.Page<Event> searchConcerts(
            @Param("city") String city,
            @Param("artist") String artist,
            @Param("from") java.time.LocalDateTime from,
            @Param("past") boolean past,
            org.springframework.data.domain.Pageable pageable);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByArtistIdOrderByEventDateDesc(Long artistId);

    // Kullanicinin kendi etkinlik onerileri (en yeni once)
    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByCreatedByIdOrderByIdDesc(Long userId);

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
    @Query("""
            SELECT e FROM Event e
            WHERE LOWER(REPLACE(e.venue.city, 'İ', 'I'))
            IN :cities
            ORDER BY e.eventDate ASC
            """)
    List<Event> findByCitiesNormalized(@Param("cities") List<String> cities);

    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByIsApproved(Boolean isApproved);

    /** Admin onay kuyruğu: listeden bilerek kaldırılanlar (delisted) kuyruğu doldurmasın. */
    @EntityGraph(attributePaths = {"artist", "venue", "createdBy"})
    List<Event> findByIsApprovedAndDelistedReasonIsNull(Boolean isApproved);

    long countByDelistedReasonIsNotNull();

    /** Yaklaşan (listelenen) konser sayısına göre sanatçılar: [artistId, konserSayısı]. */
    @Query("""
            SELECT e.artist.id, COUNT(e) FROM Event e
            WHERE e.artist IS NOT NULL AND e.eventDate >= :from
              AND e.isApproved = true AND e.delistedReason IS NULL
            GROUP BY e.artist.id
            ORDER BY COUNT(e) DESC
            """)
    List<Object[]> topArtistsByUpcomingEvents(@Param("from") java.time.LocalDateTime from,
                                              org.springframework.data.domain.Pageable pageable);

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
