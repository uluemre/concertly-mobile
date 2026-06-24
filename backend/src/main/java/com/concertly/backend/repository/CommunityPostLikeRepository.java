package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPostLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface CommunityPostLikeRepository extends JpaRepository<CommunityPostLike, Long> {

    Optional<CommunityPostLike> findByUserIdAndCommunityPostId(Long userId, Long communityPostId);

    long countByCommunityPostId(Long communityPostId);

    void deleteByCommunityPostIdIn(Collection<Long> communityPostIds);
}
