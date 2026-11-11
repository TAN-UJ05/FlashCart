package com.flashcart.cart.service;

import com.flashcart.auth.entity.User;
import com.flashcart.auth.repository.UserRepository;
import com.flashcart.cart.dto.*;
import com.flashcart.cart.entity.Cart;
import com.flashcart.cart.entity.CartItem;
import com.flashcart.cart.repository.CartItemRepository;
import com.flashcart.cart.repository.CartRepository;
import com.flashcart.common.exception.InsufficientInventoryException;
import com.flashcart.common.exception.InvalidOperationException;
import com.flashcart.common.exception.ResourceNotFoundException;
import com.flashcart.flashsale.entity.FlashSaleItem;
import com.flashcart.flashsale.repository.FlashSaleItemRepository;
import com.flashcart.inventory.entity.Inventory;
import com.flashcart.inventory.repository.InventoryRepository;
import com.flashcart.product.entity.Product;
import com.flashcart.product.entity.ProductImage;
import com.flashcart.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final UserRepository userRepository;

    @Transactional
    public CartDto getCart(UUID userId) {
        Cart cart = getOrCreateCart(userId);
        return buildCartDto(cart);
    }

    @Transactional
    public CartDto addItem(UUID userId, AddToCartRequest request) {
        Cart cart = getOrCreateCart(userId);
        Product product = productRepository.findByIdWithDetails(request.getProductId())
                .orElseThrow(() -> new ResourceNotFoundException("Product", request.getProductId().toString()));

        if (!product.isActive()) {
            throw new InvalidOperationException("Product is no longer available");
        }

        Inventory inventory = inventoryRepository.findByProductId(product.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", product.getId().toString()));

        Optional<CartItem> existingOpt = cartItemRepository.findByCartIdAndProductId(cart.getId(), product.getId());
        int newQuantity = request.getQuantity() + existingOpt.map(CartItem::getQuantity).orElse(0);

        if (inventory.getAvailableStock() < newQuantity) {
            throw new InsufficientInventoryException(
                    "Requested quantity (" + newQuantity + ") exceeds available stock (" + inventory.getAvailableStock() + ")");
        }

        if (existingOpt.isPresent()) {
            CartItem item = existingOpt.get();
            item.setQuantity(newQuantity);
            cartItemRepository.save(item);
        } else {
            CartItem item = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .quantity(newQuantity)
                    .build();
            cart.getItems().add(cartItemRepository.save(item));
        }

        Cart refreshed = cartRepository.findByUserIdWithItems(userId).orElse(cart);
        return buildCartDto(refreshed);
    }

    @Transactional
    public CartDto updateItemQuantity(UUID userId, UUID productId, UpdateCartItemRequest request) {
        Cart cart = getOrCreateCart(userId);
        CartItem item = cartItemRepository.findByCartIdAndProductId(cart.getId(), productId)
                .orElseThrow(() -> new ResourceNotFoundException("CartItem for product", productId.toString()));

        if (request.getQuantity() <= 0) {
            cart.getItems().remove(item);
            cartRepository.saveAndFlush(cart);
        } else {
            Inventory inventory = inventoryRepository.findByProductId(productId)
                    .orElseThrow(() -> new ResourceNotFoundException("Inventory for product", productId.toString()));
            if (inventory.getAvailableStock() < request.getQuantity()) {
                throw new InsufficientInventoryException(
                        "Requested quantity (" + request.getQuantity() + ") exceeds available stock (" + inventory.getAvailableStock() + ")");
            }
            item.setQuantity(request.getQuantity());
            cartItemRepository.save(item);
        }

        Cart refreshed = cartRepository.findByUserIdWithItems(userId).orElse(cart);
        return buildCartDto(refreshed);
    }

    @Transactional
    public CartDto removeItem(UUID userId, UUID productId) {
        Cart cart = getOrCreateCart(userId);
        CartItem item = cartItemRepository.findByCartIdAndProductId(cart.getId(), productId)
                .orElseThrow(() -> new ResourceNotFoundException("CartItem for product", productId.toString()));
        cart.getItems().remove(item);
        cartRepository.saveAndFlush(cart);
        Cart refreshed = cartRepository.findByUserIdWithItems(userId).orElse(cart);
        return buildCartDto(refreshed);
    }

    @Transactional
    public void clearCart(UUID userId) {
        cartRepository.findByUserIdWithItems(userId).ifPresent(cart -> {
            cart.getItems().clear();
            cartRepository.save(cart);
        });
    }

    private Cart getOrCreateCart(UUID userId) {
        return cartRepository.findByUserIdWithItems(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));
            Cart newCart = Cart.builder().user(user).build();
            return cartRepository.save(newCart);
        });
    }

    /**
     * Server-side price recalculation for every cart item.
     */
    private CartDto buildCartDto(Cart cart) {
        Instant now = Instant.now();
        List<CartItemDto> itemDtos = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal discountTotal = BigDecimal.ZERO;
        int totalItems = 0;

        for (CartItem item : cart.getItems()) {
            Product product = item.getProduct();
            Inventory inv = inventoryRepository.findByProductId(product.getId()).orElse(null);
            int availableStock = inv != null ? inv.getAvailableStock() : 0;

            BigDecimal regularPrice = product.getPrice();
            BigDecimal effectivePrice = regularPrice;
            boolean onFlashSale = false;
            UUID flashSaleId = null;

            Optional<FlashSaleItem> liveSale = flashSaleItemRepository.findLiveByProductId(product.getId(), now);
            if (liveSale.isPresent() && liveSale.get().getRemainingStock() >= item.getQuantity()) {
                effectivePrice = liveSale.get().getSalePrice();
                onFlashSale = true;
                flashSaleId = liveSale.get().getFlashSale().getId();
            }

            BigDecimal qty = BigDecimal.valueOf(item.getQuantity());
            BigDecimal lineRegular = regularPrice.multiply(qty);
            BigDecimal lineTotal = effectivePrice.multiply(qty);
            BigDecimal lineDiscount = lineRegular.subtract(lineTotal).max(BigDecimal.ZERO);

            subtotal = subtotal.add(lineRegular);
            discountTotal = discountTotal.add(lineDiscount);
            totalItems += item.getQuantity();

            String imageUrl = product.getImages() != null && !product.getImages().isEmpty()
                    ? product.getImages().stream()
                            .filter(ProductImage::isPrimary)
                            .findFirst()
                            .orElse(product.getImages().get(0))
                            .getImageUrl()
                    : null;

            itemDtos.add(CartItemDto.builder()
                    .id(item.getId())
                    .productId(product.getId())
                    .productName(product.getName())
                    .productSku(product.getSku())
                    .imageUrl(imageUrl)
                    .regularPrice(regularPrice)
                    .effectivePrice(effectivePrice)
                    .onFlashSale(onFlashSale)
                    .flashSaleId(flashSaleId)
                    .quantity(item.getQuantity())
                    .lineTotal(lineTotal)
                    .availableStock(availableStock)
                    .build());
        }

        BigDecimal totalAmount = subtotal.subtract(discountTotal).max(BigDecimal.ZERO);

        return CartDto.builder()
                .id(cart.getId())
                .items(itemDtos)
                .totalItems(totalItems)
                .subtotal(subtotal)
                .discountAmount(discountTotal)
                .totalAmount(totalAmount)
                .build();
    }
}
