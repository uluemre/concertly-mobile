package com.concertly.backend.repository;

import com.concertly.backend.model.Follow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    // Belirli bir follower → following ilişkisi var mı?
    Optional<Follow> findByFollowerIdAndFollowingId(Long followerId, Long followingId);

    // Kullanıcının kaç takipçisi var?
    long countByFollowingId(Long followingId);

    // Kullanıcı kaç kişiyi takip ediyor?
    long countByFollowerId(Long followerId);
}