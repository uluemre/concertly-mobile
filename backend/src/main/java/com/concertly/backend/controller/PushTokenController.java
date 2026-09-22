package com.concertly.backend.controller;

import com.concertly.backend.dto.request.RegisterPushTokenRequest;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.PushTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push")
public class PushTokenController {

    private final PushTokenService pushTokenService;

    public PushTokenController(PushTokenService pushTokenService) {
        this.pushTokenService = pushTokenService;
    }

    /** Cihazı kaydet/tazele. Uygulama her açılışta çağırır. */
    @PostMapping("/tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void register(@RequestBody RegisterPushTokenRequest request) {
        pushTokenService.register(JwtUtil.getCurrentUserId(), request);
    }

    /** Çıkış yaparken cihazı bu hesaptan düşür. */
    @DeleteMapping("/tokens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unregister(@RequestParam String token) {
        pushTokenService.unregister(JwtUtil.getCurrentUserId(), token);
    }
}
