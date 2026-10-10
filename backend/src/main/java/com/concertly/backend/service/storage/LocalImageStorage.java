package com.concertly.backend.service.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Varsayılan depo: sunucunun diski ({@code app.upload.dir}). Yerel geliştirme
 * için yeterli; Render'da disk kalıcı olmadığı için canlıda R2 kullanılmalı.
 */
@Component
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalImageStorage implements ImageStorage {

    private final Path uploadDir;

    public LocalImageStorage(@Value("${app.upload.dir:uploads}") String uploadDir) throws IOException {
        this.uploadDir = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadDir);
    }

    @Override
    public void put(String key, byte[] content, String contentType) throws IOException {
        Files.write(resolve(key), content);
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(resolve(key));
    }

    private Path resolve(String key) {
        Path target = uploadDir.resolve(key).normalize();
        if (!target.startsWith(uploadDir) || target.equals(uploadDir)) {
            throw new IllegalArgumentException("Geçersiz dosya adı");
        }
        return target;
    }
}
