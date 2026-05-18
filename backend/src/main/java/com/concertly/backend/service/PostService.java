package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.PollOptionDto;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final NotificationService notificationService;
    private final PollOptionRepository pollOptionRepository;
    private final PollVoteRepository pollVoteRepository;

    public PostService(PostRepository postRepository,
                       UserRepository userRepository,
                       EventRepository eventRepository,
                       LikeRepository likeRepository,
                       CommentRepository commentRepository,
                       NotificationService notificationService,
                       PollOptionRepository pollOptionRepository,
                       PollVoteRepository pollVoteRepository) {
        this.postRepository      = postRepository;
        this.userRepository      = userRepository;
        this.eventRepository     = eventRepository;
        this.likeRepository      = likeRepository;
        this.commentRepository   = commentRepository;
        this.notificationService = notificationService;
        this.pollOptionRepository = pollOptionRepository;
        this.pollVoteRepository   = pollVoteRepository;
    }

    private PostResponse toResponse(Post post) {
        return toResponse(post, null);
    }

    private PostResponse toResponse(Post post, Long currentUserId) {
        long likes = likeRepository.countByPostId(post.getId());
        long comments = commentRepository.countByPostId(post.getId());
        PostResponse response = PostResponse.from(post, likes, comments);

        if ("POLL".equals(post.getPostType()) && post.getPollOptions() != null) {
            Long myVotedOptionId = null;
            if (currentUserId != null) {
                myVotedOptionId = pollVoteRepository.findByUserIdAndPostId(currentUserId, post.getId())
                    .map(v -> v.getPollOption().getId())
                    .orElse(null);
            }
            final Long votedId = myVotedOptionId;
            List<PollOptionDto> options = post.getPollOptions().stream()
                .map(o -> PollOptionDto.of(
                    o.getId(),
                    o.getOptionText(),
                    pollVoteRepository.countByPollOptionId(o.getId()),
                    o.getId().equals(votedId)
                ))
                .collect(Collectors.toList());
            response.setPollOptions(options);
        }

        return response;
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
        post.setPostType(request.getPostType() != null ? request.getPostType() : "TEXT");

        if ("IMAGE".equals(post.getPostType())) {
            post.setImageUrl(request.getImageUrl());
        }

        Post saved = postRepository.save(post);

        if ("POLL".equals(post.getPostType()) && request.getPollOptions() != null) {
            for (String optText : request.getPollOptions()) {
                if (optText != null && !optText.isBlank()) {
                    PollOption opt = new PollOption();
                    opt.setPost(saved);
                    opt.setOptionText(optText.trim());
                    pollOptionRepository.save(opt);
                }
            }
            saved = postRepository.findById(saved.getId()).orElse(saved);
        }

        return toResponse(saved, userId);
    }

    // ✅ TRENDING FEED
    public List<PostResponse> getTrendingFeed(Long currentUserId) {
        return postRepository.findAll()
                .stream()
                .map(p -> toResponse(p, currentUserId))
                .toList();
    }

    // ✅ FOLLOWING FEED
    public List<PostResponse> getFollowingFeed(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        return postRepository.getFollowingFeed(userId)
                .stream()
                .map(p -> toResponse(p, userId))
                .toList();
    }

    // ✅ POLL OY VER
    public List<PollOptionDto> votePoll(Long userId, Long postId, Long optionId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        PollOption option = pollOptionRepository.findById(optionId)
            .orElseThrow(() -> new ResourceNotFoundException("Seçenek bulunamadı: " + optionId));

        // Önceki oyu sil
        pollVoteRepository.findByUserIdAndPostId(userId, postId).ifPresent(pollVoteRepository::delete);

        PollVote vote = new PollVote();
        vote.setUser(user);
        vote.setPollOption(option);
        vote.setPostId(postId);
        pollVoteRepository.save(vote);

        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));

        return post.getPollOptions().stream()
            .map(o -> PollOptionDto.of(
                o.getId(),
                o.getOptionText(),
                pollVoteRepository.countByPollOptionId(o.getId()),
                o.getId().equals(optionId)
            ))
            .collect(Collectors.toList());
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