package edu.cit.batawang.synchef.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class AnalyticsResponse {
    private AdminStatsResponse overview;
    private long platformRecipes;
    private List<Map<String, Object>> userRegistrationsLast30Days;
    private List<Map<String, Object>> reportsLast30Days;
}
