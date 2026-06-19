package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.PollOptionDto;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final BadgeService badgeService;
    private final ModerationService moderationService;

    public PostService(PostRepository postRepository,
                       UserRepository userRepository,
                       EventRepository eventRepository,
                       LikeRepository likeRepository,
                       CommentRepository commentRepository,
                       NotificationService notificationService,
                       PollOptionRepository pollOptionRepository,
                       PollVoteRepository pollVoteRepository,
                       BadgeService badgeService,
                       ModerationService moderationService) {
        this.postRepository      = postRepository;
        this.userRepository      = userRepository;
        this.eventRepository     = eventRepository;
        this.likeRepository      = likeRepository;
        this.commentRepository   = commentRepository;
        this.notificationService = notificationService;
        this.pollOptionRepository = pollOptionRepository;
        this.pollVoteRepository   = pollVoteRepository;
        this.badgeService         = badgeService;
        this.moderationService    = moderationService;
    }

    private PostResponse toResponse(Post post, Long currentUserId) {
        return toResponses(List.of(post), currentUserId).get(0);
    }

    // Bir post listesini tek seferde DTO'ya çevirir; like/comment/oy sayımlarını
    // toplu sorgularla çeker (feed'deki N+1 problemini önler).
    private List<PostResponse> toResponses(List<Post> posts, Long currentUserId) {
        if (posts.isEmpty()) return List.of();

        List<Long> postIds = posts.stream().map(Post::getId).toList();

        Map<Long, Long> likeCounts = toCountMap(likeRepository.countByPostIdIn(postIds));
        Map<Long, Long> commentCounts = toCountMap(commentRepository.countByPostIdIn(postIds));

        // currentUserId'nin beğendiği post id'leri (kalbin dolu mu görünmesi için)
        Set<Long> likedPostIds = currentUserId == null
            ? Set.of()
            : Set.copyOf(likeRepository.findLikedPostIds(currentUserId, postIds));

        List<Long> optionIds = posts.stream()
            .filter(p -> "POLL".equals(p.getPostType()) && p.getPollOptions() != null)
            .flatMap(p -> p.getPollOptions().stream())
            .map(PollOption::getId)
            .toList();

        Map<Long, Long> optionVoteCounts = optionIds.isEmpty()
            ? Map.of()
            : toCountMap(pollVoteRepository.countByPollOptionIdIn(optionIds));

        // currentUserId'nin oy verdiği postId -> optionId
        Map<Long, Long> myVotes = (currentUserId == null || optionIds.isEmpty())
            ? Map.of()
            : pollVoteRepository.findUserVotes(currentUserId, postIds).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1], (a, b) -> a));

        return posts.stream().map(post -> {
            long likes = likeCounts.getOrDefault(post.getId(), 0L);
            long comments = commentCounts.getOrDefault(post.getId(), 0L);
            PostResponse response = PostResponse.from(post, likes, comments);
            response.setLikedByMe(likedPostIds.contains(post.getId()));

            if ("POLL".equals(post.getPostType()) && post.getPollOptions() != null) {
                Long votedId = myVotes.get(post.getId());
                List<PollOptionDto> options = post.getPollOptions().stream()
                    .map(o -> PollOptionDto.of(
                        o.getId(),
                        o.getOptionText(),
                        optionVoteCounts.getOrDefault(o.getId(), 0L),
                        o.getId().equals(votedId)
                    ))
                    .collect(Collectors.toList());
                response.setPollOptions(options);
            }

            return response;
        }).toList();
    }

    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((Long) row[0], (Long) row[1]);
        }
        return map;
    }

    // ✅ POST OLUŞTUR
    public PostResponse createPost(Long userId, CreatePostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        // eventId opsiyonel: verilirse "konser postu" (mobilde katılım/konum kilitli),
        // null ise "genel post" (serbest paylaşım, feed'i besler).
        Event event = null;
        if (request.getEventId() != null) {
            event = eventRepository.findById(request.getEventId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Etkinlik bulunamadı: " + request.getEventId()));
        }

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

        badgeService.checkAndAwardBadges(userId);
        return toResponse(saved, userId);
    }

    // ✅ TRENDING FEED (sayfalı)
    public List<PostResponse> getTrendingFeed(Long currentUserId, int page, int size) {
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        List<Post> posts = postRepository.findByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .stream()
                .filter(p -> p.getUser() == null || !hidden.contains(p.getUser().getId()))
                .toList();
        return toResponses(posts, currentUserId);
    }

    // ✅ FOLLOWING FEED (sayfalı)
    public List<PostResponse> getFollowingFeed(Long userId, int page, int size) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        Set<Long> hidden = moderationService.getHiddenUserIds(userId);
        List<Post> posts = postRepository.getFollowingFeed(userId, PageRequest.of(page, size))
                .stream()
                .filter(p -> p.getUser() == null || !hidden.contains(p.getUser().getId()))
                .toList();
        return toResponses(posts, userId);
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

    // ✅ POST SİL
    @Transactional
    public void deletePost(Long userId, Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));
        if (!post.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu postu silemezsiniz.");
        }
        pollVoteRepository.deleteByPostId(postId);
        likeRepository.deleteByPostId(postId);
        commentRepository.deleteByPostId(postId);
        postRepository.delete(post);
    }

    // ✅ POST DÜZENLE
    @Transactional
    public PostResponse updatePost(Long userId, Long postId, String content) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));
        if (!post.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bu postu düzenleyemezsiniz.");
        }
        post.setContent(content);
        post.setUpdatedAt(LocalDateTime.now());
        return toResponse(postRepository.save(post), userId);
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