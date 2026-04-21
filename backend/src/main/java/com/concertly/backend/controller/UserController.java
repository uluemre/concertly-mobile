package com.concertly.backend.controller;

import com.concertly.backend.dto.request.RegisterRequest;
import com.concertly.backend.dto.response.UserResponse;
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

    public UserController(UserService userService, AuthService authService) {
        this.userService = userService;
        this.authService = authService;
    }

    @GetMapping
    public List<UserResponse> getUsers() {
        return userService.getUsers();
    }

    @GetMapping("/{id}")
    public UserResponse getUserById(@PathVariable Long id) {
        return userService.getUserById(id);
    }

    // Geriye dönük uyumluluk — yeni kod /api/auth/register kullanmalı
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Deprecated
    public UserResponse register(@RequestBody RegisterRequest request) {
        return authService.register(request);
    }
}