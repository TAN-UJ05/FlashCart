-- User indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Refresh token indexes
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Product indexes
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_price ON products(price);

-- Inventory indexes
CREATE INDEX idx_inventory_product_id ON inventory(product_id);

-- Inventory reservation indexes
CREATE INDEX idx_inv_res_inventory_id_status ON inventory_reservations(inventory_id, status);
CREATE INDEX idx_inv_res_idempotency_key ON inventory_reservations(idempotency_key);
CREATE INDEX idx_inv_res_expires_at_status ON inventory_reservations(expires_at) WHERE status = 'CREATED';
CREATE INDEX idx_inv_res_user_id ON inventory_reservations(user_id);
CREATE INDEX idx_inv_res_order_id ON inventory_reservations(order_id);

-- Order indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Order item indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Payment indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
CREATE INDEX idx_payments_status ON payments(status);

-- Flash sale indexes
CREATE INDEX idx_flash_sales_active ON flash_sales(active);
CREATE INDEX idx_flash_sales_start_end ON flash_sales(start_time, end_time);
CREATE INDEX idx_flash_sale_items_flash_sale_id ON flash_sale_items(flash_sale_id);
CREATE INDEX idx_flash_sale_items_product_id ON flash_sale_items(product_id);

-- Outbox indexes
CREATE INDEX idx_outbox_status_created ON outbox_events(status, created_at) WHERE status = 'PENDING';

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- Cart indexes
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
