package com.concertly.backend.controller;

import com.concertly.backend.dto.request.CreatePostRequest;
import com.concertly.backend.dto.response.PostResponse;
import com.concertly.backend.service.PostService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        return postService.createPost(request);
    }

    @GetMapping("/feed/trending")
    public List<PostResponse> getTrending() {
        return postService.getTrendingFeed();
    }

    @GetMapping("/feed/following")
    public List<PostResponse> getFollowingFeed(@RequestParam Long userId) {
        return postService.getFollowingFeed(userId);
    }

    @PostMapping("/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void likePost(
            @PathVariable Long postId,
            @RequestParam Long userId
    ) {
        postService.likePost(userId, postId);
    }

    @DeleteMapping("/{postId}/like")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlikePost(
            @PathVariable Long postId,
            @RequestParam Long userId
    ) {
        postService.unlikePost(userId, postId);
    }
}