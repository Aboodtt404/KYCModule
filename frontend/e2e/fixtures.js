// Shared E2E mocks: canister actors injected via DEV-only window hooks
// (see useActor.js / useSmsVerificationActor.js / AuthContext.jsx) and
// OCR/face HTTP services intercepted with page.route.

// >1000 chars so DocumentStep's face_image length gate passes
export const FAKE_FACE_B64 = 'iVBORw0KGgoAAAANSUhEUg' + 'A'.repeat(1200);

export const VALID_OCR_RESPONSE = {
  success: true,
  extracted_data: {
    full_name: 'Ahmed Mohamed Ali',
    national_id: '29801011234567',
    birth_date: '01/01/1998',
    address: '12 Tahrir Street, Downtown',
    governorate: 'Cairo',
    gender: 'Male',
    serial: 'A123456',
    first_name: 'Ahmed',
    second_name: 'Mohamed',
    face_image: FAKE_FACE_B64,
  },
};

export const VALID_BACK_RESPONSE = {
  success: true,
  extracted_data: {
    national_id: '29801011234567',   // back NID (cross-check); serial comes from the front
    marital_status: 'Single',
    occupation: 'Engineer',
    issue_date: '2021/05/10',
    expiry_date: '2028/05/09',
  },
};

export const MATCH_VERIFY_RESPONSE = {
  success: true,
  verification_result: {
    is_match: true,
    similarity_score: 92.5,
    distance: 0.31,
    threshold: 75,
    liveness_failed: false,
    liveness_mode: 'active',
    liveness_score: 120.4,
  },
};

export const SAMPLE_SUBMISSION = [
  'sub-e2e-001',
  JSON.stringify({
    kycData: {
      submissionId: 'sub-e2e-001',
      timestamp: '2026-06-11T10:00:00Z',
      phone: '+201001234567',
      email: 'user@example.com',
      documentFile: 'id.jpg',
      ocrData: {
        full_name: 'Ahmed Mohamed Ali',
        national_id: '29801011234567',
        birth_date: '01/01/1998',
        address: '12 Tahrir Street',
        governorate: 'Cairo',
        gender: 'Male',
      },
      faceVerified: true,
      status: 'pending_review',
    },
  }),
];

/**
 * Install mocked canister actors before app load.
 * opts.isAdmin       — make AuthContext report an authenticated admin
 * opts.sessionValid  — verify_session result for mobile handoff tests
 */
export async function installActorMocks(page, opts = {}) {
  await page.addInitScript(({ isAdmin, sessionValid, submissionRow }) => {
    window.__TEST_CALLS__ = [];
    const record = (name, args) => {
      try { window.__TEST_CALLS__.push({ name, args: JSON.parse(JSON.stringify(args)) }); }
      catch { window.__TEST_CALLS__.push({ name, args: ['<unserializable>'] }); }
    };

    const kycMethods = {
      is_admin_check: () => isAdmin,
      national_id_exists: () => false,
      log_consent_event: () => undefined,
      submit_kyc: () => ({ Ok: null }),
      get_kyc_submissions_page: () => submissionRow ? [BigInt(1), [submissionRow]] : [BigInt(0), []],
      get_kyc_submissions_count: () => BigInt(submissionRow ? 1 : 0),
      get_kyc_status_counts: () => [BigInt(submissionRow ? 1 : 0), BigInt(0), BigInt(0)],
      get_all_kyc_submissions: () => submissionRow ? [submissionRow] : [],
      update_kyc_status: () => ({ Ok: true }),
      delete_kyc_submission: () => ({ Ok: null }),
      create_verification_session: () => ({ Ok: null }),
      verify_session: () => sessionValid,
      mark_verification_in_progress: () => ({ Ok: null }),
      complete_verification: () => ({ Ok: null }),
      get_verification_status: () => [],
      get_audit_log_page: () => [BigInt(0), []],
      get_audit_log: () => [],
      get_my_kyc_status: () => [],
      list: () => [],
      register_api_client: () => ({ Ok: ['client_e2e123', 'kyc_live_e2etestkey1234567890'] }),
      list_api_clients: () => [[
        'client_e2e123',
        JSON.stringify({ client_id: 'client_e2e123', name: 'Acme Exchange', website: 'https://acme.example', contact_email: 'dev@acme.example', status: 'pending', created_at: 1760000000000000000, request_count: 0 }),
      ]],
      set_api_client_status: () => ({ Ok: null }),
      delete_api_client: () => ({ Ok: null }),
    };

    window.__TEST_AUTH__ = { isAdmin };
    window.__TEST_KYC_ACTOR__ = new Proxy({}, {
      get: (_t, prop) => {
        if (typeof prop !== 'string') return undefined;
        return async (...args) => {
          record(prop, args);
          const fn = kycMethods[prop];
          return fn ? fn(...args) : [];
        };
      },
    });

    window.__TEST_SMS_ACTOR__ = {
      send_sms: async (...args) => { record('send_sms', args); return { success: true, message: 'OTP sent' }; },
      verify_otp: async (...args) => { record('verify_otp', args); return { success: true, message: 'verified' }; },
    };
  }, {
    isAdmin: !!opts.isAdmin,
    sessionValid: opts.sessionValid !== false,
    submissionRow: opts.submissionRow,
  });
}

/** Intercept the OCR-service HTTP endpoints (relative paths in dev). */
export async function installHttpMocks(page, { ocrResponse, verifyResponse, backResponse } = {}) {
  await page.route('**/health', route =>
    route.fulfill({ json: { status: 'healthy' } }));
  // Back-side must be registered before the front so it matches first
  await page.route('**/egyptian-id-back', route =>
    route.fulfill({ json: backResponse || VALID_BACK_RESPONSE }));
  await page.route('**/egyptian-id', route =>
    route.fulfill({ json: ocrResponse }));
  await page.route('**/passport', route =>
    route.fulfill({ json: ocrResponse }));
  await page.route('**/verify-face', route =>
    route.fulfill({ json: verifyResponse }));
}

/** Read recorded actor calls from the page. */
export function getCalls(page) {
  return page.evaluate(() => window.__TEST_CALLS__);
}
