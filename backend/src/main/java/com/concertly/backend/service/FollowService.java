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

@Service
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository   userRepository;

    public FollowService(FollowRepository followRepository,
                         UserRepository userRepository) {
        this.followRepository = followRepository;
        this.userRepository   = userRepository;
    }

    // ✅ TAKİP ET
    @Transactional
    public void follow(Long followerId, Long followingId) {

        if (followerId.equals(followingId)) {
            throw new IllegalArgumentException("Kendinizi takip edemezsiniz.");
        }

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

        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Kullanıcı bulunamadı: " + targetUserId));

        long followerCount  = followRepository.countByFollowingId(targetUserId);
        long followingCount = followRepository.countByFollowerId(targetUserId);

        boolean isFollowed = currentUserId != null &&
                followRepository.findByFollowerIdAndFollowingId(currentUserId, targetUserId).isPresent();

        return UserSummaryResponse.from(target, followerCount, followingCount, isFollowed);
    }
}