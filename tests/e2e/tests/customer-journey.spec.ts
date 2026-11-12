import { test, expect } from '@playwright/test';

test.describe('Customer Journey', () => {
  test('complete purchase flow', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto('/');
    await expect(page.getByText('FlashCart').first()).toBeVisible();

    // 2. Browse products
    await page.locator('header a[href="/products"]').click();
    await expect(page.getByTestId('product-grid')).toBeVisible();

    // 3. Search for a product
    await page.fill('[data-testid="search-input"]', 'laptop');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('search-results')).toBeVisible();

    // 4. Register a new account
    await page.goto('/register');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'TestPassword@123');
    await page.fill('[name="confirmPassword"]', 'TestPassword@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    // 5. Add product to cart
    await page.goto('/products');
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('[data-testid="add-to-cart-button"]');
    await expect(page.getByTestId('cart-count')).toContainText('1');

    // 6. View cart
    await page.goto('/cart');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    // 7. Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL('/checkout');

    // Fill shipping details
    await page.fill('[name="fullName"]', 'Test User');
    await page.fill('[name="addressLine1"]', '123 Test Street');
    await page.fill('[name="city"]', 'Mumbai');
    await page.fill('[name="state"]', 'Maharashtra');
    await page.fill('[name="postalCode"]', '400001');
    await page.click('[data-testid="place-order-button"]');

    // 8. Payment simulation
    await expect(page).toHaveURL(/\/payment-result/);
    await page.click('[data-testid="simulate-success-button"]');
    await expect(page.getByTestId('payment-success')).toBeVisible();

    // 9. View order
    await page.goto('/orders');
    await expect(page.getByTestId('order-item')).toHaveCount(1);
  });

  test('admin can manage products', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@flashcart.com');
    await page.fill('[name="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/admin');

    // Create a product
    const uniqueSku = `SKU-TEST-${Date.now()}`;
    await page.click('a[href="/admin/products"]');
    await page.click('[data-testid="create-product-button"]');
    await page.fill('[name="name"]', 'Test Product E2E');
    await page.fill('[name="sku"]', uniqueSku);
    await page.fill('[name="price"]', '999.99');
    await page.fill('[name="description"]', 'Test product for E2E testing');
    await page.click('[data-testid="save-product-button"]');
    await expect(page.getByText(uniqueSku)).toBeVisible();
  });
});
