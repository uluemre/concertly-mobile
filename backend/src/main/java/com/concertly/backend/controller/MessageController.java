package com.concertly.backend.controller;

import com.concertly.backend.dto.response.ConversationResponse;
import com.concertly.backend.dto.response.MessageResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.MessageService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse send(@RequestBody Map<String, Object> body) {
        Long myId = JwtUtil.getCurrentUserId();
        Long receiverId = Long.valueOf(body.get("receiverId").toString());
        String content = body.get("content") != null ? body.get("content").toString() : null;
        return messageService.send(myId, receiverId, content);
    }

    @GetMapping("/conversations")
    public List<ConversationResponse> conversations() {
        return messageService.getConversations(JwtUtil.getCurrentUserId());
    }

    @GetMapping("/with/{userId}")
    public List<MessageResponse> conversation(@PathVariable Long userId) {
        return messageService.getConversation(JwtUtil.getCurrentUserId(), userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", messageService.getUnreadCount(JwtUtil.getCurrentUserId()));
    }
}
