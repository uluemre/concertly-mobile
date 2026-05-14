package com.concertly.backend.service;

import com.concertly.backend.dto.request.CreateCommunityPostRequest;
import com.concertly.backend.dto.response.CommunityPostResponse;
import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.exception.AlreadyExistsException;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class CommunityService {

    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final CommunityPostRepository communityPostRepository;
    private final CommunityPostLikeRepository communityPostLikeRepository;
    private final UserRepository userRepository;

    public CommunityService(CommunityRepository communityRepository,
                            CommunityMemberRepository communityMemberRepository,
                            CommunityPostRepository communityPostRepository,
                            CommunityPostLikeRepository communityPostLikeRepository,
                            UserRepository userRepository) {
        this.communityRepository = communityRepository;
        this.communityMemberRepository = communityMemberRepository;
        this.communityPostRepository = communityPostRepository;
        this.communityPostLikeRepository = communityPostLikeRepository;
        this.userRepository = userRepository;
    }

    private CommunityResponse toResponse(Community c, Long currentUserId) {
        long memberCount = communityMemberRepository.countByCommunityId(c.getId());
        long postCount = communityPostRepository.findByCommunityIdOrderByCreatedAtDesc(c.getId()).size();
        boolean joined = currentUserId != null &&
                communityMemberRepository.existsByUserIdAndCommunityId(currentUserId, c.getId());
        return CommunityResponse.from(c, memberCount, postCount, joined);
    }

    public List<CommunityResponse> getAllCommunities(String type, String q, Long currentUserId) {
        List<Community> communities;

        if (q != null && !q.isBlank()) {
            communities = communityRepository.search(q.trim());
        } else if (type != null && !type.isBlank()) {
            communities = communityRepository.findByType(type.trim());
        } else {
            communities = communityRepository.findAll();
        }

        // If both type and q provided, filter search results by type in-memory
        if (type != null && !type.isBlank() && q != null && !q.isBlank()) {
            communities = communities.stream()
                    .filter(c -> type.trim().equalsIgnoreCase(c.getType()))
                    .toList();
        }

        List<CommunityResponse> result = new ArrayList<>();
        for (Community c : communities) {
            result.add(toResponse(c, currentUserId));
        }
        return result;
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

        // Matching communities first, then the rest
        Set<Long> matchingIds = matching.stream().map(Community::getId).collect(Collectors.toSet());
        List<Community> sorted = new ArrayList<>(matching);
        for (Community c : all) {
            if (!matchingIds.contains(c.getId())) {
                sorted.add(c);
            }
        }

        List<CommunityResponse> result = new ArrayList<>();
        for (Community c : sorted) {
            result.add(toResponse(c, currentUserId));
        }
        return result;
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
        return toResponse(c, currentUserId);
    }

    @Transactional
    public void joinCommunity(Long userId, Long communityId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));

        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        if (communityMemberRepository.findByUserIdAndCommunityId(userId, communityId).isPresent()) {
            throw new AlreadyExistsException("Bu topluluga zaten uyesiniz.");
        }

        CommunityMember member = new CommunityMember();
        member.setUser(user);
        member.setCommunity(community);
        communityMemberRepository.save(member);
    }

    @Transactional
    public void leaveCommunity(Long userId, Long communityId) {
        CommunityMember member = communityMemberRepository
                .findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Bu topluluga uye degilsiniz."));

        communityMemberRepository.delete(member);
    }

    public List<CommunityPostResponse> getCommunityPosts(Long communityId, Long currentUserId) {
        communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        List<CommunityPost> posts = communityPostRepository.findByCommunityIdOrderByCreatedAtDesc(communityId);
        List<CommunityPostResponse> result = new ArrayList<>();
        for (CommunityPost post : posts) {
            long likeCount = communityPostLikeRepository.countByCommunityPostId(post.getId());
            boolean liked = currentUserId != null &&
                    communityPostLikeRepository.findByUserIdAndCommunityPostId(currentUserId, post.getId()).isPresent();
            result.add(CommunityPostResponse.from(post, likeCount, liked));
        }
        return result;
    }

    @Transactional
    public CommunityPostResponse createCommunityPost(Long userId, Long communityId,
                                                      CreateCommunityPostRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanici bulunamadi: " + userId));

        Community community = communityRepository.findById(communityId)
                .orElseThrow(() -> new ResourceNotFoundException("Topluluk bulunamadi: " + communityId));

        if (!communityMemberRepository.existsByUserIdAndCommunityId(userId, communityId)) {
            throw new IllegalArgumentException("Sadece uyeler post olusturabilir.");
        }

        CommunityPost post = new CommunityPost();
        post.setContent(request.getContent());
        post.setUser(user);
        post.setCommunity(community);
        CommunityPost saved = communityPostRepository.save(post);

        return CommunityPostResponse.from(saved, 0, false);
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
}
