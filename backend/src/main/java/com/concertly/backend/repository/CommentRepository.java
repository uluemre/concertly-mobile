package com.concertly.backend.repository;

import com.concertly.backend.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    // Post'a ait yorumları en yeniden en eskiye sırala
    List<Comment> findByPostIdOrderByCreatedAtDesc(Long postId);

    // Post'un yorum sayısını say (commentCount güncellemek için alternatif)
    long countByPostId(Long postId);
}