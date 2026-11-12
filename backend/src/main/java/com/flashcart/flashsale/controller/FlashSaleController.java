package com.flashcart.flashsale.controller;

import com.flashcart.auth.entity.User;
import com.flashcart.common.ratelimit.RateLimitService;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.flashsale.dto.FlashSaleDto;
import com.flashcart.flashsale.dto.FlashSalePurchaseRequest;
import com.flashcart.flashsale.service.FlashSaleService;
import com.flashcart.order.dto.OrderDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/flash-sales")
@RequiredArgsConstructor
public class FlashSaleController {

    private final FlashSaleService flashSaleService;
    private final RateLimitService rateLimitService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FlashSaleDto>>> getActiveAndUpcoming() {
        return ResponseEntity.ok(ApiResponse.success(flashSaleService.getActiveAndUpcomingFlashSales()));
    }

    @GetMapping("/live")
    public ResponseEntity<ApiResponse<List<FlashSaleDto>>> getLive() {
        return ResponseEntity.ok(ApiResponse.success(flashSaleService.getLiveFlashSales()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FlashSaleDto>> getFlashSale(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(flashSaleService.getFlashSaleById(id)));
    }

    @PostMapping("/{id}/purchase")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<OrderDto>> purchase(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody FlashSalePurchaseRequest request) {
        if (!rateLimitService.tryConsumeFlashSale(user.getId().toString())) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Too many flash sale requests. Please slow down.",
                            ApiResponse.ErrorDetails.builder().code("RATE_LIMITED").build()));
        }

        OrderDto order = flashSaleService.purchaseFlashSaleItem(user, id, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Flash sale item reserved", order));
    }
}
