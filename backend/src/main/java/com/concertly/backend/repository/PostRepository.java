package com.concertly.backend.repository;

import com.concertly.backend.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    // ✅ FOLLOWING FEED
    @Query("""
        SELECT p FROM Post p
        JOIN Follow f ON p.user.id = f.following.id
        WHERE f.follower.id = :userId
        ORDER BY p.createdAt DESC
    """)
    List<Post> getFollowingFeed(Long userId);

    // 🔥 TRENDING (like sayısına göre)
    @Query("""
        SELECT p FROM Post p
        ORDER BY (SELECT COUNT(l) FROM Like l WHERE l.post = p) DESC,
                 p.createdAt DESC
    """)
    List<Post> findAllOrderByLikeCountDesc();

    // ✅ USER POSTS
    List<Post> findByUserIdOrderByCreatedAtDesc(Long userId);
}