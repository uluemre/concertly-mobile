package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.ArtistService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/artists")
public class ArtistController {

    private final ArtistService artistService;

    public ArtistController(ArtistService artistService) {
        this.artistService = artistService;
    }

    @GetMapping("/{id}")
    public ArtistResponse getArtist(@PathVariable Long id) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        return artistService.getArtist(id, currentUserId);
    }

    @GetMapping("/{id}/events")
    public List<EventResponse> getArtistEvents(@PathVariable Long id) {
        return artistService.getArtistEvents(id);
    }

    @GetMapping("/{id}/posts")
    public List<PostResponse> getArtistPosts(@PathVariable Long id) {
        return artistService.getArtistPosts(id);
    }

    @PostMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void follow(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        artistService.follow(userId, id);
    }

    @DeleteMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        artistService.unfollow(userId, id);
    }
}