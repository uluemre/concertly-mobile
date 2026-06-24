package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateCommunityPostRequest;
import com.concertly.backend.dto.request.CreateCommunityRequest;
import com.concertly.backend.dto.response.CommunityMemberResponse;
import com.concertly.backend.dto.response.CommunityPostCommentResponse;
import com.concertly.backend.dto.response.CommunityPostResponse;
import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.CommunityService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    private final CommunityService communityService;

    public CommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    // ── Listeleme / keşif ──────────────────────────────────────────────────────────

    @GetMapping
    public List<CommunityResponse> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String q) {
        return communityService.getAllCommunities(type, q, JwtUtil.getCurrentUserId());
    }

    @GetMapping("/recommended")
    public List<CommunityResponse> recommended(
            @RequestParam(value = "genres", required = false) String genresCsv) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        if (genresCsv != null && !genresCsv.isBlank()) {
            List<String> genres = Arrays.asList(genresCsv.split(","));
            return communityService.getRecommendedCommunities(genres, currentUserId);
        }
        return communityService.getAllCommunities(null, null, currentUserId);
    }

    @GetMapping("/mine")
    public List<CommunityResponse> mine() {
        return communityService.getMyCommunities(JwtUtil.getCurrentUserId());
    }

    @GetMapping("/{id}")
    public CommunityResponse detail(@PathVariable Long id) {
        return communityService.getCommunityById(id, JwtUtil.getCurrentUserId());
    }

    // ── Oluşturma / düzenleme / silme ─────────────────────────────────────────────

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityResponse create(@RequestBody CreateCommunityRequest req) {
        return communityService.createCommunity(JwtUtil.getCurrentUserId(), req);
    }

    @PutMapping("/{id}")
    public CommunityResponse update(@PathVariable Long id, @RequestBody CreateCommunityRequest req) {
        return communityService.updateCommunity(JwtUtil.getCurrentUserId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        communityService.deleteCommunity(JwtUtil.getCurrentUserId(), id);
    }

    // ── Katılım ───────────────────────────────────────────────────────────────────

    @PostMapping("/{id}/join")
    public CommunityResponse join(@PathVariable Long id) {
        return communityService.joinCommunity(JwtUtil.getCurrentUserId(), id);
    }

    @PostMapping("/join")
    public CommunityResponse joinByCode(@RequestParam String code) {
        return communityService.joinByInviteCode(JwtUtil.getCurrentUserId(), code);
    }

    @DeleteMapping("/{id}/join")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable Long id) {
        communityService.leaveCommunity(JwtUtil.getCurrentUserId(), id);
    }

    // ── Katılma istekleri (mod) ────────────────────────────────────────────────────

    @GetMapping("/{id}/requests")
    public List<CommunityMemberResponse> requests(@PathVariable Long id) {
        return communityService.getJoinRequests(JwtUtil.getCurrentUserId(), id);
    }

    @PostMapping("/{id}/requests/{userId}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approveRequest(@PathVariable Long id, @PathVariable Long userId) {
        communityService.approveRequest(JwtUtil.getCurrentUserId(), id, userId);
    }

    @PostMapping("/{id}/requests/{userId}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rejectRequest(@PathVariable Long id, @PathVariable Long userId) {
        communityService.rejectRequest(JwtUtil.getCurrentUserId(), id, userId);
    }

    // ── Davet ───────────────────────────────────────────────────────────────────

    @PostMapping("/{id}/invite/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void invite(@PathVariable Long id, @PathVariable Long userId) {
        communityService.inviteUser(JwtUtil.getCurrentUserId(), id, userId);
    }

    @PostMapping("/{id}/invite/accept")
    public CommunityResponse acceptInvite(@PathVariable Long id) {
        return communityService.acceptInvite(JwtUtil.getCurrentUserId(), id);
    }

    @DeleteMapping("/{id}/invite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void declineInvite(@PathVariable Long id) {
        communityService.declineInvite(JwtUtil.getCurrentUserId(), id);
    }

    @PostMapping("/{id}/invite-code/regenerate")
    public Map<String, String> regenerateInviteCode(@PathVariable Long id) {
        return Map.of("inviteCode", communityService.regenerateInviteCode(JwtUtil.getCurrentUserId(), id));
    }

    // ── Üye yönetimi ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/members")
    public List<CommunityMemberResponse> members(@PathVariable Long id) {
        return communityService.getMembers(id);
    }

    @PostMapping("/{id}/members/{userId}/role")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setRole(@PathVariable Long id, @PathVariable Long userId, @RequestParam String role) {
        communityService.setMemberRole(JwtUtil.getCurrentUserId(), id, userId, role);
    }

    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable Long id, @PathVariable Long userId) {
        communityService.removeMember(JwtUtil.getCurrentUserId(), id, userId);
    }

    @PostMapping("/{id}/transfer/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void transfer(@PathVariable Long id, @PathVariable Long userId) {
        communityService.transferOwnership(JwtUtil.getCurrentUserId(), id, userId);
    }

    // ── Gönderiler ─────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/posts")
    public List<CommunityPostResponse> posts(@PathVariable Long id) {
        return communityService.getCommunityPosts(id, JwtUtil.getCurrentUserId());
    }

    @PostMapping("/{id}/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostResponse createPost(
            @PathVariable Long id,
            @RequestBody CreateCommunityPostRequest request) {
        return communityService.createCommunityPost(JwtUtil.getCurrentUserId(), id, request);
    }

    @GetMapping("/{id}/posts/{postId}/comments")
    public List<CommunityPostCommentResponse> comments(@PathVariable Long id, @PathVariable Long postId) {
        return communityService.getPostComments(id, postId, JwtUtil.getCurrentUserId());
    }

    @PostMapping("/{id}/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostCommentResponse addComment(
            @PathVariable Long id,
            @PathVariable Long postId,
            @RequestBody CreateCommunityPostRequest request) {
        return communityService.addPostComment(JwtUtil.getCurrentUserId(), id, postId, request.getContent());
    }

    @PostMapping("/{id}/posts/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void likePost(@PathVariable Long id, @PathVariable Long postId) {
        communityService.likeCommunityPost(JwtUtil.getCurrentUserId(), postId);
    }

    @DeleteMapping("/{id}/posts/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlikePost(@PathVariable Long id, @PathVariable Long postId) {
        communityService.unlikeCommunityPost(JwtUtil.getCurrentUserId(), postId);
    }
}
