import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Staffing Tracker/i);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('admin123');

    // Click login button
    await page.getByRole('button', { name: /login/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Should display dashboard elements
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Fill in login form with invalid credentials
    await page.getByLabel(/username/i).fill('wronguser');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Click login button
    await page.getByRole('button', { name: /login/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login/i }).click();

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Click logout button (usually in header or menu)
    await page.getByRole('button', { name: /logout/i }).click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  });

  test('should require authentication for protected routes', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
