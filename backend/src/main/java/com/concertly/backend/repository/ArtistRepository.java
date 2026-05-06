package com.concertly.backend.repository;

import com.concertly.backend.model.Artist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ArtistRepository extends JpaRepository<Artist, Long> {

    Optional<Artist> findByExternalId(String externalId);

    @Query("""
                SELECT a FROM Artist a
                WHERE LOWER(a.name) LIKE LOWER(CONCAT('%', :q, '%'))
                ORDER BY a.name ASC
            """)
    List<Artist> search(@Param("q") String q);
}