package com.concertly.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private final Path uploadDir;

    public MediaController(@Value("${app.upload.dir:uploads}") String uploadDir) throws IOException {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    /**
     * Görsel yükler, sunucuda saklar ve göreli yolunu döner.
     * İstemci bu yolu (/uploads/<dosya>) imageUrl/profileImageUrl olarak kaydeder;
     * mobil taraf görüntülerken kendi bildiği sunucu adresiyle birleştirir.
     */
    @PostMapping("/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Dosya boş");
        }

        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        String extension = original.contains(".")
                ? original.substring(original.lastIndexOf('.') + 1).toLowerCase()
                : "";
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Desteklenmeyen dosya türü: " + extension);
        }

        String filename = UUID.randomUUID() + "." + extension;
        Path target = uploadDir.resolve(filename).normalize();
        if (!target.startsWith(uploadDir)) {
            throw new IllegalArgumentException("Geçersiz dosya adı");
        }
        file.transferTo(target);

        return Map.of("url", "/uploads/" + filename);
    }
}
