package com.concertly.backend.repository;

import com.concertly.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    // 🔥 SEARCH EKLENDİ
    @Query("""
                SELECT u FROM User u
                WHERE LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))
                ORDER BY u.username ASC
            """)
    List<User> search(@Param("q") String q);
}