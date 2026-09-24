package com.concertly.backend.service;

import com.concertly.backend.dto.response.FriendAttendeeDto;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.AttendanceStatus;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.EventAttendance;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.EventAttendanceRepository;
import com.concertly.backend.repository.EventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * "Konser Günü": kullanıcının gideceği konser için tek ekranda toplanan
 * hazırlık bilgisi — geri sayım, konser saatindeki hava, gelen arkadaşlar ve
 * sanatçının en sevilen şarkılarından ısınma listesi.
 *
 * Her parça bağımsızdır: hava ya da şarkılar alınamazsa kart yine gelir,
 * yalnızca o bölüm boş kalır.
 *
 * Bilerek @Transactional değil: hava ve şarkı istekleri dış servise gider,
 * bu sürede küçük havuzdan (5) DB bağlantısı tutulmasın. İlişkiler EAGER.
 */
@Service
public class ConcertDayService {

    private static final ZoneId ZONE = ZoneId.of("Europe/Istanbul");
    /** Başlamış konser bu kadar süre daha "şu an" sayılır. */
    private static final Duration STILL_ON = Duration.ofHours(4);
    private static final int WARMUP_SIZE = 10;
    /** Deezer önizleme linkleri imzalı ve süreli; uzun tutulmaz. */
    private static final long WARMUP_CACHE_MS = 20 * 60 * 1000L;

    private final EventAttendanceRepository attendanceRepository;
    private final EventRepository eventRepository;
    private final EventAttendanceService attendanceService;
    private final WeatherService weatherService;
    private final DeezerService deezerService;

    private final Map<String, CachedTracks> warmupCache = new ConcurrentHashMap<>();

    private record CachedTracks(List<WarmupTrack> tracks, long at) {}

    public record WarmupTrack(String title, String previewUrl, String coverUrl) {}

    public record ConcertDayResponse(
            Long eventId,
            String eventName,
            String imageUrl,
            String ticketUrl,
            LocalDateTime eventDate,
            long secondsUntilStart,
            boolean happeningNow,
            Long artistId,
            String artistName,
            String venueName,
            String venueCity,
            String venueAddress,
            Double latitude,
            Double longitude,
            String attendanceStatus,
            List<FriendAttendeeDto> friendsGoing,
            WeatherService.Forecast weather,
            List<WarmupTrack> warmup) {}

    public ConcertDayService(EventAttendanceRepository attendanceRepository,
                             EventRepository eventRepository,
                             EventAttendanceService attendanceService,
                             WeatherService weatherService,
                             DeezerService deezerService) {
        this.attendanceRepository = attendanceRepository;
        this.eventRepository = eventRepository;
        this.attendanceService = attendanceService;
        this.weatherService = weatherService;
        this.deezerService = deezerService;
    }

    /** En yakın "gidiyorum" konseri; yoksa null. */
    public ConcertDayResponse next(Long userId) {
        LocalDateTime from = LocalDateTime.now(ZONE).minus(STILL_ON);
        List<EventAttendance> upcoming = attendanceRepository.findUpcomingGoing(userId, from, PageRequest.of(0, 1));
        if (upcoming.isEmpty()) return null;
        return build(userId, upcoming.get(0).getEvent(), AttendanceStatus.GOING);
    }

    /** Belirli bir konser için hazırlık ekranı (katılım şartı yok). */
    public ConcertDayResponse forEvent(Long userId, Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Etkinlik bulunamadı: " + eventId));
        AttendanceStatus status = attendanceRepository.findByUserIdAndEventId(userId, eventId)
                .map(EventAttendance::getStatus).orElse(null);
        return build(userId, event, status);
    }

    private ConcertDayResponse build(Long userId, Event event, AttendanceStatus status) {
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDateTime start = event.getEventDate();
        long seconds = start == null ? 0 : Math.max(0, Duration.between(now, start).getSeconds());
        boolean happeningNow = start != null && !now.isBefore(start) && now.isBefore(start.plus(STILL_ON));

        Venue venue = event.getVenue();
        Double lat = venue != null ? venue.getLatitude() : null;
        Double lon = venue != null ? venue.getLongitude() : null;
        String artistName = event.getArtist() != null ? event.getArtist().getName() : null;

        return new ConcertDayResponse(
                event.getId(),
                event.getName(),
                event.getImageUrl(),
                event.getTicketUrl(),
                start,
                seconds,
                happeningNow,
                event.getArtist() != null ? event.getArtist().getId() : null,
                artistName,
                venue != null ? venue.getName() : null,
                venue != null ? venue.getCity() : null,
                venue != null ? venue.getAddress() : null,
                lat,
                lon,
                status != null ? status.name() : null,
                attendanceService.getFriendsAttending(userId, event.getId()),
                weatherService.forecastAt(lat, lon, start),
                warmupFor(artistName));
    }

    /**
     * Sanatçının Deezer'daki en popüler şarkıları. Yalnızca adı birebir
     * eşleşen Deezer sanatçısı kullanılır — yanlış sanatçının şarkılarını
     * çalmaktansa listeyi boş bırakmak daha iyi.
     */
    List<WarmupTrack> warmupFor(String artistName) {
        if (artistName == null || artistName.isBlank()) return List.of();
        String key = normalize(artistName);
        CachedTracks hit = warmupCache.get(key);
        if (hit != null && System.currentTimeMillis() - hit.at() < WARMUP_CACHE_MS) return hit.tracks();

        List<WarmupTrack> tracks = List.of();
        try {
            Long deezerId = deezerService.searchArtists(artistName, 5).stream()
                    .filter(a -> key.equals(normalize(String.valueOf(a.get("name")))))
                    .map(a -> (Long) a.get("artistId"))
                    .findFirst().orElse(null);
            if (deezerId != null) {
                tracks = deezerService.getTopTracks(deezerId, 25).stream()
                        .limit(WARMUP_SIZE)
                        .map(t -> new WarmupTrack(t.title, t.previewUrl, t.coverUrl))
                        .toList();
            }
        } catch (Exception e) {
            System.out.println("  ⚠️ Isınma listesi alınamadı (" + artistName + "): " + e.getMessage());
        }
        if (warmupCache.size() > 300) warmupCache.clear();
        warmupCache.put(key, new CachedTracks(tracks, System.currentTimeMillis()));
        return tracks;
    }

    /** Türkçe harfleri ve aksanları düzleştirip yalnızca harf/rakam bırakır. */
    static String normalize(String s) {
        if (s == null) return "";
        String folded = s.replace('İ', 'i').replace('I', 'i').replace('ı', 'i')
                .replace('ş', 's').replace('Ş', 's').replace('ğ', 'g').replace('Ğ', 'g')
                .replace('ü', 'u').replace('Ü', 'u').replace('ö', 'o').replace('Ö', 'o')
                .replace('ç', 'c').replace('Ç', 'c').replace("&", " and ");
        folded = Normalizer.normalize(folded, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
        return folded.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}
