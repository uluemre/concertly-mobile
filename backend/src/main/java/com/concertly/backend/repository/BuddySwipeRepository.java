package com.concertly.backend.repository;

import com.concertly.backend.model.BuddySwipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BuddySwipeRepository extends JpaRepository<BuddySwipe, Long> {
    Optional<BuddySwipe> findBySwiperIdAndTargetId(Long swiperId, Long targetId);
    List<BuddySwipe> findBySwiperId(Long swiperId);
    boolean existsBySwiperIdAndTargetIdAndLikedTrue(Long swiperId, Long targetId);
    List<BuddySwipe> findByTargetIdAndLikedTrue(Long targetId);

    /** N-10: iki kullanıcı arasındaki tüm swipe satırları (iki yön). */
    @Modifying
    @Query("DELETE FROM BuddySwipe bs WHERE (bs.swiperId = :a AND bs.targetId = :b) " +
           "OR (bs.swiperId = :b AND bs.targetId = :a)")
    int deleteBetween(@Param("a") Long a, @Param("b") Long b);
}
