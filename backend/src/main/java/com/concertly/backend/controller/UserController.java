package com.concertly.backend.controller;

import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.request.UpdateProfileRequest;
import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PassportResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.AccountDeletionService;
import com.concertly.backend.service.ArtistService;
import com.concertly.backend.service.AuthService;
import com.concertly.backend.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthService authService;
    private final ArtistService artistService;
    private final AccountDeletionService accountDeletionService;

    public UserController(UserService userService, AuthService authService,
                          ArtistService artistService, AccountDeletionService accountDeletionService) {
        this.userService = userService;
        this.authService = authService;
        this.artistService = artistService;
        this.accountDeletionService = accountDeletionService;
    }

    // ✅ HESABI SİL (yalnızca giriş yapan kullanıcı kendi hesabını siler)
    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMyAccount() {
        accountDeletionService.deleteAccount(JwtUtil.getCurrentUserId());
    }

    @GetMapping
    public List<UserResponse> getUsers() {
        return userService.getUsers();
    }

    @GetMapping("/{id}")
    public UserResponse getUserById(@PathVariable Long id) {
        return userService.getUserById(id);
    }

    // ✅ PROFİL GÜNCELLE
    @PutMapping("/{id}/profile")
    public UserResponse updateProfile(
            @PathVariable Long id,
            @RequestBody UpdateProfileRequest request
    ) {
        return userService.updateProfile(id, request);
    }

    // ✅ KULLANICININ POSTLARİNI GETİR
    @GetMapping("/{id}/posts")
    public List<PostResponse> getUserPosts(@PathVariable Long id) {
        return userService.getUserPosts(id, JwtUtil.getCurrentUserId());
    }

    // ✅ KULLANICININ GİTTİĞİ ETKİNLİKLER
    @GetMapping("/{id}/events")
    public List<EventResponse> getUserEvents(@PathVariable Long id) {
        return userService.getUserEvents(id);
    }

    @GetMapping("/{id}/followed-artists")
    public List<ArtistResponse> getFollowedArtists(@PathVariable Long id) {
        return artistService.getFollowedArtists(id);
    }

    // ✅ KONSER PASAPORTU
    @GetMapping("/{id}/passport")
    public PassportResponse getPassport(@PathVariable Long id) {
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