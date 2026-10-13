package com.concertly.backend.config;

import com.concertly.backend.service.AppSettingsService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FeatureGateInterceptorTest {

    private final Map<String, Boolean> flags = new HashMap<>();
    private FeatureGateInterceptor gate;

    @BeforeEach
    void setUp() {
        AppSettingsService settings = mock(AppSettingsService.class);
        when(settings.isOn(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            return flags.getOrDefault(key, !key.equals(AppSettingsService.MAINTENANCE));
        });
        gate = new FeatureGateInterceptor(settings);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void loginAs(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "1:user", null, List.of(new SimpleGrantedAuthority(role))));
    }

    private ResponseStatusException blocked(String method, String path) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        return assertThrows(ResponseStatusException.class, () -> gate.preHandle(req, new MockHttpServletResponse(), null));
    }

    private void allowed(String method, String path) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        assertDoesNotThrow(() -> gate.preHandle(req, new MockHttpServletResponse(), null));
    }

    @Test
    void everythingOpenByDefault() {
        loginAs("ROLE_USER");
        allowed("GET", "/api/buddy/discover");
        allowed("POST", "/api/posts");
        allowed("POST", "/api/auth/register");
    }

    @Test
    void maintenanceBlocksUsersButNotConfigLoginOrAdmins() {
        flags.put(AppSettingsService.MAINTENANCE, true);
        loginAs("ROLE_USER");
        assertEquals(503, blocked("GET", "/api/events").getStatusCode().value());
        assertEquals("MAINTENANCE", blocked("POST", "/api/posts").getReason());
        allowed("GET", "/api/app/config");
        allowed("POST", "/api/auth/login");
        allowed("POST", "/api/auth/refresh");

        loginAs("ROLE_ADMIN");
        allowed("GET", "/api/events");
    }

    @Test
    void buddyFlagCoversBothBuddyApis() {
        flags.put(AppSettingsService.FEATURE_BUDDY, false);
        loginAs("ROLE_USER");
        assertEquals("FEATURE_DISABLED", blocked("GET", "/api/buddy/discover").getReason());
        blocked("POST", "/api/buddy/swipe");
        blocked("POST", "/api/events/12/buddies");
        allowed("GET", "/api/events/12");
    }

    @Test
    void gamesAndCommunitiesFlags() {
        flags.put(AppSettingsService.FEATURE_GAMES, false);
        flags.put(AppSettingsService.FEATURE_COMMUNITIES, false);
        loginAs("ROLE_USER");
        blocked("GET", "/api/quiz/questions");
        blocked("GET", "/api/daily-song/today");
        blocked("POST", "/api/bingo/5");
        blocked("GET", "/api/communities");
        blocked("GET", "/api/communities/3/posts");
        allowed("GET", "/api/concert-day/today");
    }

    @Test
    void postingFlagBlocksOnlyNewContent() {
        flags.put(AppSettingsService.FEATURE_POSTING, false);
        loginAs("ROLE_USER");
        blocked("POST", "/api/posts");
        blocked("POST", "/api/posts/9/comments");
        blocked("POST", "/api/communities/3/posts");
        blocked("POST", "/api/communities/3/posts/7/comments");
        allowed("GET", "/api/posts/feed/trending");
        allowed("POST", "/api/posts/9/like");
        allowed("DELETE", "/api/posts/9");
    }

    @Test
    void registrationAndSuggestionFlags() {
        flags.put(AppSettingsService.FEATURE_REGISTRATION, false);
        flags.put(AppSettingsService.FEATURE_EVENT_SUGGESTIONS, false);
        assertEquals("REGISTRATION_CLOSED", blocked("POST", "/api/auth/register").getReason());
        blocked("POST", "/api/users/register");
        allowed("POST", "/api/auth/login");
        loginAs("ROLE_USER");
        blocked("POST", "/api/events/suggest");
        allowed("GET", "/api/events/suggestions/me");
    }

    @Test
    void adminsBypassFeatureFlags() {
        flags.put(AppSettingsService.FEATURE_BUDDY, false);
        loginAs("ROLE_ADMIN");
        allowed("GET", "/api/buddy/discover");
    }
}
