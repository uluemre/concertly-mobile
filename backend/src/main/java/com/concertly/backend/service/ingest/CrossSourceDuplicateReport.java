package com.concertly.backend.service.ingest;

import com.concertly.backend.dto.response.DuplicateCandidateResponse;
import com.concertly.backend.model.Event;
import com.concertly.backend.repository.EventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Kaynaklar arasi mukerrer ADAYLARINI raporlar.
 *
 * Bu sinif bilerek SALT OKUNUR: hicbir kaydi silmez, birlestirmez, source ya da
 * externalId degerine dokunmaz. Amaci once "hangi kayitlar ayni konser olabilir"
 * sorusunu guvenle gorunur kilmak; birlestirme karari sonraki asamaya ait.
 *
 * Karsilastirma yalnizca FARKLI kaynaklar arasinda yapilir. Biletinial kendi
 * icindeki mukerrerligi zaten externalId ile engelliyor; ayni kaynagin iki
 * kaydini burada tekrar degerlendirmek o mekanizmayi bozardi.
 */
@Service
public class CrossSourceDuplicateReport {

    /** Rapor satiri. */
    public record Candidate(
            Long biletinialEventId,
            Long otherEventId,
            String artistName,
            String city,
            LocalDateTime biletinialDate,
            LocalDateTime otherDate,
            String biletinialVenue,
            String otherVenue,
            String otherExternalId,
            EventMatcher.Confidence confidence,
            String reason) {
    }

    private final EventRepository eventRepository;
    private final EventMatcher matcher;

    public CrossSourceDuplicateReport(EventRepository eventRepository, EventMatcher matcher) {
        this.eventRepository = eventRepository;
        this.matcher = matcher;
    }

    /**
     * Biletinial kayitlarini diger kaynaklarla karsilastirir.
     *
     * Aday havuzu once SEHRE gore daraltilir; sehir farkliysa eslesme zaten
     * imkansiz oldugu icin tum kayitlari birbiriyle karsilastirmaya gerek yok.
     */
    @Transactional(readOnly = true)
    public List<Candidate> findCandidates() {
        return findCandidates(eventRepository.findAll());
    }

    /**
     * Ayni tarama, hazir yuklenmis kayit listesiyle.
     *
     * Ayrintili rapor da ayni taramayi kullaniyor; veritabanini iki kez
     * okumamak icin liste disaridan verilebiliyor. Davranis birebir ayni.
     */
    List<Candidate> findCandidates(List<Event> all) {

        List<Event> biletinial = new ArrayList<>();
        Map<String, List<Event>> othersByCity = new HashMap<>();
        for (Event event : all) {
            if (isBiletinial(event)) {
                biletinial.add(event);
            } else {
                String city = EventMatcher.normalize(
                        event.getVenue() != null ? event.getVenue().getCity() : null);
                if (city.isEmpty()) continue;
                othersByCity.computeIfAbsent(city, k -> new ArrayList<>()).add(event);
            }
        }

        List<Candidate> candidates = new ArrayList<>();
        for (Event source : biletinial) {
            String city = EventMatcher.normalize(
                    source.getVenue() != null ? source.getVenue().getCity() : null);
            for (Event other : othersByCity.getOrDefault(city, List.of())) {
                EventMatcher.MatchResult result = matcher.compare(source, other);
                if (result.confidence() == EventMatcher.Confidence.NONE) continue;
                candidates.add(new Candidate(
                        source.getId(), other.getId(),
                        source.getArtist() != null ? source.getArtist().getName() : null,
                        source.getVenue() != null ? source.getVenue().getCity() : null,
                        source.getEventDate(), other.getEventDate(),
                        source.getVenue() != null ? source.getVenue().getName() : null,
                        other.getVenue() != null ? other.getVenue().getName() : null,
                        other.getExternalId(),
                        result.confidence(), result.reason()));
            }
        }
        return applyAmbiguityGuard(candidates);
    }

    /**
     * Belirsizlik korumasi: bir Biletinial kaydi birden fazla GUCLU adayla
     * eslesiyorsa en fazla biri dogru olabilir, hangisi oldugunu bilemeyiz.
     * Hepsi ZAYIF'a dusurulur, boylece otomatik birlestirme disinda kalir.
     *
     * Gercek ornek: Harbiye'de birbirine 91 m uzaklikta IKI AYRI salon var;
     * ayni sanatci ayni saatte ikisiyle birden "guclu" eslesiyordu.
     */
    static List<Candidate> applyAmbiguityGuard(List<Candidate> candidates) {
        Map<Long, Long> strongPerEvent = new HashMap<>();
        for (Candidate c : candidates) {
            if (c.confidence() == EventMatcher.Confidence.STRONG) {
                strongPerEvent.merge(c.biletinialEventId(), 1L, Long::sum);
            }
        }
        List<Candidate> guarded = new ArrayList<>(candidates.size());
        for (Candidate c : candidates) {
            boolean ambiguous = c.confidence() == EventMatcher.Confidence.STRONG
                    && strongPerEvent.getOrDefault(c.biletinialEventId(), 0L) > 1;
            guarded.add(ambiguous
                    ? new Candidate(c.biletinialEventId(), c.otherEventId(), c.artistName(), c.city(),
                            c.biletinialDate(), c.otherDate(), c.biletinialVenue(), c.otherVenue(),
                            c.otherExternalId(), EventMatcher.Confidence.WEAK,
                            "Birden fazla guclu aday var, belirsiz: " + c.reason())
                    : c);
        }
        return guarded;
    }

    /**
     * Admin inceleme uctu icin ayrintili rapor: her aday ciftinin IKI tarafi da
     * tam alanlariyla doner.
     *
     * Ayni tarama mantigini kullanir, hicbir kaydi degistirmez. Kayitlar tek
     * seferde okunur ve ciftlerin karsiligi bellekteki haritadan bulunur.
     */
    @Transactional(readOnly = true)
    public List<DuplicateCandidateResponse> findDetailedCandidates() {
        List<Event> all = eventRepository.findAll();
        Map<Long, Event> byId = new HashMap<>();
        for (Event event : all) {
            byId.put(event.getId(), event);
        }

        List<DuplicateCandidateResponse> detailed = new ArrayList<>();
        for (Candidate candidate : findCandidates(all)) {
            Event left = byId.get(candidate.biletinialEventId());
            Event right = byId.get(candidate.otherEventId());
            detailed.add(new DuplicateCandidateResponse(
                    DuplicateCandidateResponse.EventSide.from(left),
                    DuplicateCandidateResponse.EventSide.from(right),
                    candidate.confidence().name(),
                    candidate.reason(),
                    minutesApart(left, right)));
        }
        return detailed;
    }

    /** Iki etkinlik saati arasindaki fark; tarih eksikse null. */
    private static Long minutesApart(Event a, Event b) {
        if (a == null || b == null || a.getEventDate() == null || b.getEventDate() == null) return null;
        return Math.abs(java.time.Duration.between(a.getEventDate(), b.getEventDate()).toMinutes());
    }

    /** Kaynak ayirimi externalId on ekinden yapilir; eski kayitlarin source alani bos olabilir. */
    static boolean isBiletinial(Event event) {
        return event.getExternalId() != null
                && event.getExternalId().startsWith(BiletinialImportService.EXTERNAL_ID_PREFIX);
    }
}
