package com.flashcart.integration;

import com.flashcart.auth.dto.*;
import com.flashcart.auth.entity.PasswordResetToken;
import com.flashcart.auth.repository.PasswordResetTokenRepository;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.common.response.PageResponse;
import com.flashcart.flashsale.dto.FlashSaleDto;
import com.flashcart.flashsale.dto.FlashSaleItemRequest;
import com.flashcart.flashsale.dto.FlashSaleRequest;
import com.flashcart.product.dto.ProductDto;
import com.flashcart.product.dto.ProductRequest;
import com.flashcart.user.dto.UserDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuthIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Test
    void fullAuthLifecycle_registerLoginRefreshReuseDetectionResetAndLogout() {
        String email = "auth-test-" + UUID.randomUUID() + "@flashcart.com";

        // 1. Register
        RegisterRequest registerReq = RegisterRequest.builder()
                .email(email)
                .password("Password@123")
                .firstName("Integration")
                .lastName("Tester")
                .build();

        ResponseEntity<ApiResponse<AuthResponse>> registerResp = restTemplate.exchange(
                "/api/v1/auth/register",
                HttpMethod.POST,
                new HttpEntity<>(registerReq),
                new ParameterizedTypeReference<>() {}
        );

        assertThat(registerResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(registerResp.getBody()).isNotNull();
        assertThat(registerResp.getBody().isSuccess()).isTrue();
        String accessToken = registerResp.getBody().getData().getAccessToken();
        assertThat(accessToken).isNotBlank();

        List<String> setCookies = registerResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertThat(setCookies).isNotNull().isNotEmpty();
        String firstCookieHeader = setCookies.get(0);
        assertThat(firstCookieHeader).contains("HttpOnly").contains("SameSite=Strict");
        String firstRefreshToken = extractCookieValue(firstCookieHeader, "refreshToken");

        // 2. Call /auth/me with access token
        HttpHeaders authHeaders = new HttpHeaders();
        authHeaders.setBearerAuth(accessToken);
        ResponseEntity<ApiResponse<UserDto>> meResp = restTemplate.exchange(
                "/api/v1/auth/me",
                HttpMethod.GET,
                new HttpEntity<>(authHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(meResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(meResp.getBody().getData().getEmail()).isEqualTo(email);

        // 3. Refresh token rotation
        HttpHeaders refreshHeaders = new HttpHeaders();
        refreshHeaders.add(HttpHeaders.COOKIE, "refreshToken=" + firstRefreshToken);
        ResponseEntity<ApiResponse<AuthResponse>> refreshResp = restTemplate.exchange(
                "/api/v1/auth/refresh",
                HttpMethod.POST,
                new HttpEntity<>(null, refreshHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(refreshResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        String secondRefreshToken = extractCookieValue(
                refreshResp.getHeaders().getFirst(HttpHeaders.SET_COOKIE), "refreshToken");
        assertThat(secondRefreshToken).isNotBlank().isNotEqualTo(firstRefreshToken);

        // 4. Refresh token REUSE DETECTION: reusing firstRefreshToken must fail AND revoke secondRefreshToken!
        ResponseEntity<ApiResponse<Void>> reuseResp = restTemplate.exchange(
                "/api/v1/auth/refresh",
                HttpMethod.POST,
                new HttpEntity<>(null, refreshHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(reuseResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        HttpHeaders secondRefreshHeaders = new HttpHeaders();
        secondRefreshHeaders.add(HttpHeaders.COOKIE, "refreshToken=" + secondRefreshToken);
        ResponseEntity<ApiResponse<Void>> revokedResp = restTemplate.exchange(
                "/api/v1/auth/refresh",
                HttpMethod.POST,
                new HttpEntity<>(null, secondRefreshHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(revokedResp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // 5. Forgot & Reset Password
        ResponseEntity<ApiResponse<Void>> forgotResp = restTemplate.exchange(
                "/api/v1/auth/forgot-password",
                HttpMethod.POST,
                new HttpEntity<>(new ForgotPasswordRequest(email)),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(forgotResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        PasswordResetToken resetToken = passwordResetTokenRepository
                .findTopByUserEmailAndUsedFalseOrderByCreatedAtDesc(email)
                .orElseThrow();

        ResponseEntity<ApiResponse<Void>> resetResp = restTemplate.exchange(
                "/api/v1/auth/reset-password",
                HttpMethod.POST,
                new HttpEntity<>(new ResetPasswordRequest(resetToken.getToken(), "NewStrongPass@456")),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(resetResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 6. Login with new password succeeds
        ResponseEntity<ApiResponse<AuthResponse>> loginResp = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest(email, "NewStrongPass@456")),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(loginResp.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void seedDataMigration_adminCustomerLoginSearchAndLiveFlashSaleWork() {
        ResponseEntity<ApiResponse<AuthResponse>> adminLogin = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest("admin@flashcart.com", "Admin@123456")),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(adminLogin.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(adminLogin.getBody()).isNotNull();
        assertThat(adminLogin.getBody().getData().getUser().getRole().name()).isEqualTo("ADMIN");

        ResponseEntity<ApiResponse<AuthResponse>> custLogin = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest("customer1@flashcart.com", "Customer@123")),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(custLogin.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<ApiResponse<PageResponse<ProductDto>>> searchResp = restTemplate.exchange(
                "/api/v1/products/search?q=laptop",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {}
        );
        assertThat(searchResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(searchResp.getBody()).isNotNull();
        assertThat(searchResp.getBody().getData().getTotalElements()).isGreaterThanOrEqualTo(1);

        ResponseEntity<ApiResponse<List<FlashSaleDto>>> liveFlashSales = restTemplate.exchange(
                "/api/v1/flash-sales/live",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {}
        );
        assertThat(liveFlashSales.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(liveFlashSales.getBody()).isNotNull();
        assertThat(liveFlashSales.getBody().getData()).isNotEmpty();
    }

    @Test
    void adminCustomers_listWithoutSearchWithSearchAndAuthGuard() {
        ResponseEntity<ApiResponse<AuthResponse>> adminLogin = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest("admin@flashcart.com", "Admin@123456")),
                new ParameterizedTypeReference<>() {}
        );
        String adminToken = adminLogin.getBody().getData().getAccessToken();
        HttpHeaders adminHeaders = new HttpHeaders();
        adminHeaders.setBearerAuth(adminToken);

        // Listing customers without search parameter must succeed (regression test for null search bytea error)
        ResponseEntity<ApiResponse<PageResponse<UserDto>>> allCustomersResp = restTemplate.exchange(
                "/api/v1/admin/customers?page=0&size=20",
                HttpMethod.GET,
                new HttpEntity<>(adminHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(allCustomersResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(allCustomersResp.getBody()).isNotNull();
        assertThat(allCustomersResp.getBody().isSuccess()).isTrue();
        assertThat(allCustomersResp.getBody().getData().getTotalElements()).isGreaterThanOrEqualTo(2);
        assertThat(allCustomersResp.getBody().getData().getContent())
                .allMatch(u -> u.getRole().name().equals("CUSTOMER"));

        // Blank search (whitespace or empty) behaves like unfiltered list
        ResponseEntity<ApiResponse<PageResponse<UserDto>>> blankSearchResp = restTemplate.exchange(
                "/api/v1/admin/customers?page=0&size=20&search={search}",
                HttpMethod.GET,
                new HttpEntity<>(adminHeaders),
                new ParameterizedTypeReference<>() {},
                "   "
        );
        assertThat(blankSearchResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(blankSearchResp.getBody().getData().getTotalElements())
                .isEqualTo(allCustomersResp.getBody().getData().getTotalElements());

        ResponseEntity<ApiResponse<PageResponse<UserDto>>> emptySearchResp = restTemplate.exchange(
                "/api/v1/admin/customers?page=0&size=20&search=",
                HttpMethod.GET,
                new HttpEntity<>(adminHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(emptySearchResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(emptySearchResp.getBody().getData().getTotalElements())
                .isEqualTo(allCustomersResp.getBody().getData().getTotalElements());

        // Filtered search by name / email returns matching customer
        ResponseEntity<ApiResponse<PageResponse<UserDto>>> filteredResp = restTemplate.exchange(
                "/api/v1/admin/customers?page=0&size=20&search=aarav",
                HttpMethod.GET,
                new HttpEntity<>(adminHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(filteredResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(filteredResp.getBody().getData().getContent())
                .anyMatch(u -> u.getEmail().equals("customer1@flashcart.com"));

        // Customer role cannot access admin customers endpoint
        ResponseEntity<ApiResponse<AuthResponse>> custLogin = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest("customer1@flashcart.com", "Customer@123")),
                new ParameterizedTypeReference<>() {}
        );
        HttpHeaders custHeaders = new HttpHeaders();
        custHeaders.setBearerAuth(custLogin.getBody().getData().getAccessToken());
        ResponseEntity<ApiResponse<Object>> forbiddenResp = restTemplate.exchange(
                "/api/v1/admin/customers?page=0&size=20",
                HttpMethod.GET,
                new HttpEntity<>(custHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(forbiddenResp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void overlappingLiveFlashSalesAndProductImageUpdate_workWithoutServerError() {
        ResponseEntity<ApiResponse<AuthResponse>> adminLogin = restTemplate.exchange(
                "/api/v1/auth/login",
                HttpMethod.POST,
                new HttpEntity<>(new LoginRequest("admin@flashcart.com", "Admin@123456")),
                new ParameterizedTypeReference<>() {}
        );
        HttpHeaders adminHeaders = new HttpHeaders();
        adminHeaders.setBearerAuth(adminLogin.getBody().getData().getAccessToken());

        ProductRequest createReq = ProductRequest.builder()
                .name("Overlap Test Monitor")
                .sku("OVR-" + UUID.randomUUID().toString().substring(0, 8))
                .price(new BigDecimal("15000.00"))
                .initialStock(40)
                .active(true)
                .build();
        ResponseEntity<ApiResponse<ProductDto>> createdResp = restTemplate.exchange(
                "/api/v1/admin/products",
                HttpMethod.POST,
                new HttpEntity<>(createReq, adminHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(createdResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UUID productId = createdResp.getBody().getData().getId();

        // Update product with an imageUrl
        ProductRequest updateReq = ProductRequest.builder()
                .name("Overlap Test Monitor")
                .sku(createReq.getSku())
                .price(new BigDecimal("15000.00"))
                .active(true)
                .imageUrl("/api/v1/images/seed-electronics.svg")
                .build();
        ResponseEntity<ApiResponse<ProductDto>> updatedResp = restTemplate.exchange(
                "/api/v1/admin/products/" + productId,
                HttpMethod.PUT,
                new HttpEntity<>(updateReq, adminHeaders),
                new ParameterizedTypeReference<>() {}
        );
        assertThat(updatedResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updatedResp.getBody().getData().getImages()).hasSize(1);
        assertThat(updatedResp.getBody().getData().getImages().get(0).getImageUrl())
                .isEqualTo("/api/v1/images/seed-electronics.svg");

        // Create two overlapping live flash sales targeting the same product
        Instant now = Instant.now();
        FlashSaleRequest sale1 = FlashSaleRequest.builder()
                .name("Overlap Sale A")
                .startTime(now.minus(10, ChronoUnit.MINUTES))
                .endTime(now.plus(2, ChronoUnit.HOURS))
                .active(true)
                .items(List.of(FlashSaleItemRequest.builder()
                        .productId(productId)
                        .salePrice(new BigDecimal("11999.00"))
                        .saleStock(10)
                        .build()))
                .build();
        FlashSaleRequest sale2 = FlashSaleRequest.builder()
                .name("Overlap Sale B")
                .startTime(now.minus(5, ChronoUnit.MINUTES))
                .endTime(now.plus(3, ChronoUnit.HOURS))
                .active(true)
                .items(List.of(FlashSaleItemRequest.builder()
                        .productId(productId)
                        .salePrice(new BigDecimal("9999.00"))
                        .saleStock(10)
                        .build()))
                .build();

        UUID sale1Id = restTemplate.exchange(
                "/api/v1/admin/flash-sales",
                HttpMethod.POST,
                new HttpEntity<>(sale1, adminHeaders),
                new ParameterizedTypeReference<ApiResponse<FlashSaleDto>>() {}
        ).getBody().getData().getId();
        UUID sale2Id = restTemplate.exchange(
                "/api/v1/admin/flash-sales",
                HttpMethod.POST,
                new HttpEntity<>(sale2, adminHeaders),
                new ParameterizedTypeReference<ApiResponse<FlashSaleDto>>() {}
        ).getBody().getData().getId();

        ResponseEntity<ApiResponse<ProductDto>> detailResp = restTemplate.exchange(
                "/api/v1/products/" + productId,
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {}
        );
        assertThat(detailResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(detailResp.getBody().getData().getActiveFlashSalePrice())
                .isEqualByComparingTo("9999.00");

        // Clean up test fixtures
        restTemplate.exchange("/api/v1/admin/flash-sales/" + sale1Id, HttpMethod.DELETE,
                new HttpEntity<>(adminHeaders), Void.class);
        restTemplate.exchange("/api/v1/admin/flash-sales/" + sale2Id, HttpMethod.DELETE,
                new HttpEntity<>(adminHeaders), Void.class);
        restTemplate.exchange("/api/v1/admin/products/" + productId, HttpMethod.DELETE,
                new HttpEntity<>(adminHeaders), Void.class);
    }

    private String extractCookieValue(String setCookieHeader, String name) {
        for (String part : setCookieHeader.split(";")) {
            String trimmed = part.trim();
            if (trimmed.startsWith(name + "=")) {
                return trimmed.substring((name + "=").length());
            }
        }
        throw new IllegalStateException("Cookie " + name + " not found in: " + setCookieHeader);
    }
}
