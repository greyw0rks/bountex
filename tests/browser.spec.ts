import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const role = async (page: Page, name: 'worker' | 'creator') => {
  await page.locator('.wallet-button').click();
  await page.getByRole('button', { name: `Try as a ${name}` }).click();
};
test.beforeEach(async ({ page }) => {
  // Preview journeys stay deterministic even when this workspace has a live backend.
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { configured: false, network: 'testnet', paymentsReady: false },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.task-card')).toHaveCount(9);
  await expect(page.locator('.task-card').last()).toHaveCSS('opacity', '1');
});
test('discovery filters, sorts and searches without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.locator('.task-card')).toHaveCount(9);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('.task-card')).toHaveCount(2);
  await page.getByLabel('Sort bounties').selectOption('reward');
  await expect(page.locator('.task-card').first()).toContainText('600');
  await page.getByLabel('Search bounties').fill('no-such-bounty');
  await expect(page.getByRole('heading', { name: 'No bounties found.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.task-card')).toHaveCount(9);
  expect(errors).toEqual([]);
});
test('worker to creator revision, approval and clearly labeled preview receipt', async ({
  page,
}) => {
  await role(page, 'worker');
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page.getByRole('button', { name: 'Claim this bounty' }).click();
  await expect(page.getByText('In progress', { exact: true })).toBeVisible();
  await page
    .getByLabel('Your submission')
    .fill('I found three reproducible issues and documented all the steps clearly.');
  await page.getByLabel('Proof link').fill('https://example.com/my-bug-report');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await role(page, 'creator');
  await page.getByRole('button', { name: 'My work', exact: true }).click();
  await page.getByRole('button', { name: /I’ve posted/ }).click();
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page
    .getByLabel('Feedback', { exact: true })
    .fill('Please add a screenshot of the last issue.');
  await page.getByRole('button', { name: 'Request revision' }).click();
  await expect(
    page.getByRole('dialog').getByText('Revision requested', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await role(page, 'worker');
  await page.getByRole('button', { name: /I’m working on/ }).click();
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page
    .getByLabel('Your submission')
    .fill('I added the requested screenshot and updated the report with clear reproduction steps.');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await role(page, 'creator');
  await page.getByRole('button', { name: /I’ve posted/ }).click();
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page.getByRole('button', { name: 'Approve work' }).click();
  await expect(
    page.getByRole('dialog').getByText('Awaiting payment', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Preview a payout' }).click();
  await expect(page.getByText('This creates a sample receipt. No NIM will be sent.')).toBeVisible();
  await page.getByRole('button', { name: 'Simulate payout' }).click();
  await expect(page.getByText('PREVIEW RECEIPT')).toBeVisible();
  await expect(page.getByText(/No real NIM was transferred/)).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await role(page, 'worker');
  await page.getByRole('button', { name: 'My rewards', exact: true }).click();
  await expect(page.locator('.reward-summary').first()).toContainText('300');
  await expect(page.locator('.receipt-list')).toContainText('No NIM sent');
  await page.reload();
  await expect(page.locator('.reward-summary')).toContainText('0');
  await role(page, 'worker');
  await expect(page.locator('.reward-summary')).toContainText('300');
});
test('create a bounty and preserve submission drafts', async ({ page }) => {
  await role(page, 'creator');
  await page.getByRole('button', { name: 'Post a bounty', exact: true }).first().click();
  await page.getByLabel('Bounty title').fill('Test the complete mobile checkout');
  await page
    .getByLabel('What needs doing?')
    .fill(
      'Please test the mobile checkout and share at least three useful suggestions to improve it.',
    );
  await page.getByLabel('Requirement 1').fill('A document with three clear improvements');
  const date = page.getByLabel('Submission deadline');
  const originalDate = await date.inputValue();
  await date.fill('');
  await expect(page.getByRole('heading', { name: 'Turn your to-do into a bounty.' })).toBeVisible();
  await date.fill(originalDate);
  await page.getByRole('button', { name: 'Publish bounty' }).click();
  await expect(
    page.locator('.task-card').filter({ hasText: 'Test the complete mobile checkout' }),
  ).toBeVisible();
  await role(page, 'worker');
  await page.getByRole('button', { name: 'Explore bounties', exact: true }).first().click();
  await page.locator('.task-card').filter({ hasText: 'Test the complete mobile checkout' }).click();
  await page.getByRole('button', { name: 'Claim this bounty' }).click();
  await page.getByLabel('Your submission').fill('My in-progress notes are saved before I submit.');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'My work', exact: true }).click();
  await page.locator('.task-card').filter({ hasText: 'Test the complete mobile checkout' }).click();
  await expect(page.getByLabel('Your submission')).toHaveValue(
    'My in-progress notes are saved before I submit.',
  );
});
test('keyboard dialog containment and dismissal', async ({ page }) => {
  await page.locator('.wallet-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.wallet-button')).toBeFocused();
});
test('responsive sizes and reduced motion', async ({ page }) => {
  for (const width of [1440, 1024, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await noOverflow(page);
    await expect(
      page.getByRole('heading', { name: 'Small tasks. Big possibilities.' }),
    ).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await role(page, 'worker');
  await expect(page.locator('.toast')).toBeVisible();
  const notification = await page.locator('.toast').boundingBox();
  expect(notification && notification.x >= 0 && notification.x + notification.width <= 390).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Post bounty', exact: true }).click();
  await noOverflow(page);
  await expect(page.getByRole('heading', { name: 'Put a bounty on it.' })).toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.create-preview')).toBeVisible();
  await noOverflow(page);
});
test('accessibility on discovery and wallet dialog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const board = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(board.violations).toEqual([]);
  await page.locator('.wallet-button').click();
  const dialog = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(dialog.violations).toEqual([]);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  for (const [view, heading] of [
    ['create', 'Put a bounty on it.'],
    ['work', 'Good work in progress.'],
    ['rewards', 'You earned this.'],
  ]) {
    await page.evaluate((v) => {
      location.hash = v;
    }, view);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('main > div')).toHaveCSS('opacity', '1');
    const screen = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(screen.violations).toEqual([]);
  }
  await page.evaluate(() => {
    location.hash = 'explore';
  });
  await expect(page.locator('.task-card')).toHaveCount(9);
  await role(page, 'worker');
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page.getByRole('button', { name: 'Claim this bounty' }).click();
  const submission = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(submission.violations).toEqual([]);
});
