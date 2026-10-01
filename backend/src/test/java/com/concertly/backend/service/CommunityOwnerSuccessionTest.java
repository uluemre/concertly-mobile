package com.concertly.backend.service;

import com.concertly.backend.model.Community;
import com.concertly.backend.model.CommunityMember;
import com.concertly.backend.model.User;
import com.concertly.backend.repository.CommunityMemberRepository;
import com.concertly.backend.repository.CommunityRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** B1: sahip hesabı silinince topluluk silinmez, sahiplik uygun üyeye devredilir. */
class CommunityOwnerSuccessionTest {

    private static final long DELETED = 1L;
    private static final String NULL_OWNER_SQL = "UPDATE Community c SET c.owner = null WHERE c.owner.id = :uid";
    private static final String DEL_MEMBERS_SQL = "DELETE FROM CommunityMember cm WHERE cm.user.id = :uid";

    private CommunityRepository communityRepository;
    private CommunityMemberRepository memberRepository;
    private NotificationService notificationService;
    private PlatformTransactionManager txManager;
    private EntityManager em;
    private Query query;
    private AccountDeletionService service;
    private final List<String> jpql = new ArrayList<>();

    @BeforeEach
    void setUp() {
        communityRepository = mock(CommunityRepository.class);
        memberRepository = mock(CommunityMemberRepository.class);
        notificationService = mock(NotificationService.class);
        txManager = mock(PlatformTransactionManager.class);
        em = mock(EntityManager.class);
        query = mock(Query.class);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(em.createQuery(anyString())).thenAnswer(inv -> {
            jpql.add(inv.getArgument(0));
            return query;
        });
        when(em.find(eq(User.class), eq(DELETED))).thenReturn(user(DELETED));
        service = new AccountDeletionService(communityRepository, memberRepository, notificationService, txManager);
        ReflectionTestUtils.setField(service, "em", em);
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static Community community(long id, User owner) {
        Community c = new Community();
        ReflectionTestUtils.setField(c, "id", id);
        c.setName("C" + id);
        c.setOwner(owner);
        return c;
    }

    private static CommunityMember member(long id, User u, String role) {
        CommunityMember m = new CommunityMember();
        ReflectionTestUtils.setField(m, "id", id);
        m.setUser(u);
        m.setRole(role);
        return m;
    }

    private void stubCandidates(long communityId, String role, CommunityMember... result) {
        when(memberRepository.findSuccessorCandidates(eq(communityId), eq(DELETED), eq(role), any(Pageable.class)))
                .thenReturn(List.of(result));
    }

    @Test
    void activeModeratorBecomesOwner() {
        Community c = community(10, user(DELETED));
        CommunityMember mod = member(5, user(2), "MODERATOR");
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR", mod);

        service.deleteAccount(DELETED, "r", null);

        assertEquals("OWNER", mod.getRole());
        assertEquals("ACTIVE", mod.getStatus());
        assertEquals(2L, c.getOwner().getId());
        verify(memberRepository).save(mod);
        verify(communityRepository).save(c);
        verify(notificationService).sendSystem(eq(2L), eq("community_ownership"), eq("community"), eq(10L), anyString());
        // Moderatör varken MEMBER katmanı hiç sorgulanmaz
        verify(memberRepository, never()).findSuccessorCandidates(anyLong(), anyLong(), eq("MEMBER"), any());
    }

    private void runWithSynchronization(boolean commit) {
        Community c = community(10, user(DELETED));
        CommunityMember mod = member(5, user(2), "MODERATOR");
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR", mod);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.deleteAccount(DELETED, "r", null);
            // commit öncesi gönderilmemeli
            verify(notificationService, never()).sendSystem(any(), any(), any(), any(), any());
            List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, syncs.size());
            if (commit) {
                syncs.forEach(TransactionSynchronization::afterCommit);
            }
            syncs.forEach(s -> s.afterCompletion(commit
                    ? TransactionSynchronization.STATUS_COMMITTED : TransactionSynchronization.STATUS_ROLLED_BACK));
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void ownershipNotificationSentOnlyAfterCommitWhenSynchronizationActive() {
        runWithSynchronization(true);
        verify(notificationService).sendSystem(eq(2L), eq("community_ownership"), eq("community"), eq(10L),
                eq("\"C10\" toplulugunun sahipligi size devredildi."));
    }

    @Test
    void afterCommitSendRunsInRequiresNewTransaction() {
        runWithSynchronization(true);
        ArgumentCaptor<TransactionDefinition> def = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(txManager).getTransaction(def.capture());
        assertEquals(TransactionDefinition.PROPAGATION_REQUIRES_NEW, def.getValue().getPropagationBehavior());
    }

    @Test
    void ownershipNotificationNotSentOnRollback() {
        runWithSynchronization(false);
        verify(notificationService, never()).sendSystem(any(), any(), any(), any(), any());
    }

    @Test
    void noModeratorFallsBackToActiveMember() {
        Community c = community(10, user(DELETED));
        CommunityMember m = member(7, user(3), "MEMBER");
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR");
        stubCandidates(10, "MEMBER", m);

        service.deleteAccount(DELETED, "r", null);

        assertEquals("OWNER", m.getRole());
        assertEquals(3L, c.getOwner().getId());
    }

    @Test
    void queryAsksOnlyTopOneAndExcludesDeletedUser() {
        Community c = community(10, user(DELETED));
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR");
        stubCandidates(10, "MEMBER");

        service.deleteAccount(DELETED, "r", null);

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(memberRepository).findSuccessorCandidates(eq(10L), eq(DELETED), eq("MODERATOR"), page.capture());
        assertEquals(PageRequest.of(0, 1), page.getValue());
    }

    /**
     * Sıralama ve uygunluk JPQL'de: mock ile satır sıralanamaz, bu yüzden sorgu metni sözleşme olarak sabitlenir
     * (en erken joinedAt, eşitlikte en küçük id; yalnızca ACTIVE; silinen hariç; NULL rol = MEMBER).
     */
    @Test
    void selectionQueryEncodesEligibilityAndDeterministicOrdering() throws Exception {
        var m = CommunityMemberRepository.class.getMethod("findSuccessorCandidates",
                Long.class, Long.class, String.class, Pageable.class);
        String q = m.getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        assertTrue(q.contains("m.status = 'ACTIVE'"), "yalnızca ACTIVE aday olmalı");
        assertTrue(q.contains("m.user.id <> :excludeUserId"), "silinen kullanıcı hariç");
        assertTrue(q.contains("COALESCE(m.role, 'MEMBER') = :role"), "NULL rol MEMBER sayılır");
        assertTrue(q.contains("ORDER BY m.joinedAt ASC, m.id ASC"), "joinedAt sonra id tiebreak");
        assertFalse(q.contains("PENDING") || q.contains("INVITED") || q.contains("BANNED"));
    }

    @Test
    void noCandidatesArchivesCommunityWithoutDeletingOrReassigning() {
        Community c = community(10, user(DELETED));
        assertNull(c.getArchivedAt());
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR");
        stubCandidates(10, "MEMBER");

        service.deleteAccount(DELETED, "r", null);

        // B1-bos: arsivlendi, yeni sahip atanmadi (owner'i toplu UPDATE null yapar), icerik/uyelik silinmedi
        assertNotNull(c.getArchivedAt());
        assertTrue(c.isArchived());
        assertEquals(DELETED, c.getOwner().getId(), "yeni owner atanmamali; null'lama toplu UPDATE'te");
        verify(communityRepository).save(c);
        verify(communityRepository, never()).delete(any());
        verify(communityRepository, never()).deleteById(any());
        verify(memberRepository, never()).save(any());
        verify(memberRepository, never()).deleteByCommunityId(anyLong());
        verify(notificationService, never()).sendSystem(any(), any(), any(), any(), any());
        assertTrue(jpql.contains(NULL_OWNER_SQL));
        assertTrue(jpql.stream().noneMatch(s -> s.startsWith("DELETE FROM Community ")));
    }

    @Test
    void multipleOwnedCommunitiesHandledIndependently() {
        Community c1 = community(10, user(DELETED));
        Community c2 = community(11, user(DELETED));
        CommunityMember mod = member(5, user(2), "MODERATOR");
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c1, c2));
        stubCandidates(10, "MODERATOR", mod);
        stubCandidates(11, "MODERATOR");
        stubCandidates(11, "MEMBER");

        service.deleteAccount(DELETED, "r", null);

        assertEquals(2L, c1.getOwner().getId());
        assertEquals(DELETED, c2.getOwner().getId()); // aday yok: JPQL UPDATE owner=null yapar
        assertNull(c1.getArchivedAt(), "devredilen topluluk arşivlenmez");
        assertNotNull(c2.getArchivedAt(), "adaysız topluluk arşivlenir");
        verify(communityRepository).save(c1);
        verify(communityRepository).save(c2);
    }

    @Test
    void onlyDeletedUsersOwnMembershipRowsAreDeleted() {
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of());

        service.deleteAccount(DELETED, "r", null);

        assertTrue(jpql.contains(DEL_MEMBERS_SQL));
        assertTrue(jpql.stream().noneMatch(s -> s.startsWith("DELETE FROM Community ")),
                "topluluk satırı silinmemeli");
        verify(memberRepository, never()).deleteByCommunityId(anyLong());
        verify(memberRepository, never()).deleteAll();
    }

    @Test
    void transferRunsBeforeOwnerNullingAndMemberDeletion() {
        Community c = community(10, user(DELETED));
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR", member(5, user(2), "MODERATOR"));

        service.deleteAccount(DELETED, "r", null);

        var order = inOrder(communityRepository, em);
        order.verify(communityRepository).save(c);
        order.verify(em).flush();
        order.verify(em).createQuery(NULL_OWNER_SQL);
        order.verify(em).createQuery(DEL_MEMBERS_SQL);
    }

    @Test
    void deleteAccountIsTransactionalAndLaterFailurePropagates() throws Exception {
        assertNotNull(AccountDeletionService.class
                .getMethod("deleteAccount", Long.class, String.class, String.class)
                .getAnnotation(Transactional.class), "atomiklik için @Transactional şart");

        Community c = community(10, user(DELETED));
        when(communityRepository.findByOwnerId(DELETED)).thenReturn(List.of(c));
        stubCandidates(10, "MODERATOR", member(5, user(2), "MODERATOR"));
        // Devirden sonraki bir silme başarısız olursa istisna yutulmaz; Spring tüm transaction'ı geri alır
        Query failing = mock(Query.class);
        when(failing.setParameter(anyString(), any())).thenReturn(failing);
        when(failing.executeUpdate()).thenThrow(new IllegalStateException("db down"));
        when(em.createQuery(DEL_MEMBERS_SQL)).thenReturn(failing);

        assertThrows(IllegalStateException.class, () -> service.deleteAccount(DELETED, "r", null));
    }
}
