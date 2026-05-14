package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateCommunityPostRequest;
import com.concertly.backend.dto.response.CommunityPostResponse;
import com.concertly.backend.dto.response.CommunityResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.CommunityService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    private final CommunityService communityService;

    public CommunityController(CommunityService communityService) {
        this.communityService = communityService;
    }

    @GetMapping
    public List<CommunityResponse> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String q) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return communityService.getAllCommunities(type, q, currentUserId);
    }

    @GetMapping("/{id}")
    public CommunityResponse detail(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return communityService.getCommunityById(id, currentUserId);
    }

    @PostMapping("/{id}/join")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void join(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        communityService.joinCommunity(userId, id);
    }

    @DeleteMapping("/{id}/join")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        communityService.leaveCommunity(userId, id);
    }

    @GetMapping("/{id}/posts")
    public List<CommunityPostResponse> posts(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return communityService.getCommunityPosts(id, currentUserId);
    }

    @PostMapping("/{id}/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public CommunityPostResponse createPost(
            @PathVariable Long id,
            @RequestBody CreateCommunityPostRequest request) {
        Long userId = JwtUtil.getCurrentUserId();
        return communityService.createCommunityPost(userId, id, request);
    }

    @PostMapping("/{id}/posts/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void likePost(
            @PathVariable Long id,
            @PathVariable Long postId) {
        Long userId = JwtUtil.getCurrentUserId();
        communityService.likeCommunityPost(userId, postId);
    }

    @DeleteMapping("/{id}/posts/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlikePost(
            @PathVariable Long id,
            @PathVariable Long postId) {
        Long userId = JwtUtil.getCurrentUserId();
        communityService.unlikeCommunityPost(userId, postId);
    }
}
