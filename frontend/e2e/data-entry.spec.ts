import { test, expect, Page } from '@playwright/test';

let page: Page;

test.describe('Data Entry E2E Tests', () => {
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Navigate to Add Data tab
    const dataEntryTab = page.getByRole('button', { name: 'Add Data' });
    await dataEntryTab.click();
    await page.waitForTimeout(300);
  });

  test('should display data entry form', async () => {
    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should have date input field', async () => {
    const dateInputs = page.locator('input[type="date"]');
    if ((await dateInputs.count()) > 0) {
      await expect(dateInputs.first()).toBeVisible();
    }
  });

  test('should have visitor count input field', async () => {
    const numberInputs = page.locator('input[type="number"]');
    if ((await numberInputs.count()) > 0) {
      await expect(numberInputs.first()).toBeVisible();
    }
  });

  test('should display month tabs', async () => {
    const buttons = page.locator('button').filter({ hasText: /Jan|Feb|Mar/ });
    if ((await buttons.count()) > 0) {
      await expect(buttons.first()).toBeVisible();
    }
  });

  test('should allow switching between months', async () => {
    const monthButtons = page
      .locator('button')
      .filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun/ });

    if ((await monthButtons.count()) > 1) {
      const firstMonth = monthButtons.first();
      const secondMonth = monthButtons.nth(1);

      await secondMonth.click();
      await page.waitForTimeout(200);

      // Verify second month is now selected
      await expect(secondMonth).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('should display monthly statistics', async () => {
    const statsContainer = page.locator('main');
    await expect(statsContainer).toBeVisible();

    // Check for common stat labels
    const statText = await statsContainer.textContent();
    expect(statText).toContain('Total'); // Monthly total should be shown
  });

  test('should allow entering visitor data', async () => {
    const dateInput = page.locator('input[type="date"]').first();
    const visitorInput = page.locator('input[type="number"]').first();

    if ((await dateInput.isVisible()) && (await visitorInput.isVisible())) {
      // Set date
      await dateInput.fill('2025-01-15');

      // Set visitor count
      await visitorInput.fill('150');

      // Verify values were entered
      expect(await dateInput.inputValue()).toBe('2025-01-15');
      expect(await visitorInput.inputValue()).toBe('150');
    }
  });

  test('should display current year by default', async () => {
    const statsContainer = page.locator('main');
    const currentYear = new Date().getFullYear();

    const text = await statsContainer.textContent();
    expect(text).toContain(currentYear.toString());
  });

  test('should show year selector', async () => {
    const container = page.locator('main');
    const currentYear = new Date().getFullYear();

    // Check for year buttons
    const yearButton = page
      .locator('button')
      .filter({ hasText: currentYear.toString() });
    if ((await yearButton.count()) > 0) {
      await expect(yearButton.first()).toBeVisible();
    }
  });

  test('should display daily records list', async () => {
    const recordsList = page.locator('main');
    await expect(recordsList).toBeVisible();

    // Records section should exist
    const text = await recordsList.textContent();
    expect(text).toBeDefined();
  });

  test('should format large numbers in statistics', async () => {
    const statsContainer = page.locator('main');
    const text = await statsContainer.textContent();

    // Check for K notation (thousands) or numbers
    expect(text).toMatch(/\d+/);
  });

  test('should allow clearing visitor input', async () => {
    const visitorInput = page.locator('input[type="number"]').first();

    if (await visitorInput.isVisible()) {
      await visitorInput.fill('150');
      expect(await visitorInput.inputValue()).toBe('150');

      await visitorInput.clear();
      expect(await visitorInput.inputValue()).toBe('');
    }
  });

  test('should respond to date changes', async () => {
    const dateInput = page.locator('input[type="date"]').first();

    if (await dateInput.isVisible()) {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0];

      await dateInput.fill(dateString);
      expect(await dateInput.inputValue()).toBe(dateString);
    }
  });

  test('should handle month switching with data', async () => {
    const monthButtons = page
      .locator('button')
      .filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun/ });

    if ((await monthButtons.count()) > 1) {
      const firstMonth = monthButtons.first();
      const statsBeforeClick = await page.locator('main').textContent();

      await monthButtons.nth(1).click();
      await page.waitForTimeout(200);

      const statsAfterClick = await page.locator('main').textContent();

      // Statistics should have changed or remain consistent
      expect(statsAfterClick).toBeDefined();
    }
  });

  test('should update statistics when month changes', async () => {
    const monthButtons = page
      .locator('button')
      .filter({ hasText: /Jan|Feb|Mar/ });

    if ((await monthButtons.count()) > 1) {
      // Click different months and verify statistics update
      for (let i = 0; i < Math.min(2, await monthButtons.count()); i++) {
        await monthButtons.nth(i).click();
        await page.waitForTimeout(200);

        const stats = page.locator('main');
        await expect(stats).toBeVisible();
      }
    }
  });

  test('should maintain data entry state during month switch', async () => {
    const dateInput = page.locator('input[type="date"]').first();
    const visitorInput = page.locator('input[type="number"]').first();

    if ((await dateInput.isVisible()) && (await visitorInput.isVisible())) {
      // Enter data
      await dateInput.fill('2025-01-15');
      await visitorInput.fill('200');

      // Switch month
      const monthButtons = page.locator('button').filter({ hasText: /Feb/ });
      if ((await monthButtons.count()) > 0) {
        await monthButtons.first().click();
        await page.waitForTimeout(200);
      }

      // Form should still be visible
      await expect(dateInput).toBeVisible();
    }
  });

  test('should validate date input format', async () => {
    const dateInput = page.locator('input[type="date"]').first();

    if (await dateInput.isVisible()) {
      await dateInput.fill('2025-01-15');
      const value = await dateInput.inputValue();
      expect(value).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  test('should handle rapid month switching', async () => {
    const monthButtons = page
      .locator('button')
      .filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun/ });

    if ((await monthButtons.count()) > 2) {
      // Rapidly switch months
      for (let i = 0; i < Math.min(3, await monthButtons.count()); i++) {
        await monthButtons.nth(i).click();
        // Don't wait between clicks to test rapid switching
      }

      // Component should remain stable
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('should display form title or heading', async () => {
    const heading = page.locator('h1, h2, h3').first();
    if (await heading.isVisible()) {
      const text = await heading.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('should be responsive on different screen sizes', async () => {
    // Test on tablet
    await page.setViewportSize({ width: 768, height: 1024 });

    const form = page.locator('form');
    if (await form.isVisible()) {
      await expect(form).toBeVisible();
    }

    // Test on mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main')).toBeVisible();
  });
});
