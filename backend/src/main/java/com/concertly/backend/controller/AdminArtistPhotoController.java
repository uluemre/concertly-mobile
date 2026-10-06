package com.concertly.backend.controller;

import com.concertly.backend.service.ArtistPhotoService;
import org.springframework.web.bind.annotation.*;

/**
 * Sanatçı fotoğraf görevini elle çalıştırma (admin). Normalde her gece 05:30'da çalışır.
 * /api/admin/** zaten ROLE_ADMIN ile korunuyor.
 */
@RestController
@RequestMapping("/api/admin/artists")
public class AdminArtistPhotoController {

    private final ArtistPhotoService photoService;

    public AdminArtistPhotoController(ArtistPhotoService photoService) {
        this.photoService = photoService;
    }

    @PostMapping("/refresh-photos")
    public ArtistPhotoService.Result refresh(@RequestParam(defaultValue = "100") int max,
                                             @RequestParam(defaultValue = "false") boolean force) {
        return photoService.refresh(Math.max(0, Math.min(max, 1000)), force);
    }
}
