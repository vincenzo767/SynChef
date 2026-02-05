package com.synchef.service;

import com.synchef.dto.AuthResponse;
import com.synchef.dto.GoogleAuthRequest;
import com.synchef.dto.LoginRequest;
import com.synchef.dto.RegisterRequest;
import com.synchef.model.User;
import com.synchef.repository.UserRepository;
import com.synchef.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service for user authentication and registration
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    
    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    
    /**
     * Register a new user
     */
    public AuthResponse register(RegisterRequest request) {
        // Validate password match
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }
        
        // Check if email already exists
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already registered");
        }
        
        // Check if username already exists
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new IllegalArgumentException("Username already taken");
        }
        
        // Create new user
        User user = new User();
        user.setEmail(request.getEmail());
        user.setUsername(request.getUsername());
        user.setPassword(request.getPassword()); // In production, use BCryptPasswordEncoder
        user.setFullName(request.getFullName());
        user.setEmailVerified(false);
        user.setActive(true);
        
        user = userRepository.save(user);
        
        log.info("User registered: {}", user.getEmail());
        
        return buildAuthResponse(user);
    }
    
    /**
     * Login user with email/username and password
     */
    public AuthResponse login(LoginRequest request) {
        // Find user by email or username
        Optional<User> userOpt = userRepository.findByEmail(request.getEmailOrUsername())
                .or(() -> userRepository.findByUsername(request.getEmailOrUsername()));
        
        if (userOpt.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or username");
        }
        
        User user = userOpt.get();
        
        // Verify password (in production, use BCryptPasswordEncoder)
        if (user.getPassword() == null || !user.getPassword().equals(request.getPassword())) {
            throw new IllegalArgumentException("Invalid password");
        }
        
        if (!user.getActive()) {
            throw new IllegalArgumentException("Account is inactive");
        }
        
        log.info("User logged in: {}", user.getEmail());
        
        return buildAuthResponse(user);
    }
    
    /**
     * Google OAuth login/registration
     */
    public AuthResponse loginWithGoogle(GoogleAuthRequest request) {
        // In production, verify the token with Google's API
        // For now, we'll use a simplified approach
        // You should verify the token: https://developers.google.com/identity/protocols/oauth2/web-server#verify-the--token
        
        log.info("Google login attempt with token: {}", request.getGoogleToken().substring(0, 20) + "...");
        
        // For demo purposes, we'll parse basic info from the token
        // In production, validate with Google's API
        
        // Extract information (simplified - in production validate with Google)
        String email = extractEmailFromGoogleToken(request.getGoogleToken());
        
        // Try to find existing user by email or Google ID
        Optional<User> userOpt = userRepository.findByEmail(email);
        
        User user;
        if (userOpt.isPresent()) {
            user = userOpt.get();
            // Update Google ID if not set
            if (user.getGoogleId() == null) {
                user.setGoogleId(request.getGoogleToken());
                user = userRepository.save(user);
            }
        } else {
            // Create new user from Google profile
            user = new User();
            user.setEmail(email);
            user.setUsername(email.split("@")[0] + System.nanoTime()); // Generate unique username
            user.setGoogleId(request.getGoogleToken());
            user.setFullName(email); // Will be updated with actual name from Google
            user.setPassword(null); // No password for OAuth users
            user.setEmailVerified(true);
            user.setActive(true);
            user = userRepository.save(user);
            
            log.info("New Google user created: {}", user.getEmail());
        }
        
        return buildAuthResponse(user);
    }
    
    /**
     * Build AuthResponse from User entity
     */
    private AuthResponse buildAuthResponse(User user) {
        String token = tokenProvider.generateToken(user);
        
        AuthResponse response = new AuthResponse();
        response.setToken(token);
        response.setType("Bearer");
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setUsername(user.getUsername());
        response.setFullName(user.getFullName());
        response.setProfileImageUrl(user.getProfileImageUrl());
        response.setEmailVerified(user.getEmailVerified());
        
        return response;
    }
    
    /**
     * Extract email from Google token (simplified)
     * In production, validate the token properly
     */
    private String extractEmailFromGoogleToken(String token) {
        // This is a placeholder - in production, you should verify with Google's API
        // For now, return a dummy email based on token hash
        return "user_" + token.hashCode() + "@google-oauth.synchef.local";
    }
}
