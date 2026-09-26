package com.concertly.backend.repository;

import com.concertly.backend.model.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findByExternalId(String externalId);
    Optional<Venue> findByNameAndCity(String name, String city);
    Optional<Venue> findFirstByNameAndCity(String name, String city);

    /** Mekan adına göre arama; Türkçe harf / büyük-küçük harf duyarsız, % ve _ joker değil (SearchText). */
    default List<Venue> search(String q) {
        return searchByPattern(SearchText.containsPattern(q));
    }

    @Query("SELECT v FROM Venue v"
            + " WHERE " + SearchText.FOLD_OPEN + "v.name" + SearchText.FOLD_CLOSE + " LIKE :pattern ESCAPE '!'"
            + " ORDER BY v.name ASC, v.id ASC")
    List<Venue> searchByPattern(@Param("pattern") String pattern);
}