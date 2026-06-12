package com.concertly.backend.repository;

import com.concertly.backend.model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("""
            SELECT m FROM Message m
            WHERE (m.sender.id = :userA AND m.receiver.id = :userB)
               OR (m.sender.id = :userB AND m.receiver.id = :userA)
            ORDER BY m.createdAt ASC
            """)
    List<Message> findConversation(@Param("userA") Long userA, @Param("userB") Long userB);

    @Query("""
            SELECT m FROM Message m
            WHERE m.sender.id = :userId OR m.receiver.id = :userId
            ORDER BY m.createdAt DESC
            """)
    List<Message> findAllInvolving(@Param("userId") Long userId);

    @Modifying
    @Query("""
            UPDATE Message m SET m.isRead = true
            WHERE m.sender.id = :partnerId AND m.receiver.id = :userId AND m.isRead = false
            """)
    void markConversationRead(@Param("userId") Long userId, @Param("partnerId") Long partnerId);

    long countByReceiverIdAndIsReadFalse(Long receiverId);
}
