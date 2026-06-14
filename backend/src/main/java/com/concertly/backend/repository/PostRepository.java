package com.concertly.backend.repository;

import com.concertly.backend.model.Post;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {

    // ✅ FOLLOWING FEED (sayfalı)
    @Query("""
                SELECT p FROM Post p
                JOIN Follow f ON p.user.id = f.following.id
                WHERE f.follower.id = :userId
                ORDER BY p.createdAt DESC
            """)
    List<Post> getFollowingFeed(Long userId, Pageable pageable);

    // ✅ TÜM POSTLAR — en yeni önce (sayfalı, trending feed için)
    List<Post> findByOrderByCreatedAtDesc(Pageable pageable);

    // ✅ USER POSTS
    List<Post> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Post> findByEventArtistIdOrderByCreatedAtDesc(Long artistId);

}