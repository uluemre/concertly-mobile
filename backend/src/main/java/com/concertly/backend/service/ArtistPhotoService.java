package com.concertly.backend.service;

import com.concertly.backend.model.Artist;
import com.concertly.backend.model.EventSource;
import com.concertly.backend.model.ImageUrls;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sanatçı fotoğrafları: yaklaşan konseri olan her sanatçının tek ve GÜNCEL bir görseli olsun;
 * profilde ve tüm konser kartlarında aynısı görünsün.
 *
 * Öncelik:
 *   1) Bilet sitelerinin konser görseli — sanatçının bu yılki turne fotoğrafı. Birden çok
 *      sanatçıda ortak kullanılan genel görseller (Ticketmaster'ın davul görseli) sayılmaz.
 *      Dış istek gerektirmez; her gece tüm sanatçılar için tazelenir, yeni turne görseli
 *      gelince fotoğraf kendiliğinden değişir.
 *   2) Deezer — yalnız konser görseli yoksa ve adı birebir tutan TEK sanatçı varsa.
 *      Deezer'ın Türk sanatçı fotoğrafları çoğu zaman eski (Mustafa Sandal), aynı adlı
 *      başka sanatçının fotoğrafı da gelebiliyordu (Göksel, Manifest).
 *   3) Hiçbiri yoksa ve eldeki fotoğraf güvenilmezse (doğrulanmamış Deezer) kaldırılır:
 *      yanlış fotoğraftan yer tutucu iyidir.
 */
@Service
public class ArtistPhotoService {

    private static final Logger log = LoggerFactory.getLogger(ArtistPhotoService.class);

    public static final String SOURCE_DEEZER = "DEEZER";
    public static final String SOURCE_EVENT = "EVENT";

    /** Bu kadar farklı sanatçının konserinde geçen görsel genel (stok) görseldir. */
    static final long SHARED_IMAGE_MIN_ARTISTS = 3;
    /** Konser görseli olmayan sanatçı Deezer'da bu kadar gün sonra yeniden aranır. */
    static final int DEEZER_RETRY_DAYS = 7;

    /** Konser görseli tercih sırası: sanatçıya özel yükleme yapan siteler önce, Ticketmaster sonra. */
    private static final List<EventSource> SOURCE_PRIORITY = List.of(
            EventSource.BUBILET, EventSource.ZORLU_PSM, EventSource.BILETINIAL, EventSource.BILETIMGO,
            EventSource.TICKETMASTER);

    private final ArtistRepository artistRepository;
    private final EventRepository eventRepository;
    private final DeezerService deezerService;
    private final int maxLookupsPerRun;
    private final long delayMs;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public ArtistPhotoService(ArtistRepository artistRepository,
                              EventRepository eventRepository,
                              DeezerService deezerService,
                              @Value("${app.artist-photos.max-lookups:250}") int maxLookupsPerRun,
                              @Value("${app.artist-photos.delay-ms:300}") long delayMs) {
        this.artistRepository = artistRepository;
        this.eventRepository = eventRepository;
        this.deezerService = deezerService;
        this.maxLookupsPerRun = maxLookupsPerRun;
        this.delayMs = delayMs;
    }

    public record Result(int artists, int fromEvent, int fromDeezer, int unchanged, int cleared, int noPhoto,
                         int deezerLookups) {}

    /** Gece 05:30 (04:00 konser senkronundan sonra: yeni turne görselleri de dahil olur). */
    @Scheduled(cron = "${app.artist-photos.cron:0 30 5 * * *}")
    public void scheduled() {
        refresh(maxLookupsPerRun, false);
    }

    /**
     * @param maxDeezerLookups gece başına en fazla Deezer sorgusu
     * @param force            Deezer'ı yakın zamanda sorulmuş olsa da yeniden sor
     */
    public Result refresh(int maxDeezerLookups, boolean force) {
        if (!running.compareAndSet(false, true)) return new Result(0, 0, 0, 0, 0, 0, 0);
        try {
            LocalDateTime now = LocalDateTime.now();
            Set<String> shared = new HashSet<>(eventRepository.findSharedImages(now, SHARED_IMAGE_MIN_ARTISTS));
            int artists = 0, event = 0, deezer = 0, unchanged = 0, cleared = 0, none = 0, lookups = 0;
            for (Artist artist : eventRepository.findUpcomingListedArtists(now)) {
                if (artist.getMergedIntoArtistId() != null) continue;
                artists++;
                String poster = bestEventImage(eventRepository.findUpcomingImageSourcesByArtist(artist.getId(), now), shared);
                String outcome;
                if (poster != null) {
                    outcome = apply(artist, poster, now);
                } else {
                    boolean due = force || artist.getImageCheckedAt() == null
                            || artist.getImageCheckedAt().isBefore(now.minusDays(DEEZER_RETRY_DAYS));
                    if (!due || lookups >= maxDeezerLookups) {
                        unchanged++;
                        continue;
                    }
                    lookups++;
                    outcome = fromDeezer(artist, now);
                    pause();
                }
                switch (outcome) {
                    case SOURCE_EVENT -> event++;
                    case SOURCE_DEEZER -> deezer++;
                    case "CLEARED" -> cleared++;
                    case "NONE" -> none++;
                    default -> unchanged++;
                }
            }
            // Yaklaşan konseri olmayan ama eski kurallarla Deezer fotoğrafı almış sanatçılar
            // (sanatçı sayfası / aramada görünüyor): kalan bütçeyle doğrulanır
            List<Artist> extra = new ArrayList<>(artistRepository.findUnverifiedDeezerPhotos());
            // Zorla taramada fotoğrafı olmayan tüm sanatçılar da yeniden aranır
            if (force) extra.addAll(artistRepository.findByImageUrlIsNullAndMergedIntoArtistIdIsNull());
            Set<Long> seen = new HashSet<>();
            for (Artist artist : extra) {
                if (!seen.add(artist.getId())) continue;
                if (lookups >= maxDeezerLookups) break;
                artists++;
                lookups++;
                switch (fromDeezer(artist, now)) {
                    case SOURCE_DEEZER -> deezer++;
                    case "CLEARED" -> cleared++;
                    case "NONE" -> none++;
                    default -> unchanged++;
                }
                pause();
            }
            Result r = new Result(artists, event, deezer, unchanged, cleared, none, lookups);
            log.info("Sanatci fotograflari: {}", r);
            return r;
        } finally {
            running.set(false);
        }
    }

    /**
     * Konser görselleri içinden en iyisi (saf hesap, test edilebilir): genel görseller ve yer
     * tutucular atlanır; site önceliğine göre, aynı sitede en yeni konserin görseli.
     * Satırlar: [imageUrl, source, id], en yeni önce.
     */
    static String bestEventImage(List<Object[]> rows, Set<String> shared) {
        String best = null;
        int bestRank = Integer.MAX_VALUE;
        for (Object[] row : rows) {
            String url = ImageUrls.usable((String) row[0]);
            if (url == null || shared.contains(url)) continue;
            int rank = row[1] instanceof EventSource s ? SOURCE_PRIORITY.indexOf(s) : -1;
            if (rank < 0) rank = SOURCE_PRIORITY.size();
            if (rank < bestRank) {   // satırlar en yeni önce: aynı sitede ilk görülen en yenidir
                best = url;
                bestRank = rank;
            }
        }
        return best;
    }

    /** @return EVENT | UNCHANGED */
    private String apply(Artist artist, String url, LocalDateTime now) {
        boolean same = url.equals(artist.getImageUrl()) && SOURCE_EVENT.equals(artist.getImageSource());
        if (!same || artist.getImageCheckedAt() == null) {
            artist.setImageUrl(url);
            artist.setImageSource(SOURCE_EVENT);
            artist.setImageCheckedAt(now);
            artistRepository.save(artist);
        }
        return same ? "UNCHANGED" : SOURCE_EVENT;
    }

    /** Konser görseli yokken: DEEZER | UNCHANGED | CLEARED | NONE | SKIPPED (Deezer'a ulaşılamadı) */
    String fromDeezer(Artist artist, LocalDateTime now) {
        DeezerService.DeezerArtistData found;
        try {
            found = deezerService.searchArtistOrThrow(artist.getName());
        } catch (Exception e) {
            log.debug("Deezer'a ulasilamadi ({}): {}", artist.getName(), e.getMessage());
            return "SKIPPED";   // hiçbir şey değişmez, yarın yeniden denenir
        }
        String url = found == null ? null : ImageUrls.usable(found.imageUrl);
        if (url != null) {
            boolean same = url.equals(artist.getImageUrl());
            artist.setImageUrl(url);
            artist.setImageSource(SOURCE_DEEZER);
            artist.setImageCheckedAt(now);
            artistRepository.save(artist);
            return same ? "UNCHANGED" : SOURCE_DEEZER;
        }
        String result;
        if (ImageUrls.usable(artist.getImageUrl()) != null && !trustworthy(artist)) {
            // Doğrulanamayan fotoğraf (eski Deezer eşleşmesi ya da artık konseri olmayan afiş):
            // yanlış olabilir, kaldırılır
            artist.setImageUrl(null);
            artist.setImageSource(null);
            result = "CLEARED";
        } else {
            result = ImageUrls.usable(artist.getImageUrl()) != null ? "UNCHANGED" : "NONE";
        }
        artist.setImageCheckedAt(now);
        artistRepository.save(artist);
        return result;
    }

    /**
     * Konser görseli ve Deezer eşleşmesi yokken eldeki fotoğraf korunur mu? Spotify fotoğrafı
     * birebir eşleşmeyle alındı (korunur); Deezer adresi ya da eski afiş artık doğrulanamıyor.
     */
    static boolean trustworthy(Artist artist) {
        String url = artist.getImageUrl();
        if (url == null) return false;
        if (url.contains("dzcdn") || url.contains("deezer")) return false;
        return !SOURCE_EVENT.equals(artist.getImageSource());
    }

    private void pause() {
        if (delayMs <= 0) return;
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
