package com.synchef.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Google OAuth login
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoogleAuthRequest {
    private String googleToken; // Google ID token from frontend
}
