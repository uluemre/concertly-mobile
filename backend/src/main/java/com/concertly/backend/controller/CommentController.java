package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.response.CommentResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.CommentService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts/{postId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(
            @PathVariable Long postId,
            @RequestBody CreateCommentRequest request
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        return commentService.addComment(userId, postId, request);
    }

    @GetMapping
    public List<CommentResponse> getComments(@PathVariable Long postId) {
        return commentService.getCommentsByPost(postId);
    }

    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @PathVariable Long postId,
            @PathVariable Long commentId
    ) {
        Long userId = JwtUtil.getCurrentUserId();
        commentService.deleteComment(commentId, userId);
    }
}