package edu.cit.batawang.synchef.controller;

import edu.cit.batawang.synchef.dto.AuthDtos.GoogleLoginRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.LoginRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.RegisterRequest;
import edu.cit.batawang.synchef.dto.AuthDtos.SessionResponse;
import edu.cit.batawang.synchef.dto.AuthDtos.UserProfileResponse;
import edu.cit.batawang.synchef.security.CurrentUser;
import edu.cit.batawang.synchef.security.RateLimiter;
import edu.cit.batawang.synchef.security.SessionService;
import edu.cit.batawang.synchef.service.AuthService;
import edu.cit.batawang.synchef.service.UserAccountService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authentication endpoints. Successful sign-in sets an HttpOnly, SameSite session cookie; no token
 * is ever returned in a response body. All POSTs require the CSRF header (see SecurityConfig).
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SessionService sessionService;
    private final UserAccountService accountService;
    private final RateLimiter rateLimiter;
    private final CurrentUser currentUser;

    /** Boot probe for the SPA; also issues the XSRF-TOKEN cookie. Always 200. */
    @GetMapping("/session")
    public SessionResponse session() {
        UserProfileResponse profile = currentUser.principal().map(p -> accountService.profile(p.id())).orElse(null);
        return new SessionResponse(profile != null, profile, authService.isGoogleEnabled(), authService.googleClientId());
    }

    @PostMapping("/register")
    public ResponseEntity<UserProfileResponse> register(@Valid @RequestBody RegisterRequest request,
                                                        HttpServletRequest http) {
        rateLimiter.checkAuthAttempt(http.getRemoteAddr(), "register");
        return signedIn(authService.register(request), http, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<UserProfileResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        rateLimiter.checkAuthAttempt(http.getRemoteAddr(), request.emailOrUsername());
        return signedIn(authService.login(request), http, HttpStatus.OK);
    }

    @PostMapping("/google")
    public ResponseEntity<UserProfileResponse> google(@Valid @RequestBody GoogleLoginRequest request,
                                                      HttpServletRequest http) {
        rateLimiter.checkAuthAttempt(http.getRemoteAddr(), "google");
        return signedIn(authService.loginWithGoogle(request), http, HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        currentUser.principal().ifPresent(p -> sessionService.revoke(p.sessionId()));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, sessionService.clearedSessionCookie().toString())
                .build();
    }

    private ResponseEntity<UserProfileResponse> signedIn(AuthService.AuthResult result, HttpServletRequest http,
                                                         HttpStatus status) {
        SessionService.IssuedSession issued = sessionService.create(result.userId(), http.getHeader(HttpHeaders.USER_AGENT));
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, sessionService.sessionCookie(issued.rawToken()).toString())
                .body(result.profile());
    }
}
