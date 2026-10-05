package com.concertly.backend.service;

import com.concertly.backend.dto.response.UserSummaryResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Follow;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.FollowRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FollowService {

    /** Bekleyen istek listesi için üst sınır (sayfalama yok). */
    private static final int MAX_PENDING_LIST = 200;

    private final FollowRepository followRepository;
    private final UserRepository   userRepository;
    private final NotificationService notificationService;
    private final ModerationService moderationService;
    private final PrivacyService privacyService;
    private final ArtistFollowRepository artistFollowRepository;

    public FollowService(FollowRepository followRepository,
                         UserRepository userRepository,
                         NotificationService notificationService,
                         ModerationService moderationService,
                         PrivacyService privacyService,
                         ArtistFollowRepository artistFollowRepository) {
        this.followRepository    = followRepository;
        this.userRepository      = userRepository;
        this.notificationService = notificationService;
        this.moderationService   = moderationService;
        this.privacyService      = privacyService;
        this.artistFollowRepository = artistFollowRepository;
    }

    // ✅ TAKİP ET — özel hesapta PENDING istek, açık hesapta doğrudan ACCEPTED
    @Transactional
    public void follow(Long followerId, Long followingId) {

        if (followerId.equals(followingId)) {
            throw new IllegalArgumentException("Kendinizi takip edemezsiniz.");
        }
        // Aralarında engel varsa (hangi yönde olursa olsun) takip edilemez
        moderationService.requireCanInteract(followerId, followingId);

        User follower = userRepository.findById(followerId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + followerId));

        User following = userRepository.findById(followingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + followingId));

        // Zaten takip ediliyorsa ya da istek beklemedeyse işlem tamam sayılır (N-27): eski
        // ekrandan gelen ikinci basış hata göstermez, ikinci bildirim de gitmez
        if (followRepository.findByFollowerIdAndFollowingId(followerId, followingId).isPresent()) {
            return;
        }

        boolean needsApproval = PrivacyService.isPrivate(following);
        Follow follow = new Follow();
        follow.setFollower(follower);
        follow.setFollowing(following);
        follow.setStatus(needsApproval ? Follow.PENDING : Follow.ACCEPTED);
        followRepository.save(follow);
        notificationService.send(followingId, followerId,
                needsApproval ? "follow_request" : "follow", "user", followingId);
    }

    // ✅ TAKİBİ BIRAK / İSTEĞİ İPTAL ET — PENDING ve ACCEPTED satırı siler
    @Transactional
    public void unfollow(Long followerId, Long followingId) {

        // Zaten takip edilmiyorsa işlem tamam sayılır (N-27; eskiden 404 + hata uyarısı)
        followRepository.findByFollowerIdAndFollowingId(followerId, followingId)
                .ifPresent(followRepository::delete);
    }

    // ✅ BEKLEYEN TAKİP İSTEKLERİM — yalnızca başlık alanları
    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getFollowRequests(Long ownerId) {
        Set<Long> hidden = moderationService.getHiddenUserIds(ownerId);
        return followRepository.findPendingRequests(ownerId, PageRequest.of(0, MAX_PENDING_LIST)).stream()
                .map(Follow::getFollower)
                .filter(u -> !hidden.contains(u.getId()))
                .map(u -> toSummary(u, ownerId, false, true))
                .collect(Collectors.toList());
    }

    // ✅ İSTEĞİ KABUL ET — yalnızca KENDİME gelen bir istek; başkasının isteği 404
    @Transactional
    public void acceptRequest(Long ownerId, Long requesterId) {
        Follow follow = findPendingFor(ownerId, requesterId);
        follow.setStatus(Follow.ACCEPTED);
        followRepository.save(follow);
        notificationService.clearFollowRequest(ownerId, requesterId);
        notificationService.send(requesterId, ownerId, "follow_accepted", "user", ownerId);
    }

    // ✅ İSTEĞİ REDDET — satır silinir; kabul edilmiş takipçiye dokunmaz
    @Transactional
    public void rejectRequest(Long ownerId, Long requesterId) {
        followRepository.delete(findPendingFor(ownerId, requesterId));
        notificationService.clearFollowRequest(ownerId, requesterId);
    }

    private Follow findPendingFor(Long ownerId, Long requesterId) {
        return followRepository.findByFollowerIdAndFollowingId(requesterId, ownerId)
                .filter(f -> Follow.PENDING.equals(f.getStatus()))
                .orElseThrow(() -> new ResourceNotFoundException("Takip isteği bulunamadı."));
    }

    // ✅ KULLANICI PROFİLİ — takipçi/takip sayısı ve mevcut kullanıcının takip durumu
    @Transactional(readOnly = true)
    public UserSummaryResponse getUserProfile(Long targetUserId, Long currentUserId) {

        moderationService.requireVisible(currentUserId, targetUserId);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + targetUserId));

        // E-posta/telefon yalnızca kullanıcı kendi profilini çekerken döner (Ayarlar formu)
        boolean isSelf = targetUserId.equals(currentUserId);
        // Özel hesapta yetkisiz izleyici yalnızca başlığı görür (şehir/türler gizli)
        boolean restricted = !privacyService.canViewContent(currentUserId, target);
        return toSummary(target, currentUserId, isSelf, restricted);
    }

    // ✅ TAKİPÇİ LİSTESİ — beni takip edenler (yalnızca kabul edilenler)
    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getFollowers(Long userId, Long currentUserId) {
        moderationService.requireVisible(currentUserId, userId);
        privacyService.requireCanViewContent(currentUserId, userId);
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        List<User> users = followRepository.findAcceptedFollowers(userId).stream()
                .map(Follow::getFollower)
                .filter(u -> !hidden.contains(u.getId()))
                .toList();
        return toSummaries(users, currentUserId);
    }

    // ✅ TAKİP LİSTESİ — takip ettiklerim (yalnızca kabul edilenler)
    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getFollowing(Long userId, Long currentUserId) {
        moderationService.requireVisible(currentUserId, userId);
        privacyService.requireCanViewContent(currentUserId, userId);
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        List<User> users = followRepository.findAcceptedFollowing(userId).stream()
                .map(Follow::getFollowing)
                .filter(u -> !hidden.contains(u.getId()))
                .toList();
        return toSummaries(users, currentUserId);
    }

    /** Liste satırları: özel + yetkisiz hesapların şehir/türleri toplu sorguyla gizlenir. */
    private List<UserSummaryResponse> toSummaries(List<User> users, Long currentUserId) {
        Set<Long> restricted = privacyService.restrictedOwnerIds(currentUserId, users);
        return users.stream()
                .map(u -> toSummary(u, currentUserId, false, restricted.contains(u.getId())))
                .collect(Collectors.toList());
    }

    private UserSummaryResponse toSummary(User user, Long currentUserId, boolean includeContact, boolean restricted) {
        long followers = followRepository.countAcceptedFollowers(user.getId());
        // "Takip" sayısı kişileri ve takip edilen sanatçıları birlikte sayar (N-46, Emre kararı)
        long following = followRepository.countAcceptedFollowing(user.getId())
                + artistFollowRepository.countByUserId(user.getId());
        String status = followStatus(currentUserId, user.getId());
        UserSummaryResponse dto = UserSummaryResponse.from(user, followers, following,
                Follow.ACCEPTED.equals(status), includeContact).withFollowStatus(status);
        return restricted ? dto.restrictToHeader() : dto;
    }

    /** NONE | PENDING | ACCEPTED — izleyicinin hedefi takip durumu (NULL satır = ACCEPTED). */
    private String followStatus(Long currentUserId, Long targetId) {
        if (currentUserId == null || currentUserId.equals(targetId)) return "NONE";
        return followRepository.findByFollowerIdAndFollowingId(currentUserId, targetId)
                .map(f -> f.isAccepted() ? Follow.ACCEPTED : Follow.PENDING)
                .orElse("NONE");
    }
}
