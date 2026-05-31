package com.concertly.backend.controller;

import com.concertly.backend.dto.request.LoginRequest;
import com.concertly.backend.dto.request.OnboardingRequest;
import com.concertly.backend.dto.request.RefreshRequest;
import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.response.AuthResponse;
import com.concertly.backend.dto.response.UserResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // POST /api/auth/login
    // Body: { "email": "...", "password": "..." }
    // Response: { "accessToken": "eyJ...", "userId": 1, "username": "...", "email": "..." }
    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // POST /api/auth/register
    // (Eski /api/users/register endpoint'i de çalışmaya devam eder — geriye dönük uyumluluk)
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody RefreshRequest request) {
        return authService.refreshToken(request.getRefreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@RequestBody RefreshRequest request) {
        authService.logout(request.getRefreshToken());
    }

    @PostMapping("/onboarding")
    public UserResponse saveOnboardingPreferences(@RequestBody OnboardingRequest request) {
        Long userId = JwtUtil.getCurrentUserId();
        return authService.saveOnboardingPreferences(userId, request);
    }
}