import { test, expect } from '@playwright/test';
import {
  installActorMocks, installHttpMocks, getCalls,
  VALID_OCR_RESPONSE, MATCH_VERIFY_RESPONSE,
} from './fixtures';

// Partner-facing surfaces: developer portal, admin client management,
// and the hosted /verify/:sessionId flow that API sessions point to.

test('developer portal: registering shows the API key exactly once', async ({ page }) => {
  await installActorMocks(page);

  await page.goto('/developers');
  await page.getByLabel('Company / project name').fill('Acme Exchange');
  await page.getByLabel('Website URL').fill('https://acme.example');
  await page.getByLabel('Contact email').fill('dev@acme.example');
  await page.getByRole('button', { name: 'Register & Generate Key' }).click();

  await expect(page.getByText('Registration received')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('client_e2e123')).toBeVisible();
  await expect(page.getByText('kyc_live_e2etestkey1234567890')).toBeVisible();
  await expect(page.getByText(/only once/i)).toBeVisible();

  const calls = await getCalls(page);
  const reg = calls.find(c => c.name === 'register_api_client');
  expect(reg).toBeTruthy();
  expect(reg.args).toEqual(['Acme Exchange', 'https://acme.example', 'dev@acme.example']);
});

test('admin can see and activate a pending API client', async ({ page }) => {
  await installActorMocks(page, { isAdmin: true });

  await page.goto('/admin/api-clients');
  await expect(page.getByText('Acme Exchange')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('pending')).toBeVisible();

  await page.getByRole('button', { name: 'Activate' }).click();

  const calls = await getCalls(page);
  const upd = calls.find(c => c.name === 'set_api_client_status');
  expect(upd).toBeTruthy();
  expect(upd.args).toEqual(['client_e2e123', 'active']);
});

test('hosted verify: API session completes the flow and notifies the partner session', async ({ page }) => {
  await installActorMocks(page, { sessionValid: true });
  await installHttpMocks(page, {
    ocrResponse: VALID_OCR_RESPONSE,
    verifyResponse: MATCH_VERIFY_RESPONSE,
  });

  await page.goto('/verify/api_e2e_session');

  // Partner banner is shown; flow starts at the intro step (no QR choice)
  await expect(page.getByText('Identity Verification')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Start Verification' }).click();

  // Skip OTP for speed — the skip path is already covered separately
  await page.getByRole('button', { name: 'Skip phone & email verification' }).click();

  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/id-card.jpg');
  await page.getByRole('button', { name: 'Process Document' }).click();
  await expect(page.getByText('Now the back of your card.')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/id-card.jpg');
  await page.getByRole('button', { name: 'Process Back of Card' }).click();
  await page.getByRole('button', { name: 'I Agree & Continue' }).click();
  await page.getByRole('button', { name: 'Start Camera' }).click();
  const captureBtn = page.getByRole('button', { name: 'Capture' });
  await expect(captureBtn).toBeEnabled({ timeout: 15_000 });
  await captureBtn.click();
  await page.getByRole('button', { name: 'Yes, looks good' }).click({ timeout: 20_000 });

  await expect(page.locator('#full_name')).toHaveValue('Ahmed Mohamed Ali', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Save & Continue' }).click();
  await expect(page.getByText('Verification Submitted!')).toBeVisible({ timeout: 15_000 });

  const calls = await getCalls(page);
  // The session was validated and marked in progress on arrival
  expect(calls.some(c => c.name === 'verify_session' && c.args[0] === 'api_e2e_session')).toBe(true);
  // The KYC submission was stored…
  const submit = calls.find(c => c.name === 'submit_kyc');
  expect(submit).toBeTruthy();
  // …and the partner session was completed with the submission linkage
  const complete = calls.find(c => c.name === 'complete_verification');
  expect(complete).toBeTruthy();
  expect(complete.args[0]).toBe('api_e2e_session');
  expect(complete.args[1]).toContain('29801011234567');
  expect(complete.args[1]).toContain('submissionId');
});
