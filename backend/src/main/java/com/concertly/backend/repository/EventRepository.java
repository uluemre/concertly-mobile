package com.concertly.backend.repository;

import com.concertly.backend.model.Event;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    // EventResponse.from artist/venue/createdBy alanlarına erişir; liste sorgularında
    // bu to-one ilişkileri join-fetch ederek event başına ekstra select'i (N+1) önlüyoruz.

    Optional<Event> findByExternalId(String externalId);

    // İçerik bazlı mükerrer kontrolü: aynı mekân + aynı tarih/saat = aynı etkinlik
    boolean existsByVenueIdAndEventDate(Long venueId, java.time.LocalDateTime eventDate);

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
