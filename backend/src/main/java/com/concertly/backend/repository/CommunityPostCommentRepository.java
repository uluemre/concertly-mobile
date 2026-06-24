package com.concertly.backend.repository;

import com.concertly.backend.model.CommunityPostComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CommunityPostCommentRepository extends JpaRepository<CommunityPostComment, Long> {

    List<CommunityPostComment> findByCommunityPostIdOrderByCreatedAtAsc(Long communityPostId);

    long countByCommunityPostId(Long communityPostId);

    // Toplu yorum sayımı — (communityPostId, count)
    @Query("SELECT c.communityPost.id, COUNT(c) FROM CommunityPostComment c " +
           "WHERE c.communityPost.id IN :ids GROUP BY c.communityPost.id")
    List<Object[]> countByCommunityPostIdIn(@Param("ids") Collection<Long> ids);

    void deleteByCommunityPostIdIn(Collection<Long> communityPostIds);
}
