package com.concertly.backend.service.ingest;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.model.Event;
import com.concertly.backend.model.Venue;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.MergePointers;
import com.concertly.backend.repository.SearchText;
import com.concertly.backend.repository.VenueRepository;
import com.concertly.backend.service.ingest.DuplicateDetector.ArtistCandidate;
import com.concertly.backend.service.ingest.DuplicateDetector.EventCluster;
import com.concertly.backend.service.ingest.DuplicateDetector.EventMatch;
import com.concertly.backend.service.ingest.DuplicateDetector.Group;
import com.concertly.backend.service.ingest.DuplicateDetector.Match;
import com.concertly.backend.service.ingest.DuplicateDetector.VenueCandidate;
import com.concertly.backend.service.ingest.DuplicateMergeReport.ApplyRequest;
import com.concertly.backend.service.ingest.DuplicateMergeReport.DuplicateReport;
import com.concertly.backend.service.ingest.DuplicateMergeReport.GroupReport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mukerrer sanatci, mekan ve etkinliklerin YUMUSAK birlestirilmesi (N-08 / N-09).
 *
 * Kurallar:
 *  - Hicbir satir SILINMEZ. Mukerrer artists.merged_into_artist_id / venues.merged_into_venue_id
 *    ile asil kaydi gosterir; etkinlikte mevcut events.merged_into_event_id kullanilir.
 *  - dry-run YAZMAZ (readOnly islem; yalnizca okuma ve sayma). apply plani sunucuda YENIDEN hesaplar
 *    (istemciden plan kabul edilmez) ve TEK transaction'da uygular: hata olursa hicbir sey degismez.
 *  - Siralama: once sanatcilar, sonra mekanlar (etkinlik kayitlari asil kimliklere tasinir), en son
 *    etkinlik ciftleri. Etkinlik planlari, sanatci/mekan birlestirmesi uygulanmadan ONCE ayni sanal
 *    esleme ile hesaplandigi icin dry-run ile uygulama ayni kumeleri uretir.
 *  - Isaretciler her zaman kok'u gosterir (zincir yok); tekrar calistirmak yeni bir sey bulmaz.
 *  - Asil sanatci: Spotify kimligi olan > yaklasan yayinda etkinligi cok olan > takipcisi cok olan >
 *    toplam etkinligi cok olan > kucuk id. Asil mekan: etkinligi cok olan > kaynak kimligi olan >
 *    koordinati olan > kucuk id. Asil etkinlik: EventMergeService.chooseCanonical (TM once, kucuk id).
 *  - Toplu apply YALNIZCA HIGH birlestirir; MEDIUM/LOW dry-run'da oneri (autoApply=false) olarak gorunur ve
 *    sadece elle (mergeArtistManually / mergeVenueManually) birlestirilir. Etkinlik icin elle uc nokta yok.
 *  - Eslesme kurallari ve guven seviyeleri DuplicateDetector'da.
 */
@Service
public class DuplicateMergeService {

    private static final Logger log = LoggerFactory.getLogger(DuplicateMergeService.class);

    private final ArtistRepository artistRepository;
    private final VenueRepository venueRepository;
    private final EventRepository eventRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final EventMergeService eventMergeService;
    private final MergeStore store;

    public DuplicateMergeService(ArtistRepository artistRepository,
                                 VenueRepository venueRepository,
                                 EventRepository eventRepository,
                                 ArtistFollowRepository artistFollowRepository,
                                 EventMergeService eventMergeService,
                                 MergeStore store) {
        this.artistRepository = artistRepository;
        this.venueRepository = venueRepository;
        this.eventRepository = eventRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.eventMergeService = eventMergeService;
        this.store = store;
    }

    // ───────────────────────── plan ─────────────────────────

    private record Plan(List<Group<ArtistCandidate>> artists,
                        List<Group<VenueCandidate>> venues,
                        List<EventCluster> events) {}

    /** Okuma-only plan: hicbir sey yazmaz. */
    private Plan computePlan(Set<Long> excludeArtists, Set<Long> excludeVenues, Set<Long> excludeEvents,
                             MergeConfidence min) {
        LocalDateTime now = LocalDateTime.now();
        List<Event> events = eventRepository.findAll();

        Map<Long, Long> totalByArtist = new HashMap<>();
        Map<Long, Long> upcomingByArtist = new HashMap<>();
        Map<Long, Long> totalByVenue = new HashMap<>();
        for (Event e : events) {
            if (e.getArtist() != null) {
                totalByArtist.merge(e.getArtist().getId(), 1L, Long::sum);
                if (e.listedPublicly() && e.getMergedIntoEventId() == null
                        && e.getEventDate() != null && !e.getEventDate().isBefore(now)) {
                    upcomingByArtist.merge(e.getArtist().getId(), 1L, Long::sum);
                }
            }
            if (e.getVenue() != null) totalByVenue.merge(e.getVenue().getId(), 1L, Long::sum);
        }

        // Sanatcilar: yalnizca aktif (birlestirilmemis) ve haric tutulmamis kayitlar
        List<Artist> artists = artistRepository.findAll().stream()
                .filter(a -> a.getMergedIntoArtistId() == null && !excludeArtists.contains(a.getId()))
                .toList();
        Map<String, List<Artist>> buckets = new HashMap<>();
        for (Artist a : artists) {
            if (SearchText.nameKey(a.getName()).isEmpty()) continue;
            String key = DuplicateDetector.wideKey(a.getName());
            if (!key.isEmpty()) buckets.computeIfAbsent(key, k -> new ArrayList<>()).add(a);
        }
        List<Long> possibleIds = new ArrayList<>();
        for (List<Artist> b : buckets.values()) {
            if (b.size() > 1) for (Artist a : b) possibleIds.add(a.getId());
        }
        Map<Long, Long> followers = new HashMap<>();
        if (!possibleIds.isEmpty()) {
            List<Object[]> rows = artistFollowRepository.countByArtistIds(possibleIds);
            if (rows != null) for (Object[] r : rows) followers.put((Long) r[0], ((Number) r[1]).longValue());
        }
        List<ArtistCandidate> artistCandidates = new ArrayList<>();
        for (Artist a : artists) {
            artistCandidates.add(new ArtistCandidate(a.getId(), a.getName(), !isBlank(a.getSpotifyId()),
                    upcomingByArtist.getOrDefault(a.getId(), 0L), followers.getOrDefault(a.getId(), 0L),
                    totalByArtist.getOrDefault(a.getId(), 0L)));
        }
        List<Group<ArtistCandidate>> artistGroups = DuplicateDetector.groupArtists(artistCandidates, min);

        // Mekanlar
        List<VenueCandidate> venueCandidates = new ArrayList<>();
        for (Venue v : venueRepository.findAll()) {
            if (v.getMergedIntoVenueId() != null || excludeVenues.contains(v.getId())) continue;
            venueCandidates.add(new VenueCandidate(v.getId(), v.getName(), v.getCity(), v.getLatitude(), v.getLongitude(),
                    totalByVenue.getOrDefault(v.getId(), 0L), !isBlank(v.getExternalId())));
        }
        List<Group<VenueCandidate>> venueGroups = DuplicateDetector.groupVenues(venueCandidates, min);

        // Sanal esleme: dup id -> asil id (ve guveni). Etkinlik cifti tespiti bunu kullanir.
        Map<Long, Long> artistMap = new HashMap<>();
        Map<Long, MergeConfidence> artistConf = new HashMap<>();
        for (Group<ArtistCandidate> g : artistGroups) {
            for (Match<ArtistCandidate> m : g.duplicates()) {
                artistMap.put(m.duplicate().id(), g.canonical().id());
                artistConf.put(m.duplicate().id(), m.confidence());
            }
        }
        Map<Long, Long> venueMap = new HashMap<>();
        Map<Long, MergeConfidence> venueConf = new HashMap<>();
        for (Group<VenueCandidate> g : venueGroups) {
            for (Match<VenueCandidate> m : g.duplicates()) {
                venueMap.put(m.duplicate().id(), g.canonical().id());
                venueConf.put(m.duplicate().id(), m.confidence());
            }
        }

        // Yalnizca yayinda, birlestirilmemis, haric tutulmamis etkinlikler (bekleyen/gizli kayit asil olmasin)
        List<Event> candidates = events.stream()
                .filter(e -> e.listedPublicly() && e.getMergedIntoEventId() == null && !excludeEvents.contains(e.getId()))
                .toList();
        List<EventCluster> clusters = new ArrayList<>(DuplicateDetector.clusterEvents(candidates,
                id -> artistMap.getOrDefault(id, id), id -> venueMap.getOrDefault(id, id),
                artistConf, venueConf, min, eventMergeService::chooseCanonical));
        // İkizi daha önce birleştirilmiş kayık kopyalar (saat dilimi hatası)
        Set<Long> clustered = new HashSet<>();
        for (EventCluster c : clusters) {
            clustered.add(c.canonical().getId());
            c.duplicates().forEach(m -> clustered.add(m.duplicate().getId()));
        }
        clusters.addAll(DuplicateDetector.timeShiftOrphans(events, candidates, clustered, min));
        return new Plan(artistGroups, venueGroups, clusters);
    }

    // ───────────────────────── dry-run ─────────────────────────

    /**
     * Raporu cikarir; HICBIR SEY yazmaz (readOnly islem, yalnizca onizleme sorgulari).
     * *Groups = toplu apply'in uygulayacagi HIGH gruplar (apply ile birebir ayni plan). MEDIUM/LOW eslesmeler
     * *Suggestions listesindedir (autoApply=false); minConfidence yalnizca hangi onerilerin gosterilecegini belirler.
     */
    @Transactional(readOnly = true)
    public DuplicateMergeReport dryRun(String minConfidence) {
        MergeConfidence min = MergeConfidence.parse(minConfidence);
        Plan high = computePlan(Set.of(), Set.of(), Set.of(), MergeConfidence.HIGH);
        Plan wide = min == MergeConfidence.HIGH ? null : computePlan(Set.of(), Set.of(), Set.of(), min);

        Map<Long, Artist> artistsById = byId(artistRepository.findAll(), Artist::getId);
        Map<Long, Venue> venuesById = byId(venueRepository.findAll(), Venue::getId);

        Set<Long> highArtistDups = new HashSet<>();
        for (Group<ArtistCandidate> g : high.artists()) for (Match<ArtistCandidate> m : g.duplicates()) highArtistDups.add(m.duplicate().id());
        Set<Long> highVenueDups = new HashSet<>();
        for (Group<VenueCandidate> g : high.venues()) for (Match<VenueCandidate> m : g.duplicates()) highVenueDups.add(m.duplicate().id());
        Set<Long> highEventDups = new HashSet<>();
        for (EventCluster c : high.events()) for (EventMatch m : c.duplicates()) highEventDups.add(m.duplicate().getId());

        List<GroupReport> artistReports = artistReports(high.artists(), Set.of(), true, artistsById, new HashMap<>());
        List<GroupReport> venueReports = venueReports(high.venues(), Set.of(), true, venuesById, new HashMap<>());
        List<GroupReport> eventReports = eventReports(high.events(), Set.of(), true);
        List<GroupReport> artistSug = wide == null ? List.of()
                : artistReports(wide.artists(), highArtistDups, false, artistsById, new HashMap<>());
        List<GroupReport> venueSug = wide == null ? List.of()
                : venueReports(wide.venues(), highVenueDups, false, venuesById, new HashMap<>());
        List<GroupReport> eventSug = wide == null ? List.of() : eventReports(wide.events(), highEventDups, false);
        return report(true, min, min.name(), artistReports, venueReports, eventReports, artistSug, venueSug, eventSug);
    }

    private List<GroupReport> artistReports(List<Group<ArtistCandidate>> groups, Set<Long> skipDups, boolean autoApply,
                                            Map<Long, Artist> byId, Map<Long, Artist> scratch) {
        List<GroupReport> out = new ArrayList<>();
        for (Group<ArtistCandidate> g : groups) {
            Artist canonical = byId.get(g.canonical().id());
            List<DuplicateReport> dups = new ArrayList<>();
            for (Match<ArtistCandidate> m : g.duplicates()) {
                if (skipDups.contains(m.duplicate().id())) continue;
                Map<String, Integer> counts = new LinkedHashMap<>(store.previewArtist(m.duplicate().id(), g.canonical().id()));
                Artist sc = scratch.computeIfAbsent(canonical.getId(), k -> copyOf(canonical));
                counts.put("fieldsFilled", fillArtist(sc, byId.get(m.duplicate().id())));
                dups.add(new DuplicateReport(m.duplicate().id(), m.duplicate().name(), m.reason(),
                        m.confidence().name(), counts, autoApply));
            }
            if (!dups.isEmpty()) {
                String best = autoApply ? DuplicateDetector.preferredArtistName(g) : g.canonical().name();
                out.add(new GroupReport(g.canonical().id(), g.canonical().name(), dups,
                        best.equals(g.canonical().name()) ? null : best));
            }
        }
        return out;
    }

    private List<GroupReport> venueReports(List<Group<VenueCandidate>> groups, Set<Long> skipDups, boolean autoApply,
                                           Map<Long, Venue> byId, Map<Long, Venue> scratch) {
        List<GroupReport> out = new ArrayList<>();
        for (Group<VenueCandidate> g : groups) {
            Venue canonical = byId.get(g.canonical().id());
            List<DuplicateReport> dups = new ArrayList<>();
            for (Match<VenueCandidate> m : g.duplicates()) {
                if (skipDups.contains(m.duplicate().id())) continue;
                Map<String, Integer> counts = new LinkedHashMap<>(store.previewVenue(m.duplicate().id(), g.canonical().id()));
                Venue sc = scratch.computeIfAbsent(canonical.getId(), k -> copyOf(canonical));
                counts.put("fieldsFilled", fillVenue(sc, byId.get(m.duplicate().id())));
                dups.add(new DuplicateReport(m.duplicate().id(), m.duplicate().name(), m.reason(),
                        m.confidence().name(), counts, autoApply));
            }
            if (!dups.isEmpty()) out.add(new GroupReport(g.canonical().id(), g.canonical().name(), dups));
        }
        return out;
    }

    private List<GroupReport> eventReports(List<EventCluster> clusters, Set<Long> skipDups, boolean autoApply) {
        List<GroupReport> out = new ArrayList<>();
        for (EventCluster c : clusters) {
            List<DuplicateReport> dups = new ArrayList<>();
            for (EventMatch m : c.duplicates()) {
                if (skipDups.contains(m.duplicate().getId())) continue;
                Map<String, Integer> counts = new LinkedHashMap<>(
                        store.previewEventChildren(m.duplicate().getId(), c.canonical().getId()));
                dups.add(new DuplicateReport(m.duplicate().getId(), eventLabel(m.duplicate()), m.reason(),
                        m.confidence().name(), counts, autoApply));
            }
            if (!dups.isEmpty()) out.add(new GroupReport(c.canonical().getId(), eventLabel(c.canonical()), dups));
        }
        return out;
    }

    // ───────────────────────── apply ─────────────────────────

    /**
     * Plani yeniden hesaplar ve TEK transaction'da uygular. YALNIZCA HIGH guvenli eslesmeler birlestirilir;
     * istekteki minConfidence ne olursa olsun MEDIUM/LOW uygulanmaz (onlar yalnizca elle birlestirilir).
     * Haric tutulan kimlikler hic dokunulmaz.
     * Hata olursa (kisit ihlali, yaris vb.) tum islem geri alinir.
     */
    @Transactional
    public DuplicateMergeReport apply(ApplyRequest request) {
        final MergeConfidence min = MergeConfidence.HIGH; // request.minConfidence() bilerek YOK SAYILIR
        Set<Long> exA = toSet(request == null ? null : request.excludeArtistIds());
        Set<Long> exV = toSet(request == null ? null : request.excludeVenueIds());
        Set<Long> exE = toSet(request == null ? null : request.excludeEventIds());
        Plan plan = computePlan(exA, exV, exE, min);

        List<GroupReport> artistReports = new ArrayList<>();
        for (Group<ArtistCandidate> g : plan.artists()) {
            List<DuplicateReport> dups = new ArrayList<>();
            for (Match<ArtistCandidate> m : g.duplicates()) {
                Map<String, Integer> counts = mergeArtist(m.duplicate().id(), g.canonical().id());
                if (counts != null) {
                    dups.add(new DuplicateReport(m.duplicate().id(), m.duplicate().name(), m.reason(),
                            m.confidence().name(), counts, true));
                }
            }
            if (!dups.isEmpty()) {
                String best = DuplicateDetector.preferredArtistName(g);
                boolean rename = !best.equals(g.canonical().name());
                if (rename) renameArtist(g.canonical().id(), best);
                artistReports.add(new GroupReport(g.canonical().id(), g.canonical().name(), dups, rename ? best : null));
            }
        }

        List<GroupReport> venueReports = new ArrayList<>();
        for (Group<VenueCandidate> g : plan.venues()) {
            List<DuplicateReport> dups = new ArrayList<>();
            for (Match<VenueCandidate> m : g.duplicates()) {
                Map<String, Integer> counts = mergeVenue(m.duplicate().id(), g.canonical().id());
                if (counts != null) {
                    dups.add(new DuplicateReport(m.duplicate().id(), m.duplicate().name(), m.reason(),
                            m.confidence().name(), counts, true));
                }
            }
            if (!dups.isEmpty()) venueReports.add(new GroupReport(g.canonical().id(), g.canonical().name(), dups));
        }

        List<GroupReport> eventReports = new ArrayList<>();
        for (EventCluster c : plan.events()) {
            List<DuplicateReport> dups = new ArrayList<>();
            String canonicalLabel = eventLabel(c.canonical());
            Long canonicalId = c.canonical().getId();
            for (EventMatch m : c.duplicates()) {
                String dupLabel = eventLabel(m.duplicate());
                Long dupId = m.duplicate().getId();
                EventMergeService.MergeResult r = eventMergeService.merge(canonicalId, dupId);
                Map<String, Integer> counts = new LinkedHashMap<>(
                        store.applyEventChildren(r.mergedEventId(), r.canonicalEventId()));
                counts.put("sourceLinks", r.movedSourceLinks());
                dups.add(new DuplicateReport(dupId, dupLabel, m.reason(), m.confidence().name(), counts, true));
            }
            if (!dups.isEmpty()) eventReports.add(new GroupReport(canonicalId, canonicalLabel, dups));
        }

        DuplicateMergeReport result = report(false, min, null, artistReports, venueReports, eventReports, List.of(), List.of(), List.of());
        log.info("Mukerrer birlestirme UYGULANDI (minConfidence={}): sanatci={} mekan={} etkinlik={} toplam={}",
                min, result.totals().get("artistsMerged"), result.totals().get("venuesMerged"),
                result.totals().get("eventsMerged"), result.totals());
        return result;
    }

    // ───────────────────────── elle duzeltme ─────────────────────────

    /** Elle: dupId'yi canonicalId'nin KOKUNE birlestirir (ayni mantik, ayni sayaçlar). */
    @Transactional
    public DuplicateMergeReport mergeArtistManually(Long dupId, Long canonicalId) {
        if (dupId == null || canonicalId == null || dupId.equals(canonicalId)) {
            throw new IllegalArgumentException("Iki farkli sanatci kimligi gerekli.");
        }
        Artist dup = artistRepository.findById(dupId)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatci bulunamadi: " + dupId));
        Artist canonical = artistRepository.findById(canonicalId)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatci bulunamadi: " + canonicalId));
        Artist root = MergePointers.rootOf(canonical, artistRepository);
        if (root.getId().equals(dup.getId())) {
            throw new IllegalArgumentException("Asil kayit zaten bu kayda birlestirilmis; dongu olusur.");
        }
        if (dup.getMergedIntoArtistId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Kayit zaten birlestirilmis: " + dupId);
        }
        Map<String, Integer> counts = mergeArtist(dup.getId(), root.getId());
        String rootName = root.getName();
        String best = rootName;
        if (counts != null && SearchText.nameKey(dup.getName()).equals(SearchText.nameKey(rootName))) {
            best = DuplicateDetector.bestArtistName(List.of(rootName, dup.getName()));
            if (!best.equals(rootName)) renameArtist(root.getId(), best);
        }
        List<GroupReport> groups = List.of(new GroupReport(root.getId(), rootName,
                List.of(new DuplicateReport(dup.getId(), dup.getName(), "MANUAL: admin elle birlestirdi",
                        MergeConfidence.HIGH.name(), counts, false)), best.equals(rootName) ? null : best));
        DuplicateMergeReport result = report(false, MergeConfidence.LOW, null, groups, List.of(), List.of(), List.of(), List.of(), List.of());
        log.info("Sanatci elle birlestirildi: #{} -> #{} {}", dup.getId(), root.getId(), counts);
        return result;
    }

    /** Elle mekan birlestirme; farkli sehirler reddedilir. */
    @Transactional
    public DuplicateMergeReport mergeVenueManually(Long dupId, Long canonicalId) {
        if (dupId == null || canonicalId == null || dupId.equals(canonicalId)) {
            throw new IllegalArgumentException("Iki farkli mekan kimligi gerekli.");
        }
        Venue dup = venueRepository.findById(dupId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadi: " + dupId));
        Venue canonical = venueRepository.findById(canonicalId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadi: " + canonicalId));
        Venue root = MergePointers.rootOf(canonical, venueRepository);
        if (root.getId().equals(dup.getId())) {
            throw new IllegalArgumentException("Asil kayit zaten bu kayda birlestirilmis; dongu olusur.");
        }
        if (dup.getMergedIntoVenueId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Kayit zaten birlestirilmis: " + dupId);
        }
        String cityA = SearchText.nameKey(dup.getCity());
        if (cityA.isEmpty() || !cityA.equals(SearchText.nameKey(root.getCity()))) {
            throw new IllegalArgumentException("Farkli sehirdeki mekanlar birlestirilemez.");
        }
        Map<String, Integer> counts = mergeVenue(dup.getId(), root.getId());
        List<GroupReport> groups = List.of(new GroupReport(root.getId(), root.getName(),
                List.of(new DuplicateReport(dup.getId(), dup.getName(), "MANUAL: admin elle birlestirdi",
                        MergeConfidence.HIGH.name(), counts, false))));
        DuplicateMergeReport result = report(false, MergeConfidence.LOW, null, List.of(), groups, List.of(), List.of(), List.of(), List.of());
        log.info("Mekan elle birlestirildi: #{} -> #{} {}", dup.getId(), root.getId(), counts);
        return result;
    }

    // ───────────────────────── tek kayit birlestirme ─────────────────────────

    /** @return sayaclar; kayit zaten birlestirilmis/ayniysa null (idempotent atlama). */
    private Map<String, Integer> mergeArtist(Long dupId, Long canonicalId) {
        Artist dup = artistRepository.findById(dupId)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatci bulunamadi: " + dupId));
        Artist canonical = MergePointers.rootOf(artistRepository.findById(canonicalId)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatci bulunamadi: " + canonicalId)), artistRepository);
        if (dup.getMergedIntoArtistId() != null || dup.getId().equals(canonical.getId())) return null;

        int filled = fillArtist(canonical, dup);
        dup.setMergedIntoArtistId(canonical.getId());
        artistRepository.save(canonical);
        artistRepository.save(dup);
        Map<String, Integer> counts = new LinkedHashMap<>(store.applyArtist(dup.getId(), canonical.getId()));
        counts.put("fieldsFilled", filled);
        return counts;
    }

    private Map<String, Integer> mergeVenue(Long dupId, Long canonicalId) {
        Venue dup = venueRepository.findById(dupId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadi: " + dupId));
        Venue canonical = MergePointers.rootOf(venueRepository.findById(canonicalId)
                .orElseThrow(() -> new ResourceNotFoundException("Mekan bulunamadi: " + canonicalId)), venueRepository);
        if (dup.getMergedIntoVenueId() != null || dup.getId().equals(canonical.getId())) return null;

        int filled = fillVenue(canonical, dup);
        dup.setMergedIntoVenueId(canonical.getId());
        venueRepository.save(canonical);
        venueRepository.save(dup);
        Map<String, Integer> counts = new LinkedHashMap<>(store.applyVenue(dup.getId(), canonical.getId()));
        counts.put("fieldsFilled", filled);
        return counts;
    }

    // ───────────────────────── alan tamamlama ─────────────────────────

    /** Asilda bos olan imageUrl / genre / spotifyId'yi mukerrerden kopyalar (dolu alan EZILMEZ; externalId tasinmaz). */
    private static int fillArtist(Artist target, Artist source) {
        int n = 0;
        if (isBlank(target.getImageUrl()) && !isBlank(source.getImageUrl())) { target.setImageUrl(source.getImageUrl()); n++; }
        if (isBlank(target.getGenre()) && !isBlank(source.getGenre())) { target.setGenre(source.getGenre()); n++; }
        if (isBlank(target.getSpotifyId()) && !isBlank(source.getSpotifyId())) { target.setSpotifyId(source.getSpotifyId()); n++; }
        return n;
    }

    /** Asilda bos olan address / koordinat cifti / imageUrl'yi mukerrerden kopyalar (dolu alan EZILMEZ). */
    private static int fillVenue(Venue target, Venue source) {
        int n = 0;
        if (isBlank(target.getAddress()) && !isBlank(source.getAddress())) { target.setAddress(source.getAddress()); n++; }
        if ((target.getLatitude() == null || target.getLongitude() == null)
                && source.getLatitude() != null && source.getLongitude() != null) {
            target.setLatitude(source.getLatitude());
            target.setLongitude(source.getLongitude());
            n++;
        }
        if (isBlank(target.getImageUrl()) && !isBlank(source.getImageUrl())) { target.setImageUrl(source.getImageUrl()); n++; }
        return n;
    }

    private static Artist copyOf(Artist a) {
        Artist c = new Artist();
        c.setImageUrl(a.getImageUrl());
        c.setGenre(a.getGenre());
        c.setSpotifyId(a.getSpotifyId());
        return c;
    }

    private static Venue copyOf(Venue v) {
        Venue c = new Venue();
        c.setAddress(v.getAddress());
        c.setLatitude(v.getLatitude());
        c.setLongitude(v.getLongitude());
        c.setImageUrl(v.getImageUrl());
        return c;
    }

    // ───────────────────────── yardimcilar ─────────────────────────

    /** Asil sanatcinin gorunen adini grubun en iyi yazilmis adina cevirir (id ve baglantilar degismez). */
    private void renameArtist(Long id, String name) {
        Artist a = artistRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatci bulunamadi: " + id));
        a.setName(name);
        artistRepository.save(a);
    }

    private static DuplicateMergeReport report(boolean dryRun, MergeConfidence min, String suggestionMin,
                                               List<GroupReport> artists, List<GroupReport> venues,
                                               List<GroupReport> events,
                                               List<GroupReport> artistSug, List<GroupReport> venueSug,
                                               List<GroupReport> eventSug) {
        Map<String, Integer> totals = new LinkedHashMap<>();
        totals.put("artistsMerged", countDuplicates(artists));
        totals.put("venuesMerged", countDuplicates(venues));
        totals.put("eventsMerged", countDuplicates(events));
        for (List<GroupReport> groups : List.of(artists, venues, events)) {
            for (GroupReport g : groups) {
                for (DuplicateReport d : g.duplicates()) {
                    for (Map.Entry<String, Integer> e : d.counts().entrySet()) totals.merge(e.getKey(), e.getValue(), Integer::sum);
                }
            }
        }
        // Toplamlar yalnizca otomatik uygulanan (HIGH) kayitlari sayar; oneriler ayri sayilir.
        totals.put("artistSuggestionGroups", artistSug.size());
        totals.put("artistSuggestionDuplicates", countDuplicates(artistSug));
        totals.put("venueSuggestionGroups", venueSug.size());
        totals.put("venueSuggestionDuplicates", countDuplicates(venueSug));
        totals.put("eventSuggestionGroups", eventSug.size());
        totals.put("eventSuggestionDuplicates", countDuplicates(eventSug));
        return new DuplicateMergeReport(dryRun, min.name(), MergeConfidence.HIGH.name(), suggestionMin, artists, venues, events, totals, artistSug, venueSug, eventSug);
    }

    private static int countDuplicates(List<GroupReport> groups) {
        int n = 0;
        for (GroupReport g : groups) n += g.duplicates().size();
        return n;
    }

    private static String eventLabel(Event e) {
        return e.getName() + (e.getEventDate() == null ? "" : " @ " + e.getEventDate());
    }

    private static <T> Map<Long, T> byId(Collection<T> items, java.util.function.Function<T, Long> id) {
        Map<Long, T> map = new HashMap<>();
        for (T t : items) map.put(id.apply(t), t);
        return map;
    }

    private static Set<Long> toSet(Collection<Long> ids) {
        return ids == null ? Set.of() : new HashSet<>(ids);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
