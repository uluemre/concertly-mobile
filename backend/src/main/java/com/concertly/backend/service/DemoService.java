package com.concertly.backend.service;

import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
        this.venueRepository = vr;
        this.artistRepository = ar;
        this.eventRepository = er;
        this.userRepository = ur;
        this.postRepository = pr;
        this.commentRepository = cr;
        this.likeRepository = lr;
        this.communityRepository = comr;
        this.communityMemberRepository = cmr;
        this.communityPostRepository = cpr;
        this.communityPostLikeRepository = cplr;
        this.eventAttendanceRepository = ear;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> setup() {
        // Clear existing demo content
        commentRepository.deleteAll();
        likeRepository.deleteAll();
        postRepository.deleteAll();
        communityPostLikeRepository.deleteAll();
        communityPostRepository.deleteAll();
        communityMemberRepository.deleteAll();
        eventAttendanceRepository.deleteAll();
        eventRepository.deleteAll();
        venueRepository.deleteAll();

        // ---- VENUES ----
        Venue v1 = venue("Küçükçiftlik Park", "İstanbul", "Türkiye", "Harbiye Mah. Kadırgalar Cad. No:4", 41.0450, 28.9900);
        Venue v2 = venue("Volkswagen Arena", "İstanbul", "Türkiye", "Huzur Mah. Maslak Ayazağa Cad. No:4", 41.1120, 29.0050);
        Venue v3 = venue("IF Performance Hall", "Ankara", "Türkiye", "Kavaklıdere Mah. Tunus Cad. No:14", 39.9055, 32.8597);
        Venue v4 = venue("ODTÜ KKM", "Ankara", "Türkiye", "Üniversiteler Mah. Dumlupınar Bulvarı No:1", 39.8870, 32.7690);
        Venue v5 = venue("Zorlu PSM", "İstanbul", "Türkiye", "Levazım Mah. Koru Sok. No:2", 41.0636, 29.0091);
        Venue v6 = venue("Alsancak Tarihi Havagazı", "İzmir", "Türkiye", "Umurbey Mah. Liman Cad.", 38.4378, 27.1500);

        // ---- ARTISTS (use existing or create) ----
        Artist a1 = artist("Duman", "Rock", null);
        Artist a2 = artist("Mor ve Ötesi", "Rock", null);
        Artist a3 = artist("Manga", "Rock", null);
        Artist a4 = artist("Sıla", "Pop", null);
        Artist a5 = artist("Mabel Matiz", "Pop", null);
        Artist a6 = artist("Ceza", "Rap", null);
        Artist a7 = artist("Ezhel", "Rap", null);
        Artist a8 = artist("Büyük Ev Ablukada", "Indie", null);
        Artist a9 = artist("Melike Şahin", "Pop", null);
        Artist a10 = artist("Hey Douglas", "Elektronik", null);

        // ---- EVENTS (upcoming dates) ----
        LocalDateTime now = LocalDateTime.now();
        Event e1 = event("Duman - İstanbul Konseri", "Rock grubu Duman, en sevilen şarkılarıyla Volkswagen Arena'da!", now.plusDays(3).withHour(20).withMinute(0), a1, v2);
        Event e2 = event("Mor ve Ötesi - Akustik Gece", "Mor ve Ötesi'nden unutulmaz bir akustik performans. Kaçırmayın!", now.plusDays(5).withHour(21).withMinute(0), a2, v5);
        Event e3 = event("Manga Live in Ankara", "Manga hayranlarıyla buluşuyor! Yeni albüm turnesi kapsamında.", now.plusDays(7).withHour(19).withMinute(30), a3, v4);
        Event e4 = event("Sıla Açıkhava Konseri", "Yaz akşamlarının vazgeçilmezi Sıla, romantik şarkılarıyla Küçükçiftlik'te.", now.plusDays(10).withHour(21).withMinute(0), a4, v1);
        Event e5 = event("Mabel Matiz - Zorlu PSM", "Mabel Matiz yeni albüm şarkılarını ilk kez sahnede seslendiriyor.", now.plusDays(12).withHour(20).withMinute(30), a5, v5);
        Event e6 = event("Ceza - İstanbul", "Türkçe rap'in efsane ismi Ceza, sevenleriyle buluşuyor.", now.plusDays(14).withHour(21).withMinute(0), a6, v2);
        Event e7 = event("Ezhel - Ankara", "Ezhel'den bomba gibi bir performans!", now.plusDays(17).withHour(22).withMinute(0), a7, v3);
        Event e8 = event("Büyük Ev Ablukada - İzmir", "Indie sahnesinin sevilen grubu İzmir'de.", now.plusDays(20).withHour(20).withMinute(0), a8, v6);
        Event e9 = event("Melike Şahin - Akustik", "Melike Şahin'den samimi bir akustik gece.", now.plusDays(22).withHour(19).withMinute(0), a9, v5);
        Event e10 = event("Elektronik Gece Festivali", "Türkiye'nin en iyi elektronik müzik DJ'leri bir arada!", now.plusDays(25).withHour(18).withMinute(0), a10, v1);

        // ---- DEMO USERS ----
        User u1 = demoUser("ahmet_muzik", "ahmet@demo.com", "Demo1234", "İstanbul", "Konser tutkunu 🎸", "Rock,Pop,Metal", true);
        User u2 = demoUser("melis_rock", "melis@demo.com", "Demo1234", "İstanbul", "Metalhead 🤘", "Metal,Rock", true);
        User u3 = demoUser("can_elektro", "can@demo.com", "Demo1234", "Ankara", "DJ & Producer", "Elektronik,Techno", true);

        // ---- POSTS ----
        Post p1 = post("Duman konseri için fazla heyecanlıyım! Senelerdir bekliyorum.", u1, e1);
        Post p2 = post("Mor ve Ötesi'nin akustik performansını canlı dinlemek bir ayrıcalık olacak.", u2, e2);
        Post p3 = post("Manga yeni albümünü sahnede çalacakmış. Çok merak ediyorum!", u1, e3);
        Post p4 = post("Sıla konserine kız arkadaşımla gideceğim. Romantik bir gece olacak.", u3, e4);
        Post p5 = post("Mabel Matiz'in yeni şarkıları harika olmuş. Konser kaçmaz.", u2, e5);

        // ---- COMMENTS ----
        comment("Ben de gideceğim! Nerede buluşalım?", u2, p1);
        comment("Kaç yılından beri bekliyorsun? 😄", u3, p1);
        comment("Akustik performansları efsane oluyor gerçekten.", u1, p2);
        comment("Manga her zaman en iyisi!", u2, p3);

        // ---- LIKES ----
        like(u2, p1); like(u3, p1);
        like(u1, p2); like(u3, p2);
        like(u2, p3); like(u1, p3);
        like(u1, p4); like(u2, p4);

        // ---- EVENT ATTENDANCE ----
        attend(u1, e1, AttendanceStatus.GOING);
        attend(u2, e1, AttendanceStatus.GOING);
        attend(u1, e2, AttendanceStatus.INTERESTED);
        attend(u2, e3, AttendanceStatus.GOING);
        attend(u3, e4, AttendanceStatus.GOING);

        // ---- COMMUNITY POSTS ----
        Community rock = communityRepository.findByType("Rock").stream().findFirst().orElse(null);
        Community elektro = communityRepository.findByType("Elektronik").stream().findFirst().orElse(null);
        Community festival = communityRepository.findByType("Festival").stream().findFirst().orElse(null);

        if (rock != null) {
            communityMemberRepository.save(cm(u1, rock));
            communityMemberRepository.save(cm(u2, rock));
            cP("Duman'ın yeni albümü hakkında ne düşünüyorsunuz? Bence Gaye Su Akyol ile düeti harika!", u1, rock);
            cP("Bu hafta sonu Dorock XL'da buluşalım mı? Güzel bir rock gecesi olur.", u2, rock);
        }
        if (elektro != null) {
            communityMemberRepository.save(cm(u3, elektro));
            cP("Elektronik Gece Festivali için geri sayım başladı! Kimler geliyor?", u3, elektro);
            cP("DJ setleri için hangi ekipmanı önerirsiniz? Yeni başlayanlar için.", u1, elektro);
        }
        if (festival != null) {
            communityMemberRepository.save(cm(u1, festival));
            communityMemberRepository.save(cm(u2, festival));
            communityMemberRepository.save(cm(u3, festival));
            cP("Bu yaz hangi festivale gidiyorsunuz? Ben Zeytinli ve Nilüfer'i düşünüyorum.", u2, festival);
        }

        return Map.of(
            "success", true,
            "events", eventRepository.count(),
            "posts", postRepository.count(),
            "comments", commentRepository.count(),
            "demoAccount", Map.of("email", "ahmet@demo.com", "password", "Demo1234")
        );
    }

    // ---- HELPERS ----
    private Venue venue(String name, String city, String country, String address, double lat, double lng) {
        Venue v = new Venue(); v.setName(name); v.setCity(city); v.setCountry(country);
        v.setAddress(address); v.setLatitude(lat); v.setLongitude(lng);
        return venueRepository.save(v);
    }
    private Artist artist(String name, String genre, String img) {
        Artist a = artistRepository.findByNameIgnoreCase(name).orElseGet(Artist::new);
        a.setName(name); a.setGenre(genre);
        if (img != null) a.setImageUrl(img);
        return artistRepository.save(a);
    }
    private Event event(String name, String desc, LocalDateTime date, Artist artist, Venue venue) {
        Event e = new Event(); e.setName(name); e.setDescription(desc); e.setEventDate(date);
        e.setArtist(artist); e.setVenue(venue); e.setIsApproved(true); e.setGenre(artist.getGenre());
        e.setImageUrl("https://picsum.photos/seed/" + name.hashCode() + "/400/200");
        e.setTicketUrl("https://www.biletix.com");
        return eventRepository.save(e);
    }
    private User demoUser(String username, String email, String pw, String city, String bio, String genres, boolean onboarding) {
        User u = userRepository.findByEmail(email).orElseGet(User::new);
        u.setUsername(username); u.setEmail(email); u.setPassword(passwordEncoder.encode(pw));
        u.setCity(city); u.setBio(bio); u.setFavoriteGenres(genres); u.setOnboardingCompleted(onboarding);
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
