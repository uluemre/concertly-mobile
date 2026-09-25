package com.concertly.backend.controller;

import com.concertly.backend.dto.request.DeleteAccountRequest;
import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.request.PrivacySettingsRequest;
import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PassportResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.PrivacySettingsResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.AccountDeletionService;
import com.concertly.backend.service.ArtistService;
import com.concertly.backend.service.AuthService;
import com.concertly.backend.service.ModerationService;
import com.concertly.backend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthService authService;
    private final ArtistService artistService;
    private final AccountDeletionService accountDeletionService;
    private final ModerationService moderationService;

    public UserController(UserService userService, AuthService authService,
                          ArtistService artistService, AccountDeletionService accountDeletionService,
                          ModerationService moderationService) {
        this.userService = userService;
        this.authService = authService;
        this.artistService = artistService;
        this.accountDeletionService = accountDeletionService;
        this.moderationService = moderationService;
    }

    /** Aralarında engel olan kullanıcıya bu kişi "bulunamadı" (404) görünür. */
    private void requireVisible(Long targetId) {
        moderationService.requireVisible(JwtUtil.getCurrentUserId(), targetId);
    }

    // ✅ HESABI SİL (yalnızca giriş yapan kullanıcı kendi hesabını siler)
    // Silme sebebi ZORUNLU — boş gelirse 400 döner.
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMyAccount(@RequestBody(required = false) DeleteAccountRequest request) {
        String reason = request != null && request.getReason() != null ? request.getReason().trim() : "";
        if (reason.isEmpty()) {
            throw new IllegalArgumentException("Hesabı silmek için bir sebep belirtmelisin.");
        }
        String details = request.getDetails() != null ? request.getDetails().trim() : null;
        accountDeletionService.deleteAccount(JwtUtil.getCurrentUserId(), reason, details);
    }

    @GetMapping
    public List<UserResponse> getUsers() {
        return userService.getUsers();
    }

    // ── Gizlilik ayarları (yalnızca kendi hesabın) ───────────────────────────

    @GetMapping("/me/privacy")
    public PrivacySettingsResponse getPrivacySettings() {
        return userService.getPrivacySettings(JwtUtil.getCurrentUserId());
    }

    @PutMapping("/me/privacy")
    public PrivacySettingsResponse updatePrivacySettings(@RequestBody PrivacySettingsRequest request) {
        return userService.updatePrivacySettings(JwtUtil.getCurrentUserId(), request);
    }

    @GetMapping("/{id}")
    public UserResponse getUserById(@PathVariable Long id) {
        requireVisible(id);
        return userService.getUserById(id);
    }

    /** Paylaşım linkinden gelen kullanıcı adını id'ye çevirir. */
    @GetMapping("/by-username/{username}")
    public UserResponse getUserByUsername(@PathVariable String username) {
        UserResponse user = userService.getUserByUsername(username);
        requireVisible(user.getId());
        return user;
    }

    // ✅ PROFİL GÜNCELLE (yalnızca kendi profilini)
    @PutMapping("/{id}/profile")
    public UserResponse updateProfile(
            @PathVariable Long id,
            @RequestBody UpdateProfileRequest request
    ) {
        if (!id.equals(JwtUtil.getCurrentUserId())) {
            throw new AccessDeniedException("Sadece kendi profilini düzenleyebilirsin.");
        }
        return userService.updateProfile(id, request);
    }

    // ✅ KULLANICININ POSTLARİNI GETİR
    @GetMapping("/{id}/posts")
    public List<PostResponse> getUserPosts(@PathVariable Long id) {
        requireVisible(id);
        return userService.getUserPosts(id, JwtUtil.getCurrentUserId());
    }

    // ✅ KULLANICININ GİTTİĞİ ETKİNLİKLER
    @GetMapping("/{id}/events")
    public List<EventResponse> getUserEvents(@PathVariable Long id) {
        requireVisible(id);
        return userService.getUserEvents(id);
    }

    @GetMapping("/{id}/followed-artists")
    public List<ArtistResponse> getFollowedArtists(@PathVariable Long id) {
        requireVisible(id);
        return artistService.getFollowedArtists(id);
    }

    // ✅ KONSER PASAPORTU
    @GetMapping("/{id}/passport")
    public PassportResponse getPassport(@PathVariable Long id) {
        requireVisible(id);
        return userService.getUserPassport(id);
    }

    // Geriye dönük uyumluluk
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Deprecated
    public UserResponse register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }
}