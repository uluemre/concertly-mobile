package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    List<CommunityPost> findByCommunityIdOrderByCreatedAtDesc(Long communityId);

    long countByCommunityId(Long communityId);

    // Toplu post sayımı — (communityId, count)
    @Query("SELECT p.community.id, COUNT(p) FROM CommunityPost p WHERE p.community.id IN :ids GROUP BY p.community.id")
    List<Object[]> countByCommunityIdIn(@Param("ids") Collection<Long> ids);
}
