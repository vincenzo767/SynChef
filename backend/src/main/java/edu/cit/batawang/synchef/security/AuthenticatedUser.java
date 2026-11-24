package edu.cit.batawang.synchef.security;

import org.springframework.security.core.AuthenticatedPrincipal;

import java.io.Serializable;

/**
 * Principal placed in the SecurityContext for an authenticated request.
 * {@link #getName()} is the user id, which is also the STOMP user-destination name.
 */
public record AuthenticatedUser(Long id, String role, Long sessionId) implements AuthenticatedPrincipal, Serializable {

    @Override
    public String getName() {
        return String.valueOf(id);
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
