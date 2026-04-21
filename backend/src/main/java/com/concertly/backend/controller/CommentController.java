package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreateCommentRequest;
import com.concertly.backend.dto.response.CommentResponse;
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

    // POST /api/posts/{postId}/comments
    // Body: { "userId": 1, "content": "Harika konserdi!" }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse addComment(
            @PathVariable Long postId,
            @RequestBody CreateCommentRequest request
    ) {
        return commentService.addComment(postId, request);
    }

    // GET /api/posts/{postId}/comments
    @GetMapping
    public List<CommentResponse> getComments(@PathVariable Long postId) {
        return commentService.getCommentsByPost(postId);
    }

    // DELETE /api/posts/{postId}/comments/{commentId}?userId=1
    // Faz 2'de userId parametresi JWT'den okunacak, burada geçici olarak query param
    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            @RequestParam Long userId
    ) {
        commentService.deleteComment(commentId, userId);
    }
}