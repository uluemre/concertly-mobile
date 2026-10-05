package com.concertly.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SecurityConfig'i gerçek HTTP katmanından sınar: kimliksiz istek 401, yetkisiz rol 403,
 * herkese açık uçlar oturumsuz erişilebilir. Kullanıcı yükleme taklit edilir; DB'de
 * kullanıcı gerekmez (yalnız açık uçlar yerel veritabanından okur).
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityRoutesTest {

    private static final long USER_ID = 900_001L, ADMIN_ID = 900_002L, BANNED_ID = 900_003L, GHOST_ID = 900_004L;

    @Autowired MockMvc mvc;
    @Autowired JwtUtil jwtUtil;
    @MockitoBean UserDetailsServiceImpl userDetailsService;

    @BeforeEach
    void users() {
        when(userDetailsService.loadUserById(anyLong())).thenAnswer(i -> {
            long id = i.getArgument(0);
            if (id == USER_ID) return User.withUsername(id + ":user@test.local").password("x").roles("USER").build();
            if (id == ADMIN_ID) return User.withUsername(id + ":admin@test.local").password("x").roles("USER", "ADMIN").build();
            if (id == BANNED_ID) return User.withUsername(id + ":banned@test.local").password("x").roles("USER").disabled(true).build();
            throw new UsernameNotFoundException("yok");
        });
    }

    private String bearer(long id) {
        return "Bearer " + jwtUtil.generateToken(id, "x" + id + "@test.local");
    }

    private ResultActions getAs(String path, Long id) throws Exception {
        var req = get(path);
        if (id != null) req.header("Authorization", bearer(id));
        return mvc.perform(req);
    }

    // ── Kimlik ──────────────────────────────────────────────────────────────

    @Test
    void protectedRouteWithoutTokenIs401() throws Exception {
        getAs("/api/notifications/unread-count", null).andExpect(status().isUnauthorized());
    }

    @Test
    void garbageTokenIs401() throws Exception {
        mvc.perform(get("/api/notifications/unread-count").header("Authorization", "Bearer bozuk.token.degeri"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bannedUserTokenIs401() throws Exception {
        getAs("/api/notifications/unread-count", BANNED_ID).andExpect(status().isUnauthorized());
    }

    @Test
    void tokenOfDeletedUserIs401Not500() throws Exception {
        getAs("/api/notifications/unread-count", GHOST_ID).andExpect(status().isUnauthorized());
    }

    // ── Admin uçları ────────────────────────────────────────────────────────

    @Test
    void adminRoutesRejectAnonymousAndNormalUsers() throws Exception {
        getAs("/api/admin/moderation/reports", null).andExpect(status().isUnauthorized());
        getAs("/api/admin/moderation/reports", USER_ID).andExpect(status().isForbidden());
        getAs("/api/admin/merge/duplicates/dry-run", USER_ID).andExpect(status().isForbidden());
    }

    @Test
    void costlyEventActionsAreAdminOnly() throws Exception {
        mvc.perform(post("/api/events/sync").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/events/enrich").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/artists/enrich").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/demo/setup").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPassesSecurityLayer() throws Exception {
        int s = getAs("/api/admin/moderation/reports", ADMIN_ID).andReturn().getResponse().getStatus();
        assertNotEquals(401, s);
        assertNotEquals(403, s);
    }

    // ── Herkese açık uçlar ──────────────────────────────────────────────────

    @Test
    void publicPagesNeedNoToken() throws Exception {
        getAs("/legal/privacy.html", null).andExpect(status().isOk());
        getAs("/.well-known/assetlinks.json", null).andExpect(status().isOk());
    }

    @Test
    void publicReadEndpointsAreNotBlockedForAnonymous() throws Exception {
        for (String path : new String[]{"/api/events?limit=1", "/api/communities", "/api/posts/feed/trending"}) {
            int s = getAs(path, null).andReturn().getResponse().getStatus();
            assertNotEquals(401, s, path);
            assertNotEquals(403, s, path);
        }
    }
}
