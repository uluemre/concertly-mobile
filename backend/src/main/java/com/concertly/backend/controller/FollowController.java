package com.concertly.backend.controller;

import com.concertly.backend.dto.response.UserSummaryResponse;
import com.concertly.backend.service.FollowService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    // POST /api/users/{id}/follow?followerId=2
    // Faz 2'de followerId JWT'den okunacak
    @PostMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void follow(
            @PathVariable Long id,          // takip edilecek
            @RequestParam Long followerId   // takip eden
    ) {
        followService.follow(followerId, id);
    }

    // DELETE /api/users/{id}/follow?followerId=2
    @DeleteMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(
            @PathVariable Long id,
            @RequestParam Long followerId
    ) {
        followService.unfollow(followerId, id);
    }

    // GET /api/users/{id}/profile?currentUserId=2
    // currentUserId — hangi kullanıcı bakıyor (takip durumu için), opsiyonel
    @GetMapping("/{id}/profile")
    public UserSummaryResponse getProfile(
            @PathVariable Long id,
            @RequestParam(required = false) Long currentUserId
    ) {
        return followService.getUserProfile(id, currentUserId);
    }
}