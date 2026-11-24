import { test, expect, type Page } from '@playwright/test';

// End-to-end tests against the real backend (http://localhost:8000 must be
// running). The AI endpoints are mocked: a real explanation takes minutes.

const statsYear = new Date().getFullYear() - 1;

async function mockAi(page: Page) {
  await page.route('**/api/ai/status', route =>
    route.fulfill({ json: { available: true, service: 'Ollama', default_model: 'mistral' } }),
  );
  await page.route('**/api/ai/explain-chart', async route => {
    const { chart_type } = route.request().postDataJSON();
    await route.fulfill({
      json: {
        available: true,
        cached: true,
        explanation: `Test explanation for ${chart_type}.`,
        verification: { status: 'verified', claims: [], unchecked_numbers: [], attempts: 1, model: 'mistral' },
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAi(page);
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
});

test.describe('tabs', () => {
  test('each tab opens its panel', async ({ page }) => {
    const panels: Array<[string | RegExp, string | RegExp]> = [
      ['Monthly Heatmap', 'Monthly Visitation Heatmap'],
      [/Stats$/, `${statsYear} Annual Summary`],
      ['Add Data', 'Add Daily Visitor Data'],
    ];
    for (const [tab, heading] of panels) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('can be used with the keyboard', async ({ page }) => {
    const overview = page.getByRole('tab', { name: 'Overview' });
    await overview.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Monthly Heatmap' })).toBeFocused();
    await expect(overview).toHaveAttribute('aria-selected', 'true'); // arrows only move focus

    await page.keyboard.press('Enter');
    await expect(page.getByRole('tabpanel', { name: 'Monthly Heatmap' })).toBeVisible();
  });
});

test.describe('overview', () => {
  test('shows headline numbers, the yearly chart and its explanation', async ({ page }) => {
    await expect(page.getByText(/^\d{4}–\d{4}$/)).toBeVisible(); // years covered
    await expect(page.getByText('10-Year Avg Annual')).toBeVisible();
    await expect(page.getByRole('tabpanel').locator('svg').first()).toBeVisible();
    await expect(page.getByText('Test explanation for annual_trends.')).toBeVisible();
    await expect(page.getByText('Every number checked against the data')).toBeVisible();
  });
});

test.describe('heatmap', () => {
  test('shows every month and switches view', async ({ page }) => {
    await page.getByRole('tab', { name: 'Monthly Heatmap' }).click();
    const grid = page.getByRole('grid');
    await expect(grid.getByRole('columnheader')).toHaveCount(12);
    await expect(grid.getByRole('row', { name: `Year ${statsYear}` })).toBeVisible();

    const peakLow = page.getByRole('button', { name: /peak and low by year/i });
    await peakLow.click();
    await expect(peakLow).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('tab', { name: /Stats$/ }).click();
  });

  test('clicking a month in the chart selects it everywhere', async ({ page }) => {
    const chart = page.getByRole('img', { name: /Visitors by month/ });
    await expect(chart).toBeVisible();

    await page.getByTestId('month-hit-5').click();

    await expect(page.locator('#month-select')).toHaveValue('5');
    await expect(page.getByRole('heading', { name: `May ${statsYear} Details` })).toBeVisible();
    await expect(chart).toHaveAccessibleName(/May is highlighted/);
    await expect(page.getByText('Test explanation for monthly_breakdown.')).toBeVisible();
  });

  test('the dropdown moves the chart highlight', async ({ page }) => {
    await page.locator('#month-select').selectOption('7');
    await expect(page.locator('path[data-selected]')).toHaveAttribute('data-month', '7');
  });

  test('hovering a column shows its value and rank', async ({ page }) => {
    await page.getByTestId('month-hit-1').hover();
    await expect(page.getByRole('tooltip')).toContainText(/visitors/);
    await expect(page.getByRole('tooltip')).toContainText(/January · #\d+ of 12/);
  });
});

test.describe('add data', () => {
  test('shows the entry form and this year’s month tabs', async ({ page }) => {
    await page.getByRole('tab', { name: 'Add Data' }).click();
    await expect(page.getByLabel('Date')).toHaveAttribute('type', 'date');
    await expect(page.getByRole('spinbutton', { name: 'Number of Visitors' })).toBeVisible();
    await expect(page.getByRole('button', { name: /View entries for Jan/ })).toBeVisible();
  });
});

test.describe('theme', () => {
  test('toggles and survives a reload', async ({ page }) => {
    const html = page.locator('html');
    const startsDark = await html.evaluate(el => el.classList.contains('dark'));

    await page.getByRole('button', { name: 'Toggle dark mode' }).click();
    await expect(html).toHaveClass(startsDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);

    await page.reload();
    await expect(html).toHaveClass(startsDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
  });
});

test('works at phone width without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: /Stats$/ }).click();
  await expect(page.getByRole('img', { name: /Visitors by month/ })).toBeVisible();
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});
