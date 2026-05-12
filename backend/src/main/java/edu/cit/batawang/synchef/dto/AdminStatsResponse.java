package edu.cit.batawang.synchef.dto;

import lombok.Data;

@Data
public class AdminStatsResponse {
    private long totalUsers;
    private long activeUsers;
    private long bannedUsers;
    private long totalSynCookRecipes;
    private long publicRecipes;
    private long pendingReports;
    private long totalReports;
    private long totalComments;
}
