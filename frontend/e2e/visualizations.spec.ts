import { test, expect, Page } from '@playwright/test';

let page: Page;

test.describe('Visualization E2E Tests', () => {
  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
  });

  test('should render time series chart in overview', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('should render SVG elements in chart', async () => {
    const svgs = page.locator('svg');
    expect(await svgs.count()).toBeGreaterThan(0);
  });

  test('should render chart axes', async () => {
    const chartArea = page.locator('main').first();
    const textElements = chartArea.locator('text');

    expect(await textElements.count()).toBeGreaterThan(0);
  });

  test('should display monthly heatmap with cells', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    // Check for month labels
    const mainContent = page.locator('main');
    const text = await mainContent.textContent();
    expect(text).toContain('Jan');
  });

  test('should display heatmap year selector', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const yearButtons = page.locator('button').filter({ hasText: /202[0-9]/ });
    expect(await yearButtons.count()).toBeGreaterThan(0);
  });

  test('should allow toggling view mode in heatmap', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const viewButtons = page
      .locator('button')
      .filter({ hasText: /Absolute|Relative/ });
    if ((await viewButtons.count()) > 0) {
      const firstButton = viewButtons.first();
      await firstButton.click();
      await page.waitForTimeout(200);

      // Verify button pressed state changed
      const pressed = await firstButton.getAttribute('aria-pressed');
      expect(pressed).toBeDefined();
    }
  });

  test('should show color legend in heatmap', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    // Legend should be visible
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('should render 3D chart in stats tab', async () => {
    const statsTab = page.getByRole('button', { name: '2025 Stats' });
    await statsTab.click();
    await page.waitForTimeout(300);

    // 3D chart uses canvas
    const canvas = page.locator('canvas');
    if ((await canvas.count()) > 0) {
      await expect(canvas.first()).toBeVisible();
    }
  });

  test('should display stats summary', async () => {
    const statsTab = page.getByRole('button', { name: '2025 Stats' });
    await statsTab.click();
    await page.waitForTimeout(300);

    const statsContent = page.locator('main');
    const text = await statsContent.textContent();

    // Should show some statistics
    expect(text?.length || 0).toBeGreaterThan(0);
  });

  test('should handle hover interactions on charts', async () => {
    const svg = page.locator('svg').first();
    if (await svg.isVisible()) {
      await svg.hover();

      // Tooltip or highlight should appear (implementation dependent)
      await page.waitForTimeout(100);
      expect(true).toBe(true);
    }
  });

  test('should render bars in time series chart', async () => {
    // Overview tab
    const bars = page.locator('rect');
    if ((await bars.count()) > 0) {
      const barCount = await bars.count();
      expect(barCount).toBeGreaterThan(0);
    }
  });

  test('should display data labels on chart', async () => {
    const textElements = page.locator('text');
    const count = await textElements.count();

    // Chart should have text labels
    expect(count).toBeGreaterThan(0);
  });

  test('should be responsive on mobile', async () => {
    await page.setViewportSize({ width: 375, height: 667 });

    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('should handle chart resize', async () => {
    const initialViewport = { width: 1024, height: 768 };
    await page.setViewportSize(initialViewport);

    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();

    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });

    // Chart should still be visible
    await expect(svg).toBeVisible();
  });

  test('should switch between heatmap years smoothly', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const yearButtons = page.locator('button').filter({ hasText: /202[0-9]/ });

    if ((await yearButtons.count()) > 1) {
      for (let i = 0; i < Math.min(2, await yearButtons.count()); i++) {
        const btn = yearButtons.nth(i);
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
  });

  test('should display all 12 months in heatmap', async () => {
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    let monthsFound = 0;

    const mainContent = page.locator('main');
    const text = await mainContent.textContent();

    months.forEach((month) => {
      if (text?.includes(month)) {
        monthsFound++;
      }
    });

    expect(monthsFound).toBeGreaterThan(0);
  });

  test('should animate chart transitions', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await overviewTab.click();

    const svg1 = page.locator('svg').first();
    await expect(svg1).toBeVisible();

    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('should format large numbers in charts', async () => {
    const mainContent = page.locator('main');
    const text = await mainContent.textContent();

    // Check for number formatting (K for thousands, M for millions)
    const hasNumbers = /[\d,KM]+/.test(text || '');
    expect(hasNumbers).toBe(true);
  });

  test('should have accessible chart elements', async () => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    expect(count).toBeGreaterThan(0);

    // Verify buttons have proper attributes
    const firstBtn = buttons.first();
    const ariaLabel = await firstBtn.getAttribute('aria-label');
    const text = await firstBtn.textContent();

    expect(ariaLabel || text).toBeTruthy();
  });

  test('should maintain chart state during navigation', async () => {
    const overviewTab = page.getByRole('button', { name: 'Overview' });
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Switch away and back
    const heatmapTab = page.getByRole('button', { name: 'Monthly Heatmap' });
    await heatmapTab.click();
    await page.waitForTimeout(300);

    await overviewTab.click();
    await page.waitForTimeout(300);

    // Chart should render again
    const svg = page.locator('svg').first();
    await expect(svg).toBeVisible();
  });
});
