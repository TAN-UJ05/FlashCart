package com.flashcart.order.controller;

import com.flashcart.auth.entity.User;
import com.flashcart.common.enums.UserRole;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.common.response.PageResponse;
import com.flashcart.order.dto.CheckoutRequest;
import com.flashcart.order.dto.OrderDto;
import com.flashcart.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<OrderDto>> checkout(
            @AuthenticationPrincipal User user,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CheckoutRequest request) {
        OrderDto order = orderService.checkout(user, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Order placed", order));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<OrderDto>>> getMyOrders(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                orderService.getUserOrders(user.getId(), PageRequest.of(page, Math.min(size, 100)))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OrderDto>> getOrder(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderById(user, id, isAdmin)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<OrderDto>> cancelOrder(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        return ResponseEntity.ok(ApiResponse.success("Order cancelled", orderService.cancelOrder(user, id, isAdmin)));
    }
}
