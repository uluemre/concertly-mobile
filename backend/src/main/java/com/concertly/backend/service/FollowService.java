package com.concertly.backend.service;

import com.concertly.backend.dto.response.UserSummaryResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Follow;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.FollowRepository;
import com.concertly.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository   userRepository;
    private final NotificationService notificationService;
    private final ModerationService moderationService;

    public FollowService(FollowRepository followRepository,
                         UserRepository userRepository,
                         NotificationService notificationService,
                         ModerationService moderationService) {
        this.followRepository    = followRepository;
        this.userRepository      = userRepository;
        this.notificationService = notificationService;
        this.moderationService   = moderationService;
    }

    // ✅ TAKİP ET
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

        if (followRepository.findByFollowerIdAndFollowingId(followerId, followingId).isPresent()) {
            throw new AlreadyExistsException("Bu kullanıcıyı zaten takip ediyorsunuz.");
        }

        Follow follow = new Follow();
        follow.setFollower(follower);
        follow.setFollowing(following);
        followRepository.save(follow);
        notificationService.send(followingId, followerId, "follow", "user", followingId);
    }

    // ✅ TAKİBİ BIRAK
    @Transactional
    public void unfollow(Long followerId, Long followingId) {

        Follow follow = followRepository
                .findByFollowerIdAndFollowingId(followerId, followingId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Bu kullanıcıyı zaten takip etmiyorsunuz."));

        followRepository.delete(follow);
    }

    // ✅ KULLANICI PROFİLİ — takipçi/takip sayısı ve mevcut kullanıcının takip durumu
    public UserSummaryResponse getUserProfile(Long targetUserId, Long currentUserId) {

        moderationService.requireVisible(currentUserId, targetUserId);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + targetUserId));

        long followerCount  = followRepository.countByFollowingId(targetUserId);
        long followingCount = followRepository.countByFollowerId(targetUserId);

        boolean isFollowed = currentUserId != null &&
                followRepository.findByFollowerIdAndFollowingId(currentUserId, targetUserId).isPresent();

        // E-posta/telefon yalnızca kullanıcı kendi profilini çekerken döner (Ayarlar formu)
        boolean isSelf = targetUserId.equals(currentUserId);
        return UserSummaryResponse.from(target, followerCount, followingCount, isFollowed, isSelf);
    }

    // ✅ TAKİPÇİ LİSTESİ — beni takip edenler
    public List<UserSummaryResponse> getFollowers(Long userId, Long currentUserId) {
        moderationService.requireVisible(currentUserId, userId);
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        return followRepository.findAllByFollowingId(userId).stream()
                .filter(f -> !hidden.contains(f.getFollower().getId()))
                .map(f -> {
                    User follower = f.getFollower();
                    long fc  = followRepository.countByFollowingId(follower.getId());
                    long fwc = followRepository.countByFollowerId(follower.getId());
                    boolean isFollowed = currentUserId != null &&
                            followRepository.findByFollowerIdAndFollowingId(currentUserId, follower.getId()).isPresent();
                    return UserSummaryResponse.from(follower, fc, fwc, isFollowed);
                })
                .collect(Collectors.toList());
    }

    // ✅ TAKİP LİSTESİ — takip ettiklerim
    public List<UserSummaryResponse> getFollowing(Long userId, Long currentUserId) {
        moderationService.requireVisible(currentUserId, userId);
        Set<Long> hidden = moderationService.getHiddenUserIds(currentUserId);
        return followRepository.findAllByFollowerId(userId).stream()
                .filter(f -> !hidden.contains(f.getFollowing().getId()))
                .map(f -> {
                    User following = f.getFollowing();
                    long fc  = followRepository.countByFollowingId(following.getId());
                    long fwc = followRepository.countByFollowerId(following.getId());
                    boolean isFollowed = currentUserId != null &&
                            followRepository.findByFollowerIdAndFollowingId(currentUserId, following.getId()).isPresent();
                    return UserSummaryResponse.from(following, fc, fwc, isFollowed);
                })
                .collect(Collectors.toList());
    }
}