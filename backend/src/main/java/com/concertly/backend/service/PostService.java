package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final NotificationService notificationService;

    public PostService(PostRepository postRepository,
                       UserRepository userRepository,
                       EventRepository eventRepository,
                       LikeRepository likeRepository,
                       CommentRepository commentRepository,
                       NotificationService notificationService) {
        this.postRepository      = postRepository;
        this.userRepository      = userRepository;
        this.eventRepository     = eventRepository;
        this.likeRepository      = likeRepository;
        this.commentRepository   = commentRepository;
        this.notificationService = notificationService;
    }

    // 🔥 CORE: Post → Response dönüşüm
    private PostResponse toResponse(Post post) {
        long likes = likeRepository.countByPostId(post.getId());
        long comments = commentRepository.countByPostId(post.getId());
        return PostResponse.from(post, likes, comments);
    }

    // ✅ POST OLUŞTUR
    public PostResponse createPost(Long userId, CreatePostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        Event event = eventRepository.findById(request.getEventId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etkinlik bulunamadı: " + request.getEventId()));

        Post post = new Post();
        post.setContent(request.getContent());
        post.setUser(user);
        post.setEvent(event);

        return toResponse(postRepository.save(post));
    }

    // ✅ TRENDING FEED
    public List<PostResponse> getTrendingFeed() {
        return postRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ✅ FOLLOWING FEED
    public List<PostResponse> getFollowingFeed(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        return postRepository.getFollowingFeed(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ✅ LIKE
    public void likePost(Long userId, Long postId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));

        if (likeRepository.findByUserIdAndPostId(userId, postId).isPresent()) {
            throw new AlreadyExistsException("Bu postu zaten beğendiniz.");
        }

        Like like = new Like();
        like.setUser(user);
        like.setPost(post);

        likeRepository.save(like);
        notificationService.send(post.getUser().getId(), userId, "like", "post", postId);
    }

    // ✅ UNLIKE
    public void unlikePost(Long userId, Long postId) {
        postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));

        Like like = likeRepository.findByUserIdAndPostId(userId, postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Bu post daha önce beğenilmemiş."));

        likeRepository.delete(like);

        // ❌ likeCount yok artık
    }
}