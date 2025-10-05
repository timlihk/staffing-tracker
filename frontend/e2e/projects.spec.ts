import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should display projects page', async ({ page }) => {
    // Navigate to projects page
    await page.getByRole('link', { name: /projects/i }).first().click();

    // Should display projects list
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Click New Project button
    await page.getByRole('button', { name: /new project/i }).click();

    // Fill in project form
    const projectName = `E2E Test Project ${Date.now()}`;
    await page.getByLabel(/project code/i).fill(projectName);
    await page.getByLabel(/category/i).click();
    await page.getByRole('option', { name: /HK Trx/i }).click();
    await page.getByLabel(/status/i).click();
    await page.getByRole('option', { name: /Active/i }).click();

    // Submit form
    await page.getByRole('button', { name: /create|save/i }).click();

    // Should show success message
    await expect(page.getByText(/created successfully/i)).toBeVisible();

    // Should redirect to projects list or project detail
    await expect(page).toHaveURL(/\/projects/);

    // Should see the new project in the list
    await expect(page.getByText(projectName)).toBeVisible();
  });

  test('should search for projects', async ({ page }) => {
    await page.goto('/projects');

    // Enter search term
    const searchBox = page.getByLabel(/search/i);
    await searchBox.fill('Alpha');

    // Wait for results to update
    await page.waitForTimeout(600); // Wait for debounce

    // Should display filtered results
    const projectRows = page.locator('[role="row"]').filter({ hasText: /Alpha/i });
    await expect(projectRows.first()).toBeVisible();
  });

  test('should filter projects by status', async ({ page }) => {
    await page.goto('/projects');

    // Click status filter
    await page.getByLabel(/status/i).click();
    await page.getByRole('option', { name: /Active/i }).click();

    // Wait for results to update
    await page.waitForTimeout(300);

    // All visible projects should be Active
    const statusCells = page.locator('[role="cell"]').filter({ hasText: /Active/i });
    await expect(statusCells.first()).toBeVisible();
  });

  test('should view project details', async ({ page }) => {
    await page.goto('/projects');

    // Click on first project (assuming there's at least one)
    await page.locator('[role="row"]').nth(1).click();

    // Should navigate to project detail page
    await expect(page).toHaveURL(/\/projects\/\d+/);

    // Should display project information
    await expect(page.getByText(/category|status|priority/i)).toBeVisible();
  });

  test('should edit a project', async ({ page }) => {
    await page.goto('/projects');

    // Click edit button on first project
    await page.locator('[aria-label="edit"]').or(page.getByRole('button', { name: /edit/i })).first().click();

    // Should navigate to edit page
    await expect(page).toHaveURL(/\/projects\/\d+\/edit/);

    // Update project notes
    const notesField = page.getByLabel(/notes/i);
    await notesField.clear();
    await notesField.fill('Updated via E2E test');

    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Should show success message
    await expect(page.getByText(/updated successfully/i)).toBeVisible();
  });

  test('should handle pagination', async ({ page }) => {
    await page.goto('/projects');

    // Check if pagination controls are visible
    const paginationControl = page.getByLabel(/rows per page/i);
    if (await paginationControl.isVisible()) {
      // Change rows per page
      await paginationControl.click();
      await page.getByRole('option', { name: '25' }).click();

      // Table should update
      await page.waitForTimeout(500);
      const rows = page.locator('[role="row"]');
      const rowCount = await rows.count();
      expect(rowCount).toBeLessThanOrEqual(26); // Header + 25 data rows
    }
  });
});
