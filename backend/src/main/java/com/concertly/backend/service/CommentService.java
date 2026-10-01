package com.concertly.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

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
    private final ContentLimitService contentLimitService;
    private final ModerationService moderationService;
    private final PrivacyService privacyService;

    public CommentService(CommentRepository commentRepository,
                          PostRepository postRepository,
                          UserRepository userRepository,
                          NotificationService notificationService,
                          ContentLimitService contentLimitService,
                          ModerationService moderationService,
                          PrivacyService privacyService) {
        this.commentRepository   = commentRepository;
        this.postRepository      = postRepository;
        this.userRepository      = userRepository;
        this.notificationService = notificationService;
        this.contentLimitService = contentLimitService;
        this.moderationService   = moderationService;
        this.privacyService      = privacyService;
    }

    /**
     * Gizlenen gönderi yalnızca sahibine, engelleme (iki yönlü) olan gönderi hiç kimseye
     * görünmez; PostService.getPost ile aynı kural (SEC-03). Varlık sızmasın diye 404.
     */
    private void assertPostVisible(Post post, Long viewerId) {
        boolean isOwner = post.getUser() != null && post.getUser().getId().equals(viewerId);
        boolean hiddenPost = Boolean.TRUE.equals(post.getIsHidden()) && !isOwner;
        boolean blocked = post.getUser() != null
                && moderationService.getHiddenUserIds(viewerId).contains(post.getUser().getId());
        // SEC-05: özel hesabın gönderisi yetkisiz izleyiciye hiç yokmuş gibi görünür
        boolean privateHidden = post.getUser() != null && !privacyService.canViewContent(viewerId, post.getUser());
        if (hiddenPost || blocked || privateHidden) {
            throw new ResourceNotFoundException("Post bulunamadı: " + post.getId());
        }
    }

    // ✅ YORUM EKLE
    @Transactional
    public CommentResponse addComment(Long userId, Long postId, CreateCommentRequest request) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));

        assertPostVisible(post, userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        if (request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("Yorum içeriği boş olamaz.");
        }
        ContentLimits.check(request.getContent(), ContentLimits.COMMENT_MAX);
        contentLimitService.checkComment(userId);

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setPost(post);
        comment.setUser(user);

        Comment saved = commentRepository.save(comment);
        notificationService.send(post.getUser().getId(), userId, "comment", "post", postId);

        return CommentResponse.from(saved);
    }

    // ✅ POST'UN YORUMLARINI GETİR
    @Transactional(readOnly = true)
    public List<CommentResponse> getCommentsByPost(Long postId, Long viewerId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));
        assertPostVisible(post, viewerId);
        Set<Long> hidden = moderationService.getHiddenUserIds(viewerId);

        return commentRepository.findByPostIdOrderByCreatedAtDesc(postId)
                .stream()
                .filter(c -> !c.getIsHidden())
                .filter(c -> c.getUser() == null || !hidden.contains(c.getUser().getId()))
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