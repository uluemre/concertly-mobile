package com.concertly.backend.repository;

import com.concertly.backend.model.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    Optional<Event> findByExternalId(String externalId);

    List<Event> findByArtistIdOrderByEventDateDesc(Long artistId);

    // 🔥 SEARCH QUERY EKLENDİ
    @Query("""
                SELECT e FROM Event e
                WHERE LOWER(e.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.artist.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(e.venue.city) LIKE LOWER(CONCAT('%', :q, '%'))
                ORDER BY e.eventDate DESC
            """)
    List<Event> search(@Param("q") String q);

    List<Event> findByVenue_CityIgnoreCase(String city);
}