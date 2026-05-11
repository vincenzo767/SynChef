package edu.cit.batawang.synchef.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RecipeReportResponse {
    private Long id;
    private Long reporterId;
    private String reporterName;
    private Long recipeId;
    private String recipeTitle;
    private Long recipeOwnerId;
    private String recipeOwnerName;
    private String category;
    private String reason;
    private String status;
    private LocalDateTime reportDate;
}
