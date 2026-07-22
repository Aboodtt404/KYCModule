import { test, expect } from '@playwright/test';
import { installActorMocks, installHttpMocks, getCalls, VALID_OCR_RESPONSE, MATCH_VERIFY_RESPONSE } from './fixtures';

// Mobile handoff flow — runs in the 'mobile' Playwright project (Pixel 7 UA).
test('valid session: shows the mobile KYC flow and marks session in progress', async ({ page }) => {
  await installActorMocks(page, { sessionValid: true });
  await installHttpMocks(page, {
    ocrResponse: VALID_OCR_RESPONSE,
    verifyResponse: MATCH_VERIFY_RESPONSE,
  });

  await page.goto('/mobile-verify/test-session-123');

  await expect(page.getByText('Mobile Verification')).toBeVisible({ timeout: 15_000 });

  const calls = await getCalls(page);
  expect(calls.some(c => c.name === 'verify_session' && c.args[0] === 'test-session-123')).toBe(true);
  expect(calls.some(c => c.name === 'mark_verification_in_progress')).toBe(true);
});

test('invalid session: shows the Session Unavailable screen', async ({ page }) => {
  await installActorMocks(page, { sessionValid: false });

  await page.goto('/mobile-verify/expired-session-999');

  await expect(page.getByText('Session Unavailable')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/generate a new QR code/i)).toBeVisible();

  // No in-progress marking for a dead session
  const calls = await getCalls(page);
  expect(calls.some(c => c.name === 'mark_verification_in_progress')).toBe(false);
});
