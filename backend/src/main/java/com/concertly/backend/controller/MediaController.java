package com.concertly.backend.controller;

import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.storage.ImageStorage;
import com.concertly.backend.service.storage.MediaUploadService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif");

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "jpg", "image/jpeg", "jpeg", "image/jpeg", "png", "image/png",
            "webp", "image/webp", "gif", "image/gif");

    private final ImageStorage storage;
    private final MediaUploadService uploads;

    public MediaController(ImageStorage storage, MediaUploadService uploads) {
        this.storage = storage;
        this.uploads = uploads;
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
     * Görsel yükler, depoya (yerel disk ya da R2) yazar ve göreli yolunu döner.
     * İstemci bu yolu (/uploads/<dosya>) imageUrl/profileImageUrl olarak kaydeder;
     * mobil taraf görüntülerken kendi bildiği sunucu adresiyle birleştirir.
     */
    @PostMapping("/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Dosya boş");
        }
        Long userId = JwtUtil.getCurrentUserId();
        uploads.checkQuota(userId);

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
        byte[] content = file.getBytes();
        storage.put(filename, content, CONTENT_TYPES.get(extension));
        uploads.record(filename, userId, content.length);

        return Map.of("url", "/uploads/" + filename);
    }
}
