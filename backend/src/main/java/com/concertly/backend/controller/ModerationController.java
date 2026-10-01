package com.concertly.backend.controller;

import com.concertly.backend.dto.request.ReportRequest;
import com.concertly.backend.dto.response.BlockedUserResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.CommunityService;
import com.concertly.backend.service.ModerationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ModerationController {

    private final ModerationService moderationService;
    private final CommunityService communityService;

    public ModerationController(ModerationService moderationService, CommunityService communityService) {
        this.moderationService = moderationService;
        this.communityService = communityService;
    }

    // POST /api/reports  { targetType, targetId, reason }
    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void report(@RequestBody ReportRequest request) {
        Long reporterId = JwtUtil.getCurrentUserId();
        // B11: COMMUNITY_POST / COMMUNITY_COMMENT — hedef var ve şikayet eden görebiliyor olmalı
        // (ModerationService, CommunityService'e bağımlı olduğundan döngüyü önlemek için doğrulama burada)
        // Tür bir kez trim+büyük harf yapılır; doğrulama ve kayıt aynı değeri kullanır
        String targetType = request.getTargetType() == null ? null
                : request.getTargetType().trim().toUpperCase(java.util.Locale.ROOT);
        communityService.requireCanReportCommunityContent(reporterId, targetType, request.getTargetId());
        moderationService.report(reporterId, targetType, request.getTargetId(), request.getReason());
    }

    // POST /api/users/{id}/block
    @PostMapping("/users/{id}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void block(@PathVariable Long id) {
        moderationService.block(JwtUtil.getCurrentUserId(), id);
    }

    // DELETE /api/users/{id}/block
    @DeleteMapping("/users/{id}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable Long id) {
        moderationService.unblock(JwtUtil.getCurrentUserId(), id);
    }

    // GET /api/users/{id}/block-status  → { blocked: true/false }
    @GetMapping("/users/{id}/block-status")
    public Map<String, Boolean> blockStatus(@PathVariable Long id) {
        return Map.of("blocked", moderationService.isBlocking(JwtUtil.getCurrentUserId(), id));
    }

    // GET /api/users/blocked  → engellediğim kullanıcılar
    @GetMapping("/users/blocked")
    public List<BlockedUserResponse> blockedUsers() {
        return moderationService.getBlockedUsers(JwtUtil.getCurrentUserId());
    }
}
