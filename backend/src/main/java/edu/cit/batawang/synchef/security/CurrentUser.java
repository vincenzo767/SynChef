package edu.cit.batawang.synchef.security;

import edu.cit.batawang.synchef.exception.ApiException;
import edu.cit.batawang.synchef.model.User;
import edu.cit.batawang.synchef.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Single place to obtain the authenticated user (replaces three duplicated helpers).
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UserRepository userRepository;

    public Optional<AuthenticatedUser> principal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public AuthenticatedUser requirePrincipal() {
        return principal().orElseThrow(() -> ApiException.unauthorized("Please sign in to continue"));
    }

    public Long id() {
        return requirePrincipal().id();
    }

    public User require() {
        return userRepository.findById(id()).orElseThrow(() -> ApiException.unauthorized("Please sign in to continue"));
    }
}
