package com.concertly.backend.service.storage;

import com.concertly.backend.model.MediaUpload;
import com.concertly.backend.repository.MediaUploadRepository;
import com.concertly.backend.service.ContentLimitService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Görsel yükleme kotası ve yetim görsel temizliği.
 *
 * Kota: giriş yapmış herkes sınırsız 10 MB'lık dosya yükleyip R2 faturasını
 * şişirmesin diye kullanıcı başına günlük tavan (yeni hesaplara daha düşük).
 * Adminler muaf. Aşımda 429 UPLOAD_LIMIT.
 *
 * Temizlik: her gece, bekleme süresini (varsayılan 2 gün) doldurmuş ve artık
 * hiçbir kayıtta geçmeyen yüklemeler depodan silinir — silinen gönderi,
 * değiştirilen profil fotoğrafı, silinen hesap, yüklenip paylaşılmayan görsel.
 * Yalnız bu tablodaki (bu özellikten sonra yüklenen) görseller aday olur;
 * eski görsellere dokunulmaz.
 */
@Service
public class MediaUploadService {

    private static final Logger log = LoggerFactory.getLogger(MediaUploadService.class);

    private final MediaUploadRepository repository;
    private final ImageStorage storage;
    private final UploadReferenceScanner scanner;
    private final ContentLimitService contentLimitService;

    private final long maxPerDay;
    private final long newAccountMaxPerDay;
    private final boolean cleanupEnabled;
    private final long graceHours;
    private final int maxDeletesPerRun;

    public MediaUploadService(MediaUploadRepository repository,
                              ImageStorage storage,
                              UploadReferenceScanner scanner,
                              ContentLimitService contentLimitService,
                              @Value("${app.media.max-uploads-per-day:30}") long maxPerDay,
                              @Value("${app.media.new-account-max-uploads-per-day:10}") long newAccountMaxPerDay,
                              @Value("${app.media.orphan-cleanup.enabled:true}") boolean cleanupEnabled,
                              @Value("${app.media.orphan-cleanup.grace-hours:48}") long graceHours,
                              @Value("${app.media.orphan-cleanup.max-deletes-per-run:500}") int maxDeletesPerRun) {
        this.repository = repository;
        this.storage = storage;
        this.scanner = scanner;
        this.contentLimitService = contentLimitService;
        this.maxPerDay = maxPerDay;
        this.newAccountMaxPerDay = newAccountMaxPerDay;
        this.cleanupEnabled = cleanupEnabled;
        this.graceHours = graceHours;
        this.maxDeletesPerRun = maxDeletesPerRun;
    }

    /** Tavan 0 ise kota kapalıdır. */
    public void checkQuota(Long userId) {
        if (userId == null || isAdmin()) return;
        long limit = contentLimitService.isNewAccount(userId) ? newAccountMaxPerDay : maxPerDay;
        if (limit <= 0) return;
        if (repository.countByUserIdAndCreatedAtAfter(userId, LocalDateTime.now().minusDays(1)) >= limit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "UPLOAD_LIMIT");
        }
    }

    public void record(String key, Long userId, long sizeBytes) {
        repository.save(new MediaUpload(key, userId, sizeBytes, LocalDateTime.now()));
    }

    private static boolean isAdmin() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    @Scheduled(cron = "${app.media.orphan-cleanup.cron:0 15 3 * * *}")
    public void cleanupOrphansJob() {
        try {
            int deleted = cleanupOrphans();
            if (deleted > 0) log.info("Yetim gorsel temizligi: {} dosya silindi", deleted);
        } catch (Exception e) {
            log.warn("Yetim gorsel temizligi atlandi: {}", e.getMessage());
        }
    }

    /** Silinen dosya sayısını döner. Tarama hata verirse hiçbir şey silinmez. */
    public int cleanupOrphans() {
        if (!cleanupEnabled) return 0;
        List<MediaUpload> candidates =
                repository.findByCreatedAtBeforeOrderByCreatedAtAsc(LocalDateTime.now().minusHours(graceHours));
        if (candidates.isEmpty()) return 0;

        Set<String> referenced = scanner.referencedKeys();
        List<MediaUpload> orphans = candidates.stream()
                .filter(u -> !referenced.contains(u.getStorageKey()))
                .toList();

        // Silme geri alınamaz: adayların çoğu birden yetim çıkıyorsa tarama bozuk
        // olabilir (ör. görsel kolonu yeniden adlandırıldı) — dokunma, logla.
        if (orphans.size() > 20 && orphans.size() * 2 > candidates.size()) {
            log.warn("Yetim gorsel temizligi durduruldu: {} adayin {} tanesi yetim gorunuyor, kontrol edin",
                    candidates.size(), orphans.size());
            return 0;
        }

        int deleted = 0;
        for (MediaUpload u : orphans) {
            if (deleted >= maxDeletesPerRun) break;
            try {
                storage.delete(u.getStorageKey());
                repository.delete(u);
                deleted++;
            } catch (Exception e) {
                // Satır kalır, sonraki gece yeniden denenir
                log.warn("Gorsel silinemedi {}: {}", u.getStorageKey(), e.getMessage());
            }
        }
        return deleted;
    }
}
