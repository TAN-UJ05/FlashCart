package com.flashcart.analytics.service;

import com.flashcart.analytics.dto.AnalyticsDashboardDto;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.common.enums.OrderStatus;
import com.flashcart.common.enums.UserRole;
import com.flashcart.flashsale.repository.FlashSaleRepository;
import com.flashcart.inventory.dto.InventoryDto;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.inventory.service.InventoryService;
import com.flashcart.order.entity.Order;
import com.flashcart.order.repository.OrderItemRepository;
import com.flashcart.order.repository.OrderRepository;
import com.flashcart.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private static final List<OrderStatus> REVENUE_STATUSES = List.of(
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED
    );

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final FlashSaleRepository flashSaleRepository;
    private final InventoryService inventoryService;

    @Transactional(readOnly = true)
    public AnalyticsDashboardDto getDashboard(int days) {
        int clampedDays = Math.max(1, Math.min(days, 365));
        Instant since = Instant.now().minus(clampedDays, ChronoUnit.DAYS);

        BigDecimal totalRevenue = orderRepository.sumTotalAmountByStatusIn(REVENUE_STATUSES);
        BigDecimal periodRevenue = orderRepository.sumTotalAmountByStatusInAndCreatedAtAfter(REVENUE_STATUSES, since);
        long totalOrders = orderRepository.count();
        long periodOrders = orderRepository.countByCreatedAtAfter(since);
        long confirmedOrders = orderRepository.countByStatusIn(REVENUE_STATUSES);
        long cancelledOrders = orderRepository.countByStatus(OrderStatus.CANCELLED);
        long pendingOrders = orderRepository.countByStatus(OrderStatus.PENDING)
                + orderRepository.countByStatus(OrderStatus.PAYMENT_PENDING);

        long totalCustomers = userRepository.countByRole(UserRole.CUSTOMER);
        long totalProducts = productRepository.countByActiveTrue();
        long lowStockCount = inventoryRepository.countLowStock(10);
        long activeFlashSalesCount = flashSaleRepository.findLiveFlashSales(Instant.now()).size();

        Map<String, Long> ordersByStatus = new LinkedHashMap<>();
        for (OrderStatus status : OrderStatus.values()) {
            ordersByStatus.put(status.name(), 0L);
        }
        for (Object[] row : orderRepository.countGroupedByStatus()) {
            OrderStatus status = (OrderStatus) row[0];
            Long count = (Long) row[1];
            ordersByStatus.put(status.name(), count);
        }

        // Daily revenue & order trend across the selected window
        Map<LocalDate, DailyAccumulator> dailyMap = new LinkedHashMap<>();
        LocalDate endDate = LocalDate.now(ZoneOffset.UTC);
        LocalDate startDate = endDate.minusDays(clampedDays - 1L);
        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            dailyMap.put(d, new DailyAccumulator());
        }

        List<Order> recentOrders = orderRepository.findAllCreatedSince(since);
        Set<OrderStatus> revenueStatusSet = new HashSet<>(REVENUE_STATUSES);
        for (Order order : recentOrders) {
            if (order.getCreatedAt() == null) {
                continue;
            }
            LocalDate orderDate = order.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            DailyAccumulator acc = dailyMap.get(orderDate);
            if (acc != null) {
                acc.orders++;
                if (revenueStatusSet.contains(order.getStatus())) {
                    acc.revenue = acc.revenue.add(order.getTotalAmount());
                }
            }
        }

        List<AnalyticsDashboardDto.DailyMetricDto> revenueByDay = dailyMap.entrySet().stream()
                .map(e -> AnalyticsDashboardDto.DailyMetricDto.builder()
                        .date(e.getKey().toString())
                        .orders(e.getValue().orders)
                        .revenue(e.getValue().revenue)
                        .build())
                .toList();

        List<AnalyticsDashboardDto.TopProductDto> topProducts = orderItemRepository
                .findTopSellingProducts(REVENUE_STATUSES, PageRequest.of(0, 5))
                .stream()
                .map(row -> AnalyticsDashboardDto.TopProductDto.builder()
                        .productId((UUID) row[0])
                        .productName((String) row[1])
                        .productSku((String) row[2])
                        .unitsSold(((Number) row[3]).longValue())
                        .revenue((BigDecimal) row[4])
                        .build())
                .toList();

        List<InventoryDto> lowStockItems = inventoryRepository.findLowStockInventories(10).stream()
                .limit(10)
                .map(inventoryService::toDto)
                .toList();

        return AnalyticsDashboardDto.builder()
                .totalRevenue(totalRevenue != null ? totalRevenue : BigDecimal.ZERO)
                .periodRevenue(periodRevenue != null ? periodRevenue : BigDecimal.ZERO)
                .totalOrders(totalOrders)
                .periodOrders(periodOrders)
                .confirmedOrders(confirmedOrders)
                .cancelledOrders(cancelledOrders)
                .pendingOrders(pendingOrders)
                .totalCustomers(totalCustomers)
                .totalProducts(totalProducts)
                .lowStockCount(lowStockCount)
                .activeFlashSalesCount(activeFlashSalesCount)
                .revenueByDay(revenueByDay)
                .ordersByStatus(ordersByStatus)
                .topProducts(topProducts)
                .lowStockItems(lowStockItems)
                .build();
    }

    private static class DailyAccumulator {
        long orders = 0;
        BigDecimal revenue = BigDecimal.ZERO;
    }
}
