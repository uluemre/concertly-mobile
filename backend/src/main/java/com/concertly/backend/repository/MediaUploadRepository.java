package com.concertly.backend.repository;

import com.concertly.backend.model.MediaUpload;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface MediaUploadRepository extends JpaRepository<MediaUpload, Long> {

    /** Günlük yükleme kotası. */
    long countByUserIdAndCreatedAtAfter(Long userId, LocalDateTime after);

    /** Yetim temizliği adayları: bekleme süresini doldurmuş yüklemeler. */
    List<MediaUpload> findByCreatedAtBeforeOrderByCreatedAtAsc(LocalDateTime before);
}
