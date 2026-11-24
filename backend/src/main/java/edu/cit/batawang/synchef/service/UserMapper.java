package edu.cit.batawang.synchef.service;

import edu.cit.batawang.synchef.dto.AdminUserResponse;
import edu.cit.batawang.synchef.dto.AuthDtos.UserProfileResponse;
import edu.cit.batawang.synchef.model.User;

import java.util.ArrayList;

public final class UserMapper {

    private UserMapper() {
    }

    public static UserProfileResponse toProfile(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getFullName(),
                user.getProfileImageUrl(),
                user.getEmailVerified(),
                user.getCountryCode(),
                user.getCountryName(),
                user.getFavoriteRecipeIds() != null ? new ArrayList<>(user.getFavoriteRecipeIds()) : new ArrayList<>(),
                user.getCreatedAt(),
                user.getRole() != null ? user.getRole() : "USER",
                user.getThemePreference() != null ? user.getThemePreference() : "SYSTEM",
                !Boolean.FALSE.equals(user.getNotifyOnComments()),
                user.getPassword() != null && !user.getPassword().isBlank()
        );
    }

    public static AdminUserResponse toAdmin(User u) {
        AdminUserResponse r = new AdminUserResponse();
        r.setId(u.getId());
        r.setEmail(u.getEmail());
        r.setUsername(u.getUsername());
        r.setFullName(u.getFullName());
        r.setRole(u.getRole() != null ? u.getRole() : "USER");
        r.setActive(Boolean.TRUE.equals(u.getActive()));
        r.setCountryCode(u.getCountryCode());
        r.setCountryName(u.getCountryName());
        r.setProfileImageUrl(u.getProfileImageUrl());
        r.setCreatedAt(u.getCreatedAt());
        return r;
    }
}
