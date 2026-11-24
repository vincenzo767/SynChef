package edu.cit.batawang.synchef.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authenticates requests from the HttpOnly session cookie. Invalid/expired cookies are cleared.
 */
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final SessionService sessionService;

    public SessionAuthenticationFilter(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = sessionService.readToken(request);
        if (token != null && !token.isEmpty()) {
            var resolved = sessionService.resolve(token);
            if (resolved.isPresent()) {
                var user = resolved.get().user();
                String role = user.getRole() == null ? "USER" : user.getRole();
                AuthenticatedUser principal = new AuthenticatedUser(user.getId(), role, resolved.get().session().getId());
                var authentication = new UsernamePasswordAuthenticationToken(
                        principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            } else {
                response.addHeader(HttpHeaders.SET_COOKIE, sessionService.clearedSessionCookie().toString());
            }
        }
        chain.doFilter(request, response);
    }
}
