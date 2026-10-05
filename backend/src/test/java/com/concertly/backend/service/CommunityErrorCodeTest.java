package com.concertly.backend.service;

import com.concertly.backend.exception.ResourceNotFoundException;
import com.concertly.backend.model.*;
import com.concertly.backend.repository.*;
import com.concertly.backend.security.AuthRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * C5: topluluk hataları ham Türkçe cümle değil, mobilin çevirdiği kod döner
 * (İngilizce arayüzde Türkçe hata görünmesin).
 */
class CommunityErrorCodeTest {

    private static final long CID = 10;

    private final Map<String, CommunityMember> members = new HashMap<>();
    private final Map<Long, User> users = new HashMap<>();
    private Community community;
    private CommunityService service;

    private static <T> T withId(T e, long id) {
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    private void member(long userId, String role, String status) {
        CommunityMember m = new CommunityMember();
        m.setUser(users.get(userId));
        m.setCommunity(community);
        m.setRole(role);
        m.setStatus(status);
        members.put(userId + ":" + CID, m);
    }

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 4; id++) {
            User u = withId(new User(), id);
            u.setUsername("u" + id);
            users.put(id, u);
        }
        community = withId(new Community(), CID);
        community.setName("c");
        community.setVisibility("PUBLIC");
        community.setApprovalStatus("APPROVED");
        community.setOwner(users.get(1L));
        member(1, "OWNER", "ACTIVE");
        member(2, "MEMBER", "PENDING");

        CommunityRepository communityRepo = mock(CommunityRepository.class);
        CommunityMemberRepository memberRepo = mock(CommunityMemberRepository.class);
        UserRepository userRepo = mock(UserRepository.class);
        when(communityRepo.findById(anyLong())).thenAnswer(i ->
                Optional.ofNullable(i.<Long>getArgument(0) == CID ? community : null));
        when(userRepo.findById(anyLong())).thenAnswer(i -> Optional.ofNullable(users.get(i.<Long>getArgument(0))));
        when(memberRepo.findByUserIdAndCommunityId(anyLong(), anyLong()))
                .thenAnswer(i -> Optional.ofNullable(members.get(i.<Long>getArgument(0) + ":" + i.<Long>getArgument(1))));

        service = new CommunityService(communityRepo, memberRepo, mock(CommunityPostRepository.class),
                mock(CommunityPostLikeRepository.class), mock(CommunityPostCommentRepository.class),
                mock(CommunityPostPollOptionRepository.class), mock(CommunityPostPollVoteRepository.class),
                userRepo, mock(NotificationService.class), mock(NotificationRepository.class), mock(ModerationService.class),
                mock(ContentLimitService.class), new AuthRateLimiter());
    }

    @Test
    void ownerLeavingGetsCode() {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.leaveCommunity(1L, CID));
        assertEquals("COMMUNITY_OWNER_CANNOT_LEAVE", e.getMessage());
    }

    @Test
    void nonMemberLeavingGetsCode() {
        ResourceNotFoundException e = assertThrows(ResourceNotFoundException.class,
                () -> service.leaveCommunity(3L, CID));
        assertEquals("COMMUNITY_NOT_MEMBER", e.getMessage());
    }

    @Test
    void transferChecksReturnCodes() {
        assertEquals("COMMUNITY_TRANSFER_TO_SELF", assertThrows(IllegalArgumentException.class,
                () -> service.transferOwnership(1L, CID, 1L)).getMessage());
        assertEquals("COMMUNITY_TRANSFER_ACTIVE_ONLY", assertThrows(IllegalArgumentException.class,
                () -> service.transferOwnership(1L, CID, 2L)).getMessage());
        assertEquals("COMMUNITY_TRANSFER_TARGET_NOT_FOUND", assertThrows(ResourceNotFoundException.class,
                () -> service.transferOwnership(1L, CID, 4L)).getMessage());
        assertEquals("COMMUNITY_OWNER_ONLY_TRANSFER", assertThrows(ResponseStatusException.class,
                () -> service.transferOwnership(2L, CID, 1L)).getReason());
    }

    /**
     * Gerileme kalkanı: kullanıcının tetikleyebildiği hata türlerinde (400/409/403) mesaj
     * her zaman BÜYÜK_HARF kod olmalı. Yeni bir Türkçe cümle eklenirse bu test kırılır.
     */
    @Test
    void serviceThrowsOnlyCodesForUserFacingErrors() throws Exception {
        String src = Files.readString(Path.of("src/main/java/com/concertly/backend/service/CommunityService.java"));
        Matcher m = Pattern.compile(
                "(?:IllegalArgumentException|AlreadyExistsException|forbidden)\\(\\s*\"([^\"]*)\"").matcher(src);
        List<String> notCodes = new ArrayList<>();
        int checked = 0;
        while (m.find()) {
            checked++;
            if (!m.group(1).matches("[A-Z][A-Z0-9_]+")) notCodes.add(m.group(1));
        }
        assertTrue(checked > 20, "tarama hiçbir şey bulmadı: " + checked);
        assertEquals(List.of(), notCodes);
    }
}
