package com.concertly.backend.service;

import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommentRepository;
import com.concertly.backend.repository.MessageRepository;
import com.concertly.backend.repository.PostRepository;
import com.concertly.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Yeni hesap spam tavanı: kötüye kullanımı yavaşlatmalı, normal kullanıcıyı engellememeli. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ContentLimitServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PostRepository postRepository;
    @Mock private CommentRepository commentRepository;
    @Mock private MessageRepository messageRepository;

    private ContentLimitService service(long newAccountHours) {
        return new ContentLimitService(userRepository, postRepository, commentRepository,
                messageRepository, newAccountHours, 10, 50, 50);
    }

    private void userCreated(LocalDateTime createdAt) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 1L);
        ReflectionTestUtils.setField(u, "createdAt", createdAt);
        when(userRepository.findById(1L)).thenReturn(Optional.of(u));
    }

    @Test
    void newAccountHittingCapIsRejected() {
        userCreated(LocalDateTime.now().minusHours(2));
        when(postRepository.countByUserIdAndCreatedAtAfter(eq(1L), any())).thenReturn(10L);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service(48).checkPost(1L));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
    }

    @Test
    void newAccountUnderCapIsAllowed() {
        userCreated(LocalDateTime.now().minusHours(2));
        when(postRepository.countByUserIdAndCreatedAtAfter(eq(1L), any())).thenReturn(3L);

        assertDoesNotThrow(() -> service(48).checkPost(1L));
    }

    /** Hesap olgunlaştıktan sonra sayım bile yapılmamalı. */
    @Test
    void establishedAccountIsNotLimited() {
        userCreated(LocalDateTime.now().minusDays(30));

        assertDoesNotThrow(() -> service(48).checkPost(1L));
        verify(postRepository, never()).countByUserIdAndCreatedAtAfter(any(), any());
    }

    @Test
    void limitCanBeDisabledWithZeroHours() {
        assertDoesNotThrow(() -> service(0).checkMessage(1L));
        verify(userRepository, never()).findById(any());
    }

    /** Kayıt tarihi bilinmeyen eski kullanıcılar cezalandırılmamalı. */
    @Test
    void userWithoutCreatedAtIsNotLimited() {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", 1L);
        ReflectionTestUtils.setField(u, "createdAt", null);
        when(userRepository.findById(1L)).thenReturn(Optional.of(u));

        assertDoesNotThrow(() -> service(48).checkComment(1L));
    }
}
