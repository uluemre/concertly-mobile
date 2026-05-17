package com.concertly.backend.repository;

import com.concertly.backend.model.Follow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    Optional<Follow> findByFollowerIdAndFollowingId(Long followerId, Long followingId);

    long countByFollowingId(Long followingId);
    long countByFollowerId(Long followerId);

    List<Follow> findAllByFollowingId(Long followingId);
    List<Follow> findAllByFollowerId(Long followerId);
}