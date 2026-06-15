package com.concertly.backend.repository;

import com.concertly.backend.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    // Post'a ait yorumları en yeniden en eskiye sırala
    List<Comment> findByPostIdOrderByCreatedAtDesc(Long postId);
    long countByPostId(Long postId);
    void deleteByPostId(Long postId);

    // Toplu yorum sayımı — feed'deki N+1'i önlemek için (postId, count)
    @Query("SELECT c.post.id, COUNT(c) FROM Comment c WHERE c.post.id IN :postIds GROUP BY c.post.id")
    List<Object[]> countByPostIdIn(@Param("postIds") Collection<Long> postIds);
}
