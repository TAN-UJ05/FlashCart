package com.flashcart.cart;

import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.cart.dto.AddToCartRequest;
import com.flashcart.cart.dto.CartDto;
import com.flashcart.cart.entity.Cart;
import com.flashcart.cart.entity.CartItem;
import com.flashcart.cart.repository.CartItemRepository;
import com.flashcart.cart.repository.CartRepository;
import com.flashcart.cart.service.CartService;
import com.flashcart.common.exception.InsufficientInventoryException;
import com.flashcart.flashsale.entity.FlashSale;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.product.entity.Product;
import com.flashcart.product.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock private CartRepository cartRepository;
    @Mock private CartItemRepository cartItemRepository;
    @Mock private ProductRepository productRepository;
    @Mock private InventoryRepository inventoryRepository;
    @Mock private FlashSaleItemRepository flashSaleItemRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private CartService cartService;

    @Test
    void getCart_recalculatesServerSidePricesWithActiveFlashSale() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("c@flashcart.com").build();
        Product product = Product.builder()
                .id(UUID.randomUUID())
                .name("Headphones")
                .sku("HP-100")
                .price(new BigDecimal("200.00"))
                .active(true)
                .images(new ArrayList<>())
                .build();

        Cart cart = Cart.builder().id(UUID.randomUUID()).user(user).items(new ArrayList<>()).build();
        CartItem item = CartItem.builder().id(UUID.randomUUID()).cart(cart).product(product).quantity(2).build();
        cart.setItems(List.of(item));

        FlashSale flashSale = FlashSale.builder().id(UUID.randomUUID()).name("Flash").build();
        FlashSaleItem saleItem = FlashSaleItem.builder()
                .id(UUID.randomUUID())
                .flashSale(flashSale)
                .product(product)
                .salePrice(new BigDecimal("120.00"))
                .saleStock(50)
                .soldCount(5)
                .build();

        when(cartRepository.findByUserIdWithItems(userId)).thenReturn(Optional.of(cart));
        when(inventoryRepository.findByProductId(product.getId())).thenReturn(Optional.of(
                Inventory.builder().product(product).totalStock(50).reservedStock(0).build()));
        when(flashSaleItemRepository.findLiveByProductId(eq(product.getId()), any(Instant.class)))
                .thenReturn(Optional.of(saleItem));

        CartDto dto = cartService.getCart(userId);

        assertThat(dto.getSubtotal()).isEqualByComparingTo("400.00");
        assertThat(dto.getDiscountAmount()).isEqualByComparingTo("160.00");
        assertThat(dto.getTotalAmount()).isEqualByComparingTo("240.00");
        assertThat(dto.getItems().get(0).isOnFlashSale()).isTrue();
    }

    @Test
    void addItem_exceedingAvailableStock_throwsInsufficientInventory() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("c@flashcart.com").build();
        Product product = Product.builder().id(UUID.randomUUID()).name("TV").sku("TV-1").price(BigDecimal.TEN).active(true).build();
        Cart cart = Cart.builder().id(UUID.randomUUID()).user(user).items(new ArrayList<>()).build();

        when(cartRepository.findByUserIdWithItems(userId)).thenReturn(Optional.of(cart));
        when(productRepository.findByIdWithDetails(product.getId())).thenReturn(Optional.of(product));
        when(inventoryRepository.findByProductId(product.getId())).thenReturn(Optional.of(
                Inventory.builder().product(product).totalStock(5).reservedStock(3).build()));
        when(cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cartService.addItem(userId, AddToCartRequest.builder()
                .productId(product.getId()).quantity(3).build()))
                .isInstanceOf(InsufficientInventoryException.class);
    }

    @Test
    void clearCart_usesOrphanRemovalWithoutBulkDeleteConflict() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("c@flashcart.com").build();
        Product product = Product.builder().id(UUID.randomUUID()).name("TV").sku("TV-1").price(BigDecimal.TEN).active(true).build();
        Cart cart = Cart.builder().id(UUID.randomUUID()).user(user).items(new ArrayList<>()).build();
        cart.getItems().add(CartItem.builder().id(UUID.randomUUID()).cart(cart).product(product).quantity(1).build());

        when(cartRepository.findByUserIdWithItems(userId)).thenReturn(Optional.of(cart));

        cartService.clearCart(userId);

        assertThat(cart.getItems()).isEmpty();
        verify(cartRepository).save(cart);
        verify(cartItemRepository, never()).deleteByCartId(any());
    }

    @Test
    void removeItem_usesOrphanRemovalWithoutDoubleDelete() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("c@flashcart.com").build();
        Product product = Product.builder().id(UUID.randomUUID()).name("TV").sku("TV-1").price(BigDecimal.TEN).active(true).build();
        Cart cart = Cart.builder().id(UUID.randomUUID()).user(user).items(new ArrayList<>()).build();
        CartItem item = CartItem.builder().id(UUID.randomUUID()).cart(cart).product(product).quantity(1).build();
        cart.getItems().add(item);

        when(cartRepository.findByUserIdWithItems(userId)).thenReturn(Optional.of(cart));
        when(cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId())).thenReturn(Optional.of(item));

        CartDto result = cartService.removeItem(userId, product.getId());

        assertThat(cart.getItems()).isEmpty();
        assertThat(result.getItems()).isEmpty();
        verify(cartRepository).saveAndFlush(cart);
        verify(cartItemRepository, never()).delete(any());
    }
}
