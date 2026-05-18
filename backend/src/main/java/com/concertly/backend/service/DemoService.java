package com.concertly.backend.service;

import com.concertly.backend.dto.response.EventResponse;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class DemoService {

    private final VenueRepository venueRepository;
    private final ArtistRepository artistRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final LikeRepository likeRepository;
    private final CommunityRepository communityRepository;
    private final CommunityMemberRepository communityMemberRepository;
    private final CommunityPostRepository communityPostRepository;
    private final CommunityPostLikeRepository communityPostLikeRepository;
    private final EventAttendanceRepository eventAttendanceRepository;
    private final PasswordEncoder passwordEncoder;

    public DemoService(VenueRepository vr, ArtistRepository ar, EventRepository er,
                       UserRepository ur, PostRepository pr, CommentRepository cr,
                       LikeRepository lr, CommunityRepository comr,
                       CommunityMemberRepository cmr, CommunityPostRepository cpr,
                       CommunityPostLikeRepository cplr, EventAttendanceRepository ear,
                       PasswordEncoder passwordEncoder) {
        this.venueRepository = vr; this.artistRepository = ar; this.eventRepository = er;
        this.userRepository = ur; this.postRepository = pr; this.commentRepository = cr;
        this.likeRepository = lr; this.communityRepository = comr;
        this.communityMemberRepository = cmr; this.communityPostRepository = cpr;
        this.communityPostLikeRepository = cplr; this.eventAttendanceRepository = ear;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> setup() {
        // Only clear demo interactions — never delete real event/venue data
        commentRepository.deleteAll();
        likeRepository.deleteAll();
        postRepository.deleteAll();
        communityPostLikeRepository.deleteAll();
        communityPostRepository.deleteAll();
        communityMemberRepository.deleteAll();
        eventAttendanceRepository.deleteAll();

        // Get existing events from Ticketmaster sync, or create demo events if none
        List<Event> events = eventRepository.findAll();
        if (events.isEmpty()) {
            events = seedDemoEvents();
        }

        // Demo users (creates if not exists)
        User u1 = demoUser("ahmet_muzik", "ahmet@demo.com", "Demo1234", "Istanbul", "Konser tutkunu 🎸", "Rock,Pop,Metal");
        User u2 = demoUser("melis_rock", "melis@demo.com", "Demo1234", "Istanbul", "Metalhead 🤘", "Metal,Rock");
        User u3 = demoUser("can_elektro", "can@demo.com", "Demo1234", "Ankara", "DJ & Producer", "Elektronik,Techno");

        // Posts on existing events
        List<Post> demoPosts = new ArrayList<>();
        for (int i = 0; i < Math.min(events.size(), 5); i++) {
            User author = i % 3 == 0 ? u1 : (i % 3 == 1 ? u2 : u3);
            String[] contents = {
                "Bu konser için çok heyecanlıyım! Senelerdir bekliyorum.",
                "Canlı dinlemek harika olacak. Kaçırmayın!",
                "Biletimi aldım bile. Kimler geliyor?",
                "En sevdiğim sanatçılardan. Mutlaka gidin.",
                "Yeni albüm turnesi kapsamında. Çok iyi olacak."
            };
            demoPosts.add(post(contents[i], author, events.get(i)));
        }

        // Comments & likes on first few posts
        if (demoPosts.size() >= 1) {
            comment("Ben de gideceğim! Nerede buluşalım?", u2, demoPosts.get(0));
            comment("Harika! Kaç yılından beri bekliyorsun? 😄", u3, demoPosts.get(0));
            like(u2, demoPosts.get(0)); like(u3, demoPosts.get(0));
        }
        if (demoPosts.size() >= 2) {
            comment("Akustik performansları efsane oluyor.", u1, demoPosts.get(1));
            like(u1, demoPosts.get(1)); like(u3, demoPosts.get(1));
        }
        if (demoPosts.size() >= 3) {
            comment("En iyisi!", u2, demoPosts.get(2));
            like(u2, demoPosts.get(2)); like(u1, demoPosts.get(2));
        }

        // Attendance
        if (events.size() >= 1) { attend(u1, events.get(0), AttendanceStatus.GOING); attend(u2, events.get(0), AttendanceStatus.GOING); }
        if (events.size() >= 2) { attend(u1, events.get(1), AttendanceStatus.INTERESTED); }
        if (events.size() >= 3) { attend(u2, events.get(2), AttendanceStatus.GOING); }
        if (events.size() >= 4) { attend(u3, events.get(3), AttendanceStatus.GOING); }

        // Community activity
        Community rock = communityRepository.findByType("Rock").stream().findFirst().orElse(null);
        Community elektro = communityRepository.findByType("Elektronik").stream().findFirst().orElse(null);
        Community festival = communityRepository.findByType("Festival").stream().findFirst().orElse(null);

        if (rock != null) {
            communityMemberRepository.save(cm(u1, rock));
            communityMemberRepository.save(cm(u2, rock));
            cP("Duman'ın yeni albümü hakkında ne düşünüyorsunuz?", u1, rock);
            cP("Bu hafta sonu Dorock XL'da buluşalım mı?", u2, rock);
        }
        if (elektro != null) {
            communityMemberRepository.save(cm(u3, elektro));
            cP("Elektronik Gece Festivali için geri sayım başladı!", u3, elektro);
            cP("DJ setleri için hangi ekipmanı önerirsiniz?", u1, elektro);
        }
        if (festival != null) {
            communityMemberRepository.save(cm(u1, festival));
            communityMemberRepository.save(cm(u2, festival));
            communityMemberRepository.save(cm(u3, festival));
            cP("Bu yaz hangi festivale gidiyorsunuz?", u2, festival);
        }

        return Map.of(
            "success", true,
            "events", eventRepository.count(),
            "posts", postRepository.count(),
            "comments", commentRepository.count(),
            "demoAccount", Map.of("email", "ahmet@demo.com", "password", "Demo1234")
        );
    }

    private List<Event> seedDemoEvents() {
        List<Event> list = new ArrayList<>();
        Venue v1 = venue("Kucukciftlik Park", "Istanbul", "Turkiye", "Harbiye Mah.", 41.0450, 28.9900);
        Venue v2 = venue("Volkswagen Arena", "Istanbul", "Turkiye", "Maslak", 41.1120, 29.0050);
        Venue v3 = venue("IF Performance Hall", "Ankara", "Turkiye", "Kavaklidere", 39.9055, 32.8597);
        Venue v4 = venue("ODTU KKM", "Ankara", "Turkiye", "Universiteler Mah.", 39.8870, 32.7690);
        Venue v5 = venue("Zorlu PSM", "Istanbul", "Turkiye", "Levazim Mah.", 41.0636, 29.0091);
        Venue v6 = venue("Tarihi Havagazi", "Izmir", "Turkiye", "Umurbey Mah.", 38.4378, 27.1500);

        Artist a1 = artist("Duman", "Rock"); Artist a2 = artist("Mor ve Otesi", "Rock");
        Artist a3 = artist("Manga", "Rock"); Artist a4 = artist("Sila", "Pop");
        Artist a5 = artist("Mabel Matiz", "Pop"); Artist a6 = artist("Ceza", "Rap");
        Artist a7 = artist("Ezhel", "Rap"); Artist a8 = artist("Buyuk Ev Ablukada", "Indie");
        Artist a9 = artist("Melike Sahin", "Pop"); Artist a10 = artist("Hey Douglas", "Elektronik");

        LocalDateTime n = LocalDateTime.now();
        list.add(event("Duman - Istanbul Konseri", "Duman en sevilen sarkilariyla!", n.plusDays(3).withHour(20).withMinute(0), a1, v2));
        list.add(event("Mor ve Otesi - Akustik Gece", "Unutulmaz bir aksam.", n.plusDays(5).withHour(21).withMinute(0), a2, v5));
        list.add(event("Manga Live in Ankara", "Yeni album turnesi.", n.plusDays(7).withHour(19).withMinute(30), a3, v4));
        list.add(event("Sila Acikhava Konseri", "Yaz aksami romantik sarkilar.", n.plusDays(10).withHour(21).withMinute(0), a4, v1));
        list.add(event("Mabel Matiz - Zorlu PSM", "Yeni album ilk kez sahnede.", n.plusDays(12).withHour(20).withMinute(30), a5, v5));
        list.add(event("Ceza - Istanbul", "Turkce rap'in efsanesi.", n.plusDays(14).withHour(21).withMinute(0), a6, v2));
        list.add(event("Ezhel - Ankara", "Bomba gibi performans!", n.plusDays(17).withHour(22).withMinute(0), a7, v3));
        list.add(event("Buyuk Ev Ablukada - Izmir", "Indie sahnesi Izmir'de.", n.plusDays(20).withHour(20).withMinute(0), a8, v6));
        list.add(event("Melike Sahin - Akustik", "Samimi bir aksam.", n.plusDays(22).withHour(19).withMinute(0), a9, v5));
        list.add(event("Elektronik Gece Festivali", "En iyi DJ'ler bir arada!", n.plusDays(25).withHour(18).withMinute(0), a10, v1));
        return list;
    }

    // Helpers
    @Transactional
    public EventResponse createTestEvent(String name, double lat, double lng) {
        Venue v = new Venue();
        v.setName("Test Mekanı"); v.setCity("Ankara"); v.setCountry("Turkiye");
        v.setAddress("Test Adresi"); v.setLatitude(lat); v.setLongitude(lng);
        venueRepository.save(v);

        Artist a = artistRepository.findByNameIgnoreCase("Test Artist").orElseGet(Artist::new);
        a.setName("Test Artist"); a.setGenre("Rock");
        artistRepository.save(a);

        Event e = new Event();
        e.setName(name);
        e.setDescription("Post ve anket özelliklerini test etmek için oluşturulmuş etkinlik.");
        e.setEventDate(LocalDateTime.now().plusDays(1).withHour(20).withMinute(0));
        e.setArtist(a); e.setVenue(v);
        e.setIsApproved(true); e.setGenre("Rock");
        e.setTicketUrl("https://www.biletix.com");
        eventRepository.save(e);

        return EventResponse.from(e);
    }

    private Venue venue(String name, String city, String country, String address, double lat, double lng) {
        Venue v = new Venue(); v.setName(name); v.setCity(city); v.setCountry(country);
        v.setAddress(address); v.setLatitude(lat); v.setLongitude(lng);
        return venueRepository.save(v);
    }
    private Artist artist(String name, String genre) {
        Artist a = artistRepository.findByNameIgnoreCase(name).orElseGet(Artist::new);
        a.setName(name); a.setGenre(genre);
        return artistRepository.save(a);
    }
    private Event event(String name, String desc, LocalDateTime date, Artist artist, Venue venue) {
        Event e = new Event(); e.setName(name); e.setDescription(desc); e.setEventDate(date);
        e.setArtist(artist); e.setVenue(venue); e.setIsApproved(true); e.setGenre(artist.getGenre());
        e.setTicketUrl("https://www.biletix.com");
        return eventRepository.save(e);
    }
    private User demoUser(String username, String email, String pw, String city, String bio, String genres) {
        User u = userRepository.findByEmail(email).orElseGet(User::new);
        u.setUsername(username); u.setEmail(email); u.setPassword(passwordEncoder.encode(pw));
        u.setCity(city); u.setBio(bio); u.setFavoriteGenres(genres); u.setOnboardingCompleted(true);
        return userRepository.save(u);
    }
    private Post post(String content, User user, Event event) {
        Post p = new Post(); p.setContent(content); p.setUser(user); p.setEvent(event);
        return postRepository.save(p);
    }
    private void comment(String content, User user, Post post) {
        Comment c = new Comment(); c.setContent(content); c.setUser(user); c.setPost(post);
        commentRepository.save(c);
    }
    private void like(User user, Post post) {
        if (likeRepository.findByUserIdAndPostId(user.getId(), post.getId()).isEmpty()) {
            Like l = new Like(); l.setUser(user); l.setPost(post);
            likeRepository.save(l);
        }
    }
    private void attend(User user, Event event, AttendanceStatus status) {
        if (eventAttendanceRepository.findByUserIdAndEventId(user.getId(), event.getId()).isEmpty()) {
            EventAttendance ea = new EventAttendance();
            ea.setUser(user); ea.setEvent(event); ea.setStatus(status);
            eventAttendanceRepository.save(ea);
        }
    }
    private CommunityMember cm(User u, Community c) {
        CommunityMember m = new CommunityMember(); m.setUser(u); m.setCommunity(c); return m;
    }
    private CommunityPost cP(String content, User u, Community c) {
        CommunityPost cp = new CommunityPost(); cp.setContent(content); cp.setUser(u); cp.setCommunity(c);
        return communityPostRepository.save(cp);
    }
}
