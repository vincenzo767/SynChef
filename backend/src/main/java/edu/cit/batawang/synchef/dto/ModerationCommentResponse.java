package edu.cit.batawang.synchef.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ModerationCommentResponse {
    private Long id;
    private Long recipeId;
    private String recipeTitle;
    private Long authorId;
    private String authorName;
    private String content;
    private LocalDateTime createdAt;
}
