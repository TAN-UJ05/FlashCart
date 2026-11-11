package com.flashcart.inventory.controller;

import com.flashcart.common.response.ApiResponse;
import com.flashcart.common.response.PageResponse;
import com.flashcart.inventory.dto.InventoryDto;
import com.flashcart.inventory.dto.StockAdjustmentRequest;
import com.flashcart.inventory.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/inventory")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminInventoryController {

    private final InventoryService inventoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<InventoryDto>>> listInventory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                inventoryService.listInventory(PageRequest.of(page, Math.min(size, 100)))));
    }

    @GetMapping("/low-stock")
    public ResponseEntity<ApiResponse<List<InventoryDto>>> getLowStock(
            @RequestParam(defaultValue = "10") int threshold) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getLowStockItems(threshold)));
    }

    @GetMapping("/product/{productId}")
    public ResponseEntity<ApiResponse<InventoryDto>> getProductInventory(@PathVariable UUID productId) {
        return ResponseEntity.ok(ApiResponse.success(inventoryService.getByProductId(productId)));
    }

    @PutMapping("/product/{productId}/adjust")
    public ResponseEntity<ApiResponse<InventoryDto>> adjustStock(
            @PathVariable UUID productId,
            @Valid @RequestBody StockAdjustmentRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Inventory updated",
                inventoryService.adjustStock(productId, request)));
    }
}
