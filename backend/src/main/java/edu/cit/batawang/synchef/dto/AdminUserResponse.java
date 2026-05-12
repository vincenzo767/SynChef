package edu.cit.batawang.synchef.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AdminUserResponse {
    private Long id;
    private String email;
    private String username;
    private String fullName;
    private String role;
    private Boolean active;
    private String countryCode;
    private String countryName;
    private String profileImageUrl;
    private LocalDateTime createdAt;
}
