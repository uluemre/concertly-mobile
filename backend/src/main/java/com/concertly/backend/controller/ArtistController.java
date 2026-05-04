package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
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

    // GET /api/artists/{id}?currentUserId=5
    @GetMapping("/{id}")
    public ArtistResponse getArtist(
            @PathVariable Long id,
            @RequestParam(required = false) Long currentUserId
    ) {
        return artistService.getArtist(id, currentUserId);
    }

    // GET /api/artists/{id}/events
    @GetMapping("/{id}/events")
    public List<EventResponse> getArtistEvents(@PathVariable Long id) {
        return artistService.getArtistEvents(id);
    }

    // GET /api/artists/{id}/posts
    @GetMapping("/{id}/posts")
    public List<PostResponse> getArtistPosts(@PathVariable Long id) {
        return artistService.getArtistPosts(id);
    }

    // POST /api/artists/{id}/follow?userId=5
    @PostMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void follow(
            @PathVariable Long id,
            @RequestParam Long userId
    ) {
        artistService.follow(userId, id);
    }

    // DELETE /api/artists/{id}/follow?userId=5
    @DeleteMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(
            @PathVariable Long id,
            @RequestParam Long userId
    ) {
        artistService.unfollow(userId, id);
    }
}