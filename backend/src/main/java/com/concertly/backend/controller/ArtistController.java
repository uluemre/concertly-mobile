package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.ArtistService;
import com.concertly.backend.service.SimilarArtistService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/artists")
public class ArtistController {

    /** Rozet kontrolü işlem bittikten sonra (alan enjeksiyonu: kurucuyu kullanan testler değişmesin). */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.concertly.backend.service.BadgeService badgeService;

    private void checkBadges(Long userId) {
        if (badgeService != null) badgeService.checkQuietly(userId);
    }

    private final ArtistService artistService;
    private final SimilarArtistService similarArtistService;

    public ArtistController(ArtistService artistService, SimilarArtistService similarArtistService) {
        this.artistService = artistService;
        this.similarArtistService = similarArtistService;
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
        return artistService.getArtistPosts(id, JwtUtil.getCurrentUserId());
    }

    @GetMapping("/{id}/past-events")
    public List<EventResponse> getArtistPastEvents(@PathVariable Long id) {
        return artistService.getArtistPastEvents(id);
    }

    @PostMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void follow(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        artistService.follow(userId, id);
        checkBadges(userId);
    }

    @DeleteMapping("/{id}/follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unfollow(@PathVariable Long id) {
        Long userId = JwtUtil.getCurrentUserId();
        artistService.unfollow(userId, id);
    }

    @PostMapping("/bulk-follow")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void bulkFollow(@RequestBody Map<String, List<Long>> body) {
        Long userId = JwtUtil.getCurrentUserId();
        artistService.bulkFollow(userId, body.get("artistIds"));
    }

    // GET /api/artists/{id}/similar — Deezer'ın benzerlerinden bizde kaydı olanlar
    @GetMapping("/{id}/similar")
    public List<ArtistResponse> getSimilar(@PathVariable Long id) {
        return similarArtistService.getSimilar(id, JwtUtil.getCurrentUserId());
    }

    // GET /api/artists/popular?limit=12 — yaklaşan konser sayısına göre
    @GetMapping("/popular")
    public List<ArtistResponse> getPopular(@RequestParam(defaultValue = "12") int limit) {
        return artistService.getPopularArtists(limit, JwtUtil.getCurrentUserId());
    }

    @GetMapping("/recommended")
    public List<ArtistResponse> getRecommended(@RequestParam("genres") String genresCsv) {
        Long currentUserId = JwtUtil.getCurrentUserId();
        List<String> genres = List.of(genresCsv.split(","));
        return artistService.getArtistsByGenres(genres, currentUserId);
    }

    @RequestMapping(value = "/enrich", method = { RequestMethod.GET, RequestMethod.POST })
    public String enrichAll() {
        int count = artistService.enrichAllArtists();
        return count + " sanatci Spotify ile zenginlestirildi.";
    }
}