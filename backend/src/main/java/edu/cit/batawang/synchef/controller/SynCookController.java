package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.SynCookCommentResponse;
import edu.cit.batawang.synchef.dto.SynCookDtos.CommentRequest;
import edu.cit.batawang.synchef.dto.SynCookDtos.ImageUploadResponse;
import edu.cit.batawang.synchef.dto.SynCookDtos.SynCookRecipeRequest;
import edu.cit.batawang.synchef.dto.SynCookRecipeResponse;
import edu.cit.batawang.synchef.security.AuthenticatedUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.service.SynCookService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Community dishes. Ownership and privacy are enforced in {@link SynCookService}.
 */
@RestController
@RequestMapping("/api/syncook")
@RequiredArgsConstructor
@Validated
public class SynCookController {

    private final SynCookService synCookService;
    private final RateLimiter rateLimiter;

    @GetMapping("/public")
    public List<SynCookRecipeResponse> publicFeed(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam(required = false) @Size(max = 120) String country) {
        return synCookService.publicFeed(user.id(), country);
    }

    @GetMapping("/mine")
    public List<SynCookRecipeResponse> mine(@AuthenticationPrincipal AuthenticatedUser user) {
        return synCookService.mine(user.id());
    }

    @GetMapping("/{id}")
    public SynCookRecipeResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return synCookService.get(id, user.id());
    }

    @PostMapping
    public ResponseEntity<SynCookRecipeResponse> create(@AuthenticationPrincipal AuthenticatedUser user,
                                                        @Valid @RequestBody SynCookRecipeRequest request) {
        rateLimiter.check("syncook-create:" + user.id(), 30);
        return ResponseEntity.status(HttpStatus.CREATED).body(synCookService.create(request, user.id()));
    }

    @PutMapping("/{id}")
    public SynCookRecipeResponse update(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id,
                                        @Valid @RequestBody SynCookRecipeRequest request) {
        return synCookService.update(id, request, user.id());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        synCookService.delete(id, user.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/comments")
    public List<SynCookCommentResponse> comments(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable Long id) {
        return synCookService.getComments(id, user.id());
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<SynCookCommentResponse> addComment(@AuthenticationPrincipal AuthenticatedUser user,
                                                             @PathVariable Long id,
                                                             @Valid @RequestBody CommentRequest request) {
        rateLimiter.check("comment:" + user.id(), 60);
        return ResponseEntity.status(HttpStatus.CREATED).body(synCookService.addComment(id, request, user.id()));
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImageUploadResponse uploadImage(@AuthenticationPrincipal AuthenticatedUser user,
                                           @RequestParam("file") MultipartFile file) {
        rateLimiter.check("upload:" + user.id(), 20);
        return new ImageUploadResponse(synCookService.uploadImage(file, user.id()));
    }
}
