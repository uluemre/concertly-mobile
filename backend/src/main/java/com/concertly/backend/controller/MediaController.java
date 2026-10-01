package com.concertly.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
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

    static boolean matchesImageSignature(String extension, byte[] h) {
        if (h == null) return false;
        switch (extension) {
            case "jpg":
            case "jpeg":
                return h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF;
            case "png":
                return startsWith(h, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
            case "gif":
                return startsWith(h, new int[]{0x47, 0x49, 0x46, 0x38, 0x37, 0x61})
                        || startsWith(h, new int[]{0x47, 0x49, 0x46, 0x38, 0x39, 0x61});
            case "webp":
                // "RIFF" + 4 bayt boyut + "WEBP"
                return h.length >= 12 && startsWith(h, new int[]{0x52, 0x49, 0x46, 0x46})
                        && (h[8] & 0xFF) == 0x57 && (h[9] & 0xFF) == 0x45
                        && (h[10] & 0xFF) == 0x42 && (h[11] & 0xFF) == 0x50;
            default:
                return false;
        }
    }

    private static boolean startsWith(byte[] h, int[] sig) {
        if (h.length < sig.length) return false;
        for (int i = 0; i < sig.length; i++) {
            if ((h[i] & 0xFF) != sig[i]) return false;
        }
        return true;
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

        // Uzantıya güvenme: dosya başlığı (magic bytes) uzantıyla uyuşmalı (SEC-06)
        byte[] head;
        try (InputStream in = file.getInputStream()) {
            head = in.readNBytes(12);
        }
        if (!matchesImageSignature(extension, head)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE");
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
