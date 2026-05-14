package com.concertly.backend.repository;

import com.concertly.backend.model.Community;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommunityRepository extends JpaRepository<Community, Long> {

    List<Community> findByType(String type);

    @Query("""
                SELECT c FROM Community c
                WHERE LOWER(c.type) IN :types
                ORDER BY c.createdAt DESC
            """)
    List<Community> findByTypeIn(@Param("types") List<String> types);

    @Query("""
                SELECT c FROM Community c
                WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(c.city) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(c.tags) LIKE LOWER(CONCAT('%', :q, '%'))
                ORDER BY c.createdAt DESC
            """)
    List<Community> search(@Param("q") String q);
}
