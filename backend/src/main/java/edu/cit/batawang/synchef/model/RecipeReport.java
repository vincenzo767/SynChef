package edu.cit.batawang.synchef.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "recipe_reports", indexes = {
    @Index(name = "idx_recipe_reports_recipe_id", columnList = "recipe_id"),
    @Index(name = "idx_recipe_reports_reporter_id", columnList = "reporter_id"),
    @Index(name = "idx_recipe_reports_status", columnList = "status")
})
@Data
@NoArgsConstructor
public class RecipeReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Column(name = "reporter_name", nullable = false, length = 200)
    private String reporterName;

    @Column(name = "recipe_id", nullable = false)
    private Long recipeId;

    @Column(name = "recipe_title", nullable = false, length = 300)
    private String recipeTitle;

    @Column(name = "recipe_owner_id")
    private Long recipeOwnerId;

    @Column(name = "recipe_owner_name", length = 200)
    private String recipeOwnerName;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "reason", length = 500)
    private String reason;

    /** Legacy column — mirrors `reason`. Required NOT NULL by the existing DB schema. */
    @Column(name = "report_reason", nullable = false, length = 500)
    private String reportReason;

    /** Legacy column — mirrors `category`. Required NOT NULL by the existing DB schema. */
    @Column(name = "report_type", nullable = false, length = 50)
    private String reportType;

    @Column(name = "status", length = 20, nullable = false)
    private String status = "PENDING";

    @CreationTimestamp
    @Column(name = "report_date", nullable = false, updatable = false)
    private LocalDateTime reportDate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
