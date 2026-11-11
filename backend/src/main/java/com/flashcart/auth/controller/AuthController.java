package com.flashcart.auth.controller;

import com.flashcart.auth.dto.*;
import com.flashcart.auth.entity.User;
import com.flashcart.auth.service.AuthService;
import com.flashcart.common.ratelimit.RateLimitService;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.user.dto.UserDto;
import com.flashcart.user.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    public static final String REFRESH_COOKIE_NAME = "refreshToken";

    private final AuthService authService;
    private final UserService userService;
    private final RateLimitService rateLimitService;

    @Value("${flashcart.jwt.refresh-token-expiry-ms:604800000}")
    private long refreshTokenExpiryMs;

    @Value("${flashcart.jwt.cookie-secure:false}")
    private boolean cookieSecure;

    @Value("${flashcart.rate-limit.trust-proxy:false}")
    private boolean trustProxy;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (!rateLimitService.tryConsumeAuth(resolveClientIp(httpRequest))) {
            return tooManyRequests();
        }

        AuthService.AuthSessionResult result = authService.register(request);
        setRefreshCookie(httpResponse, result.refreshToken());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registration successful", result.authResponse()));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (!rateLimitService.tryConsumeAuth(resolveClientIp(httpRequest))) {
            return tooManyRequests();
        }

        AuthService.AuthSessionResult result = authService.login(request);
        setRefreshCookie(httpResponse, result.refreshToken());
        return ResponseEntity.ok(ApiResponse.success("Login successful", result.authResponse()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String cookieToken,
            @RequestBody(required = false) RefreshTokenRequest body,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        if (!rateLimitService.tryConsumeAuth(resolveClientIp(httpRequest))) {
            return tooManyRequests();
        }

        String token = (cookieToken != null && !cookieToken.isBlank())
                ? cookieToken
                : (body != null ? body.getRefreshToken() : null);

        try {
            AuthService.AuthSessionResult result = authService.refreshToken(token);
            setRefreshCookie(httpResponse, result.refreshToken());
            return ResponseEntity.ok(ApiResponse.success("Token refreshed", result.authResponse()));
        } catch (RuntimeException ex) {
            clearRefreshCookie(httpResponse);
            throw ex;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String cookieToken,
            @RequestBody(required = false) RefreshTokenRequest body,
            HttpServletResponse httpResponse) {
        String token = (cookieToken != null && !cookieToken.isBlank())
                ? cookieToken
                : (body != null ? body.getRefreshToken() : null);
        authService.logout(token);
        clearRefreshCookie(httpResponse);
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully", null));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(userService.getProfile(user.getId())));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpRequest) {
        if (!rateLimitService.tryConsumeAuth(resolveClientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Too many requests. Please try again later."));
        }
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success(
                "If an account exists with this email, a password reset link has been sent.", null));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest httpRequest) {
        if (!rateLimitService.tryConsumeAuth(resolveClientIp(httpRequest))) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Too many requests. Please try again later."));
        }
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password has been reset successfully", null));
    }

    private void setRefreshCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(Duration.ofMillis(refreshTokenExpiryMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (trustProxy) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private ResponseEntity<ApiResponse<AuthResponse>> tooManyRequests() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(ApiResponse.error("Too many authentication requests. Please try again later.",
                        ApiResponse.ErrorDetails.builder().code("RATE_LIMITED").build()));
    }
}
