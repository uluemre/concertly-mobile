package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.response.CommentResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Comment;
import com.concertly.backend.model.Post;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final PostRepository    postRepository;
    private final UserRepository    userRepository;

    public CommentService(CommentRepository commentRepository,
                          PostRepository postRepository,
                          UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.postRepository    = postRepository;
        this.userRepository    = userRepository;
    }

    // ✅ YORUM EKLE
    @Transactional
    public CommentResponse addComment(Long postId, CreateCommentRequest request) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + request.getUserId()));

        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("Yorum içeriği boş olamaz.");
        }

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setPost(post);
        comment.setUser(user);

        Comment saved = commentRepository.save(comment);

        // commentCount'u güncelle
        post.setCommentCount((post.getCommentCount() != null ? post.getCommentCount() : 0) + 1);
        postRepository.save(post);

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

        // Sadece yorumun sahibi silebilir
        if (!comment.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Bu yorumu silme yetkiniz yok.");
        }

        Post post = comment.getPost();
        commentRepository.delete(comment);

        // commentCount'u güncelle
        if (post != null) {
            int current = post.getCommentCount() != null ? post.getCommentCount() : 0;
            post.setCommentCount(Math.max(0, current - 1));
            postRepository.save(post);
        }
    }
}