package com.flashcart.flashsale.controller;

import com.flashcart.auth.entity.User;
import com.flashcart.common.response.ApiResponse;
import com.flashcart.flashsale.dto.FlashSaleDto;
import com.flashcart.flashsale.dto.FlashSaleItemRequest;
import com.flashcart.flashsale.dto.FlashSaleRequest;
import com.flashcart.flashsale.service.FlashSaleService;
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
@RequestMapping("/api/v1/admin/flash-sales")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminFlashSaleController {

    private final FlashSaleService flashSaleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FlashSaleDto>>> getAllFlashSales() {
        return ResponseEntity.ok(ApiResponse.success(flashSaleService.getAllFlashSalesForAdmin()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FlashSaleDto>> createFlashSale(
            @AuthenticationPrincipal User admin,
            @Valid @RequestBody FlashSaleRequest request) {
        FlashSaleDto created = flashSaleService.createFlashSale(admin, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Flash sale created", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<FlashSaleDto>> updateFlashSale(
            @PathVariable UUID id,
            @Valid @RequestBody FlashSaleRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Flash sale updated",
                flashSaleService.updateFlashSale(id, request)));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<ApiResponse<FlashSaleDto>> addOrUpdateItem(
            @PathVariable UUID id,
            @Valid @RequestBody FlashSaleItemRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Flash sale item saved",
                flashSaleService.addOrUpdateItem(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivateFlashSale(@PathVariable UUID id) {
        flashSaleService.deactivateFlashSale(id);
        return ResponseEntity.ok(ApiResponse.success("Flash sale deactivated", null));
    }
}
