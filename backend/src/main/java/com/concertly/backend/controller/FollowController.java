package com.concertly.backend.controller;

import com.concertly.backend.dto.response.UserSummaryResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.FollowService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    @PostMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void follow(@PathVariable Long id) {
        Long followerId = JwtUtil.getCurrentUserId();
        followService.follow(followerId, id);
    }

    @DeleteMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@PathVariable Long id) {
        Long followerId = JwtUtil.getCurrentUserId();
        followService.unfollow(followerId, id);
    }

    @GetMapping("/{id}/profile")
    public UserSummaryResponse getProfile(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return followService.getUserProfile(id, currentUserId);
    }

    @GetMapping("/{id}/followers")
    public List<UserSummaryResponse> getFollowers(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return followService.getFollowers(id, currentUserId);
    }

    @GetMapping("/{id}/following")
    public List<UserSummaryResponse> getFollowing(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return followService.getFollowing(id, currentUserId);
    }
}