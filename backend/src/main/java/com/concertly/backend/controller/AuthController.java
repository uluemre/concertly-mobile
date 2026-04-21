package com.concertly.backend.controller;

import com.concertly.backend.dto.request.LoginRequest;
import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.response.AuthResponse;
import com.concertly.backend.dto.response.UserResponse;
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
}