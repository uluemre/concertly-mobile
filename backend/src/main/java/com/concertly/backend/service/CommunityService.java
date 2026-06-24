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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
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

    // Bir kullanıcının kurabileceği en fazla topluluk (spam koruması)
    private static final int MAX_OWNED_COMMUNITIES = 5;

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

    public CommunityService(CommunityRepository communityRepository,
                            CommunityMemberRepository communityMemberRepository,
                            CommunityPostRepository communityPostRepository,
                            CommunityPostLikeRepository communityPostLikeRepository,
                            CommunityPostCommentRepository communityPostCommentRepository,
                            CommunityPostPollOptionRepository communityPostPollOptionRepository,
                            CommunityPostPollVoteRepository communityPostPollVoteRepository,
                            UserRepository userRepository,
                            NotificationService notificationService) {
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.communityPostRepository = communityPostRepository;
        this.communityPostLikeRepository = communityPostLikeRepository;
        this.communityPostCommentRepository = communityPostCommentRepository;
        this.communityPostPollOptionRepository = communityPostPollOptionRepository;
        this.communityPostPollVoteRepository = communityPostPollVoteRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
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
        return CommunityResponse.from(c, memberCount, postCount, role, status, pendingCount);
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
                    return CommunityResponse.from(c,
                            memberCounts.getOrDefault(c.getId(), 0L),
                            postCounts.getOrDefault(c.getId(), 0L),
                            role, status, null);
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

    public List<CommunityResponse> getAllCommunities(String type, String q, Long currentUserId) {
        List<Community> communities;

        if (q != null && !q.isBlank()) {
            communities = communityRepository.search(q.trim());
        } else if (type != null && !type.isBlank()) {
            communities = communityRepository.findByType(type.trim());
        } else {
            communities = communityRepository.findAll();
        }

        if (type != null && !type.isBlank() && q != null && !q.isBlank()) {
            communities = communities.stream()
                    .filter(c -> type.trim().equalsIgnoreCase(c.getType()))
                    .toList();
        }

        return toResponses(filterVisible(communities, currentUserId), currentUserId);
    }

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
                    .map(m -> m.getCommunity().getId()).collect(Collectors.toSet());

        return communities.stream().filter(c -> {
            if (REJECTED.equals(effectiveApproval(c))) return false;
            if (SECRET.equals(effectiveVisibility(c)) && !myCommunityIds.contains(c.getId())) return false;
            return true;
        }).toList();
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

    public CommunityResponse getCommunityById(Long communityId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        boolean member = currentUserId != null &&
                communityMemberRepository.findByUserIdAndCommunityId(currentUserId, communityId).isPresent();
        boolean privileged = member || isAdmin(currentUserId) || isOwner(c, currentUserId);

        // Gizli topluluk üye olmayana yok gibi davranır; reddedilen yalnızca sahip/admin görür.
        if (SECRET.equals(effectiveVisibility(c)) && !privileged) {
            throw new ResourceNotFoundException("Topluluk bulunamadi: " + communityId);
        }
        if (REJECTED.equals(effectiveApproval(c)) && !(isAdmin(currentUserId) || isOwner(c, currentUserId))) {
            throw new ResourceNotFoundException("Topluluk bulunamadi: " + communityId);
        }
        return toResponse(c, currentUserId);
    }

    // ── Oluşturma / düzenleme / silme ─────────────────────────────────────────────

    @Transactional
    public CommunityResponse createCommunity(Long userId, CreateCommunityRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));

        if (req.getName() == null || req.getName().isBlank()) {
            throw new IllegalArgumentException("Topluluk adi gerekli.");
        }
        if (communityRepository.countByOwnerId(userId) >= MAX_OWNED_COMMUNITIES) {
            throw new IllegalArgumentException("En fazla " + MAX_OWNED_COMMUNITIES + " topluluk kurabilirsiniz.");
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
        requireManager(userId, c);

        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getType() != null) c.setType(req.getType().trim());
        if (req.getCity() != null) c.setCity(req.getCity());
        if (req.getEmoji() != null && !req.getEmoji().isBlank()) c.setEmoji(req.getEmoji());
        if (req.getDescription() != null) c.setDescription(req.getDescription());
        if (req.getGradientStart() != null) c.setGradientStart(req.getGradientStart());
        if (req.getGradientEnd() != null) c.setGradientEnd(req.getGradientEnd());
        if (req.getTags() != null) c.setTags(req.getTags());
        if (req.getVisibility() != null) c.setVisibility(normalizeVisibility(req.getVisibility()));

        return toResponse(communityRepository.save(c), userId);
    }

    @Transactional
    public void deleteCommunity(Long userId, Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, userId) && !isAdmin(userId)) {
            throw new IllegalArgumentException("Sadece topluluk sahibi silebilir.");
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
        communityRepository.delete(c);
    }

    // ── Katılım ───────────────────────────────────────────────────────────────────

    @Transactional
    public CommunityResponse joinCommunity(Long userId, Long communityId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(userId, communityId).orElse(null);
        if (existing != null) {
            switch (existing.getStatus()) {
                case ACTIVE -> throw new AlreadyExistsException("Bu topluluga zaten uyesiniz.");
                case PENDING -> throw new AlreadyExistsException("Katilma isteginiz zaten beklemede.");
                case BANNED -> throw new IllegalArgumentException("Bu topluluga katilamazsiniz.");
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
            throw new IllegalArgumentException("Bu toplulluga yalnizca davetle katilabilirsiniz.");
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
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findByInviteCode(code)
                .orElseThrow(() -> new ResourceNotFoundException("Davet baglantisi gecersiz."));

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(userId, community.getId()).orElse(null);
        if (existing != null) {
            if (BANNED.equals(existing.getStatus())) {
                throw new IllegalArgumentException("Bu topluluga katilamazsiniz.");
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
                .orElseThrow(() -> new ResourceNotFoundException("Bu topluluga uye degilsiniz."));
        if (OWNER.equals(member.getRole())) {
            throw new IllegalArgumentException("Topluluk sahibi ayrilamaz. Once sahipligi devredin veya toplulugu silin.");
        }
        communityMemberRepository.delete(member);
    }

    // ── Katılma istekleri (mod) ────────────────────────────────────────────────────

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
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Katilma istegi bulunamadi."));
        if (!PENDING.equals(m.getStatus())) {
            throw new IllegalArgumentException("Bekleyen bir istek yok.");
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
                .orElseThrow(() -> new ResourceNotFoundException("Katilma istegi bulunamadi."));
        if (!PENDING.equals(m.getStatus())) {
            throw new IllegalArgumentException("Bekleyen bir istek yok.");
        }
        communityMemberRepository.delete(m);
    }

    // ── Davet ───────────────────────────────────────────────────────────────────

    @Transactional
    public void inviteUser(Long inviterId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(inviterId, communityId, ACTIVE)) {
            throw new IllegalArgumentException("Sadece uyeler davet edebilir.");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + targetUserId));

        CommunityMember existing = communityMemberRepository
                .findByUserIdAndCommunityId(targetUserId, communityId).orElse(null);
        if (existing != null) {
            if (ACTIVE.equals(existing.getStatus())) throw new AlreadyExistsException("Bu kullanici zaten uye.");
            if (BANNED.equals(existing.getStatus())) throw new IllegalArgumentException("Bu kullanici engellenmis.");
            // PENDING isteği varsa daveti onay gibi say → ACTIVE; INVITED ise tekrar bildir
            if (PENDING.equals(existing.getStatus())) {
                existing.setStatus(ACTIVE);
                communityMemberRepository.save(existing);
                notificationService.sendSystem(targetUserId, "community_request_approved", "community", communityId,
                        "\"" + c.getName() + "\" toplulugu katilma isteginizi onayladi.");
                return;
            }
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
                .orElseThrow(() -> new ResourceNotFoundException("Davet bulunamadi."));
        if (!INVITED.equals(m.getStatus())) {
            throw new IllegalArgumentException("Bekleyen bir davet yok.");
        }
        m.setStatus(ACTIVE);
        communityMemberRepository.save(m);
        return toResponse(m.getCommunity(), userId);
    }

    @Transactional
    public void declineInvite(Long userId, Long communityId) {
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Davet bulunamadi."));
        if (!INVITED.equals(m.getStatus())) {
            throw new IllegalArgumentException("Bekleyen bir davet yok.");
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

    public List<CommunityMemberResponse> getMembers(Long communityId) {
        communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        return communityMemberRepository.findByCommunityIdAndStatusOrderByJoinedAtDesc(communityId, ACTIVE)
                .stream().map(CommunityMemberResponse::from).toList();
    }

    @Transactional
    public void setMemberRole(Long ownerId, Long communityId, Long targetUserId, String role) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, ownerId) && !isAdmin(ownerId)) {
            throw new IllegalArgumentException("Sadece topluluk sahibi rol atayabilir.");
        }
        if (!MODERATOR.equals(role) && !MEMBER.equals(role)) {
            throw new IllegalArgumentException("Gecersiz rol.");
        }
        CommunityMember m = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Uye bulunamadi."));
        if (OWNER.equals(m.getRole())) {
            throw new IllegalArgumentException("Sahibin rolu degistirilemez.");
        }
        if (!ACTIVE.equals(m.getStatus())) {
            throw new IllegalArgumentException("Yalnizca aktif uyelere rol atanir.");
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
                .orElseThrow(() -> new ResourceNotFoundException("Uye bulunamadi."));
        if (OWNER.equals(m.getRole())) {
            throw new IllegalArgumentException("Topluluk sahibi cikarilamaz.");
        }
        // Moderatörü yalnızca sahip/admin çıkarabilir
        if (MODERATOR.equals(m.getRole()) && !isOwner(c, managerId) && !isAdmin(managerId)) {
            throw new IllegalArgumentException("Moderatoru yalnizca sahip cikarabilir.");
        }
        communityMemberRepository.delete(m);
    }

    @Transactional
    public void transferOwnership(Long ownerId, Long communityId, Long targetUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        if (!isOwner(c, ownerId)) {
            throw new IllegalArgumentException("Sadece mevcut sahip devredebilir.");
        }
        CommunityMember target = communityMemberRepository.findByUserIdAndCommunityId(targetUserId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Hedef uye bulunamadi."));
        if (!ACTIVE.equals(target.getStatus())) {
            throw new IllegalArgumentException("Sahiplik yalnizca aktif uyeye devredilir.");
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

    public List<CommunityResponse> getPendingForReview() {
        return communityRepository.findByApprovalStatusOrderByCreatedAtAsc(PENDING_REVIEW)
                .stream().map(c -> toResponse(c, null)).toList();
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
    }

    @Transactional
    public void rejectCommunity(Long communityId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        c.setApprovalStatus(REJECTED);
        c.setReviewedAt(LocalDateTime.now());
        communityRepository.save(c);
        if (c.getOwner() != null) {
            notificationService.sendSystem(c.getOwner().getId(), "community_rejected", "community", communityId,
                    "\"" + c.getName() + "\" toplulugunuz onaylanmadi.");
        }
    }

    // ── Gönderiler ─────────────────────────────────────────────────────────────────

    public List<CommunityPostResponse> getCommunityPosts(Long communityId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        // Public dışı topluluklarda gönderileri yalnızca aktif üyeler (veya admin) görür
        requireCanViewPosts(c, currentUserId);

        List<CommunityPost> posts = communityPostRepository.findByCommunityIdOrderByCreatedAtDesc(communityId);
        if (posts.isEmpty()) return List.of();

        List<Long> postIds = posts.stream().map(CommunityPost::getId).toList();
        Map<Long, Long> commentCounts = toCountMap(communityPostCommentRepository.countByCommunityPostIdIn(postIds));

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

    public List<CommunityPostCommentResponse> getPostComments(Long communityId, Long postId, Long currentUserId) {
        Community c = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        requireCanViewPosts(c, currentUserId);
        return communityPostCommentRepository.findByCommunityPostIdOrderByCreatedAtAsc(postId)
                .stream().map(CommunityPostCommentResponse::from).toList();
    }

    @Transactional
    public CommunityPostCommentResponse addPostComment(Long userId, Long communityId, Long postId, String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Yorum bos olamaz.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));
        CommunityPost post = communityPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + postId));

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw new IllegalArgumentException("Sadece uyeler yorum yapabilir.");
        }

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
        if (PUBLIC.equals(effectiveVisibility(c))) return;
        boolean activeMember = currentUserId != null &&
                communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(currentUserId, c.getId(), ACTIVE);
        if (!activeMember && !isAdmin(currentUserId)) {
            throw new IllegalArgumentException("Bu toplulugun gonderilerini gormek icin uye olmalisiniz.");
        }
    }

    @Transactional
    public CommunityPostResponse createCommunityPost(Long userId, Long communityId,
                                                      CreateCommunityPostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw new IllegalArgumentException("Sadece uyeler post olusturabilir.");
        }

        String postType = request.getPostType() != null ? request.getPostType() : "TEXT";

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
        CommunityPost post = communityPostRepository.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + postId));
        CommunityPostPollOption option = communityPostPollOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Secenek bulunamadi: " + optionId));

        if (!communityMemberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, ACTIVE)) {
            throw new IllegalArgumentException("Sadece uyeler oy verebilir.");
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

    @Transactional
    public void likeCommunityPost(Long userId, Long communityPostId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));
        CommunityPost post = communityPostRepository.findById(communityPostId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + communityPostId));

        if (communityPostLikeRepository.findByUserIdAndCommunityPostId(userId, communityPostId).isPresent()) {
            throw new AlreadyExistsException("Bu postu zaten begendiniz.");
        }

        CommunityPostLike like = new CommunityPostLike();
        like.setUser(user);
        like.setCommunityPost(post);
        communityPostLikeRepository.save(like);
    }

    @Transactional
    public void unlikeCommunityPost(Long userId, Long communityPostId) {
        communityPostRepository.findById(communityPostId)
                .orElseThrow(() -> new ResourceNotFoundException("Post bulunamadi: " + communityPostId));
        CommunityPostLike like = communityPostLikeRepository
                .findByUserIdAndCommunityPostId(userId, communityPostId)
                .orElseThrow(() -> new ResourceNotFoundException("Bu post daha once begenilmemis."));
        communityPostLikeRepository.delete(like);
    }

    // ── Yardımcılar ────────────────────────────────────────────────────────────────

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
            throw new IllegalArgumentException("Bu islem icin yetkiniz yok.");
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

    private String effectiveApproval(Community c) {
        return c.getApprovalStatus() != null ? c.getApprovalStatus() : APPROVED;
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
