package com.concertly.backend.service;

import com.concertly.backend.dto.response.ArtistResponse;
import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.Artist;
import com.concertly.backend.repository.ArtistFollowRepository;
import com.concertly.backend.repository.ArtistRepository;
import com.concertly.backend.repository.EventRepository;
import com.concertly.backend.repository.MergePointers;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sanatçı profilindeki "Benzer sanatçılar" şeridi.
 *
 * Kaynak Deezer'ın related listesi (anahtarsız). Yalnızca bizde kaydı olan
 * sanatçılar döner ki dokununca profiline gidilebilsin; yaklaşan konseri
 * olanlar öne alınır, kendi aralarında Deezer'ın benzerlik sırası korunur.
 *
 * Deezer sanatçısı yalnızca adı birebir eşleşirse kullanılır — yanlış
 * sanatçının benzerlerini göstermektense şeridi gizlemek daha iyi.
 */
@Service
public class SimilarArtistService {

    static final int MAX_RESULTS = 12;
    private static final int RELATED_FETCH = 25;
    private static final long CACHE_MS = 12 * 60 * 60 * 1000L;
    /** Boş sonuç Deezer kesintisinden de gelebilir (DeezerService hatayı yutar): kısa tutulur. */
    private static final long EMPTY_CACHE_MS = 30 * 60 * 1000L;

    private final DeezerService deezerService;
    private final ArtistRepository artistRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final EventRepository eventRepository;

    /** artistId → benzer sanatçı kimlikleri (Deezer sırası). Takip durumu kullanıcıya göre her istekte hesaplanır. */
    private final Map<Long, CachedIds> cache = new ConcurrentHashMap<>();

    private record CachedIds(List<Long> ids, long at) {}

    public SimilarArtistService(DeezerService deezerService,
                                ArtistRepository artistRepository,
                                ArtistFollowRepository artistFollowRepository,
                                EventRepository eventRepository) {
        this.deezerService = deezerService;
        this.artistRepository = artistRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.eventRepository = eventRepository;
    }

    public List<ArtistResponse> getSimilar(Long artistId, Long currentUserId) {
        Artist artist = MergePointers.canonical(artistRepository.findById(artistId), artistRepository)
                .orElseThrow(() -> new ResourceNotFoundException("Sanatçı bulunamadı: " + artistId));

        List<Long> ids = similarIds(artist);
        if (ids.isEmpty()) return List.of();

        Map<Long, Artist> byId = new HashMap<>();
        artistRepository.findAllById(ids).forEach(a -> byId.put(a.getId(), a));

        Map<Long, Long> upcoming = new HashMap<>();
        for (Object[] row : eventRepository.countUpcomingListedByArtistIdIn(ids, LocalDateTime.now())) {
            upcoming.put((Long) row[0], (Long) row[1]);
        }

        // Kararlı sıralama: yaklaşan konseri olanlar önce, eşitlikte Deezer sırası
        return ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing((Artist a) -> upcoming.getOrDefault(a.getId(), 0L) == 0))
                .limit(MAX_RESULTS)
                .map(a -> ArtistResponse.from(a,
                        artistFollowRepository.countByArtistId(a.getId()),
                        currentUserId != null && artistFollowRepository
                                .findByUserIdAndArtistId(currentUserId, a.getId()).isPresent()))
                .toList();
    }

    private List<Long> similarIds(Artist artist) {
        CachedIds hit = cache.get(artist.getId());
        if (hit != null && System.currentTimeMillis() - hit.at() < (hit.ids().isEmpty() ? EMPTY_CACHE_MS : CACHE_MS)) {
            return hit.ids();
        }

        List<Long> ids = new ArrayList<>();
        try {
            String key = ConcertDayService.normalize(artist.getName());
            Long deezerId = key.isEmpty() ? null : deezerService.searchArtists(artist.getName(), 5).stream()
                    .filter(a -> key.equals(ConcertDayService.normalize(String.valueOf(a.get("name")))))
                    .map(a -> (Long) a.get("artistId"))
                    .findFirst().orElse(null);
            if (deezerId != null) {
                Set<Long> seen = new HashSet<>();
                seen.add(artist.getId());
                for (String name : deezerService.getRelatedArtistNames(deezerId, RELATED_FETCH)) {
                    // findExisting: Türkçe harf farkı yok sayılır, birleştirilmiş kayıtta asıl kayıt döner
                    artistRepository.findExisting(null, name)
                            .filter(a -> seen.add(a.getId()))
                            .ifPresent(a -> ids.add(a.getId()));
                }
            }
        } catch (Exception e) {
            // Geçici hata önbelleğe yazılmaz: bir sonraki istek yeniden dener
            System.out.println("  ⚠️ Benzer sanatçılar alınamadı (" + artist.getName() + "): " + e.getMessage());
            return ids;
        }
        if (cache.size() > 500) cache.clear();
        cache.put(artist.getId(), new CachedIds(List.copyOf(ids), System.currentTimeMillis()));
        return ids;
    }
}
