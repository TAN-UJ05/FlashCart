-- Seed Users (BCrypt hashes verified for Admin@123456 and Customer@123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, enabled) VALUES
    ('admin@flashcart.com', '$2a$10$GReIY6sSBAsGHZ6UyHiMH.XDODJvvDeulZY/6aOnzQVzIAU3CPx9e', 'FlashCart', 'Admin', '+91-9800000001', 'ADMIN', true),
    ('customer1@flashcart.com', '$2a$10$G.kDGjgyNvv2q6RnWVXMRuuQoKoV/fSS1vqgnHCKkxH2fBBBqZ2fm', 'Aarav', 'Sharma', '+91-9800000002', 'CUSTOMER', true),
    ('customer2@flashcart.com', '$2a$10$G.kDGjgyNvv2q6RnWVXMRuuQoKoV/fSS1vqgnHCKkxH2fBBBqZ2fm', 'Priya', 'Patel', '+91-9800000003', 'CUSTOMER', true);

-- Seed Saved Addresses for Customers
INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
SELECT id, 'Aarav Sharma', '+91-9800000002', '42 Indiranagar 100 Feet Road', 'Apt 4B', 'Bengaluru', 'Karnataka', '560038', 'India', true
FROM users WHERE email = 'customer1@flashcart.com';

INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
SELECT id, 'Priya Patel', '+91-9800000003', '18 Marine Drive', 'Floor 7', 'Mumbai', 'Maharashtra', '400020', 'India', true
FROM users WHERE email = 'customer2@flashcart.com';

-- Seed Categories (6 categories matching seed-images/seed-*.svg)
INSERT INTO categories (name, description, slug, image_url, active, sort_order) VALUES
    ('Electronics', 'Flagship laptops, audio gear, wearables, and accessories', 'electronics', '/api/v1/images/seed-electronics.svg', true, 1),
    ('Clothing', 'Everyday essentials, outerwear, and active apparel', 'clothing', '/api/v1/images/seed-clothing.svg', true, 2),
    ('Books', 'Engineering, system design, and technical architecture titles', 'books', '/api/v1/images/seed-books.svg', true, 3),
    ('Home & Kitchen', 'Modern appliances, cookware, and smart home lighting', 'home-kitchen', '/api/v1/images/seed-home.svg', true, 4),
    ('Sports', 'Fitness equipment, cycling gear, and training essentials', 'sports', '/api/v1/images/seed-sports.svg', true, 5),
    ('Beauty', 'Skincare serums, haircare, and daily sun protection', 'beauty', '/api/v1/images/seed-beauty.svg', true, 6);

-- Seed Products (30 products across 6 categories)
INSERT INTO products (name, description, sku, price, compare_at_price, category_id, active) VALUES
    -- Electronics
    ('FlashCart Pro Laptop 15', 'High-performance 15-inch developer laptop with 32GB RAM, 1TB NVMe SSD, and 120Hz display.', 'ELEC-001', 84999.00, 99999.00, (SELECT id FROM categories WHERE slug = 'electronics'), true),
    ('UltraBook Air Laptop 14', 'Lightweight 14-inch aluminum ultrabook laptop with all-day battery life and Thunderbolt 4.', 'ELEC-002', 64999.00, 74999.00, (SELECT id FROM categories WHERE slug = 'electronics'), true),
    ('SonicPulse Wireless ANC Headphones', 'Active noise-cancelling over-ear headphones with 40-hour battery and lossless USB-C audio.', 'ELEC-003', 12999.00, 16999.00, (SELECT id FROM categories WHERE slug = 'electronics'), true),
    ('ChronoFit AMOLED Smartwatch', 'Always-on AMOLED fitness smartwatch with dual-band GPS and 10-day endurance.', 'ELEC-004', 9999.00, 13999.00, (SELECT id FROM categories WHERE slug = 'electronics'), true),
    ('MechKey Pro 75% Mechanical Keyboard', 'Hot-swappable wireless tactile mechanical keyboard with PBT keycaps and aluminum frame.', 'ELEC-005', 5499.00, 6999.00, (SELECT id FROM categories WHERE slug = 'electronics'), true),

    -- Clothing
    ('UrbanWeave Classic Denim Jacket', 'Structured 12oz organic cotton denim jacket built for multi-season layering.', 'CLOT-001', 2999.00, 3999.00, (SELECT id FROM categories WHERE slug = 'clothing'), true),
    ('MerinoTouch Slim Fit Polo Shirt', 'Breathable fine-knit merino blend polo shirt with tailored collar retention.', 'CLOT-002', 1499.00, 1999.00, (SELECT id FROM categories WHERE slug = 'clothing'), true),
    ('AeroStride Breathable Running Hoodie', 'Moisture-wicking lightweight athletic zip hoodie with reflective accents.', 'CLOT-003', 2299.00, 2899.00, (SELECT id FROM categories WHERE slug = 'clothing'), true),
    ('LinenCraft Tailored Chino Trousers', 'Comfort-stretch tapered chino trousers suitable for work and weekend travel.', 'CLOT-004', 1999.00, 2599.00, (SELECT id FROM categories WHERE slug = 'clothing'), true),
    ('CloudKnit Thermal Crewneck Sweater', 'Ultra-soft brushed fleece crewneck sweater with ribbed cuffs and hem.', 'CLOT-005', 2499.00, 3199.00, (SELECT id FROM categories WHERE slug = 'clothing'), true),

    -- Books
    ('Designing Distributed Commerce Systems', 'Practical architecture patterns for high-concurrency inventory, outbox messaging, and consistency.', 'BOOK-001', 1299.00, 1599.00, (SELECT id FROM categories WHERE slug = 'books'), true),
    ('Pragmatic Concurrent Java 21', 'Deep guide to virtual threads, structured concurrency, locks, and JVM memory models.', 'BOOK-002', 999.00, 1299.00, (SELECT id FROM categories WHERE slug = 'books'), true),
    ('Database Internals & Indexing Deep Dive', 'Understand B-trees, MVCC snapshots, pessimistic locking, and PostgreSQL query planning.', 'BOOK-003', 1499.00, 1899.00, (SELECT id FROM categories WHERE slug = 'books'), true),
    ('Clean Frontend Architecture with TypeScript', 'State management, server cache invalidation, and accessible component design with React.', 'BOOK-004', 899.00, 1199.00, (SELECT id FROM categories WHERE slug = 'books'), true),
    ('Zero-Downtime Cloud Migrations Handbook', 'Blue-green deployments, schema evolution with Flyway, and observability in production.', 'BOOK-005', 1099.00, 1399.00, (SELECT id FROM categories WHERE slug = 'books'), true),

    -- Home & Kitchen
    ('BaristaPress Espresso Coffee Maker', '15-bar precision espresso machine with stainless steel steam wand and PID temperature control.', 'HOME-001', 14999.00, 18999.00, (SELECT id FROM categories WHERE slug = 'home-kitchen'), true),
    ('CrispAir Digital 5L Air Fryer', 'Rapid 360-degree convection air fryer with non-stick ceramic basket and 8 presets.', 'HOME-002', 6499.00, 8499.00, (SELECT id FROM categories WHERE slug = 'home-kitchen'), true),
    ('PureBreeze HEPA Smart Air Purifier', 'True H13 HEPA air purifier covering 500 sq ft with real-time PM2.5 laser sensor.', 'HOME-003', 11999.00, 14999.00, (SELECT id FROM categories WHERE slug = 'home-kitchen'), true),
    ('ChefForge Cast Iron Dutch Oven', 'Enameled 4.5-quart heavy cast iron Dutch oven for slow braising and artisan baking.', 'HOME-004', 4499.00, 5999.00, (SELECT id FROM categories WHERE slug = 'home-kitchen'), true),
    ('LumaGlow Adjustable Desk LED Lamp', 'Flicker-free architectural task lamp with stepless dimming and warm-to-daylight presets.', 'HOME-005', 1899.00, 2499.00, (SELECT id FROM categories WHERE slug = 'home-kitchen'), true),

    -- Sports
    ('CarbonLite Pro Badminton Racket', 'Ultra-light 82g carbon graphite frame engineered for fast swing speed and crisp control.', 'SPRT-001', 3999.00, 4999.00, (SELECT id FROM categories WHERE slug = 'sports'), true),
    ('TerraGrip Cushioned Yoga Mat 8mm', 'High-density closed-cell TPE yoga mat with laser-etched alignment lines and carry strap.', 'SPRT-002', 1299.00, 1699.00, (SELECT id FROM categories WHERE slug = 'sports'), true),
    ('VelocityX Carbon Road Cycling Helmet', 'Aerodynamic MIPS-equipped ventilated cycling helmet with dial fit retention.', 'SPRT-003', 4999.00, 6299.00, (SELECT id FROM categories WHERE slug = 'sports'), true),
    ('IronCore Adjustable Dumbbell Pair 20kg', 'Space-saving quick-dial adjustable dumbbells ranging from 2kg to 20kg per hand.', 'SPRT-004', 7499.00, 8999.00, (SELECT id FROM categories WHERE slug = 'sports'), true),
    ('HydroMax Insulated Stainless Flask 1L', 'Double-wall vacuum insulated bottle keeping water cold for 24 hours.', 'SPRT-005', 999.00, 1299.00, (SELECT id FROM categories WHERE slug = 'sports'), true),

    -- Beauty
    ('HydraSilk Vitamin C Glow Serum 30ml', 'Stabilized 15% L-ascorbic acid and hyaluronic serum for brighter skin tone.', 'BEAU-001', 1199.00, 1599.00, (SELECT id FROM categories WHERE slug = 'beauty'), true),
    ('Botanica Deep Repair Argan Hair Mask', 'Cold-pressed Moroccan argan and keratin conditioning mask for dry hair.', 'BEAU-002', 899.00, 1199.00, (SELECT id FROM categories WHERE slug = 'beauty'), true),
    ('SolarShield Matte SPF 50 Sunscreen', 'Broad-spectrum PA++++ non-greasy daily mineral-hybrid UV protection.', 'BEAU-003', 699.00, 899.00, (SELECT id FROM categories WHERE slug = 'beauty'), true),
    ('VelvetMist Botanical Facial Toner', 'Alcohol-free rosewater and niacinamide hydrating mist for balanced skin barrier.', 'BEAU-004', 799.00, 999.00, (SELECT id FROM categories WHERE slug = 'beauty'), true),
    ('IonicPro Ceramic Hair Styling Dryer', 'Brushless motor negative-ion hair dryer for fast drying without heat damage.', 'BEAU-005', 3499.00, 4499.00, (SELECT id FROM categories WHERE slug = 'beauty'), true);

-- Seed Primary Product Images
INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
SELECT
    p.id,
    CASE c.slug
        WHEN 'electronics' THEN '/api/v1/images/seed-electronics.svg'
        WHEN 'clothing' THEN '/api/v1/images/seed-clothing.svg'
        WHEN 'books' THEN '/api/v1/images/seed-books.svg'
        WHEN 'home-kitchen' THEN '/api/v1/images/seed-home.svg'
        WHEN 'sports' THEN '/api/v1/images/seed-sports.svg'
        WHEN 'beauty' THEN '/api/v1/images/seed-beauty.svg'
        ELSE '/api/v1/images/seed-electronics.svg'
    END,
    p.name,
    0,
    true
FROM products p
JOIN categories c ON p.category_id = c.id;

-- Seed Inventory for All 30 Products (includes high-stock flash sale items and low-stock items <= 10)
INSERT INTO inventory (product_id, total_stock, reserved_stock, version)
SELECT
    p.id,
    CASE p.sku
        WHEN 'ELEC-001' THEN 150
        WHEN 'ELEC-002' THEN 80
        WHEN 'ELEC-003' THEN 120
        WHEN 'ELEC-004' THEN 90
        WHEN 'ELEC-005' THEN 8
        WHEN 'CLOT-001' THEN 75
        WHEN 'CLOT-002' THEN 140
        WHEN 'CLOT-003' THEN 60
        WHEN 'CLOT-004' THEN 9
        WHEN 'CLOT-005' THEN 55
        WHEN 'BOOK-001' THEN 110
        WHEN 'BOOK-002' THEN 95
        WHEN 'BOOK-003' THEN 70
        WHEN 'BOOK-004' THEN 7
        WHEN 'BOOK-005' THEN 65
        WHEN 'HOME-001' THEN 45
        WHEN 'HOME-002' THEN 85
        WHEN 'HOME-003' THEN 50
        WHEN 'HOME-004' THEN 6
        WHEN 'HOME-005' THEN 100
        WHEN 'SPRT-001' THEN 60
        WHEN 'SPRT-002' THEN 130
        WHEN 'SPRT-003' THEN 40
        WHEN 'SPRT-004' THEN 5
        WHEN 'SPRT-005' THEN 150
        WHEN 'BEAU-001' THEN 110
        WHEN 'BEAU-002' THEN 90
        WHEN 'BEAU-003' THEN 160
        WHEN 'BEAU-004' THEN 8
        WHEN 'BEAU-005' THEN 45
        ELSE 50
    END,
    0,
    0
FROM products p;

-- Seed 1 Live Flash Sale (active NOW - 1h to NOW + 24h)
INSERT INTO flash_sales (name, description, start_time, end_time, active, created_by)
VALUES (
    'Weekend Tech Lightning Sale',
    'Limited-quantity flash deals on top electronics with instant inventory reservation.',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '24 hours',
    true,
    (SELECT id FROM users WHERE email = 'admin@flashcart.com')
);

-- Seed 3 Flash Sale Items (ELEC-001 has sale_stock = 100, inventory total_stock = 150)
INSERT INTO flash_sale_items (flash_sale_id, product_id, sale_price, sale_stock, sold_count)
VALUES
    (
        (SELECT id FROM flash_sales WHERE name = 'Weekend Tech Lightning Sale' LIMIT 1),
        (SELECT id FROM products WHERE sku = 'ELEC-001'),
        69999.00,
        100,
        0
    ),
    (
        (SELECT id FROM flash_sales WHERE name = 'Weekend Tech Lightning Sale' LIMIT 1),
        (SELECT id FROM products WHERE sku = 'ELEC-003'),
        7999.00,
        60,
        0
    ),
    (
        (SELECT id FROM flash_sales WHERE name = 'Weekend Tech Lightning Sale' LIMIT 1),
        (SELECT id FROM products WHERE sku = 'ELEC-004'),
        5999.00,
        40,
        0
    );
