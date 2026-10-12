package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Konser Arkadaşı: aynı konsere birlikte gidecek kişi bulma.
 *
 * Yalnızca İSTEYENLER görünür (Emre kararı, 7 Eki 2026): bir konsere "Gidiyorum" demek kişiyi
 * desteye sokmaz; kişi o konserde "arkadaş arıyorum" der (ConcertBuddy). Karşılıklıdır —
 * desteyi görmek için kullanıcı da o konserde arkadaş arıyor olmalı.
 *
 * Uyum puanı yalnız gerçek ortaklıklardan çıkar: ortak sanatçılar (takip edilen ve gidilen
 * konserlerin sanatçıları), ortak türler, aynı şehir, birlikte gidilmiş geçmiş konserler.
 * Gizli hesabın sanatçı/tür/şehir bilgisi karta da puana da girmez (SEC-05).
 */
@Service
public class BuddyMatchService {

    static final int MAX_CARDS = 50;
    static final int MAX_CARD_CONCERTS = 6;
    static final int MAX_CARD_ARTISTS = 10;
    /** Kaydırmayı geri alma penceresi (dakika). */
    static final int UNDO_WINDOW_MINUTES = 10;
    private static final int MAX_MY_EVENTS = 30;
    private static final int MAX_REASON_ITEMS = 3;

    private final ConcertBuddyRepository buddyRepository;
    private final EventAttendanceRepository attendanceRepository;
    private final BuddySwipeRepository swipeRepository;
    private final UserRepository userRepository;
    private final ArtistFollowRepository artistFollowRepository;
    private final MessageRepository messageRepository;
    private final ModerationService moderationService;
    private final NotificationService notificationService;

    public BuddyMatchService(ConcertBuddyRepository buddyRepository,
                             EventAttendanceRepository attendanceRepository,
                             BuddySwipeRepository swipeRepository,
                             UserRepository userRepository,
                             ArtistFollowRepository artistFollowRepository,
                             MessageRepository messageRepository,
                             ModerationService moderationService,
                             NotificationService notificationService) {
        this.buddyRepository = buddyRepository;
        this.attendanceRepository = attendanceRepository;
        this.swipeRepository = swipeRepository;
        this.userRepository = userRepository;
        this.artistFollowRepository = artistFollowRepository;
        this.messageRepository = messageRepository;
        this.moderationService = moderationService;
        this.notificationService = notificationService;
    }

    // ── Deste ────────────────────────────────────────────────────────────────

    /**
     * @param eventId yalnız bu konserin destesi (null: arkadaş aradığım tüm konserler)
     * @return cards, myEvents (gideceğim / arkadaş aradığım konserler), likesReceived
     */
    @Transactional(readOnly = true)
    public Map<String, Object> discover(Long myId, Long eventId) {
        LocalDateTime now = LocalDateTime.now();
        Set<Long> hidden = moderationService.getHiddenUserIds(myId);

        List<ConcertBuddy> myRows = buddyRepository.findUpcomingForUser(myId, now).stream()
                .filter(b -> b.getEvent().listedPublicly())
                .toList();
        Map<Long, ConcertBuddy> myRowByEvent = new HashMap<>();
        myRows.forEach(b -> myRowByEvent.put(b.getEvent().getId(), b));

        // Gideceğim konserler + arkadaş aradığım konserler (açma/kapama listesi)
        Map<Long, Event> myEventsById = new LinkedHashMap<>();
        attendanceRepository.findUpcomingGoing(myId, now, PageRequest.of(0, MAX_MY_EVENTS))
                .forEach(ea -> myEventsById.put(ea.getEvent().getId(), ea.getEvent()));
        myRows.forEach(b -> myEventsById.putIfAbsent(b.getEvent().getId(), b.getEvent()));

        Set<Long> openEventIds = new HashSet<>(myRowByEvent.keySet());
        if (eventId != null) openEventIds.retainAll(Set.of(eventId));

        // Konser başına arkadaş arayan diğer kişiler (sayaç + kart adayları)
        List<ConcertBuddy> others = myEventsById.isEmpty() ? List.of()
                : buddyRepository.findForEvents(myEventsById.keySet()).stream()
                .filter(b -> !b.getUser().getId().equals(myId) && !hidden.contains(b.getUser().getId())
                        && isActive(b.getUser()))
                .toList();
        Map<Long, Long> lookingCount = others.stream()
                .collect(Collectors.groupingBy(b -> b.getEvent().getId(), Collectors.counting()));

        List<Map<String, Object>> myEvents = myEventsById.values().stream()
                .filter(Event::listedPublicly)
                .sorted(Comparator.comparing(Event::getEventDate))
                .map(e -> {
                    Map<String, Object> m = eventMap(e);
                    ConcertBuddy mine = myRowByEvent.get(e.getId());
                    m.put("lookingForBuddy", mine != null);
                    m.put("message", mine != null && mine.getMessage() != null ? mine.getMessage() : "");
                    m.put("buddyCount", lookingCount.getOrDefault(e.getId(), 0L));
                    return m;
                })
                .toList();

        Set<Long> alreadySwiped = swipeRepository.findBySwiperId(myId).stream()
                .map(BuddySwipe::getTargetId).collect(Collectors.toSet());
        Set<Long> likedMe = swipeRepository.findByTargetIdAndLikedTrue(myId).stream()
                .map(BuddySwipe::getSwiperId).collect(Collectors.toSet());

        Map<Long, User> candidateUsers = new LinkedHashMap<>();
        Map<Long, List<Map<String, Object>>> sharedByUser = new HashMap<>();
        for (ConcertBuddy b : others) {
            Long uid = b.getUser().getId();
            if (!openEventIds.contains(b.getEvent().getId()) || alreadySwiped.contains(uid)) continue;
            candidateUsers.putIfAbsent(uid, b.getUser());
            Map<String, Object> ev = eventMap(b.getEvent());
            ev.put("message", b.getMessage() != null ? b.getMessage() : "");
            sharedByUser.computeIfAbsent(uid, k -> new ArrayList<>()).add(ev);
        }

        Profile me = profileOf(userRepository.findById(myId).orElse(null));
        List<Map<String, Object>> cards = new ArrayList<>();
        for (User u : candidateUsers.values()) {
            boolean isPrivate = PrivacyService.isPrivate(u);
            Profile them = isPrivate ? Profile.EMPTY : profileOf(u);
            Compatibility c = compatibility(me, them);
            List<Map<String, Object>> shared = sharedByUser.get(u.getId());
            shared.sort(Comparator.comparing(m -> (String) m.get("eventDate")));

            Map<String, Object> card = new LinkedHashMap<>();
            card.put("userId", u.getId());
            card.put("username", u.getUsername());
            card.put("fullName", u.getFullName() != null ? u.getFullName() : "");
            // Doğum tarihi verilmez, yalnız yaş; gizli hesapta şehir gibi gizli
            Integer age = isPrivate ? null : ProfileRules.age(u.getBirthDate());
            card.put("age", age);
            card.put("profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : "");
            card.put("city", !isPrivate && u.getCity() != null ? u.getCity() : "");
            card.put("bio", !isPrivate && u.getBio() != null ? u.getBio() : "");
            card.put("favoriteGenres", !isPrivate && u.getFavoriteGenres() != null ? u.getFavoriteGenres() : "");
            card.put("concertCount", isPrivate ? 0 : them.wentEventIds.size());
            card.put("sharedEvents", shared);
            card.put("compatibility", c.score);
            card.put("genreMatchScore", c.score); // eski istemciler için
            card.put("sharedArtists", c.sharedArtists);
            card.put("sharedGenres", c.sharedGenres);
            card.put("sameCity", c.sameCity);
            card.put("pastConcertsTogether", c.pastConcertsTogether);
            // Tam ekran kartın detayları: son gittiği konserler ve sevdiği sanatçılar
            // (gizli hesapta boş; Profile.EMPTY)
            card.put("recentConcerts", them.wentEvents.stream()
                    .filter(e -> e.getEventDate() != null && e.listedPublicly())
                    .sorted(Comparator.comparing(Event::getEventDate).reversed())
                    .limit(MAX_CARD_CONCERTS)
                    .map(this::eventMap)
                    .toList());
            card.put("topArtists", topArtists(them, c.sharedArtists));
            cards.add(card);
        }
        // Beni beğenenler önce (eşleşme şansı yüksek), sonra uyum, sonra ortak konser sayısı
        cards.sort(Comparator
                .comparing((Map<String, Object> c) -> !likedMe.contains((Long) c.get("userId")))
                .thenComparing(c -> -(int) c.get("compatibility"))
                .thenComparing(c -> -((List<?>) c.get("sharedEvents")).size()));
        List<Map<String, Object>> limited = cards.size() > MAX_CARDS ? cards.subList(0, MAX_CARDS) : cards;

        long likesReceived = likedMe.stream().filter(candidateUsers::containsKey).count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("cards", new ArrayList<>(limited));
        result.put("myEvents", myEvents);
        result.put("likesReceived", likesReceived);
        return result;
    }

    // ── Kaydırma ─────────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> swipe(Long myId, Long targetId, boolean liked) {
        if (targetId == null) throw new IllegalArgumentException("targetId ve liked zorunlu.");
        if (targetId.equals(myId)) throw new IllegalArgumentException("Kendinle eşleşemezsin.");
        if (!userRepository.existsById(targetId)) {
            throw new ResourceNotFoundException("Kullanıcı bulunamadı: " + targetId);
        }
        moderationService.requireCanInteract(myId, targetId);
        // Yalnız aynı konserde arkadaş arayan iki kişi eşleşebilir (deste dışından istek kapalı)
        if (liked && sharedLookingEvents(myId, targetId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "BUDDY_NOT_ELIGIBLE");
        }

        // Aynı çift için işlem boyunca kilit: karşılıklı eşzamanlı beğenide ikinci istek birincinin
        // kaydını görür; tam bir taraf matched=true alır ve bildirim bir kez gider. Aynı kişinin
        // yinelenen isteği de burada sıralanır (upsert tek satırda kalır).
        swipeRepository.lockPair(pairLockKey(myId, targetId));
        if (liked && swipeRepository.existsUnmatchedBetween(myId, targetId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "BUDDY_UNMATCHED");
        }

        BuddySwipe swipe = swipeRepository.findBySwiperIdAndTargetId(myId, targetId).orElse(new BuddySwipe());
        boolean alreadyLiked = swipe.isLiked();
        swipe.setSwiperId(myId);
        swipe.setTargetId(targetId);
        swipe.setLiked(liked);
        swipeRepository.save(swipe);

        boolean matched = liked && swipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(targetId, myId);
        Map<String, Object> result = new HashMap<>();
        result.put("matched", matched);
        if (matched) {
            userRepository.findById(targetId).ifPresent(u -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("userId", u.getId());
                m.put("username", u.getUsername());
                m.put("profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : "");
                m.put("sharedEvents", sharedLookingEvents(myId, targetId).stream().map(this::eventMap).toList());
                result.put("matchedUser", m);
            });
            // Önce beğenen taraf eşleşmeyi bilmiyordu: ona bildirim (uygulama kapalıysa push).
            // Aynı beğeninin tekrarında yeniden bildirim gitmez.
            if (!alreadyLiked) {
                notificationService.send(targetId, myId, "buddy_match", "buddy", myId);
            }
        }
        return result;
    }

    /**
     * Son kaydırmayı geri alır; kurulmuş eşleşme geri alınamaz (eşleşmeyi kaldır kullanılır).
     * Yalnız son 10 dakikadaki ve kaldırılmamış kaydırma: aksi halde kaldırma işareti undo ile
     * silinip sohbet yeniden açılabilirdi → 400 UNDO_EXPIRED.
     */
    @Transactional
    public void undo(Long myId, Long targetId) {
        swipeRepository.findBySwiperIdAndTargetId(myId, targetId).ifPresent(s -> {
            boolean expired = s.getCreatedAt() == null
                    || s.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(UNDO_WINDOW_MINUTES));
            if (s.getUnmatchedAt() != null || expired || swipeRepository.existsUnmatchedBetween(myId, targetId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UNDO_EXPIRED");
            }
            if (s.isLiked() && swipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(targetId, myId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "BUDDY_ALREADY_MATCHED");
            }
            swipeRepository.delete(s);
        });
    }

    /**
     * Eşleşmeyi kaldırır: benim beğenim geri çekilir, kişi desteye de dönmez. Kurulmuş bir eşleşme
     * kaldırılıyorsa çift kalıcı olarak "kaldırıldı" işaretlenir (sohbet iki yönde kapanır,
     * geçmiş mesajlar silinmez; kaydırma geri alınamaz).
     */
    @Transactional
    public void unmatch(Long myId, Long targetId) {
        swipeRepository.findBySwiperIdAndTargetId(myId, targetId).ifPresent(s -> {
            if (s.getUnmatchedAt() == null && s.isLiked()
                    && swipeRepository.existsBySwiperIdAndTargetIdAndLikedTrue(targetId, myId)) {
                s.setUnmatchedAt(LocalDateTime.now());
            }
            s.setLiked(false);
            swipeRepository.save(s);
        });
    }

    // ── Eşleşmeler ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> matches(Long myId) {
        Map<Long, BuddySwipe> iLiked = swipeRepository.findBySwiperId(myId).stream()
                .filter(BuddySwipe::isLiked)
                .collect(Collectors.toMap(BuddySwipe::getTargetId, s -> s, (a, b) -> a));
        Set<Long> hidden = moderationService.getHiddenUserIds(myId);

        List<Map<String, Object>> out = new ArrayList<>();
        for (BuddySwipe theirs : swipeRepository.findByTargetIdAndLikedTrue(myId)) {
            Long uid = theirs.getSwiperId();
            BuddySwipe mine = iLiked.get(uid);
            if (mine == null || uid.equals(myId) || hidden.contains(uid)) continue;
            if (mine.getUnmatchedAt() != null || theirs.getUnmatchedAt() != null) continue;
            userRepository.findById(uid).filter(BuddyMatchService::isActive).ifPresent(u -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("userId", u.getId());
                m.put("username", u.getUsername());
                m.put("city", u.getCity() != null ? u.getCity() : "");
                m.put("profileImageUrl", u.getProfileImageUrl() != null ? u.getProfileImageUrl() : "");
                m.put("favoriteGenres", u.getFavoriteGenres() != null ? u.getFavoriteGenres() : "");
                m.put("sharedEvents", sharedGoingEvents(myId, uid));
                LocalDateTime at = later(mine.getCreatedAt(), theirs.getCreatedAt());
                m.put("matchedAt", at != null ? at.toString() : "");
                m.put("hasConversation", messageRepository.conversationExists(myId, uid));
                out.add(m);
            });
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> (String) m.get("matchedAt")).reversed());
        return out;
    }

    // ── Uyum ─────────────────────────────────────────────────────────────────

    /** Bir kişinin uyum hesabında kullanılan bilgileri. */
    record Profile(Map<Long, String> artists, Set<String> genres, String cityKey, Set<Long> wentEventIds,
                   List<Event> wentEvents) {
        static final Profile EMPTY = new Profile(Map.of(), Set.of(), null, Set.of());

        Profile(Map<Long, String> artists, Set<String> genres, String cityKey, Set<Long> wentEventIds) {
            this(artists, genres, cityKey, wentEventIds, List.of());
        }
    }

    record Compatibility(int score, List<String> sharedArtists, List<String> sharedGenres,
                         boolean sameCity, int pastConcertsTogether) {}

    /**
     * 0–100: ortak sanatçı başına 14 (en çok 40) + tür benzerliği (Jaccard × 30)
     * + aynı şehir 10 + birlikte gidilmiş geçmiş konser başına 10 (en çok 20).
     */
    static Compatibility compatibility(Profile me, Profile them) {
        List<String> artists = me.artists.entrySet().stream()
                .filter(e -> them.artists.containsKey(e.getKey()))
                .map(Map.Entry::getValue).sorted().toList();
        Set<String> genreUnion = new HashSet<>(me.genres);
        genreUnion.addAll(them.genres);
        List<String> genres = me.genres.stream().filter(them.genres::contains).sorted().toList();
        boolean sameCity = me.cityKey != null && me.cityKey.equals(them.cityKey);
        int together = (int) me.wentEventIds.stream().filter(them.wentEventIds::contains).count();

        double score = Math.min(40, artists.size() * 14)
                + (genreUnion.isEmpty() ? 0 : 30.0 * genres.size() / genreUnion.size())
                + (sameCity ? 10 : 0)
                + Math.min(20, together * 10);
        return new Compatibility((int) Math.round(Math.min(100, score)),
                artists.subList(0, Math.min(MAX_REASON_ITEMS, artists.size())),
                genres.subList(0, Math.min(MAX_REASON_ITEMS, genres.size())),
                sameCity, together);
    }

    /** Önce ortak sanatçılar, sonra diğerleri alfabetik; en çok MAX_CARD_ARTISTS. */
    static List<String> topArtists(Profile p, List<String> shared) {
        List<String> out = new ArrayList<>(shared);
        p.artists.values().stream().distinct().sorted()
                .filter(n -> !out.contains(n))
                .forEach(out::add);
        return out.subList(0, Math.min(MAX_CARD_ARTISTS, out.size()));
    }

    private Profile profileOf(User u) {
        if (u == null) return Profile.EMPTY;
        Map<Long, String> artists = new HashMap<>();
        artistFollowRepository.findAllByUserId(u.getId()).forEach(f -> {
            if (f.getArtist() != null) artists.put(f.getArtist().getId(), f.getArtist().getName());
        });
        Set<Long> went = new HashSet<>();
        List<Event> wentEvents = new ArrayList<>();
        attendanceRepository.findByUserIdAndStatus(u.getId(), AttendanceStatus.WENT).forEach(ea -> {
            Event e = ea.getEvent();
            if (e == null || !went.add(e.getId())) return;
            wentEvents.add(e);
            if (e.getArtist() != null) artists.putIfAbsent(e.getArtist().getId(), e.getArtist().getName());
        });
        return new Profile(artists, genresOf(u.getFavoriteGenres()), ConcertAttendanceService.cityKey(u.getCity()), went, wentEvents);
    }

    static Set<String> genresOf(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    // ── Yardımcılar ──────────────────────────────────────────────────────────

    /** Pasif (yasaklı/kapatılmış) hesaplar deste ve eşleşmelerde görünmez. */
    static boolean isActive(User u) {
        return u != null && !Boolean.FALSE.equals(u.getIsActive());
    }

    /** İki kullanıcı için simetrik danışma kilidi anahtarı. */
    static long pairLockKey(Long a, Long b) {
        long lo = Math.min(a, b), hi = Math.max(a, b);
        return (lo << 32) ^ hi;
    }

    /** İkisinin de arkadaş aradığı yaklaşan konserler. */
    private List<Event> sharedLookingEvents(Long a, Long b) {
        LocalDateTime now = LocalDateTime.now();
        Set<Long> mine = buddyRepository.findUpcomingForUser(a, now).stream()
                .map(x -> x.getEvent().getId()).collect(Collectors.toSet());
        return buddyRepository.findUpcomingForUser(b, now).stream()
                .map(ConcertBuddy::getEvent)
                .filter(e -> mine.contains(e.getId()))
                .sorted(Comparator.comparing(Event::getEventDate))
                .toList();
    }

    /** İki kullanıcının ortak yaklaşan "Gidiyorum" ya da "arkadaş arıyorum" konserleri (eşleşme sebebi). */
    private List<Map<String, Object>> sharedGoingEvents(Long a, Long b) {
        LocalDateTime now = LocalDateTime.now();
        Map<Long, Event> aEvents = new HashMap<>();
        attendanceRepository.findByUserIdAndStatus(a, AttendanceStatus.GOING).forEach(ea -> aEvents.put(ea.getEvent().getId(), ea.getEvent()));
        buddyRepository.findUpcomingForUser(a, now).forEach(x -> aEvents.put(x.getEvent().getId(), x.getEvent()));
        Set<Long> bEventIds = new HashSet<>();
        attendanceRepository.findByUserIdAndStatus(b, AttendanceStatus.GOING).forEach(ea -> bEventIds.add(ea.getEvent().getId()));
        buddyRepository.findUpcomingForUser(b, now).forEach(x -> bEventIds.add(x.getEvent().getId()));
        return aEvents.values().stream()
                .filter(e -> bEventIds.contains(e.getId()) && e.getEventDate() != null && e.getEventDate().isAfter(now))
                .sorted(Comparator.comparing(Event::getEventDate))
                .map(this::eventMap)
                .toList();
    }

    private Map<String, Object> eventMap(Event e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.getId());
        m.put("name", e.getName());
        m.put("artistName", e.getArtist() != null ? e.getArtist().getName() : "");
        m.put("eventDate", e.getEventDate().toString());
        m.put("venueName", e.getVenue() != null ? e.getVenue().getName() : "");
        m.put("venueCity", e.getVenue() != null && e.getVenue().getCity() != null ? e.getVenue().getCity() : "");
        m.put("imageUrl", eventImage(e));
        return m;
    }

    /** Kartın üst görseli: etkinlik görseli, yoksa sanatçı fotoğrafı. */
    private static String eventImage(Event event) {
        String img = ImageUrls.usable(event.getImageUrl());
        if (img == null && event.getArtist() != null) img = ImageUrls.usable(event.getArtist().getImageUrl());
        return img != null ? img : "";
    }

    private static LocalDateTime later(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }
}
