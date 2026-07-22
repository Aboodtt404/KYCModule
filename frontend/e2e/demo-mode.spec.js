import { test, expect } from '@playwright/test';

// Demo mode uses its own injection path (window.__DEMO_*), separate from the
// __TEST_* mocks — these tests exercise the real demo engine end to end.

test('demo admin: dashboard shows seeded submissions and approve works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo as Admin' }).click();

  // Demo banner is visible app-wide
  await expect(page.getByText(/Demo mode \(admin\)/)).toBeVisible({ timeout: 10_000 });

  // Seeded submissions appear
  await page.goto('/admin/kyc-submissions');
  await expect(page.getByText('Ahmed Mohamed Hassan')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Fatma Ali Ibrahim')).toBeVisible();

  // Approving mutates the demo store (no real canister involved)
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await expect(page.getByText('APPROVED').first()).toBeVisible({ timeout: 10_000 });
});

test('demo developer: registration returns the demo API key', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo Developer' }).click();

  await expect(page).toHaveURL(/\/developers/);
  await page.getByLabel('Company / project name').fill('Demo Corp');
  await page.getByLabel('Website URL').fill('https://demo-corp.example');
  await page.getByLabel('Contact email').fill('dev@demo-corp.example');
  await page.getByRole('button', { name: 'Register & Generate Key' }).click();

  await expect(page.getByText('Registration received')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/kyc_demo_/)).toBeVisible();
});

test('demo user: OTP hint works and exit demo returns to clean state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo as User' }).click();

  await expect(page).toHaveURL(/\/user/);
  // Banner shows the fixed demo OTP code
  await expect(page.getByText(/OTP code:/)).toBeVisible({ timeout: 10_000 });

  // Exit demo: banner disappears, back on login
  await page.getByRole('button', { name: 'Exit demo' }).click();
  await expect(page.getByText('Identity verification,')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Demo mode/)).not.toBeVisible();
});
