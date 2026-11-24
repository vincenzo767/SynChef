package edu.cit.batawang.synchef.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.math.BigDecimal;

/**
 * Join entity between Recipe and Ingredient with quantity and scaling info.
 */
@Entity
@Table(name = "recipe_ingredients")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecipeIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    /** Parsed numeric quantity; null when the amount is descriptive (e.g. "1 handful of fresh herbs"). */
    @Column(precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(nullable = false, length = 50)
    private String unit; // g, tbsp, cloves ... (empty for countable items)

    /** Original amount exactly as authored, e.g. "½ tsp". Display fallback when quantity is null. */
    @Column(name = "amount_text", length = 120)
    private String amountText;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Column(length = 200)
    private String preparation;

    @Column(name = "is_optional")
    private Boolean isOptional = false;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
