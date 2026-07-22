import { test, expect } from '@playwright/test';
import { installActorMocks, getCalls, SAMPLE_SUBMISSION } from './fixtures';

// Admin review flow: authenticated admin sees pending submissions and approves one.
test('admin sees a pending submission and approves it', async ({ page }) => {
  await installActorMocks(page, { isAdmin: true, submissionRow: SAMPLE_SUBMISSION });

  await page.goto('/admin/kyc-submissions');

  // The mocked pending submission is listed
  await expect(page.getByText('Ahmed Mohamed Ali')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('29801011234567')).toBeVisible();

  // Approve it
  await page.getByRole('button', { name: 'Approve' }).first().click();

  const calls = await getCalls(page);
  const update = calls.find(c => c.name === 'update_kyc_status');
  expect(update).toBeTruthy();
  expect(update.args[0]).toBe('sub-e2e-001');
  expect(update.args[1]).toBe('approved');
});

test('desktop QR handoff: creating a session shows the QR screen', async ({ page }) => {
  await installActorMocks(page);

  await page.goto('/user');
  await page.getByRole('button', { name: /Continue on Mobile/ }).click();

  // QR handoff screen appears and a session was registered on-chain
  await expect(page.locator('svg, canvas').first()).toBeVisible({ timeout: 15_000 });
  const calls = await getCalls(page);
  expect(calls.some(c => c.name === 'create_verification_session')).toBe(true);
});
