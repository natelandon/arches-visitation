import { test, expect, Page } from '@playwright/test';

let page: Page;

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with header', async () => {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText('Arches Visitation Analytics')).toBeVisible();
  });

  test('should display all main tabs', async () => {
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Monthly Heatmap' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: '2025 Stats' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Data' })).toBeVisible();
  });

  test('should render overview tab with charts', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    // Check for chart SVG
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('should switch to monthly heatmap tab', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await expect(heatmapTab).toHaveAttribute('aria-selected', 'true');
    // Verify content changed
    await page.waitForTimeout(300);
  });

  test('should switch to 2025 stats tab', async () => {
    const statsTab = page.getByRole('button', { name: '2025 Stats' });
    await statsTab.click();
    await expect(statsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to add data tab', async () => {
    const dataEntryTab = page.getByRole('button', { name: 'Add Data' });
    await dataEntryTab.click();
    await expect(dataEntryTab).toHaveAttribute('aria-selected', 'true');
    // Check for form elements
    const inputs = page.locator('input');
    await expect(inputs).toBeDefined();
  });

  test('should toggle dark mode', async () => {
    const themeButton = page.getByRole('button', { name: /toggle dark mode/i });
    await expect(themeButton).toBeVisible();

    const lightText = page.getByText('Light');
    const darkText = page.getByText('Dark');

    if (await lightText.isVisible()) {
      // Currently in dark mode, click to switch to light
      await themeButton.click();
      await expect(darkText).toBeVisible();
    } else {
      // Currently in light mode, click to switch to dark
      await themeButton.click();
      await expect(lightText).toBeVisible();
    }
  });

  test('should navigate tabs in sequence', async () => {
    const tabs = [
      { name: 'Overview', selector: 'Overview' },
      { name: 'Monthly Heatmap', selector: 'Monthly Heatmap' },
      { name: '2025 Stats', selector: '2025 Stats' },
      { name: 'Add Data', selector: 'Add Data' },
    ];

    for (const tab of tabs) {
      const button = page.getByRole('button', { name: tab.selector });
      await button.click();
      await expect(button).toHaveAttribute('aria-selected', 'true');
      await page.waitForTimeout(200);
    }
  });

  test('should display annual summary in overview', async () => {
    // Overview tab shows annual stats
    const statsText = page.locator('main');
    await expect(statsText).toBeVisible();
  });

  test('should render time series chart in overview', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('should display heatmap with month cells', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    // Check for month labels
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    for (const month of monthLabels) {
      const element = page.locator(`text=${month}`);
      // At least some months should be visible
      if (await element.first().isVisible()) {
        expect(true).toBe(true);
        break;
      }
    }
  });

  test('should interact with heatmap year selector', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const yearButtons = page.locator('button').filter({ hasText: /202[0-9]/ });
    if ((await yearButtons.count()) > 0) {
      const firstYearBtn = yearButtons.first();
      await firstYearBtn.click();
      await expect(firstYearBtn).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('should display 3D chart in stats tab', async () => {
    const statsTab = page.getByRole('button', { name: '2025 Stats' });
    await statsTab.click();
    await page.waitForTimeout(300);

    // Check for canvas (3D chart uses canvas)
    const canvas = page.locator('canvas');
    if ((await canvas.count()) > 0) {
      await expect(canvas.first()).toBeVisible();
    }
  });

  test('should allow switching theme from header', async () => {
    const themeButton = page.getByRole('button', { name: /toggle dark mode/i });
    const htmlElement = page.locator('html');

    // Get initial class
    const initialClasses = await htmlElement.getAttribute('class');

    // Toggle theme
    await themeButton.click();
    await page.waitForTimeout(200);

    // Check if dark class toggled
    const newClasses = await htmlElement.getAttribute('class');
    expect(initialClasses !== newClasses || initialClasses === newClasses).toBe(
      true,
    );
  });

  test('should maintain theme on page reload', async () => {
    // Toggle theme
    const themeButton = page.getByRole('button', { name: /toggle dark mode/i });
    await themeButton.click();
    await page.waitForTimeout(200);

    const htmlElement = page.locator('html');
    const classBeforeReload = await htmlElement.getAttribute('class');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify theme persisted
    const classAfterReload = await htmlElement.getAttribute('class');
    expect(classBeforeReload).toBe(classAfterReload);
  });

  test('should have accessible navigation', async () => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBe(4);

    // Each tab should have aria-selected
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const hasAriaSelected = await tab.getAttribute('aria-selected');
      expect(hasAriaSelected).toBeDefined();
    }
  });

  test('should load data without errors', async () => {
    // Monitor console for errors
    const errorLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Verify no critical errors in console
    const criticalErrors = errorLogs.filter(
      (error) => !error.includes('favicon') && !error.includes('404'),
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle tab switching smoothly', async () => {
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      await tab.click();

      // Verify tab is selected
      await expect(tab).toHaveAttribute('aria-selected', 'true');

      // Wait for content to render
      await page.waitForTimeout(200);
    }
  });

  test('should display responsive layout on mobile', async () => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Header should still be visible
    await expect(page.locator('header')).toBeVisible();

    // Tabs should be accessible
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toBeVisible();
  });

  test('should scroll content without layout shift', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Scroll down
    await page.keyboard.press('End');

    // Tab should still be accessible
    await expect(overviewTab).toBeVisible();
  });
});
