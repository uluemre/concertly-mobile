package com.concertly.backend.service;

import com.concertly.backend.model.Post;
import com.concertly.backend.model.Report;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Moderasyon kuyruğu kararları: tek kararla bütün şikâyetler kapanır, uyarı/yasak sahibine gider. */
class ModerationQueueServiceTest {

    private final ReportRepository reports = mock(ReportRepository.class);
    private final PostRepository posts = mock(PostRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final AdminModerationService moderation = mock(AdminModerationService.class);
    private final AdminUserService adminUsers = mock(AdminUserService.class);
    private final ModerationQueueService service = new ModerationQueueService(reports, posts,
            mock(CommentRepository.class), mock(CommunityPostRepository.class), mock(CommunityPostCommentRepository.class),
            mock(MessageRepository.class), users, moderation, adminUsers, mock(JdbcTemplate.class));

    private User owner;
    private List<Report> open;

    @BeforeEach
    void setUp() {
        owner = new User();
        ReflectionTestUtils.setField(owner, "id", 30L);
        Post post = new Post();
        ReflectionTestUtils.setField(post, "id", 5L);
        post.setUser(owner);
        when(posts.findById(5L)).thenReturn(Optional.of(post));
        when(users.findById(30L)).thenReturn(Optional.of(owner));

        open = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Report r = new Report();
            r.setTargetType("POST");
            r.setTargetId(5L);
            open.add(r);
        }
        when(reports.findByTargetTypeAndTargetIdAndResolvedFalse("POST", 5L)).thenReturn(open);
        when(reports.findByTargetTypeAndTargetIdAndResolvedFalse("USER", 30L)).thenReturn(new ArrayList<>());
    }

    private static String reason(Runnable r) {
        return assertThrows(ResponseStatusException.class, r::run).getReason();
    }

    @Test
    void dismissClosesEveryReportOfTheContent() {
        String detail = service.act("POST", 5L, "DISMISS", null, null, 1L, "d");
        assertTrue(open.stream().allMatch(r -> r.isResolved() && "DISMISS".equals(r.getResolution()) && "d".equals(r.getResolvedBy())));
        verifyNoInteractions(moderation, adminUsers);
        assertTrue(detail.contains("3 şikâyet"));
    }

    @Test
    void hideAndWarnHidesNotifiesOwnerAndCloses() {
        service.act("POST", 5L, "HIDE_WARN", "Hakaret içeriyor", null, 1L, "d");
        verify(moderation).setContentHidden("POST", 5L, true);
        verify(adminUsers).warn(30L, "Hakaret içeriyor", "d");
        verify(adminUsers, never()).ban(anyLong(), any(), any(), any(), any());
        assertTrue(open.stream().allMatch(r -> "HIDE_WARN".equals(r.getResolution())));
    }

    @Test
    void hideAndBanUsesDurationAndDefaultReason() {
        service.act("POST", 5L, "HIDE_BAN", " ", 7, 1L, "d");
        verify(adminUsers).ban(30L, "Topluluk kurallarına aykırı içerik", 7, 1L, "d");
        verify(moderation).setContentHidden("POST", 5L, true);
    }

    @Test
    void failedBanLeavesContentAndReportsUntouched() {
        when(adminUsers.ban(anyLong(), any(), any(), any(), any()))
                .thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "CANNOT_BAN_ADMIN"));
        assertEquals("CANNOT_BAN_ADMIN", reason(() -> service.act("POST", 5L, "HIDE_BAN", "x", 1, 1L, "d")));
        verifyNoInteractions(moderation);
        assertTrue(open.stream().noneMatch(Report::isResolved));
    }

    @Test
    void usersCanBeWarnedButNotHidden() {
        assertEquals("NOT_HIDEABLE", reason(() -> service.act("USER", 30L, "HIDE", null, null, 1L, "d")));
        service.act("USER", 30L, "WARN", "Sahte profil", null, 1L, "d");
        verify(adminUsers).warn(30L, "Sahte profil", "d");
    }

    @Test
    void unhideDoesNotCloseReports() {
        service.act("POST", 5L, "UNHIDE", null, null, 1L, "d");
        verify(moderation).setContentHidden("POST", 5L, false);
        assertTrue(open.stream().noneMatch(Report::isResolved));
    }

    @Test
    void invalidActionRejected() {
        assertEquals("INVALID_ACTION", reason(() -> service.act("POST", 5L, "DELETE", null, null, 1L, "d")));
    }

    @Test
    void bulkHideSkipsUsersAndOnlyAllowsSafeActions() {
        String detail = service.bulk(List.of(
                Map.of("targetType", "POST", "targetId", 5),
                Map.of("targetType", "USER", "targetId", 30)), "HIDE", "d");
        verify(moderation).setContentHidden("POST", 5L, true);
        verify(moderation, never()).setContentHidden(eq("USER"), anyLong(), anyBoolean());
        assertTrue(detail.contains("1 içerik"));
        assertEquals("INVALID_ACTION", reason(() -> service.bulk(List.of(Map.of("targetType", "POST", "targetId", 5)), "BAN", "d")));
    }

    @Test
    void typeFilters() {
        assertEquals(java.util.Set.of("COMMUNITY_POST", "COMMUNITY_COMMENT"), ModerationQueueService.typesOf("community"));
        assertNull(ModerationQueueService.typesOf("all"));
    }
}
