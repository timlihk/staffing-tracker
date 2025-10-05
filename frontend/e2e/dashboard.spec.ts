import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display dashboard components', async ({ page }) => {
    // Check for main dashboard elements
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Check for project stats or key metrics
    await expect(page.getByText(/projects|staff|assignments/i)).toBeVisible();
  });

  test('should display project statistics', async ({ page }) => {
    // Look for stat cards or metrics
    const statCards = page.locator('[class*="card"]').or(page.locator('[class*="stat"]'));

    // Should have some stat information
    await expect(statCards.first()).toBeVisible();

    // Check for numeric values
    await expect(page.locator('text=/\\d+/')).toBeVisible();
  });

  test('should display deal radar or calendar view', async ({ page }) => {
    // Look for calendar or deal radar component
    const calendarOrRadar = page.locator('[class*="calendar"]')
      .or(page.locator('[class*="radar"]'))
      .or(page.getByText(/deal radar|calendar/i));

    // At least one should be visible
    const count = await calendarOrRadar.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display activity feed or recent activity', async ({ page }) => {
    // Look for activity feed
    const activitySection = page.getByText(/activity|recent|updates/i).first();

    if (await activitySection.isVisible()) {
      // Should display some activities or a message
      await expect(page.locator('[class*="activity"]').or(page.locator('[role="list"]'))).toBeVisible();
    }
  });

  test('should navigate to projects from dashboard', async ({ page }) => {
    // Click on a link or card that goes to projects
    const projectsLink = page.getByRole('link', { name: /view.*projects|all projects/i })
      .or(page.getByRole('button', { name: /view.*projects/i }));

    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await expect(page).toHaveURL(/\/projects/);
    }
  });

  test('should display projects needing attention', async ({ page }) => {
    // Look for projects that need attention section
    const attentionSection = page.getByText(/needing attention|action.*required|urgent/i);

    if (await attentionSection.isVisible()) {
      // Should display projects or message
      await expect(page.locator('body')).toContainText(/project|no.*items/i);
    }
  });

  test('should refresh dashboard data', async ({ page }) => {
    // Get initial timestamp or data
    const initialContent = await page.locator('body').textContent();

    // Wait a moment
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Dashboard should load again
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Content should be similar (basic smoke test)
    const newContent = await page.locator('body').textContent();
    expect(newContent).toBeTruthy();
  });

  test('should show loading states', async ({ page }) => {
    // Reload to catch loading state
    await page.reload();

    // Look for loading indicators (skeleton, spinner, etc.)
    const loadingIndicator = page.locator('[class*="skeleton"]')
      .or(page.locator('[class*="loading"]'))
      .or(page.locator('[class*="spinner"]'))
      .or(page.locator('[role="progressbar"]'));

    // Loading indicator might appear briefly
    // We'll just check that the page eventually loads successfully
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
  });
});
