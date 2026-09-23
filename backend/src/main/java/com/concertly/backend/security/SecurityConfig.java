package com.concertly.backend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final UserDetailsServiceImpl userDetailsService;
    private final List<String> allowedOriginPatterns;

    public SecurityConfig(
            JwtFilter jwtFilter,
            UserDetailsServiceImpl userDetailsService,
            @Value("${app.cors.allowed-origin-patterns}") String allowedOriginPatterns) {
        this.jwtFilter = jwtFilter;
        this.userDetailsService = userDetailsService;
        this.allowedOriginPatterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(pattern -> !pattern.isEmpty())
                .toList();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Kimliksiz/süresi dolmuş token → 401 (mobil istemci 401'de refresh token ile
                // oturumu otomatik yeniler; varsayılan 403 bu mekanizmayı hiç tetiklemiyordu)
                .exceptionHandling(ex -> ex.authenticationEntryPoint(
                        (request, response, authException) ->
                                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/actuator/health/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/reset-password").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/verify-email").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/resend-verification").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/users/register").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/events").permitAll()
                        // Mobil konser listesi — etkinlikler zaten herkese acik
                        .requestMatchers(HttpMethod.GET, "/api/concerts").permitAll()
                        // Kullanıcıya özel doğrulama durumu — aşağıdaki genel
                        // "GET /api/events/**" permitAll kuralından ÖNCE gelmeli,
                        // yoksa anonim isteklere de açılıyor.
                        .requestMatchers(HttpMethod.GET, "/api/events/*/verify").authenticated()
                        // Kendi önerilerim — kullanıcıya özel, genel GET /api/events/**
                        // permitAll kuralından ÖNCE gelmeli.
                        .requestMatchers(HttpMethod.GET, "/api/events/suggestions/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/events/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/feed/trending").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/*/profile").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/comments").permitAll()
                        // Veri içe-aktarma/zenginleştirme — maliyetli dış API çağrıları + DB yazımı;
                        // kimliksiz tetiklenmesi suistimal/maliyet riski. Zamanlanmış sync ayrı
                        // @Scheduled metodundan çalışır, bu kısıtlamadan etkilenmez.
                        .requestMatchers(HttpMethod.POST, "/api/events/sync").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/events/enrich").hasRole("ADMIN")
                        // Doğrudan etkinlik oluşturma yalnızca admin (mobil /api/admin/events kullanır).
                        // Alt yollar (attendance/verify/bookmark/reviews/buddies) bu exact eşleşmeden etkilenmez.
                        .requestMatchers(HttpMethod.POST, "/api/events").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/events/*/approve").hasRole("ADMIN")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/events/*/attendance").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/events/*/attendance").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/artists/*/attendance").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/communities").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/communities/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/demo/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/artists/enrich").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/artists/enrich").hasRole("ADMIN")
                        // Yüklenen görseller — <Image> etiketleri auth header gönderemez
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                        // Yasal sayfalar (gizlilik/şartlar) — App Store reviewer'ı ve kullanıcılar
                        // tarayıcıdan kimliksiz erişebilmeli. classpath:/static/legal/*.html
                        .requestMatchers(HttpMethod.GET, "/legal/**").permitAll()
                        // Tanıtım sayfası — sosyal medya / Marketing URL, kimliksiz erişilebilir
                        .requestMatchers(HttpMethod.GET, "/promo", "/promo/**").permitAll()
                        // Paylaşım linkleri — linki alan kişi henüz kullanıcı değil;
                        // sayfa yalnızca herkese açık alanları gösterir, amacı uygulamayı açmak.
                        .requestMatchers(HttpMethod.GET, "/e/*", "/a/*", "/u/*", "/p/*", "/c/*").permitAll()
                        // Universal/App Link doğrulama dosyaları — Apple ve Google kimliksiz okur.
                        .requestMatchers(HttpMethod.GET, "/.well-known/**").permitAll()
                        .anyRequest().authenticated()

                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .authenticationProvider(authenticationProvider());

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider p = new DaoAuthenticationProvider(userDetailsService);
        p.setPasswordEncoder(passwordEncoder());
        return p;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration c) throws Exception {
        return c.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(allowedOriginPatterns);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(false);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
