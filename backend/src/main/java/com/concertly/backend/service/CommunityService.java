package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateCommunityPostRequest;
import com.concertly.backend.dto.request.CreateCommunityRequest;
import com.concertly.backend.dto.response.CommunityMemberResponse;
import com.concertly.backend.dto.response.CommunityPostCommentResponse;
import com.concertly.backend.dto.response.CommunityPostResponse;
import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.dto.response.PollOptionDto;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    // Görünürlük
    private static final String PUBLIC = "PUBLIC";
    private static final String PRIVATE = "PRIVATE";
    private static final String SECRET = "SECRET";

    // Onay durumu
    private static final String PENDING_REVIEW = "PENDING";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";

    // Üyelik durumu
    private static final String ACTIVE = "ACTIVE";
    private static final String PENDING = "PENDING";
    private static final String INVITED = "INVITED";
    private static final String BANNED = "BANNED";

    // Roller
    private static final String OWNER = "OWNER";
    private static final String MODERATOR = "MODERATOR";
    private static final String MEMBER = "MEMBER";

    // communities.description varchar(255): daha uzunu DB hatasına (yanıltıcı 409) düşüyordu (A1)
    static final int DESCRIPTION_MAX = 255;

    // B5: incelemedeki (PENDING) topluluk ilk 24 saat keşifte görünmez; 7 günde karar yoksa otomatik reddedilir.
    static final Duration REVIEW_HIDDEN_FOR = Duration.ofHours(24);
    static final Duration REVIEW_AUTO_REJECT_AFTER = Duration.ofDays(7);
    static final String PENDING_REVIEW_CODE = "COMMUNITY_PENDING_REVIEW";

    // Bir kullanıcının kurabileceği en fazla topluluk (spam koruması)
    private static final int MAX_OWNED_COMMUNITIES = 5;

    // Davet kodu denemesi: kullanıcı başına 15 dakikada en fazla 10 (kod tahmini koruması)
    private static final int INVITE_CODE_ATTEMPTS = 10;
    private static final Duration INVITE_CODE_WINDOW = Duration.ofMinutes(15);

    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final CommunityPostRepository communityPostRepository;
    private final CommunityPostLikeRepository communityPostLikeRepository;
    private final CommunityPostCommentRepository communityPostCommentRepository;
    private final CommunityPostPollOptionRepository communityPostPollOptionRepository;
    private final CommunityPostPollVoteRepository communityPostPollVoteRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;
    private final ModerationService moderationService;
    private final ContentLimitService contentLimitService;
    private final AuthRateLimiter rateLimiter;

    public CommunityService(CommunityRepository communityRepository,
                            CommunityMemberRepository communityMemberRepository,
                            CommunityPostRepository communityPostRepository,
                            CommunityPostLikeRepository communityPostLikeRepository,
                            CommunityPostCommentRepository communityPostCommentRepository,
                            CommunityPostPollOptionRepository communityPostPollOptionRepository,
                            CommunityPostPollVoteRepository communityPostPollVoteRepository,
                            UserRepository userRepository,
                            NotificationService notificationService,
                            NotificationRepository notificationRepository,
                            ModerationService moderationService,
                            ContentLimitService contentLimitService,
                            AuthRateLimiter rateLimiter) {
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.communityPostRepository = communityPostRepository;
        this.communityPostLikeRepository = communityPostLikeRepository;
        this.communityPostCommentRepository = communityPostCommentRepository;
        this.communityPostPollOptionRepository = communityPostPollOptionRepository;
        this.communityPostPollVoteRepository = communityPostPollVoteRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.notificationRepository = notificationRepository;
        this.moderationService = moderationService;
        this.contentLimitService = contentLimitService;
        this.rateLimiter = rateLimiter;
    }

    // ── DTO dönüşümü ─────────────────────────────────────────────────────────────

    private CommunityResponse toResponse(Community c, Long currentUserId) {
        CommunityMember mm = currentUserId == null ? null
                : communityMemberRepository.findByUserIdAndCommunityId(currentUserId, c.getId()).orElse(null);
        String role = mm != null ? mm.getRole() : null;
        String status = mm != null ? mm.getStatus() : null;
        Long pendingCount = null;
        if (canManage(role)) {
            pendingCount = communityMemberRepository.countByCommunityIdAndStatus(c.getId(), PENDING);
        }
        long memberCount = communityMemberRepository.countByCommunityIdAndStatus(c.getId(), ACTIVE);
        long postCount = communityPostRepository.countByCommunityId(c.getId());
        return withEffectiveApproval(CommunityResponse.from(c, memberCount, postCount, role, status, pendingCount), c);
    }

    // B5 (tembel ret): 7 günü aşmış PENDING topluluk, zamanlanmış görev DB'yi güncelleyene kadar da REJECTED görünür
    private CommunityResponse withEffectiveApproval(CommunityResponse dto, Community c) {
        if (isStalePending(c, LocalDateTime.now())) dto.setApprovalStatus(REJECTED);
        return dto;
    }

    // Topluluk listesini tek seferde DTO'ya çevirir; üye/post sayımları ile kullanıcının
    // rol/durumunu toplu sorgularla çeker (liste endpoint'lerindeki N+1'i önler).
    private List<CommunityResponse> toResponses(List<Community> communities, Long currentUserId) {
        if (communities.isEmpty()) return List.of();

        List<Long> ids = communities.stream().map(Community::getId).toList();
        Map<Long, Long> memberCounts = toCountMap(communityMemberRepository.countActiveByCommunityIdIn(ids));
        Map<Long, Long> postCounts = toCountMap(communityPostRepository.countByCommunityIdIn(ids));

        Map<Long, CommunityMember> myMembership = new HashMap<>();
        if (currentUserId != null) {
            for (CommunityMember m : communityMemberRepository.findByUserId(currentUserId)) {
                myMembership.put(m.getCommunity().getId(), m);
            }
        }

        return communities.stream()
                .map(c -> {
                    CommunityMember mm = myMembership.get(c.getId());
                    String role = mm != null ? mm.getRole() : null;
                    String status = mm != null ? mm.getStatus() : null;
                    // Liste görünümünde bekleyen istek sayısı hesaplanmaz (detayda gelir)
                    return withEffectiveApproval(CommunityResponse.from(c,
                            memberCounts.getOrDefault(c.getId(), 0L),
                            postCounts.getOrDefault(c.getId(), 0L),
                            role, status, null), c);
                })
                .toList();
    }

    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((Long) row[0], (Long) row[1]);
        }
        return map;
    }

    // ── Listeleme / keşif ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommunityResponse> getAllCommunities(String type, String q, Long currentUserId) {
        List<Community> communities;

        if (q != null && !q.isBlank()) {
            communities = communityRepository.search(q.trim());
        } else {
            communities = communityRepository.findAll();
        }

        // Tür filtresi hem tek başına hem aramayla aynı kuralı kullanır (A2):
        // "Şehir"/"Sehir"/"city", "Diğer"/"Diger"/"other" vb. aynı tür sayılır.
        if (type != null && !type.isBlank()) {
            communities = communities.stream()
                    .filter(c -> CommunityTypes.matches(type, c.getType()))
                    .toList();
        }

        return toResponses(filterVisible(communities, currentUserId), currentUserId);
    }

    @Transactional(readOnly = true)
    public List<CommunityResponse> getRecommendedCommunities(List<String> userGenres, Long currentUserId) {
        if (userGenres == null || userGenres.isEmpty()) {
            return getAllCommunities(null, null, currentUserId);
        }

        Set<String> communityTypes = userGenres.stream()
                .map(String::toLowerCase)
                .map(this::mapGenreToCommunityType)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (communityTypes.isEmpty()) {
            return getAllCommunities(null, null, currentUserId);
        }

        List<Community> matching = communityRepository.findByTypeIn(new ArrayList<>(communityTypes));
        List<Community> all = communityRepository.findAll();

        Set<Long> matchingIds = matching.stream().map(Community::getId).collect(Collectors.toSet());
        List<Community> sorted = new ArrayList<>(matching);
        for (Community c : all) {
            if (!matchingIds.contains(c.getId())) {
                sorted.add(c);
            }
        }

        return toResponses(filterVisible(sorted, currentUserId), currentUserId);
    }

    // Kullanıcının ACTIVE üye olduğu topluluklar ("Topluluklarım")
    @Transactional(readOnly = true)
    public List<CommunityResponse> getMyCommunities(Long currentUserId) {
        if (currentUserId == null) return List.of();
        List<Community> mine = communityMemberRepository.findByUserIdAndStatus(currentUserId, ACTIVE)
                .stream()
                .map(CommunityMember::getCommunity)
                .filter(c -> !REJECTED.equals(effectiveApproval(c)))
                .toList();
        return toResponses(mine, currentUserId);
    }

    // REJECTED'leri herkesten gizler; SECRET'leri yalnız üyesi olana gösterir.
    private List<Community> filterVisible(List<Community> communities, Long currentUserId) {
        Set<Long> myCommunityIds = currentUserId == null ? Set.of()
                : communityMemberRepository.findByUserId(currentUserId).stream()
                    .filter(m -> !BANNED.equals(m.getStatus())) // D8: yasaklı üyelik üyelik sayılmaz
                    .map(m -> m.getCommunity().getId()).collect(Collectors.toSet());

        boolean admin = isAdmin(currentUserId);
        LocalDateTime now = LocalDateTime.now();
        return communities.stream().filter(c -> {
            if (REJECTED.equals(effectiveApproval(c))) return false;
            if (SECRET.equals(effectiveVisibility(c)) && !myCommunityIds.contains(c.getId())) return false;
            // B5: incelemenin ilk 24 saatinde yalnızca sahip/admin keşifte görür; sonra PENDING olarak listelenir
            if (isInReviewHiddenWindow(c, now) && !admin && !isOwner(c, currentUserId)) return false;
            return true;
        }).toList();
    }

    /** B5: kendi başlangıç anından 7 gün geçmiş ve hâlâ PENDING olan topluluk. */
    static boolean isStalePending(Community c, LocalDateTime now) {
        return PENDING_REVIEW.equals(c.getApprovalStatus())
                && c.getReviewStart() != null
                && !c.getReviewStart().plus(REVIEW_AUTO_REJECT_AFTER).isAfter(now);
    }

    /** B5: PENDING ve inceleme başlangıcından beri 24 saat dolmamış (keşifte gizli). */
    static boolean isInReviewHiddenWindow(Community c, LocalDateTime now) {
        return PENDING_REVIEW.equals(c.getApprovalStatus())
                && !isStalePending(c, now)
                && c.getReviewStart() != null
                && c.getReviewStart().plus(REVIEW_HIDDEN_FOR).isAfter(now);
    }

    /** Paylaşım sayfası vb. için: tembel ret uygulanmış onay durumu (null → APPROVED). */
    public static String effectiveApprovalStatus(Community c, LocalDateTime now) {
        if (isStalePending(c, now)) return REJECTED;
        return c.getApprovalStatus() != null ? c.getApprovalStatus() : APPROVED;
    }

    /** Paylaşım sayfası: keşif kuralı — ilk 24 saatteki PENDING topluluk bulunamaz sayılır. */
    public static boolean isHiddenFromDiscovery(Community c, LocalDateTime now) {
        return REJECTED.equals(effectiveApprovalStatus(c, now)) || isInReviewHiddenWindow(c, now);
    }

    private String mapGenreToCommunityType(String genre) {
        if (genre == null) return null;
        return switch (genre) {
            case "rock", "metal", "indie", "alternatif rock", "turkce rock" -> "rock";
            case "elektronik", "electronic", "techno" -> "elektronik";
            case "jazz", "classical" -> "caz";
            default -> null;
        };
    }

    @Transactional(readOnly = true)
    public CommunityResponse getCommunityById(Long communityId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(c, currentUserId);
        return toResponse(c, currentUserId);
    }

    // Gizli topluluk üye olmayana yok gibi davranır; reddedilen yalnızca sahip/admin görür.
    private void requireCommunityVisible(Community c, Long currentUserId) {
        // D8: BANNED satırı üyelik sayılmaz (gizli topluluğu görmez)
        boolean member = currentUserId != null &&
                communityMemberRepository.findByUserIdAndCommunityId(currentUserId, c.getId())
                        .map(m -> !BANNED.equals(m.getStatus())).orElse(false);
        boolean privileged = member || isAdmin(currentUserId) || isOwner(c, currentUserId);

        if (SECRET.equals(effectiveVisibility(c)) && !privileged) {
            throw new ResourceNotFoundException("Topluluk bulunamadi: " + c.getId());
        }
        if (REJECTED.equals(effectiveApproval(c)) && !(isAdmin(currentUserId) || isOwner(c, currentUserId))) {
            throw new ResourceNotFoundException("Topluluk bulunamadi: " + c.getId());
        }
    }

    // ── Oluşturma / düzenleme / silme ─────────────────────────────────────────────

    @Transactional
    public CommunityResponse createCommunity(Long userId, CreateCommunityRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));

        if (req.getName() == null || req.getName().isBlank()) {
            throw new IllegalArgumentException("COMMUNITY_NAME_REQUIRED");
        }
        requireDescriptionLength(req.getDescription());
        if (communityRepository.countByOwnerId(userId) >= MAX_OWNED_COMMUNITIES) {
            throw new IllegalArgumentException("COMMUNITY_OWN_LIMIT");
        }

        Community c = new Community();
        c.setName(req.getName().trim());
        c.setType(req.getType() != null ? req.getType().trim() : "Diger");
        c.setCity(req.getCity());
        c.setEmoji(req.getEmoji() != null && !req.getEmoji().isBlank() ? req.getEmoji() : "🎵");
        c.setDescription(req.getDescription());
        c.setGradientStart(req.getGradientStart() != null ? req.getGradientStart() : "#7C3AED");
        c.setGradientEnd(req.getGradientEnd() != null ? req.getGradientEnd() : "#E94560");
        c.setTags(req.getTags());
        c.setLive(false);
        c.setVisibility(normalizeVisibility(req.getVisibility()));
        c.setApprovalStatus(PENDING_REVIEW); // admin onayı bekler, ama hemen kullanılabilir
        c.setOwner(user);
        c.setInviteCode(generateUniqueInviteCode());
        Community saved = communityRepository.save(c);

        // Kurucu otomatik OWNER + ACTIVE üye
        CommunityMember ownerMember = new CommunityMember();
        ownerMember.setUser(user);
        ownerMember.setCommunity(saved);
        ownerMember.setRole(OWNER);
        ownerMember.setStatus(ACTIVE);
        communityMemberRepository.save(ownerMember);

        return toResponse(saved, userId);
    }

    @Transactional
    public CommunityResponse updateCommunity(Long userId, Long communityId, CreateCommunityRequest req) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(userId, c); // D7: OWNER + ACTIVE MODERATOR + admin; sıradan üye 403
        requireDescriptionLength(req.getDescription());

        // SEC-C02: onaylı toplulukta admin dışı biri ad/açıklama/görünürlüğü gerçekten değiştirirse yeniden incelemeye girer
        String oldVisibility = effectiveVisibility(c);
        boolean nameChanged = req.getName() != null && !req.getName().isBlank()
                && !req.getName().trim().equals(c.getName());
        boolean descriptionChanged = req.getDescription() != null
                && !req.getDescription().equals(c.getDescription() == null ? "" : c.getDescription());
        boolean visibilityChanged = req.getVisibility() != null
                && !normalizeVisibility(req.getVisibility()).equals(oldVisibility);
        boolean reReview = APPROVED.equals(effectiveApproval(c))
                && (nameChanged || descriptionChanged || visibilityChanged)
                && !isAdmin(userId);

        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getType() != null) c.setType(req.getType().trim());
        if (req.getCity() != null) c.setCity(req.getCity());
        if (req.getEmoji() != null && !req.getEmoji().isBlank()) c.setEmoji(req.getEmoji());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getGradientStart() != null) c.setGradientStart(req.getGradientStart());
        if (req.getGradientEnd() != null) c.setGradientEnd(req.getGradientEnd());
        if (req.getTags() != null) c.setTags(req.getTags());
        if (req.getVisibility() != null) c.setVisibility(normalizeVisibility(req.getVisibility()));

        if (reReview) {
            c.setApprovalStatus(PENDING_REVIEW);
            c.setReviewRequestedAt(LocalDateTime.now());
        }

        // B6: topluluk PUBLIC olunca bekleyen katılma istekleri kendiliğinden ACTIVE olur
        if (!PUBLIC.equals(oldVisibility) && PUBLIC.equals(effectiveVisibility(c)) && !c.isArchived()
                && !isPendingReview(c)) { // B5: incelemedeki topluluk istekleri onay sonrası kabul edilir
            acceptAllPendingRequests(c);
        }

        return toResponse(communityRepository.save(c), userId);
    }

    /**
     * B6: bekleyen her istek ACTIVE olur. Her kullanıcıya mevcut "isteğiniz onaylandı"
     * bildirimi gider (kişi isteği kendisi atmıştı, sonucu bilmesi gerekir); toplu işlem
     * tek tip kısa bildirimdir, yönetici/üyelere ayrıca bildirim yok.
     */
    private void acceptAllPendingRequests(Community c) {
        for (CommunityMember m : communityMemberRepository
                .findByCommunityIdAndStatusOrderByJoinedAtDesc(c.getId(), PENDING)) {
            m.setStatus(ACTIVE);
            communityMemberRepository.save(m);
            if (m.getUser() != null) {
                notificationService.sendSystem(m.getUser().getId(), "community_request_approved", "community",
                        c.getId(), "\"" + c.getName() + "\" toplulugu katilma isteginizi onayladi.");
            }
        }
    }

    @Transactional
    public void deleteCommunity(Long userId, Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, userId) && !isAdmin(userId)) {
            throw forbidden("COMMUNITY_OWNER_ONLY_DELETE");
        }

        List<Long> postIds = communityPostRepository.findByCommunityIdOrderByCreatedAtDesc(communityId)
                .stream().map(CommunityPost::getId).toList();
        if (!postIds.isEmpty()) {
            communityPostLikeRepository.deleteByCommunityPostIdIn(postIds);
            communityPostCommentRepository.deleteByCommunityPostIdIn(postIds);
            communityPostPollVoteRepository.deleteByCommunityPostIdIn(postIds);
            communityPostPollOptionRepository.deleteByCommunityPostIdIn(postIds);
        }
        communityPostRepository.deleteByCommunityId(communityId);
        communityMemberRepository.deleteByCommunityId(communityId);
        // B9: silinen topluluğa işaret eden bildirimler (davet, istek, onay...) askıda kalmasın
        notificationRepository.deleteByEntityTypeAndEntityId("community", communityId);
        communityRepository.delete(c);
    }

    // ── Katılım ───────────────────────────────────────────────────────────────────

    @Transactional
    public CommunityResponse joinCommunity(Long userId, Long communityId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(community, userId); // B8: reddedilen/gizli topluluk dışarıdan yok sayılır

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(userId, communityId).orElse(null);
        // B1: arşivli toplulukta yeni üyelik girişi kapalı; zaten ACTIVE üyeye idempotent yanıt kalır
        if (community.isArchived() && (existing == null || !ACTIVE.equals(existing.getStatus()))) {
            throw archived();
        }
        // B5: incelemedeki toplulukta yeni üyelik girişi kapalı (zaten ACTIVE üyeye idempotent yanıt kalır)
        if (isPendingReview(community) && (existing == null || !ACTIVE.equals(existing.getStatus()))) {
            throw pendingReview();
        }
        if (existing != null) {
            switch (existing.getStatus()) {
                case ACTIVE -> { return toResponse(community, userId); } // B3: tekrar katılma idempotent
                case PENDING -> throw new AlreadyExistsException("COMMUNITY_JOIN_PENDING");
                case BANNED -> throw forbidden("COMMUNITY_BANNED");
                case INVITED -> { // bekleyen daveti varken katıl = daveti kabul et
                    existing.setStatus(ACTIVE);
                    existing.setRole(MEMBER);
                    communityMemberRepository.save(existing);
                    return toResponse(community, userId);
                }
                default -> { /* devam */ }
            }
        }

        String vis = effectiveVisibility(community);
        if (SECRET.equals(vis)) {
            throw new IllegalArgumentException("COMMUNITY_INVITE_ONLY");
        }

        CommunityMember member = new CommunityMember();
        member.setUser(user);
        member.setCommunity(community);
        member.setRole(MEMBER);

        if (PRIVATE.equals(vis)) {
            member.setStatus(PENDING);
            communityMemberRepository.save(member);
            notifyManagers(community, userId, "community_join_request");
        } else { // PUBLIC
            member.setStatus(ACTIVE);
            communityMemberRepository.save(member);
        }
        return toResponse(community, userId);
    }

    @Transactional
    public CommunityResponse joinByInviteCode(Long userId, String code) {
        // SEC-C04: kod tahminini yavaşlat (başarılı/başarısız her deneme sayılır)
        rateLimiter.check("community-invite:" + userId, INVITE_CODE_ATTEMPTS, INVITE_CODE_WINDOW);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findByInviteCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("INVITE_LINK_INVALID"));
        // B8: davet kodu SECRET topluluğa giriş yetkisidir (görünürlük kontrolü uygulanmaz),
        // ama reddedilmiş topluluk sahip/admin dışında yok sayılır.
        if (REJECTED.equals(effectiveApproval(community)) && !(isAdmin(userId) || isOwner(community, userId))) {
            throw new ResourceNotFoundException("INVITE_LINK_INVALID");
        }

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(userId, community.getId()).orElse(null);
        // B1: arşivli toplulukta davet koduyla da yeni giriş yok; zaten ACTIVE üyeye idempotent yanıt kalır
        if (community.isArchived() && (existing == null || !ACTIVE.equals(existing.getStatus()))) {
            throw archived();
        }
        // B5: davet koduyla da incelemedeki topluluğa yeni giriş yok
        if (isPendingReview(community) && (existing == null || !ACTIVE.equals(existing.getStatus()))) {
            throw pendingReview();
        }
        if (existing != null) {
            if (BANNED.equals(existing.getStatus())) {
                throw forbidden("COMMUNITY_BANNED");
            }
            if (!ACTIVE.equals(existing.getStatus())) {
                // davet linki onay yerine geçer → direkt aktif
                existing.setStatus(ACTIVE);
                if (existing.getRole() == null) existing.setRole(MEMBER);
                communityMemberRepository.save(existing);
            }
            return toResponse(community, userId);
        }

        CommunityMember member = new CommunityMember();
        member.setUser(user);
        member.setCommunity(community);
        member.setRole(MEMBER);
        member.setStatus(ACTIVE); // davet linki = ön onaylı
        communityMemberRepository.save(member);
        return toResponse(community, userId);
    }

    @Transactional
    public void leaveCommunity(Long userId, Long communityId) {
        CommunityMember member = communityMemberRepository
                .findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("COMMUNITY_NOT_MEMBER"));
        // D8: yasak kaydı kullanıcı tarafından silinemez (yoksa yasak kendiliğinden kalkar)
        if (BANNED.equals(member.getStatus())) {
            throw forbidden("COMMUNITY_BANNED");
        }
        if (OWNER.equals(member.getRole())) {
            throw new IllegalArgumentException("COMMUNITY_OWNER_CANNOT_LEAVE");
        }
        communityMemberRepository.delete(member);
    }

    // ── Katılma istekleri (mod) ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommunityMemberResponse> getJoinRequests(Long userId, Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(userId, c);
        return communityMemberRepository.findByCommunityIdAndStatusOrderByJoinedAtDesc(communityId, PENDING)
                .stream().map(CommunityMemberResponse::from).toList();
    }

    @Transactional
    public void approveRequest(Long managerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(managerId, c);
        if (c.isArchived()) throw archived(); // B1: bekleyen isteği onaylamak da yeni katılımdır
        if (isPendingReview(c)) throw pendingReview(); // B5
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("JOIN_REQUEST_NOT_FOUND"));
        if (!PENDING.equals(m.getStatus())) {
            throw new IllegalArgumentException("JOIN_REQUEST_NOT_PENDING");
        }
        m.setStatus(ACTIVE);
        communityMemberRepository.save(m);
        notificationService.sendSystem(targetUserId, "community_request_approved", "community", communityId,
                "\"" + c.getName() + "\" toplulugu katilma isteginizi onayladi.");
    }

    @Transactional
    public void rejectRequest(Long managerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(managerId, c);
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("JOIN_REQUEST_NOT_FOUND"));
        if (!PENDING.equals(m.getStatus())) {
            throw new IllegalArgumentException("JOIN_REQUEST_NOT_PENDING");
        }
        communityMemberRepository.delete(m);
    }

    // ── Davet ───────────────────────────────────────────────────────────────────

    @Transactional
    public void inviteUser(Long inviterId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        // SEC-C03: davet yalnızca OWNER / ACTIVE MODERATOR / admin (sıradan üye 403)
        requireManager(inviterId, c);
        if (c.isArchived()) throw archived(); // B1: arşivli topluluğa yeni üye davet edilemez
        if (isPendingReview(c)) throw pendingReview(); // B5
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + targetUserId));
        // D6: aralarında engel varsa sessizce hiçbir şey yapma (engelin varlığı sızmasın)
        if (moderationService.isBlockedEitherWay(inviterId, targetUserId)) {
            return;
        }

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(targetUserId, communityId).orElse(null);
        if (existing != null) {
            if (ACTIVE.equals(existing.getStatus())) throw new AlreadyExistsException("COMMUNITY_ALREADY_MEMBER");
            if (BANNED.equals(existing.getStatus())) throw forbidden("COMMUNITY_BANNED");
            // PENDING isteği varsa daveti onay gibi say → ACTIVE; INVITED ise tekrar bildir.
            // Bu bir katılma isteği onayıdır: approveRequest ile aynı yetki gerekir, sıradan
            // üye davet üzerinden yönetici onayını atlayamaz (D5).
            if (PENDING.equals(existing.getStatus())) {
                requireManager(inviterId, c);
                existing.setStatus(ACTIVE);
                communityMemberRepository.save(existing);
                notificationService.sendSystem(targetUserId, "community_request_approved", "community", communityId,
                        "\"" + c.getName() + "\" toplulugu katilma isteginizi onayladi.");
                return;
            }
            // SEC-C03: zaten davetli → yeni satır da bildirim/push da yok (idempotent)
            if (INVITED.equals(existing.getStatus())) return;
        } else {
            CommunityMember invite = new CommunityMember();
            invite.setUser(target);
            invite.setCommunity(c);
            invite.setRole(MEMBER);
            invite.setStatus(INVITED);
            communityMemberRepository.save(invite);
        }
        notificationService.send(targetUserId, inviterId, "community_invite", "community", communityId);
    }

    @Transactional
    public CommunityResponse acceptInvite(Long userId, Long communityId) {
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("INVITE_NOT_FOUND"));
        if (!INVITED.equals(m.getStatus())) {
            throw new IllegalArgumentException("INVITE_NOT_PENDING");
        }
        if (m.getCommunity().isArchived()) throw archived(); // B1: arşivden önce gelmiş davet de yeni girişi açmaz
        if (isPendingReview(m.getCommunity())) throw pendingReview(); // B5: incelemeden önce gelmiş davet de girişi açmaz
        m.setStatus(ACTIVE);
        communityMemberRepository.save(m);
        return toResponse(m.getCommunity(), userId);
    }

    @Transactional
    public void declineInvite(Long userId, Long communityId) {
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("INVITE_NOT_FOUND"));
        if (!INVITED.equals(m.getStatus())) {
            throw new IllegalArgumentException("INVITE_NOT_PENDING");
        }
        communityMemberRepository.delete(m);
    }

    @Transactional
    public String regenerateInviteCode(Long userId, Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(userId, c);
        c.setInviteCode(generateUniqueInviteCode());
        communityRepository.save(c);
        return c.getInviteCode();
    }

    // ── Üye yönetimi ──────────────────────────────────────────────────────────────

    // Üye listesi topluluk ve gönderilerle aynı görünürlük kuralına tabidir (D4):
    // PUBLIC herkese açık; PRIVATE/SECRET yalnızca aktif üye veya admin.
    @Transactional(readOnly = true)
    public List<CommunityMemberResponse> getMembers(Long communityId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(c, currentUserId);
        requireCanViewPosts(c, currentUserId);
        return communityMemberRepository.findByCommunityIdAndStatusOrderByJoinedAtDesc(communityId, ACTIVE)
                .stream().map(CommunityMemberResponse::from).toList();
    }

    @Transactional
    public void setMemberRole(Long ownerId, Long communityId, Long targetUserId, String role) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, ownerId) && !isAdmin(ownerId)) {
            throw forbidden("COMMUNITY_OWNER_ONLY_ROLES");
        }
        if (!MODERATOR.equals(role) && !MEMBER.equals(role)) {
            throw new IllegalArgumentException("COMMUNITY_INVALID_ROLE");
        }
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("COMMUNITY_MEMBER_NOT_FOUND"));
        if (OWNER.equals(m.getRole())) {
            throw new IllegalArgumentException("COMMUNITY_OWNER_ROLE_LOCKED");
        }
        if (!ACTIVE.equals(m.getStatus())) {
            throw new IllegalArgumentException("COMMUNITY_ROLE_ACTIVE_ONLY");
        }
        m.setRole(role);
        communityMemberRepository.save(m);
    }

    @Transactional
    public void removeMember(Long managerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(managerId, c);
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("COMMUNITY_MEMBER_NOT_FOUND"));
        if (OWNER.equals(m.getRole())) {
            throw new IllegalArgumentException("COMMUNITY_OWNER_CANNOT_BE_REMOVED");
        }
        // Moderatörü yalnızca sahip/admin çıkarabilir
        if (MODERATOR.equals(m.getRole()) && !isOwner(c, managerId) && !isAdmin(managerId)) {
            throw forbidden("COMMUNITY_OWNER_ONLY_REMOVE_MOD");
        }
        if (managerId != null && managerId.equals(targetUserId)) {
            throw new IllegalArgumentException("COMMUNITY_CANNOT_BAN_SELF");
        }
        // B7: çıkarma = yasak. Satır silinmez (BANNED); kullanıcı join/kod/davetle geri giremez.
        // Kendi ayrılan satır silinir (leaveCommunity) ve tekrar katılabilir; yasak kalkınca (unbanMember) satır silinir.
        if (BANNED.equals(m.getStatus())) return; // idempotent
        m.setStatus(BANNED);
        m.setRole(MEMBER);
        communityMemberRepository.save(m);
    }

    // B7: yasaklı üyeler (yalnızca yönetici)
    @Transactional(readOnly = true)
    public List<CommunityMemberResponse> getBannedMembers(Long managerId, Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(managerId, c);
        return communityMemberRepository.findByCommunityIdAndStatusOrderByJoinedAtDesc(communityId, BANNED)
                .stream().map(CommunityMemberResponse::from).toList();
    }

    // B7: yasağı kaldır = BANNED satırı silinir → kullanıcı tekrar katılabilir (kurallar normal akışla)
    @Transactional
    public void unbanMember(Long managerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(managerId, c);
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("COMMUNITY_BANNED_MEMBER_NOT_FOUND"));
        if (!BANNED.equals(m.getStatus())) {
            throw new ResourceNotFoundException("COMMUNITY_BANNED_MEMBER_NOT_FOUND");
        }
        communityMemberRepository.delete(m);
    }

    @Transactional
    public void transferOwnership(Long ownerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, ownerId)) {
            throw forbidden("COMMUNITY_OWNER_ONLY_TRANSFER");
        }
        // C2: kendine devir anlamsız; arşivli topluluk devredilmez. Bekleyen inceleme (PENDING) devri engellemez.
        if (ownerId.equals(targetUserId)) {
            throw new IllegalArgumentException("COMMUNITY_TRANSFER_TO_SELF");
        }
        if (c.isArchived()) throw archived();
        CommunityMember target = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("COMMUNITY_TRANSFER_TARGET_NOT_FOUND"));
        if (!ACTIVE.equals(target.getStatus())) {
            throw new IllegalArgumentException("COMMUNITY_TRANSFER_ACTIVE_ONLY");
        }
        CommunityMember current = communityMemberRepository.findByUserIdAndCommunityId(ownerId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Mevcut sahip uyeligi bulunamadi."));
        current.setRole(MODERATOR);
        target.setRole(OWNER);
        communityMemberRepository.save(current);
        communityMemberRepository.save(target);
        c.setOwner(target.getUser());
        communityRepository.save(c);
        notificationService.sendSystem(targetUserId, "community_ownership", "community", communityId,
                "\"" + c.getName() + "\" toplulugunun sahipligi size devredildi.");
    }

    // ── Admin onay akışı ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommunityResponse> getPendingForReview() {
        LocalDateTime now = LocalDateTime.now();
        return communityRepository.findByApprovalStatusOrderByCreatedAtAsc(PENDING_REVIEW)
                .stream().filter(c -> !isStalePending(c, now)) // B5: 7 günü aşan zaten reddedilmiş sayılır
                .map(c -> toResponse(c, null)).toList();
    }

    /**
     * B5: 7 gündür karar verilmeyen PENDING topluluklar REJECTED olur (reviewedAt + mevcut ret bildirimi).
     * Saatlik çalışır; okuma yolları aradaki süreyi {@link #effectiveApproval} ile tembel kapatır.
     */
    @Scheduled(cron = "${community.review.autoreject.cron:0 0 * * * *}")
    @Transactional
    public int autoRejectStaleReviews() {
        LocalDateTime now = LocalDateTime.now();
        int count = 0;
        for (Community c : communityRepository.findByApprovalStatusOrderByCreatedAtAsc(PENDING_REVIEW)) {
            if (isStalePending(c, now)) {
                applyRejection(c);
                count++;
            }
        }
        return count;
    }

    @Transactional
    public void approveCommunity(Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        c.setApprovalStatus(APPROVED);
        c.setReviewedAt(LocalDateTime.now());
        communityRepository.save(c);
        if (c.getOwner() != null) {
            notificationService.sendSystem(c.getOwner().getId(), "community_approved", "community", communityId,
                    "\"" + c.getName() + "\" toplulugunuz onaylandi.");
        }
        // B6×B5: onayla + PUBLIC ise incelemede biriken istekler kabul edilir
        if (PUBLIC.equals(effectiveVisibility(c)) && !c.isArchived()) {
            acceptAllPendingRequests(c);
        }
    }

    @Transactional
    public void rejectCommunity(Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        applyRejection(c);
    }

    private void applyRejection(Community c) {
        Long communityId = c.getId();
        c.setApprovalStatus(REJECTED);
        c.setReviewedAt(LocalDateTime.now());
        communityRepository.save(c);
        if (c.getOwner() != null) {
            notificationService.sendSystem(c.getOwner().getId(), "community_rejected", "community", communityId,
                    "\"" + c.getName() + "\" toplulugunuz onaylanmadi.");
        }
    }

    // ── Gönderiler ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommunityPostResponse> getCommunityPosts(Long communityId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(c, currentUserId); // B8

        // Public dışı topluluklarda gönderileri yalnızca aktif üyeler (veya admin) görür
        requireCanViewPosts(c, currentUserId);

        // B11: engellediğim / beni engelleyen kullanıcıların içeriği görünmez
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        // B11: moderasyonla gizlenen gönderiler yalnızca yöneticilere (isHidden: true) listelenir
        boolean manager = isManagerOf(c, currentUserId);
        List<CommunityPost> posts = communityPostRepository.findByCommunityIdOrderByCreatedAtDesc(communityId)
                .stream()
                .filter(p -> p.getUser() == null || !hidden.contains(p.getUser().getId()))
                .filter(p -> manager || !Boolean.TRUE.equals(p.getIsHidden()))
                .toList();
        if (posts.isEmpty()) return List.of();

        List<Long> postIds = posts.stream().map(CommunityPost::getId).toList();
        Map<Long, Long> commentCounts = toCountMap(manager
                ? communityPostCommentRepository.countByCommunityPostIdIn(postIds)
                : communityPostCommentRepository.countVisibleByCommunityPostIdIn(postIds));

        // Anket: tüm seçeneklerin oy sayımları + kullanıcının oyları toplu çekilir (N+1 önlenir)
        List<Long> optionIds = posts.stream()
                .filter(p -> "POLL".equals(p.getPostType()) && p.getPollOptions() != null)
                .flatMap(p -> p.getPollOptions().stream())
                .map(CommunityPostPollOption::getId)
                .toList();
        Map<Long, Long> optionVoteCounts = optionIds.isEmpty()
                ? Map.of() : toCountMap(communityPostPollVoteRepository.countByPollOptionIdIn(optionIds));
        Map<Long, Long> myVotes = (currentUserId == null || optionIds.isEmpty())
                ? Map.of()
                : communityPostPollVoteRepository.findUserVotes(currentUserId, postIds).stream()
                    .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1], (a, b) -> a));

        List<CommunityPostResponse> result = new ArrayList<>();
        for (CommunityPost post : posts) {
            long likeCount = communityPostLikeRepository.countByCommunityPostId(post.getId());
            boolean liked = currentUserId != null &&
                    communityPostLikeRepository.findByUserIdAndCommunityPostId(currentUserId, post.getId()).isPresent();
            CommunityPostResponse dto = CommunityPostResponse.from(post, likeCount,
                    commentCounts.getOrDefault(post.getId(), 0L), liked);

            if ("POLL".equals(post.getPostType()) && post.getPollOptions() != null) {
                Long votedId = myVotes.get(post.getId());
                List<PollOptionDto> options = post.getPollOptions().stream()
                        .map(o -> PollOptionDto.of(
                                o.getId(),
                                o.getOptionText(),
                                optionVoteCounts.getOrDefault(o.getId(), 0L),
                                o.getId().equals(votedId)))
                        .toList();
                dto.setPollOptions(options);
            }
            result.add(dto);
        }
        return result;
    }

    // ── Yorumlar (yanıtlar) ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<CommunityPostCommentResponse> getPostComments(Long communityId, Long postId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(c, currentUserId); // B8
        requireCanViewPosts(c, currentUserId);
        requirePostVisibleTo(c, postId, currentUserId); // D1: başka topluluğun gönderisi okunamaz; B11: gizli gönderi 404
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId); // B11
        boolean manager = isManagerOf(c, currentUserId);
        return communityPostCommentRepository.findByCommunityPostIdOrderByCreatedAtAsc(postId)
                .stream()
                .filter(cm -> cm.getUser() == null || !hidden.contains(cm.getUser().getId()))
                .filter(cm -> manager || !Boolean.TRUE.equals(cm.getIsHidden()))
                .map(CommunityPostCommentResponse::from).toList();
    }

    @Transactional
    public CommunityPostCommentResponse addPostComment(Long userId, Long communityId, Long postId, String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("COMMENT_EMPTY");
        }
        ContentLimits.check(content.trim(), ContentLimits.COMMENT_MAX); // B10
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(community, userId); // B8

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw forbidden("COMMUNITY_MEMBERS_ONLY_COMMENT");
        }
        // D2: üyelik URL'deki topluluk için doğrulandı; gönderi de o topluluğa ait olmalı
        CommunityPost post = requirePostVisibleTo(community, postId, userId);
        contentLimitService.checkComment(userId); // B11: yeni hesap günlük sınırı

        CommunityPostComment comment = new CommunityPostComment();
        comment.setContent(content.trim());
        comment.setUser(user);
        comment.setCommunityPost(post);
        CommunityPostComment saved = communityPostCommentRepository.save(comment);

        // Gönderi sahibine bildirim (kendine değil)
        if (post.getUser() != null && !post.getUser().getId().equals(userId)) {
            notificationService.send(post.getUser().getId(), userId, "community_comment", "community", communityId);
        }
        return CommunityPostCommentResponse.from(saved);
    }

    // Public dışı topluluklarda gönderi/yorumları yalnızca aktif üye (veya admin) görebilir
    private void requireCanViewPosts(Community c, Long currentUserId) {
        // B5: incelemedeki toplulukta içeriği yalnızca sahip, admin ve zaten ACTIVE üyeler görür
        if (isPendingReview(c)) {
            boolean allowed = isOwner(c, currentUserId) || isAdmin(currentUserId)
                    || (currentUserId != null && communityMemberRepository
                            .existsByUserIdAndCommunityIdAndStatus(currentUserId, c.getId(), ACTIVE));
            if (!allowed) throw forbidden(PENDING_REVIEW_CODE);
        }
        if (PUBLIC.equals(effectiveVisibility(c))) return;
        boolean activeMember = currentUserId != null &&
                communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(currentUserId, c.getId(), ACTIVE);
        if (!activeMember && !isAdmin(currentUserId)) {
            throw forbidden("COMMUNITY_MEMBERS_ONLY_VIEW");
        }
    }

    /** B11: yönetici = admin veya ACTIVE OWNER/MODERATOR (hiç hata fırlatmaz). */
    private boolean isManagerOf(Community c, Long userId) {
        if (userId == null) return false;
        if (isAdmin(userId)) return true;
        return communityMemberRepository.findByUserIdAndCommunityId(userId, c.getId())
                .map(m -> ACTIVE.equals(m.getStatus()) && canManage(m.getRole())).orElse(false);
    }

    // ── Gizleme / şikayet (B11) ──────────────────────────────────────────────────

    @Transactional
    public void setPostHidden(Long userId, Long communityId, Long postId, boolean hidden) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(userId, c);
        CommunityPost post = requirePostInCommunity(communityId, postId);
        post.setIsHidden(hidden);
        communityPostRepository.save(post);
    }

    @Transactional
    public void setCommentHidden(Long userId, Long communityId, Long postId, Long commentId, boolean hidden) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireManager(userId, c);
        requirePostInCommunity(communityId, postId);
        CommunityPostComment comment = communityPostCommentRepository.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Yorum bulunamadi: " + commentId));
        if (comment.getCommunityPost() == null || !postId.equals(comment.getCommunityPost().getId())) {
            throw new ResourceNotFoundException("Yorum bulunamadi: " + commentId);
        }
        comment.setIsHidden(hidden);
        communityPostCommentRepository.save(comment);
    }

    /**
     * B11: topluluk gönderisi/yorumu şikayeti — raporlayan içeriği zaten göremiyorsa
     * (gizli/özel topluluk, incelemede, gizlenmiş içerik) hedef yokmuş gibi 404/403 döner.
     * targetType: COMMUNITY_POST | COMMUNITY_COMMENT. Başka türler için hiçbir şey yapmaz.
     */
    @Transactional(readOnly = true)
    public void requireCanReportCommunityContent(Long reporterId, String targetType, Long targetId) {
        String type = targetType == null ? "" : targetType.trim().toUpperCase(java.util.Locale.ROOT);
        if (!"COMMUNITY_POST".equals(type) && !"COMMUNITY_COMMENT".equals(type)) return;
        if (targetId == null) throw new IllegalArgumentException("REPORT_TARGET_MISSING");

        CommunityPost post;
        CommunityPostComment comment = null;
        if ("COMMUNITY_POST".equals(type)) {
            post = communityPostRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + targetId));
        } else {
            comment = communityPostCommentRepository.findById(targetId)
                    .orElseThrow(() -> new ResourceNotFoundException("Yorum bulunamadi: " + targetId));
            post = comment.getCommunityPost();
            if (post == null) throw new ResourceNotFoundException("Yorum bulunamadi: " + targetId);
        }
        Community c = post.getCommunity();
        if (c == null) throw new ResourceNotFoundException("Post bulunamadi: " + post.getId());
        requireCommunityVisible(c, reporterId);
        requireCanViewPosts(c, reporterId);
        boolean hidden = Boolean.TRUE.equals(post.getIsHidden())
                || (comment != null && Boolean.TRUE.equals(comment.getIsHidden()));
        if (hidden && !isManagerOf(c, reporterId)) {
            throw new ResourceNotFoundException("Icerik bulunamadi: " + targetId);
        }
    }

    @Transactional
    public CommunityPostResponse createCommunityPost(Long userId, Long communityId,
                                                      CreateCommunityPostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(community, userId); // B8

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw forbidden("COMMUNITY_MEMBERS_ONLY_POST");
        }

        ContentLimits.check(request.getContent(), ContentLimits.COMMUNITY_POST_MAX);
        contentLimitService.checkPost(userId); // B11: yeni hesap günlük sınırı

        String postType = request.getPostType() != null ? request.getPostType() : "TEXT";
        requirePollAndImageLimits(postType, request); // SEC-C05

        CommunityPost post = new CommunityPost();
        post.setContent(request.getContent());
        post.setUser(user);
        post.setCommunity(community);
        post.setPostType(postType);
        if ("IMAGE".equals(postType)) {
            post.setImageUrl(request.getImageUrl());
        }
        CommunityPost saved = communityPostRepository.save(post);

        List<PollOptionDto> pollDtos = null;
        if ("POLL".equals(postType) && request.getPollOptions() != null) {
            pollDtos = new ArrayList<>();
            for (String optText : request.getPollOptions()) {
                if (optText != null && !optText.isBlank()) {
                    CommunityPostPollOption opt = new CommunityPostPollOption();
                    opt.setCommunityPost(saved);
                    opt.setOptionText(optText.trim());
                    CommunityPostPollOption savedOpt = communityPostPollOptionRepository.save(opt);
                    pollDtos.add(PollOptionDto.of(savedOpt.getId(), savedOpt.getOptionText(), 0, false));
                }
            }
        }

        CommunityPostResponse dto = CommunityPostResponse.from(saved, 0, 0, false);
        dto.setPollOptions(pollDtos);
        return dto;
    }

    @Transactional
    public List<PollOptionDto> votePoll(Long userId, Long communityId, Long postId, Long optionId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(community, userId); // B8

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw forbidden("COMMUNITY_MEMBERS_ONLY_VOTE");
        }
        // D2: gönderi URL'deki topluluğa, seçenek de bu gönderinin anketine ait olmalı
        CommunityPost post = requirePostVisibleTo(community, postId, userId);
        CommunityPostPollOption option = communityPostPollOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Secenek bulunamadi: " + optionId));
        if (option.getCommunityPost() == null || !postId.equals(option.getCommunityPost().getId())) {
            throw new ResourceNotFoundException("Secenek bulunamadi: " + optionId);
        }

        // Önceki oyu sil (oy değiştirme)
        communityPostPollVoteRepository.findByUserIdAndCommunityPostId(userId, postId)
                .ifPresent(communityPostPollVoteRepository::delete);

        CommunityPostPollVote vote = new CommunityPostPollVote();
        vote.setUser(user);
        vote.setPollOption(option);
        vote.setCommunityPostId(postId);
        communityPostPollVoteRepository.save(vote);

        return post.getPollOptions() == null ? List.of() : post.getPollOptions().stream()
                .map(o -> PollOptionDto.of(
                        o.getId(),
                        o.getOptionText(),
                        communityPostPollVoteRepository.countByPollOptionId(o.getId()),
                        o.getId().equals(optionId)))
                .toList();
    }

    // D3: beğeni, gönderiyi görme yetkisiyle aynı kurala tabidir (PUBLIC herkes,
    // PRIVATE/SECRET yalnızca aktif üye/admin) ve gönderi URL'deki topluluğa ait olmalıdır.
    @Transactional
    public void likeCommunityPost(Long userId, Long communityId, Long communityPostId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        CommunityPost post = requireInteractablePost(userId, communityId, communityPostId);

        // B3: tekrar beğeni idempotent (çift dokunuş hata vermez)
        if (communityPostLikeRepository.findByUserIdAndCommunityPostId(userId, communityPostId).isPresent()) {
            return;
        }

        CommunityPostLike like = new CommunityPostLike();
        like.setUser(user);
        like.setCommunityPost(post);
        communityPostLikeRepository.save(like);
    }

    @Transactional
    public void unlikeCommunityPost(Long userId, Long communityId, Long communityPostId) {
        requireInteractablePost(userId, communityId, communityPostId);
        // B3: beğenilmemiş postu geri almak da idempotent
        communityPostLikeRepository.findByUserIdAndCommunityPostId(userId, communityPostId)
                .ifPresent(communityPostLikeRepository::delete);
    }

    // ── Yardımcılar ────────────────────────────────────────────────────────────────

    /**
     * Açıklama sınırı (A1). Postgres varchar karakter (kod noktası) sayar; emoji Java'da
     * 2 birim tutsa da DB'de 1 karakterdir, bu yüzden kod noktası sayılır. Hata bir kod
     * olarak döner, metni istemci dile göre gösterir.
     */
    private static void requireDescriptionLength(String description) {
        if (description != null && description.codePointCount(0, description.length()) > DESCRIPTION_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "COMMUNITY_DESCRIPTION_TOO_LONG");
        }
    }

    /** Gönderi URL'deki topluluğa ait değilse yok sayılır (404) — topluluklar arası erişim olmasın. */
    private CommunityPost requirePostInCommunity(Long communityId, Long postId) {
        CommunityPost post = communityPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + postId));
        if (post.getCommunity() == null || !communityId.equals(post.getCommunity().getId())) {
            throw new ResourceNotFoundException("Post bulunamadi: " + postId);
        }
        return post;
    }

    /** Topluluk görünür, gönderileri görülebilir ve gönderi bu topluluğa ait (D3). */
    private CommunityPost requireInteractablePost(Long userId, Long communityId, Long postId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCommunityVisible(c, userId);
        requireCanViewPosts(c, userId);
        return requirePostVisibleTo(c, postId, userId);
    }

    /** B11: gönderi bu topluluğa ait olmalı; gizliyse yönetici dışına 404 (yorum/beğeni/oy da kapanır). */
    private CommunityPost requirePostVisibleTo(Community c, Long postId, Long userId) {
        CommunityPost post = requirePostInCommunity(c.getId(), postId);
        if (Boolean.TRUE.equals(post.getIsHidden()) && !isManagerOf(c, userId)) {
            throw new ResourceNotFoundException("Post bulunamadi: " + postId);
        }
        return post;
    }

    /** SEC-C05: anket seçenek sayısı/uzunluğu ve görsel yolu; hepsi kod olarak döner. */
    private static void requirePollAndImageLimits(String postType, CreateCommunityPostRequest request) {
        if ("POLL".equals(postType) && request.getPollOptions() != null) {
            List<String> filled = request.getPollOptions().stream()
                    .filter(o -> o != null && !o.isBlank()).toList();
            if (filled.size() > ContentLimits.POLL_OPTIONS_MAX) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_TOO_MANY_OPTIONS");
            }
            for (String o : filled) {
                if (o.trim().length() > ContentLimits.POLL_OPTION_TEXT_MAX) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "POLL_OPTION_TOO_LONG");
                }
            }
        }
        // Mobil yalnızca /media/upload'dan dönen göreli yolu gönderir; dış URL kabul edilmez
        String img = request.getImageUrl();
        if ("IMAGE".equals(postType) && img != null && !img.isBlank()
                && (!img.startsWith("/uploads/") || img.contains(".."))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_URL");
        }
    }

    /** Yetki reddi: 403 (mesaj aynen kalır; istemci durum koduna göre ayırt edebilir). */
    private static ResponseStatusException archived() {
        return new ResponseStatusException(HttpStatus.CONFLICT, "COMMUNITY_ARCHIVED");
    }

    private static ResponseStatusException forbidden(String reason) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, reason);
    }

    private void notifyManagers(Community c, Long requesterId, String type) {
        communityMemberRepository.findByCommunityIdAndStatusOrderByJoinedAtDesc(c.getId(), ACTIVE).stream()
                .filter(m -> OWNER.equals(m.getRole()) || MODERATOR.equals(m.getRole()))
                .forEach(m -> notificationService.send(m.getUser().getId(), requesterId, type, "community", c.getId()));
    }

    private void requireManager(Long userId, Community c) {
        if (isAdmin(userId)) return;
        CommunityMember m = userId == null ? null
                : communityMemberRepository.findByUserIdAndCommunityId(userId, c.getId()).orElse(null);
        if (m == null || !ACTIVE.equals(m.getStatus()) || !canManage(m.getRole())) {
            throw forbidden("COMMUNITY_NO_PERMISSION");
        }
    }

    private boolean canManage(String role) {
        return OWNER.equals(role) || MODERATOR.equals(role);
    }

    private boolean isOwner(Community c, Long userId) {
        return userId != null && c.getOwner() != null && userId.equals(c.getOwner().getId());
    }

    private boolean isAdmin(Long userId) {
        if (userId == null) return false;
        return userRepository.findById(userId)
                .map(u -> u.getRoles() != null && u.getRoles().stream()
                        .anyMatch(r -> "ROLE_ADMIN".equals(r.getName())))
                .orElse(false);
    }

    private String effectiveVisibility(Community c) {
        return c.getVisibility() != null ? c.getVisibility() : PUBLIC;
    }

    // B5: 7 günü aşmış PENDING tembel olarak REJECTED sayılır
    private String effectiveApproval(Community c) {
        return effectiveApprovalStatus(c, LocalDateTime.now());
    }

    private boolean isPendingReview(Community c) {
        return PENDING_REVIEW.equals(effectiveApproval(c));
    }

    private static ResponseStatusException pendingReview() {
        return new ResponseStatusException(HttpStatus.CONFLICT, PENDING_REVIEW_CODE);
    }

    private String normalizeVisibility(String v) {
        if (v == null) return PUBLIC;
        String upper = v.trim().toUpperCase();
        return switch (upper) {
            case PRIVATE, SECRET, PUBLIC -> upper;
            default -> PUBLIC;
        };
    }

    private String generateUniqueInviteCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(INVITE_ALPHABET.charAt(RANDOM.nextInt(INVITE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (communityRepository.findByInviteCode(code).isEmpty()) {
                return code;
            }
        }
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
