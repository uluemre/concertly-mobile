package com.concertly.backend.dto.response;

import com.concertly.backend.model.Comment;

import java.time.LocalDateTime;

public class CommentResponse {

    private Long id;
    private String content;
    private LocalDateTime createdAt;
    private Long postId;
    private Long userId;
    private String username;

    public static CommentResponse from(Comment comment) {
        CommentResponse dto = new CommentResponse();
        dto.id        = comment.getId();
        dto.content   = comment.getContent();
        dto.createdAt = comment.getCreatedAt();

        if (comment.getPost() != null) {
            dto.postId = comment.getPost().getId();
        }
        if (comment.getUser() != null) {
            dto.userId   = comment.getUser().getId();
            dto.username = comment.getUser().getUsername();
        }

        return dto;
    }

    public Long getId()                  { return id; }
    public String getContent()           { return content; }
    public LocalDateTime getCreatedAt()  { return createdAt; }
    public Long getPostId()              { return postId; }
    public Long getUserId()              { return userId; }
    public String getUsername()          { return username; }
}