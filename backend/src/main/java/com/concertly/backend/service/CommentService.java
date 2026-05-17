package com.concertly.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.response.CommentResponse;
import com.concertly.backend.exception.*;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public CommentService(CommentRepository commentRepository,
                          PostRepository postRepository,
                          UserRepository userRepository,
                          NotificationService notificationService) {
        this.commentRepository   = commentRepository;
        this.postRepository      = postRepository;
        this.userRepository      = userRepository;
        this.notificationService = notificationService;
    }

    // ✅ YORUM EKLE
    @Transactional
    public CommentResponse addComment(Long userId, Long postId, CreateCommentRequest request) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("Yorum içeriği boş olamaz.");
        }

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setPost(post);
        comment.setUser(user);

        Comment saved = commentRepository.save(comment);
        notificationService.send(post.getUser().getId(), userId, "comment", "post", postId);

        return CommentResponse.from(saved);
    }

    // ✅ POST'UN YORUMLARINI GETİR
    public List<CommentResponse> getCommentsByPost(Long postId) {
        if (!postRepository.existsById(postId)) {
            throw new ResourceNotFoundException("Post bulunamadı: " + postId);
        }

        return commentRepository.findByPostIdOrderByCreatedAtDesc(postId)
                .stream()
                .map(CommentResponse::from)
                .toList();
    }

    // ✅ YORUM SİL
    @Transactional
    public void deleteComment(Long commentId, Long userId) {

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Yorum bulunamadı: " + commentId));

        if (!comment.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Bu yorumu silme yetkiniz yok.");
        }

        commentRepository.delete(comment);
    }
}