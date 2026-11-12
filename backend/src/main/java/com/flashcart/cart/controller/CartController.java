package com.flashcart.cart.controller;

import com.flashcart.auth.entity.User;
import com.flashcart.cart.dto.AddToCartRequest;
import com.flashcart.cart.dto.CartDto;
import com.flashcart.cart.dto.UpdateCartItemRequest;
import com.flashcart.cart.service.CartService;
import com.flashcart.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cart")
@PreAuthorize("hasRole('CUSTOMER')")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<ApiResponse<CartDto>> getCart(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(cartService.getCart(user.getId())));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<CartDto>> addItem(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody AddToCartRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Item added to cart", cartService.addItem(user.getId(), request)));
    }

    @PutMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<CartDto>> updateItem(
            @AuthenticationPrincipal User user,
            @PathVariable UUID productId,
            @Valid @RequestBody UpdateCartItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cart updated",
                cartService.updateItemQuantity(user.getId(), productId, request)));
    }

    @DeleteMapping("/items/{productId}")
    public ResponseEntity<ApiResponse<CartDto>> removeItem(
            @AuthenticationPrincipal User user,
            @PathVariable UUID productId) {
        return ResponseEntity.ok(ApiResponse.success("Item removed from cart",
                cartService.removeItem(user.getId(), productId)));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> clearCart(@AuthenticationPrincipal User user) {
        cartService.clearCart(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Cart cleared", null));
    }
}
