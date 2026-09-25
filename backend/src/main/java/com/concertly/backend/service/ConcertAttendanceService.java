package com.concertly.backend.service;

import com.concertly.backend.config.LaunchCityConfig;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.repository.EventAttendanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Kullanıcının konser istatistiklerinin TEK tanımı.
 *
 *  - katıldığı (attended): "Gidiyorum" + etkinlik tarihi geçmiş
 *  - katılacağı (upcoming): "Gidiyorum" + etkinlik tarihi gelmemiş
 *
 * Profil, Konser Pasaportu / Konser Yılım ve rozetler bu servisi kullanır.
 * Eskiden profil gönderi atılan etkinlikleri, pasaport geçmiş "Gidiyorum"ları,
 * rozetler ise gelecektekiler dahil tüm "Gidiyorum"ları sayıyordu; aynı kullanıcı
 * için üç farklı sayı çıkıyordu.
 */
@Service
public class ConcertAttendanceService {

    private final EventAttendanceRepository attendanceRepository;

    public ConcertAttendanceService(EventAttendanceRepository attendanceRepository) {
        this.attendanceRepository = attendanceRepository;
    }

    /** Katıldığı konserler, en yeni önce. */
    @Transactional(readOnly = true)
    public List<Event> attended(Long userId) {
        return attended(userId, LocalDateTime.now());
    }

    /** Katılacağı konserler, en yakın önce. */
    @Transactional(readOnly = true)
    public List<Event> upcoming(Long userId) {
        return upcoming(userId, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public long attendedCount(Long userId) {
        return attended(userId).size();
    }

    List<Event> attended(Long userId, LocalDateTime now) {
        return going(userId).stream()
                .filter(e -> e.getEventDate().isBefore(now))
                .sorted(Comparator.comparing(Event::getEventDate).reversed())
                .toList();
    }

    List<Event> upcoming(Long userId, LocalDateTime now) {
        return going(userId).stream()
                .filter(e -> !e.getEventDate().isBefore(now))
                .sorted(Comparator.comparing(Event::getEventDate))
                .toList();
    }

    private List<Event> going(Long userId) {
        return attendanceRepository.findByUserIdAndStatus(userId, AttendanceStatus.GOING).stream()
                .map(EventAttendance::getEvent)
                .filter(e -> e != null && e.getEventDate() != null)
                .toList();
    }

    /**
     * Şehir karşılaştırma anahtarı: "Istanbul" ve "İstanbul" aynı şehirdir.
     * Projede şehirler için zaten kullanılan LaunchCityConfig.normalize'a dayanır.
     */
    public static String cityKey(String city) {
        return city == null || city.isBlank() ? null : LaunchCityConfig.normalize(city);
    }

    /** Farklı şehir sayısı (yazım farkları tek şehir sayılır). */
    public static int countCities(Collection<Event> events) {
        return (int) events.stream()
                .map(e -> e.getVenue() != null ? cityKey(e.getVenue().getCity()) : null)
                .filter(Objects::nonNull)
                .distinct()
                .count();
    }
}
