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

    long countByUserIdAndCreatedAtAfter(Long userId, java.time.LocalDateTime since);

    // Toplu yorum sayımı — (communityPostId, count)
    @Query("SELECT c.communityPost.id, COUNT(c) FROM CommunityPostComment c " +
           "WHERE c.communityPost.id IN :ids GROUP BY c.communityPost.id")
    List<Object[]> countByCommunityPostIdIn(@Param("ids") Collection<Long> ids);

    // B11: gizli yorumlar hariç sayım (yönetici olmayanlar için)
    @Query("SELECT c.communityPost.id, COUNT(c) FROM CommunityPostComment c " +
           "WHERE c.communityPost.id IN :ids AND (c.isHidden IS NULL OR c.isHidden = false) " +
           "GROUP BY c.communityPost.id")
    List<Object[]> countVisibleByCommunityPostIdIn(@Param("ids") Collection<Long> ids);

    void deleteByCommunityPostIdIn(Collection<Long> communityPostIds);
}
