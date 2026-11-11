package com.flashcart.auth;

import com.flashcart.auth.dto.*;
import com.flashcart.auth.entity.PasswordResetToken;
import com.flashcart.auth.entity.RefreshToken;
import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.PasswordResetTokenRepository;
import com.flashcart.auth.repository.RefreshTokenRepository;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.auth.security.JwtTokenProvider;
import com.flashcart.auth.service.AuthService;
import com.flashcart.common.enums.NotificationType;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.exception.DuplicateResourceException;
import com.flashcart.common.exception.UnauthorizedException;
import com.flashcart.notification.service.NotificationService;
import com.flashcart.user.dto.UserDto;
import com.flashcart.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private NotificationService notificationService;
    @Mock private UserService userService;

    @InjectMocks
    private AuthService authService;

    private User testUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryMs", 604800000L);
        ReflectionTestUtils.setField(authService, "frontendUrl", "http://localhost:3000");

        testUser = User.builder()
                .id(UUID.randomUUID())
                .email("customer@flashcart.com")
                .passwordHash("hashed")
                .firstName("Jane")
                .lastName("Doe")
                .role(UserRole.CUSTOMER)
                .enabled(true)
                .build();
    }

    @Test
    void register_success_issuesTokensAndQueuesNotification() {
        RegisterRequest req = RegisterRequest.builder()
                .email("Customer@FlashCart.com")
                .password("StrongPass123!")
                .firstName("Jane")
                .lastName("Doe")
                .build();

        when(userRepository.existsByEmail("customer@flashcart.com")).thenReturn(false);
        when(passwordEncoder.encode("StrongPass123!")).thenReturn("encoded-hash");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(jwtTokenProvider.generateAccessToken(any())).thenReturn("jwt-access-token");
        when(jwtTokenProvider.getAccessTokenExpiryMs()).thenReturn(900000L);
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));
        when(userService.toUserDto(any(User.class))).thenReturn(UserDto.builder().id(testUser.getId()).email(testUser.getEmail()).build());

        AuthService.AuthSessionResult result = authService.register(req);

        assertThat(result.authResponse().getAccessToken()).isEqualTo("jwt-access-token");
        assertThat(result.refreshToken()).isNotBlank();
        verify(notificationService).queueNotification(eq(testUser), eq(NotificationType.REGISTRATION), anyString(), anyString());
    }

    @Test
    void register_duplicateEmail_throwsDuplicateResourceException() {
        RegisterRequest req = RegisterRequest.builder()
                .email("customer@flashcart.com")
                .password("StrongPass123!")
                .firstName("Jane")
                .build();

        when(userRepository.existsByEmail("customer@flashcart.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(DuplicateResourceException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void refreshToken_validToken_rotatesToken() {
        RefreshToken existing = RefreshToken.builder()
                .id(UUID.randomUUID())
                .token("old-refresh-token")
                .user(testUser)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .used(false)
                .build();

        when(refreshTokenRepository.findByToken("old-refresh-token")).thenReturn(Optional.of(existing));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));
        when(jwtTokenProvider.generateAccessToken(testUser)).thenReturn("new-jwt");
        when(jwtTokenProvider.getAccessTokenExpiryMs()).thenReturn(900000L);
        when(userService.toUserDto(testUser)).thenReturn(UserDto.builder().id(testUser.getId()).email(testUser.getEmail()).build());

        AuthService.AuthSessionResult result = authService.refreshToken("old-refresh-token");

        assertThat(existing.isUsed()).isTrue();
        assertThat(result.authResponse().getAccessToken()).isEqualTo("new-jwt");
        assertThat(result.refreshToken()).isNotEqualTo("old-refresh-token");
    }

    @Test
    void refreshToken_reusedToken_revokesAllUserSessions() {
        RefreshToken reused = RefreshToken.builder()
                .id(UUID.randomUUID())
                .token("already-used-token")
                .user(testUser)
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .used(true)
                .build();

        when(refreshTokenRepository.findByToken("already-used-token")).thenReturn(Optional.of(reused));

        assertThatThrownBy(() -> authService.refreshToken("already-used-token"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("reuse detected");

        verify(refreshTokenRepository).revokeAllByUserId(eq(testUser.getId()), any(Instant.class));
    }

    @Test
    void resetPassword_validToken_updatesPasswordAndRevokesSessions() {
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .id(UUID.randomUUID())
                .token("reset-123")
                .user(testUser)
                .expiresAt(Instant.now().plus(1, ChronoUnit.HOURS))
                .used(false)
                .build();

        when(passwordResetTokenRepository.findByToken("reset-123")).thenReturn(Optional.of(resetToken));
        when(passwordEncoder.encode("NewPass123!")).thenReturn("new-hash");

        authService.resetPassword(ResetPasswordRequest.builder()
                .token("reset-123")
                .newPassword("NewPass123!")
                .build());

        assertThat(testUser.getPasswordHash()).isEqualTo("new-hash");
        assertThat(resetToken.isUsed()).isTrue();
        verify(refreshTokenRepository).revokeAllByUserId(eq(testUser.getId()), any(Instant.class));
    }
}
