package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.PollOptionDto;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.security.JwtUtil;
import com.concertly.backend.service.PostService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse createPost(@RequestBody CreatePostRequest request) {
        Long userId = JwtUtil.getCurrentUserId();
        return postService.createPost(userId, request);
    }

    @GetMapping("/feed/trending")
    public List<PostResponse> getTrending(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = JwtUtil.getCurrentUserId();
        return postService.getTrendingFeed(userId, page, size);
    }

    @PostMapping("/{postId}/poll/vote")
    public List<PollOptionDto> votePoll(@PathVariable Long postId, @RequestParam Long optionId) {
        Long userId = JwtUtil.getCurrentUserId();
        return postService.votePoll(userId, postId, optionId);
    }

    @GetMapping("/feed/following")
    public List<PostResponse> getFollowingFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Long userId = JwtUtil.getCurrentUserId();
        return postService.getFollowingFeed(userId, page, size);
    }

    @PostMapping("/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void likePost(@PathVariable Long postId) {
        Long userId = JwtUtil.getCurrentUserId();
        postService.likePost(userId, postId);
    }

    @DeleteMapping("/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlikePost(@PathVariable Long postId) {
        Long userId = JwtUtil.getCurrentUserId();
        postService.unlikePost(userId, postId);
    }

    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@PathVariable Long postId) {
        Long userId = JwtUtil.getCurrentUserId();
        postService.deletePost(userId, postId);
    }

    @PatchMapping("/{postId}")
    public PostResponse updatePost(@PathVariable Long postId, @RequestBody Map<String, String> body) {
        Long userId = JwtUtil.getCurrentUserId();
        return postService.updatePost(userId, postId, body.get("content"));
    }
}