import { test, expect } from '@playwright/test';

test('navigates to heatmap tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Monthly Heatmap' }).click();

  await expect(
    page.getByRole('heading', { name: 'Monthly Visitation Heatmap' }),
  ).toBeVisible();
});

test('navigates to 2025 stats tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '2025 Stats' }).click();

  await expect(
    page.getByRole('heading', { name: /2025 Annual Summary/i }),
  ).toBeVisible();
});
