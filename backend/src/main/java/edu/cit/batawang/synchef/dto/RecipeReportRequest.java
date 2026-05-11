package edu.cit.batawang.synchef.dto;

import lombok.Data;

@Data
public class RecipeReportRequest {
    private Long recipeId;
    private String category; // Critical | Recipe | Medium
    private String reason;
}
