package edu.cit.batawang.synchef.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

/**
 * Platform recipe (curated catalogue). Exposed to clients only through DTOs.
 */
@Entity
@Table(name = "recipes", indexes = {
    @Index(name = "idx_recipes_region", columnList = "region"),
    @Index(name = "idx_recipes_country", columnList = "country_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Stable identifier of curated catalogue entries (1..n). It is the ID the previous
     * web/mobile clients used for favorites, and lets the seeder stay idempotent.
     */
    @Column(name = "catalog_number", unique = true)
    private Integer catalogNumber;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "country_id", nullable = false)
    private Country country;

    /** Culinary tradition, e.g. "Italian", "Māori". */
    @Column(length = 60)
    private String cuisine;

    /** Culinary region used for discovery filters, e.g. "Europe", "Middle East". */
    @Column(length = 40)
    private String region;

    @ManyToMany
    @JoinTable(
        name = "recipe_categories",
        joinColumns = @JoinColumn(name = "recipe_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Category> categories = new ArrayList<>();

    /** Nullable: curated recipes only publish a total time. */
    @Column(name = "prep_time_minutes")
    private Integer prepTimeMinutes;

    /** Nullable: curated recipes only publish a total time. */
    @Column(name = "cook_time_minutes")
    private Integer cookTimeMinutes;

    /** Nullable: imported recipes whose source does not publish a total time. */
    @Column(name = "total_time_minutes")
    private Integer totalTimeMinutes;

    /** Nullable: when the source gives no yield, scaling works in batches (×1, ×2 …). */
    @Column(name = "default_servings")
    private Integer defaultServings;

    /** Stable key of an imported recipe, e.g. "themealdb:52772" (idempotent seeding). */
    @Column(name = "source_ref", length = 60, unique = true)
    private String sourceRef;

    /** Where the recipe text comes from (attribution link). */
    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    /** Licence/attribution page of the photo (e.g. Wikimedia Commons file page). */
    @Column(name = "image_source_url", length = 500)
    private String imageSourceUrl;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    @Column(name = "difficulty_level", length = 20)
    private String difficultyLevel; // EASY, MEDIUM, HARD

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String culturalContext;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<RecipeIngredient> ingredients = new ArrayList<>();

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<Step> steps = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private java.util.Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private java.util.Date updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new java.util.Date();
        updatedAt = new java.util.Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new java.util.Date();
    }
}
