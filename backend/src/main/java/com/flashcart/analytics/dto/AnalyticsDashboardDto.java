package com.flashcart.analytics.dto;

import com.flashcart.inventory.dto.InventoryDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsDashboardDto {
    private BigDecimal totalRevenue;
    private BigDecimal periodRevenue;
    private long totalOrders;
    private long periodOrders;
    private long confirmedOrders;
    private long cancelledOrders;
    private long pendingOrders;
    private long totalCustomers;
    private long totalProducts;
    private long lowStockCount;
    private long activeFlashSalesCount;
    private List<DailyMetricDto> revenueByDay;
    private Map<String, Long> ordersByStatus;
    private List<TopProductDto> topProducts;
    private List<InventoryDto> lowStockItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyMetricDto {
        private String date;
        private long orders;
        private BigDecimal revenue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopProductDto {
        private UUID productId;
        private String productName;
        private String productSku;
        private long unitsSold;
        private BigDecimal revenue;
    }
}
