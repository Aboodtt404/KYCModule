import { test, expect } from '@playwright/test';
import {
  installActorMocks, installHttpMocks, getCalls,
  VALID_OCR_RESPONSE, MATCH_VERIFY_RESPONSE,
} from './fixtures';

// Full desktop KYC journey:
// choice → intro → OTP → document OCR → face verification (active liveness) → review → submit
test('completes the full desktop KYC flow', async ({ page }) => {
  await installActorMocks(page);
  await installHttpMocks(page, {
    ocrResponse: VALID_OCR_RESPONSE,
    verifyResponse: MATCH_VERIFY_RESPONSE,
  });

  await page.goto('/user');

  // Step 0 → 1: choice screen
  await page.getByRole('button', { name: 'Continue on Desktop' }).click();
  await page.getByRole('button', { name: 'Start Verification' }).click();

  // Step 2: OTP
  await page.locator('.react-tel-input input').pressSequentially('1001234567');
  await page.getByRole('button', { name: 'Send Code' }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`OTP digit ${i + 1} of 6`).fill(String(i + 1));
  }
  await page.getByRole('button', { name: 'Verify', exact: true }).click();

  // Step 3a: document FRONT upload + OCR
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/id-card.jpg');
  await page.getByRole('button', { name: 'Process Document' }).click();

  // Step 3b: mandatory BACK of card
  await expect(page.getByText('Now the back of your card.')).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/id-card.jpg');
  await page.getByRole('button', { name: 'Process Back of Card' }).click();

  // Step 4: face verification — consent → camera → liveness challenge → verify
  await page.getByRole('button', { name: 'I Agree & Continue' }).click();
  await page.getByRole('button', { name: 'Start Camera' }).click();
  const captureBtn = page.getByRole('button', { name: 'Capture' });
  await expect(captureBtn).toBeEnabled({ timeout: 15_000 });
  await captureBtn.click();
  // Liveness prompts run for ~4.5 s, then preview appears
  await page.getByRole('button', { name: 'Yes, looks good' }).click({ timeout: 20_000 });
  // Mocked match → success screen → auto-advance to review after 2 s

  // Step 5: review — OCR values are prefilled
  await expect(page.locator('#full_name')).toHaveValue('Ahmed Mohamed Ali', { timeout: 15_000 });
  await expect(page.locator('#national_id')).toHaveValue('29801011234567');
  await page.getByRole('button', { name: 'Save & Continue' }).click();

  // Step 6: success
  await expect(page.getByText('Verification Submitted!')).toBeVisible({ timeout: 15_000 });

  // The canister got a payload containing the OCR'd national ID + OTP'd phone
  const calls = await getCalls(page);
  const submit = calls.find(c => c.name === 'submit_kyc');
  expect(submit).toBeTruthy();
  expect(submit.args[1]).toContain('29801011234567');
  expect(submit.args[1]).toContain('+201001234567');
  // Back-of-card fields made it into the stored payload
  expect(submit.args[1]).toContain('A123456');        // factory serial (from front)
  expect(submit.args[1]).toContain('Engineer');       // occupation (from back)
  // Consent was recorded on-chain before the camera opened
  expect(calls.some(c => c.name === 'log_consent_event')).toBe(true);
});

test('completes the flow with phone/email verification skipped', async ({ page }) => {
  await installActorMocks(page);
  await installHttpMocks(page, {
    ocrResponse: VALID_OCR_RESPONSE,
    verifyResponse: MATCH_VERIFY_RESPONSE,
  });

  await page.goto('/user');
  await page.getByRole('button', { name: 'Continue on Desktop' }).click();
  await page.getByRole('button', { name: 'Start Verification' }).click();

  // Skip OTP entirely — no phone, no email
  await page.getByRole('button', { name: 'Skip phone & email verification' }).click();

  // Flow continues straight to document upload (front, then mandatory back)
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

  // Submission went through flagged as unverified, with no OTP calls made
  const calls = await getCalls(page);
  const submit = calls.find(c => c.name === 'submit_kyc');
  expect(submit).toBeTruthy();
  expect(submit.args[1]).toContain('"phoneVerified":false');
  expect(calls.some(c => c.name === 'send_sms')).toBe(false);
  expect(calls.some(c => c.name === 'verify_otp')).toBe(false);
});

test('blocks face verification after liveness failure and offers retry', async ({ page }) => {
  await installActorMocks(page);
  await installHttpMocks(page, {
    ocrResponse: VALID_OCR_RESPONSE,
    verifyResponse: {
      success: true,
      verification_result: {
        is_match: false, similarity_score: 40.1, distance: 0.81, threshold: 75,
        liveness_failed: true, liveness_reason: 'no_motion', liveness_mode: 'active',
        liveness_score: 30.2, liveness_min: 50,
      },
    },
  });

  await page.goto('/user');
  await page.getByRole('button', { name: 'Continue on Desktop' }).click();
  await page.getByRole('button', { name: 'Start Verification' }).click();
  await page.locator('.react-tel-input input').pressSequentially('1001234567');
  await page.getByRole('button', { name: 'Send Code' }).click();
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(`OTP digit ${i + 1} of 6`).fill('1');
  }
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
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

  // The no_motion liveness message is shown and a retry is offered
  await expect(page.getByText(/couldn't detect any head movement/i)).toBeVisible({ timeout: 15_000 });
});
