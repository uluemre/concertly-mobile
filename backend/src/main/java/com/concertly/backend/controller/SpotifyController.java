package com.concertly.backend.controller;

import com.concertly.backend.dto.response.SpotifyRecommendationDto;
import com.concertly.backend.service.SpotifyUserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/spotify")
public class SpotifyController {

    private final SpotifyUserService spotifyUserService;

    public SpotifyController(SpotifyUserService spotifyUserService) {
        this.spotifyUserService = spotifyUserService;
    }

    @GetMapping("/auth-url")
    public Map<String, String> getAuthUrl(@RequestParam Long userId) {
        return Map.of("url", spotifyUserService.getAuthUrl(userId));
    }

    @GetMapping("/callback")
    public ResponseEntity<String> handleCallback(
            @RequestParam String code,
            @RequestParam String state) {

        Long userId;
        try { userId = Long.parseLong(state); }
        catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .contentType(MediaType.TEXT_HTML)
                    .body(htmlPage("Hata", "Geçersiz kullanıcı.", false));
        }

        boolean success = spotifyUserService.handleCallback(code, userId);
        String html = success
                ? htmlPage("Spotify Bağlandı!", "Uygulamaya dönebilirsin. Sayfayı kapat.", true)
                : htmlPage("Hata", "Spotify bağlanamadı. Tekrar dene.", false);

        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    @GetMapping("/status/{userId}")
    public Map<String, Object> getStatus(@PathVariable Long userId) {
        return spotifyUserService.getStatus(userId);
    }

    @GetMapping("/recommendations/{userId}")
    public List<SpotifyRecommendationDto> getRecommendations(@PathVariable Long userId) {
        return spotifyUserService.getRecommendations(userId);
    }

    @DeleteMapping("/disconnect/{userId}")
    public void disconnect(@PathVariable Long userId) {
        spotifyUserService.disconnect(userId);
    }

    private String htmlPage(String title, String message, boolean success) {
        String color = success ? "#1DB954" : "#E94560";
        String icon = success ? "✅" : "❌";
        return """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Concertly – Spotify</title>
              <style>
                body { background: #0F0F1A; color: #fff; font-family: -apple-system, sans-serif;
                       display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { text-align: center; padding: 40px; border-radius: 20px; background: #1A1A2E;
                        border: 1px solid %s; max-width: 340px; }
                .icon { font-size: 64px; margin-bottom: 16px; }
                h1 { font-size: 22px; margin: 0 0 12px; color: %s; }
                p { color: #aaa; margin: 0; line-height: 1.5; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">%s</div>
                <h1>%s</h1>
                <p>%s</p>
              </div>
            </body>
            </html>
            """.formatted(color, color, icon, title, message);
    }
}
