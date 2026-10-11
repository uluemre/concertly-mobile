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
    private final ContentLimitService contentLimitService;
    private final PrivacyService privacyService;

    /** Yapılandırılmışsa R2 public adresi (görsel adresi doğrulamasında kabul edilen ikinci önek). */
    @org.springframework.beans.factory.annotation.Value("${app.storage.r2.public-url:}")
    private String r2PublicUrl = "";

    /** Akış sayfa boyutu üst sınırı. */
    static final int MAX_FEED_SIZE = 50;
    static final java.util.Set<String> POST_TYPES = java.util.Set.of("TEXT", "IMAGE", "POLL");

    public PostService(PostRepository postRepository,
                       UserRepository userRepository,
                       EventRepository eventRepository,
                       LikeRepository likeRepository,
                       CommentRepository commentRepository,
                       NotificationService notificationService,
                       PollOptionRepository pollOptionRepository,
                       PollVoteRepository pollVoteRepository,
                       BadgeService badgeService,
                       ModerationService moderationService,
                       ContentLimitService contentLimitService,
                       PrivacyService privacyService) {
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
        this.contentLimitService = contentLimitService;
        this.privacyService      = privacyService;
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
    // Tek transaction: anket seçenekleri kaydedilemezse ya da yanıt üretilemezse post da
    // geri alınır (eskiden post kaydedilip 500 dönüyordu, kullanıcı tekrar deneyince mükerrer oluyordu).
    @Transactional
    public PostResponse createPost(Long userId, CreatePostRequest request) {
        ContentLimits.check(request.getContent(), ContentLimits.POST_MAX);
        String postType = request.getPostType() != null ? request.getPostType() : "TEXT";
        validateNewPost(postType, request);
        contentLimitService.checkPost(userId);
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
        post.setContent(request.getContent() != null ? request.getContent() : "");
        post.setUser(user);
        post.setEvent(event);
        post.setPostType(postType);

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
                    saved.getPollOptions().add(pollOptionRepository.save(opt));
                }
            }
        }

        badgeService.checkAndAwardBadges(userId);
        return toResponse(saved, userId);
    }

    /**
     * Gönderi türü, anket ve görsel kuralları (sunucuda zorlanır; mobil doğrulaması tek başına yetmez).
     * Yazısız görsel gönderisi geçerlidir; TEXT ve POLL için içerik zorunlu.
     */
    private void validateNewPost(String postType, CreatePostRequest request) {
        if (!POST_TYPES.contains(postType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POST_TYPE_INVALID");
        }
        boolean blank = request.getContent() == null || request.getContent().isBlank();
        if (blank && !"IMAGE".equals(postType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CONTENT_EMPTY");
        }
        if ("POLL".equals(postType)) {
            List<String> filled = request.getPollOptions() == null ? List.of()
                    : request.getPollOptions().stream().filter(o -> o != null && !o.isBlank()).toList();
            if (filled.size() < 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_TOO_FEW_OPTIONS");
            }
            if (filled.size() > ContentLimits.POLL_OPTIONS_MAX) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_TOO_MANY_OPTIONS");
            }
            for (String o : filled) {
                if (o.trim().length() > ContentLimits.POLL_OPTION_TEXT_MAX) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_OPTION_TOO_LONG");
                }
            }
        }
        if ("IMAGE".equals(postType) && !isAllowedImageUrl(request.getImageUrl())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_URL");
        }
    }

    /** Yalnız /media/upload'dan dönen göreli yol ya da yapılandırılmış R2 public adresi. */
    boolean isAllowedImageUrl(String url) {
        if (url == null || url.isBlank() || url.contains("..")) return false;
        if (url.startsWith("/uploads/")) return true;
        String r2 = r2PublicUrl == null ? "" : r2PublicUrl.trim();
        if (r2.isEmpty()) return false;
        String prefix = r2.endsWith("/") ? r2 : r2 + "/";
        return url.startsWith(prefix);
    }

    /**
     * Tek gönderi — paylaşım linki ve bildirim yönlendirmesi id ile gelir.
     * Gizlenen içerik sahibi ve admin dışında görünmez.
     */
    // open-in-view kapalı: anket seçenekleri (LAZY) DTO'ya çevrilirken oturum açık olmalı
    @Transactional(readOnly = true)
    public PostResponse getPost(Long postId, Long currentUserId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));
        requireViewable(post, currentUserId);
        return toResponse(post, currentUserId);
    }

    /**
     * Tek gönderiye erişen her uç (okuma, beğeni, anket oyu) aynı kuralı kullanır: gizlenen gönderi
     * yalnızca sahibine, engelli taraflar ve özel hesabın yetkisiz izleyicileri için ise gönderi
     * hiç yokmuş gibi 404 (SEC-05; varlığı sızdırılmaz).
     */
    private void requireViewable(Post post, Long viewerId) {
        boolean isOwner = post.getUser() != null && post.getUser().getId().equals(viewerId);
        if (post.getIsHidden() && !isOwner) {
            throw new ResourceNotFoundException("Post bulunamadı: " + post.getId());
        }
        if (post.getUser() != null
                && moderationService.getHiddenUserIds(viewerId).contains(post.getUser().getId())) {
            throw new ResourceNotFoundException("Post bulunamadı: " + post.getId());
        }
        if (post.getUser() != null && !privacyService.canViewContent(viewerId, post.getUser())) {
            throw new ResourceNotFoundException("Post bulunamadı: " + post.getId());
        }
    }

    /** Trend için puanlanan en yeni gönderi sayısı; sayfalar bu küme içinden verilir. */
    static final int TRENDING_WINDOW = 500;

    /**
     * Trend puanı: etkileşim (beğeni + 2×yorum + 1) yaşla birlikte azalır — (gün + 1)^1.2.
     * Yeni gönderi öne çıkabilir ama birkaç günlük, çok beğenilmiş gönderi hiç beğeni almamış
     * yeni gönderinin önüne geçer. Eskiden trend yalnızca tarihe göre sıralıydı.
     */
    static double trendingScore(long likes, long comments, java.time.LocalDateTime createdAt,
                                java.time.LocalDateTime now) {
        double ageDays = createdAt == null ? 365
                : Math.max(0, java.time.Duration.between(createdAt, now).toMinutes()) / 1440.0;
        return (likes + 2.0 * comments + 1.0) / Math.pow(ageDays + 1.0, 1.2);
    }

    // ✅ TRENDING FEED (sayfalı) — trend puanına göre; eşit puanda en yeni, sonra büyük id
    @Transactional(readOnly = true)
    public List<PostResponse> getTrendingFeed(Long currentUserId, int page, int size) {
        if (page < 0 || size <= 0) return List.of();
        size = Math.min(size, MAX_FEED_SIZE);
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        // Özel hesapların gönderileri (izleyici kabul edilmiş takipçi/kendisi/admin değilse) sorguda elenir;
        // aday penceresi (TRENDING_WINDOW) yalnızca görünebilir gönderilerle dolar, sayfalar kısalmaz.
        PageRequest window = PageRequest.of(0, TRENDING_WINDOW);
        List<Post> windowPosts = privacyService.isAdmin(currentUserId)
                ? postRepository.findByOrderByCreatedAtDesc(window)
                : postRepository.findVisibleToViewerOrderByCreatedAtDesc(
                        currentUserId == null ? -1L : currentUserId, window);
        List<Post> candidates = windowPosts
                .stream()
                .filter(p -> !p.getIsHidden())
                .filter(p -> p.getUser() == null || !Boolean.FALSE.equals(p.getUser().getIsActive()))
                .filter(p -> p.getUser() == null || !hidden.contains(p.getUser().getId()))
                .toList();
        if (candidates.isEmpty()) return List.of();

        List<Long> ids = candidates.stream().map(Post::getId).toList();
        Map<Long, Long> likes = toCountMap(likeRepository.countByPostIdIn(ids));
        Map<Long, Long> comments = toCountMap(commentRepository.countByPostIdIn(ids));
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        Map<Long, Double> score = new HashMap<>();
        for (Post p : candidates) {
            score.put(p.getId(), trendingScore(likes.getOrDefault(p.getId(), 0L),
                    comments.getOrDefault(p.getId(), 0L), p.getCreatedAt(), now));
        }
        List<Post> ranked = candidates.stream()
                .sorted(java.util.Comparator.<Post>comparingDouble(p -> score.get(p.getId())).reversed()
                        .thenComparing(Post::getCreatedAt, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()))
                        .thenComparing(Post::getId, java.util.Comparator.reverseOrder()))
                .toList();

        int from = (int) Math.min((long) page * size, ranked.size());
        int to = Math.min(from + size, ranked.size());
        return toResponses(ranked.subList(from, to), currentUserId);
    }

    // ✅ FOLLOWING FEED (sayfalı)
    @Transactional(readOnly = true)
    public List<PostResponse> getFollowingFeed(Long userId, int page, int size) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId);
        }

        size = Math.min(size, MAX_FEED_SIZE);
        Set<Long> hidden = new java.util.HashSet<>(moderationService.getHiddenUserIds(userId));
        hidden.add(-1L); // boş NOT IN listesi olmasın
        List<Post> posts = postRepository.getFollowingFeed(userId, hidden, PageRequest.of(page, size));
        return toResponses(posts, userId);
    }

    // ✅ POLL OY VER
    @Transactional
    public List<PollOptionDto> votePoll(Long userId, Long postId, Long optionId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı: " + userId));
        // Gizli / engelli / özel hesabın göremediği gönderiye oy verilemez (SEC-05)
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadı: " + postId));
        requireViewable(post, userId);
        PollOption option = pollOptionRepository.findById(optionId)
            .orElseThrow(() -> new ResourceNotFoundException("Seçenek bulunamadı: " + optionId));
        // Seçenek bu gönderiye ait olmalı ve gönderi anket olmalı (başka gönderinin seçeneğiyle oy atılamaz)
        if (!"POLL".equals(post.getPostType()) || option.getPost() == null
                || !postId.equals(option.getPost().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_OPTION_INVALID");
        }

        // Upsert: kullanıcı başına gönderi başına tek oy; varsa seçeneği değişir
        PollVote vote = pollVoteRepository.findByUserIdAndPostId(userId, postId).orElseGet(PollVote::new);
        vote.setUser(user);
        vote.setPollOption(option);
        vote.setPostId(postId);
        pollVoteRepository.save(vote);

        return post.getPollOptions().stream()
            .map(o -> PollOptionDto.of(
                o.getId(),
                o.getOptionText(),
                pollVoteRepository.countByPollOptionId(o.getId()),
                o.getId().equals(optionId)
            ))
            .collect(Collectors.toList());
    }

    // ✅ LIKE — idempotent: zaten beğenilmişse (ya da yarışta kaybedildiyse) sessizce 204
    @Transactional
    public void likePost(Long userId, Long postId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + userId));

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));
        requireViewable(post, userId); // reddedilirse bildirim de gitmez

        if (likeRepository.findByUserIdAndPostId(userId, postId).isPresent()) {
            return;
        }
        // Eşzamanlı iki istekte unique ihlali fırlatmadan tek kayıt: 0 dönerse bu istek kaybetti
        if (likeRepository.insertIfAbsent(user.getId(), post.getId()) == 0) {
            return;
        }
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
        // Metin/anket gönderisi boşaltılamaz; yazısız görsel gönderisinin metni boşaltılabilir
        if (content == null || (content.isBlank() && !"IMAGE".equals(post.getPostType()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CONTENT_EMPTY");
        }
        ContentLimits.check(content, ContentLimits.POST_MAX);
        post.setContent(content);
        post.setUpdatedAt(LocalDateTime.now());
        return toResponse(postRepository.save(post), userId);
    }

    // ✅ UNLIKE — idempotent: beğeni yoksa da 204
    @Transactional
    public void unlikePost(Long userId, Long postId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Post bulunamadı: " + postId));
        requireViewable(post, userId);

        likeRepository.findByUserIdAndPostId(userId, postId).ifPresent(likeRepository::delete);
    }
}