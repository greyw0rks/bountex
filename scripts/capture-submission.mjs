import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Capture the labeled local preview. No live tasks, sessions or payments are created.
const origin = process.env.BOUNTEX_CAPTURE_ORIGIN || 'http://127.0.0.1:5175';
const output = 'docs/submission';
const captureHero = !process.argv.includes('--skip-hero');
mkdirSync(output, { recursive: true });
let browser = await chromium.launch({
  headless: true,
  args: captureHero
    ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--no-sandbox'],
});
let page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: 'reduce',
});
async function role(name) {
  await page.locator('.wallet-button').click();
  await page.getByRole('button', { name: `Try as a ${name}` }).click();
}
async function screenshot(name) {
  // The notification may expire while a screenshot is prepared. Dismiss any
  // current instance without waiting for a disappearing button's actionability.
  await page.getByRole('button', { name: 'Dismiss notification' }).evaluateAll(
    (buttons) => buttons.forEach((button) => button.click()),
  );
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' });
}
async function loadPreview() {
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/config')
      return route.fulfill({ json: { configured: false, network: 'testnet', paymentsReady: false } });
    return route.fulfill({ status: 503, json: { error: 'Submission capture uses the preview workspace.' } });
  });
  await page.goto(origin);
  await expect(page.locator('.task-card')).toHaveCount(9, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}
try {
  await loadPreview();
  if (captureHero) {
    await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.task-card').last()).toHaveCSS('opacity', '1');
    await screenshot('01-explore');

    // Use a fresh browser to avoid expensive SwiftShader resizes in mobile dialogs.
    await browser.close();
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    await loadPreview();
  }

  await role('creator');
  await page.setViewportSize({ width: 1440, height: 1180 });
  await page.getByRole('button', { name: 'Post a bounty', exact: true }).first().click();
  await page.getByLabel('Bounty title').fill('Test a Nimiq Mini App on mobile');
  await page.getByLabel('What needs doing?').fill(
    'Try the sign-in, task discovery and submission flow. Report three usability issues with clear steps and screenshots.',
  );
  await page.locator('.form-panel select').selectOption('Development');
  await page.getByLabel('Requirement 1').fill('Three bug reports with screenshots and steps');
  await page.getByRole('heading', { name: 'Turn your to-do into a bounty.' }).click();
  await screenshot('03-create-bounty');

  await role('worker');
  await page.getByRole('button', { name: 'Explore bounties', exact: true }).first().click();
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await expect(page.getByRole('button', { name: 'Claim this bounty' })).toBeVisible();
  await screenshot('02-task-details');
  await page.getByRole('button', { name: 'Claim this bounty' }).click();
  await page.getByLabel('Your submission').fill(
    'I tested the task flow on mobile and documented three reproducible issues with steps and screenshots.',
  );
  await page.getByLabel('Proof link').fill('https://example.com/preview-bug-report');
  await page.locator('.submission-form').scrollIntoViewIfNeeded();
  await screenshot('04-submit-work');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.setViewportSize({ width: 1440, height: 1100 });
  await role('creator');
  await page.getByRole('button', { name: 'My work', exact: true }).click();
  await page.getByRole('button', { name: /I’ve posted/ }).click();
  await page.locator('.task-card').filter({ hasText: 'Test our new Mini App' }).click();
  await page.getByRole('button', { name: 'Approve work' }).click();
  await page.getByRole('button', { name: 'Preview a payout' }).click();
  await page.getByRole('button', { name: 'Simulate payout' }).click();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.locator('.receipt').scrollIntoViewIfNeeded();
  await expect(page.getByText('A sample reward for a job well done. No real NIM was transferred.')).toBeVisible();
  await screenshot('05-preview-receipt');
  console.log('Captured five labeled preview screenshots, including the Three.js scene.');
} finally {
  await browser.close();
}
