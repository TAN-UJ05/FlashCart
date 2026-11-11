package com.flashcart.auth.service;

import com.flashcart.auth.dto.*;
import com.flashcart.auth.entity.PasswordResetToken;
import com.flashcart.auth.entity.RefreshToken;
import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.PasswordResetTokenRepository;
import com.flashcart.auth.repository.RefreshTokenRepository;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.auth.security.JwtTokenProvider;
import com.flashcart.common.enums.NotificationType;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.exception.DuplicateResourceException;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final NotificationService notificationService;
    private final UserService userService;

    @Value("${flashcart.jwt.refresh-token-expiry-ms:604800000}")
    private long refreshTokenExpiryMs;

    @Value("${flashcart.cors.allowed-origins:http://localhost:3000}")
    private String frontendUrl;

    public record AuthSessionResult(AuthResponse authResponse, String refreshToken) {}

    @Transactional
    public AuthSessionResult register(RegisterRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException("An account with email " + normalizedEmail + " already exists");
        }

        User user = User.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName() != null ? request.getLastName().trim() : null)
                .phone(request.getPhone() != null ? request.getPhone().trim() : null)
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .build();

        user = userRepository.save(user);

        notificationService.queueNotification(
                user,
                NotificationType.REGISTRATION,
                "Welcome to FlashCart!",
                "Hi " + user.getFirstName() + ", welcome to FlashCart! Your account has been created."
        );

        return issueSession(user);
    }

    @Transactional
    public AuthSessionResult login(LoginRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.getPassword()));

        User user = (User) authentication.getPrincipal();
        return issueSession(user);
    }

    @Transactional(noRollbackFor = UnauthorizedException.class)
    public AuthSessionResult refreshToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is missing");
        }

        RefreshToken storedToken = refreshTokenRepository.findByToken(rawRefreshToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        // Reuse detection: if an already-used or revoked token is presented, revoke ALL tokens for this user
        if (storedToken.isUsed() || storedToken.getRevokedAt() != null) {
            log.warn("SECURITY ALERT: Refresh token reuse detected for userId={}. Revoking all sessions.",
                    storedToken.getUser().getId());
            refreshTokenRepository.revokeAllByUserId(storedToken.getUser().getId(), Instant.now());
            throw new UnauthorizedException("Refresh token reuse detected. All sessions have been revoked.");
        }

        if (storedToken.isExpired()) {
            throw new UnauthorizedException("Refresh token has expired");
        }

        User user = storedToken.getUser();
        if (!user.isEnabled()) {
            throw new UnauthorizedException("User account is disabled");
        }

        // Rotate: mark old token used and issue new token pair
        storedToken.setUsed(true);
        refreshTokenRepository.save(storedToken);

        return issueSession(user);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByToken(rawRefreshToken).ifPresent(token -> {
            token.setRevokedAt(Instant.now());
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            passwordResetTokenRepository.invalidateAllByUserId(user.getId());
            String tokenValue = UUID.randomUUID().toString();
            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token(tokenValue)
                    .user(user)
                    .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                    .used(false)
                    .build();
            passwordResetTokenRepository.save(resetToken);

            String baseUrl = frontendUrl.split(",")[0].trim();
            String resetLink = baseUrl + "/reset-password?token=" + tokenValue;
            log.info("Password reset token generated for {}: token={}", normalizedEmail, tokenValue);

            notificationService.queueNotification(
                    user,
                    NotificationType.PASSWORD_RESET,
                    "FlashCart Password Reset",
                    "Use this link to reset your password (expires in 1 hour): " + resetLink + " | Token: " + tokenValue
            );
        });
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.getToken().trim())
                .orElseThrow(() -> new InvalidOperationException("Invalid or expired password reset token"));

        if (!resetToken.isValid()) {
            throw new InvalidOperationException("Password reset token has expired or already been used");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        // Revoke all refresh tokens upon password change
        refreshTokenRepository.revokeAllByUserId(user.getId(), Instant.now());
    }

    private AuthSessionResult issueSession(User user) {
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String rawRefreshToken = UUID.randomUUID() + "-" + UUID.randomUUID();

        RefreshToken refreshToken = RefreshToken.builder()
                .token(rawRefreshToken)
                .user(user)
                .expiresAt(Instant.now().plusMillis(refreshTokenExpiryMs))
                .used(false)
                .build();
        refreshTokenRepository.save(refreshToken);

        AuthResponse response = AuthResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresInMs(jwtTokenProvider.getAccessTokenExpiryMs())
                .user(userService.toUserDto(user))
                .build();

        return new AuthSessionResult(response, rawRefreshToken);
    }
}
