package com.concertly.backend.repository;

import com.concertly.backend.model.Like;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LikeRepository extends JpaRepository<Like, Long> {
    Optional<Like> findByUserIdAndPostId(Long userId, Long postId);
    long countByPostId(Long postId);
    void deleteByPostId(Long postId);

    /**
     * Yarış güvenli beğeni: (user, post) çiftinde kayıt varsa hiçbir şey yapmaz (0 döner),
     * eklediyse 1 döner. Unique ihlali istisnası fırlamaz, böylece açık transaction
     * "rollback-only" olmaz.
     */
    @Modifying
    @Query(value = "INSERT INTO likes (user_id, post_id) VALUES (:userId, :postId) ON CONFLICT DO NOTHING",
           nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId, @Param("postId") Long postId);

    // Toplu beğeni sayımı — feed'deki N+1'i önlemek için (postId, count)
    @Query("SELECT l.post.id, COUNT(l) FROM Like l WHERE l.post.id IN :postIds GROUP BY l.post.id")
    List<Object[]> countByPostIdIn(@Param("postIds") Collection<Long> postIds);

    // Bir kullanıcının verilen postlardan beğendiklerinin id'leri — "likedByMe" tek sorguda
    @Query("SELECT l.post.id FROM Like l WHERE l.user.id = :userId AND l.post.id IN :postIds")
    List<Long> findLikedPostIds(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);
}
