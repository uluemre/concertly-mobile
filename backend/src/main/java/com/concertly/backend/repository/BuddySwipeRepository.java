package com.concertly.backend.repository;

import com.concertly.backend.model.BuddySwipe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BuddySwipeRepository extends JpaRepository<BuddySwipe, Long> {
    Optional<BuddySwipe> findBySwiperIdAndTargetId(Long swiperId, Long targetId);
    List<BuddySwipe> findBySwiperId(Long swiperId);
    boolean existsBySwiperIdAndTargetIdAndLikedTrue(Long swiperId, Long targetId);
}
