package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.SynCookCommentResponse;
import edu.cit.batawang.synchef.dto.SynCookDtos.CommentRequest;
import edu.cit.batawang.synchef.dto.SynCookDtos.SynCookRecipeRequest;
import edu.cit.batawang.synchef.dto.SynCookRecipeResponse;
import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.SynCookComment;
import edu.cit.batawang.synchef.model.SynCookRecipe;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.SynCookCommentRepository;
import edu.cit.batawang.synchef.repository.SynCookRecipeRepository;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Community dishes ("SynCook"): sharing, privacy, ownership and live comment threads.
 */
@Service
@RequiredArgsConstructor
public class SynCookService {

    private static final Pattern DATA_IMAGE = Pattern.compile("^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\\s]+$");

    private final SynCookRecipeRepository recipeRepository;
    private final SynCookCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ProfileImageStorageService imageStorage;
    private final RealtimePublisher realtime;
    private final AdminStatsService adminStats;

    @Transactional(readOnly = true)
    public List<SynCookRecipeResponse> publicFeed(Long requesterId, String country) {
        List<SynCookRecipe> recipes = country == null || country.isBlank()
                ? recipeRepository.findByPrivacyOrderByCreatedAtDesc("PUBLIC")
                : recipeRepository.findPublicByCountry(country.trim());
        return toSummaries(recipes, requesterId);
    }

    @Transactional(readOnly = true)
    public List<SynCookRecipeResponse> mine(Long requesterId) {
        return toSummaries(recipeRepository.findByOwnerIdOrderByUpdatedAtDesc(requesterId), requesterId);
    }

    @Transactional(readOnly = true)
    public SynCookRecipeResponse get(Long id, Long requesterId) {
        SynCookRecipe recipe = require(id);
        enforceCanRead(recipe, requesterId);
        return toResponse(recipe, requesterId, comments(id), commentRepository.countByRecipeId(id));
    }

    @Transactional(readOnly = true)
    public boolean canRead(Long recipeId, Long requesterId) {
        return recipeRepository.findById(recipeId)
                .map(r -> r.getOwnerId().equals(requesterId) || "PUBLIC".equalsIgnoreCase(r.getPrivacy()))
                .orElse(false);
    }

    @Transactional
    public SynCookRecipeResponse create(SynCookRecipeRequest request, Long requesterId) {
        User user = userRepository.findById(requesterId).orElseThrow(() -> ApiException.unauthorized("Please sign in"));
        SynCookRecipe recipe = new SynCookRecipe();
        apply(recipe, request, true);
        recipe.setOwnerId(user.getId());
        recipe.setOwnerName(user.displayName());
        SynCookRecipe saved = recipeRepository.save(recipe);
        adminStats.broadcastStats();
        return toResponse(saved, requesterId, List.of(), 0);
    }

    @Transactional
    public SynCookRecipeResponse update(Long id, SynCookRecipeRequest request, Long requesterId) {
        SynCookRecipe recipe = require(id);
        enforceOwner(recipe, requesterId);
        String previousImage = recipe.getImageUrl();
        apply(recipe, request, false);
        if (previousImage != null && !previousImage.equals(recipe.getImageUrl())) {
            imageStorage.deleteIfLocal(previousImage);
        }
        SynCookRecipe saved = recipeRepository.save(recipe);
        return toResponse(saved, requesterId, comments(id), commentRepository.countByRecipeId(id));
    }

    @Transactional
    public void delete(Long id, Long requesterId) {
        SynCookRecipe recipe = require(id);
        enforceOwner(recipe, requesterId);
        deleteRecipe(recipe);
        adminStats.broadcastStats();
    }

    /** Removes a dish with its comments and uploaded image (owner deletion or account deletion). */
    @Transactional
    public void deleteRecipe(SynCookRecipe recipe) {
        commentRepository.deleteByRecipeId(recipe.getId());
        imageStorage.deleteIfLocal(recipe.getImageUrl());
        recipeRepository.delete(recipe);
    }

    @Transactional(readOnly = true)
    public List<SynCookCommentResponse> getComments(Long id, Long requesterId) {
        SynCookRecipe recipe = require(id);
        enforceCanRead(recipe, requesterId);
        return comments(id);
    }

    @Transactional
    public SynCookCommentResponse addComment(Long id, CommentRequest request, Long requesterId) {
        User user = userRepository.findById(requesterId).orElseThrow(() -> ApiException.unauthorized("Please sign in"));
        SynCookRecipe recipe = require(id);
        enforceCanRead(recipe, requesterId);

        SynCookComment comment = new SynCookComment();
        comment.setRecipe(recipe);
        comment.setAuthorId(user.getId());
        comment.setAuthorName(user.displayName());
        comment.setContent(request.content().trim());
        SynCookComment saved = commentRepository.save(comment);

        notificationService.createCommentNotification(recipe, user, saved.getContent());
        SynCookCommentResponse response = toComment(saved);
        realtime.toTopic("/topic/syncook/" + id + "/comments", response);
        adminStats.broadcastStats();
        return response;
    }

    public String uploadImage(MultipartFile file, Long requesterId) {
        return imageStorage.store(file, ProfileImageStorageService.SYNCOOK_IMAGES, "dish-" + requesterId);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private SynCookRecipe require(Long id) {
        return recipeRepository.findById(id).orElseThrow(() -> ApiException.notFound("Dish not found"));
    }

    private void apply(SynCookRecipe recipe, SynCookRecipeRequest request, boolean creating) {
        List<String> ingredients = cleanLines(request.ingredients());
        List<String> procedures = cleanLines(request.procedures());
        if (ingredients.isEmpty()) throw ApiException.badRequest("Add at least one ingredient");
        if (procedures.isEmpty()) throw ApiException.badRequest("Add at least one procedure step");

        recipe.setTitle(request.title().trim());
        recipe.setCountry(request.country().trim());
        recipe.setIngredients(ingredients);
        recipe.setProcedures(procedures);
        recipe.setPrivacy("PRIVATE".equalsIgnoreCase(request.privacy()) ? "PRIVATE" : "PUBLIC");

        String image = validateImage(request.imageUrl());
        if (creating || image != null) {
            recipe.setImageUrl(image);
        }
    }

    /**
     * Accepts images uploaded through {@code /api/syncook/images}, absolute http(s) URLs, or (for
     * dishes created before uploads existed) base64 data URLs. Anything else — e.g. javascript: —
     * is rejected.
     */
    static String validateImage(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (value.startsWith("/uploads/" + ProfileImageStorageService.SYNCOOK_IMAGES + "/")
                && !value.contains("..")) {
            return value;
        }
        if (value.startsWith("data:")) {
            if (DATA_IMAGE.matcher(value).matches()) return value;
            throw ApiException.badRequest("Unsupported embedded image");
        }
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if ((scheme.equals("https") || scheme.equals("http")) && uri.getHost() != null && value.length() <= 2000) {
                return value;
            }
        } catch (IllegalArgumentException ignored) {
            // fall through
        }
        throw ApiException.badRequest("Image URL must be a valid http(s) link");
    }

    private List<String> cleanLines(List<String> values) {
        if (values == null) return new ArrayList<>();
        List<String> cleaned = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) cleaned.add(value.trim());
        }
        return cleaned;
    }

    private void enforceCanRead(SynCookRecipe recipe, Long requesterId) {
        if (recipe.getOwnerId().equals(requesterId) || "PUBLIC".equalsIgnoreCase(recipe.getPrivacy())) return;
        throw ApiException.forbidden("This dish is private");
    }

    private void enforceOwner(SynCookRecipe recipe, Long requesterId) {
        if (!recipe.getOwnerId().equals(requesterId)) {
            throw ApiException.forbidden("You can only change your own dishes");
        }
    }

    private List<SynCookCommentResponse> comments(Long recipeId) {
        return commentRepository.findByRecipeIdOrderByCreatedAtAsc(recipeId).stream().map(this::toComment).toList();
    }

    private List<SynCookRecipeResponse> toSummaries(List<SynCookRecipe> recipes, Long requesterId) {
        Map<Long, Long> counts = new HashMap<>();
        List<Long> ids = recipes.stream().map(SynCookRecipe::getId).filter(Objects::nonNull).toList();
        if (!ids.isEmpty()) {
            for (Object[] row : commentRepository.countByRecipeIds(ids)) {
                counts.put((Long) row[0], ((Number) row[1]).longValue());
            }
        }
        return recipes.stream()
                .map(r -> toResponse(r, requesterId, List.of(), counts.getOrDefault(r.getId(), 0L)))
                .toList();
    }

    private SynCookRecipeResponse toResponse(SynCookRecipe recipe, Long requesterId,
                                             List<SynCookCommentResponse> comments, long commentCount) {
        return new SynCookRecipeResponse(
                recipe.getId(),
                recipe.getTitle(),
                recipe.getCountry(),
                recipe.getIngredients() == null ? List.of() : List.copyOf(recipe.getIngredients()),
                recipe.getProcedures() == null ? List.of() : List.copyOf(recipe.getProcedures()),
                recipe.getImageUrl(),
                recipe.getPrivacy(),
                recipe.getOwnerId(),
                recipe.getOwnerName(),
                recipe.getOwnerId().equals(requesterId),
                recipe.getCreatedAt(),
                recipe.getUpdatedAt(),
                commentCount,
                comments
        );
    }

    private SynCookCommentResponse toComment(SynCookComment comment) {
        return new SynCookCommentResponse(comment.getId(), comment.getAuthorId(), comment.getAuthorName(),
                comment.getContent(), comment.getCreatedAt());
    }
}
