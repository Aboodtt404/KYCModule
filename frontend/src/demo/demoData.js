// Seed data for demo mode. Everything here is fictional.

// Draw a simple cartoon face on a canvas — used as the "extracted ID photo"
// in the demo flow so the face-verification step has something to display.
export function generateDemoFaceImage() {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dbe4f0'; ctx.fillRect(0, 0, 240, 300);          // background
  ctx.fillStyle = '#c9a07a'; ctx.beginPath();                        // head
  ctx.ellipse(120, 140, 70, 90, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f2a26';                                          // hair
  ctx.beginPath(); ctx.ellipse(120, 80, 72, 45, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#1f2937';                                          // eyes
  ctx.beginPath(); ctx.arc(92, 130, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(148, 130, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a4f'; ctx.lineWidth = 3;                     // nose
  ctx.beginPath(); ctx.moveTo(120, 140); ctx.lineTo(115, 165); ctx.stroke();
  ctx.strokeStyle = '#7a4a3a'; ctx.lineWidth = 4;                     // mouth
  ctx.beginPath(); ctx.arc(120, 185, 25, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = '#475569'; ctx.fillRect(50, 245, 140, 55);          // shoulders
  ctx.fillStyle = '#64748b'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText('DEMO PHOTO', 75, 290);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const iso = (msAgo) => new Date(now - msAgo).toISOString();

const sub = (id, name, nid, phone, gov, gender, birth, status, msAgo, faceVerified = true, phoneVerified = true) => ([
  id,
  JSON.stringify({
    kycData: {
      submissionId: id,
      timestamp: iso(msAgo),
      phone,
      phoneVerified,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      documentFile: 'national-id.jpg',
      ocrData: {
        full_name: name,
        national_id: nid,
        birth_date: birth,
        age: 2026 - Number(birth.slice(-4)),
        address: '15 El-Nile Street, Downtown',
        governorate: gov,
        gender,
      },
      faceVerified,
      status,
    },
  }),
]);

export const DEMO_SUBMISSIONS = [
  sub('kyc_demo-0001', 'Ahmed Mohamed Hassan',  '29805211234561', '+201001234567', 'Cairo',      'Male',   '21/05/1998', 'pending_review', 2 * 60 * 60 * 1000),
  sub('kyc_demo-0002', 'Fatma Ali Ibrahim',     '30002150234562', '+201112345678', 'Giza',       'Female', '15/02/2000', 'pending_review', 5 * 60 * 60 * 1000, true, false),
  sub('kyc_demo-0003', 'Omar Khaled Mahmoud',   '29711301234563', '+201223456789', 'Alexandria', 'Male',   '30/11/1997', 'approved',       2 * day),
  sub('kyc_demo-0004', 'Nour Tarek El-Sayed',   '30106250234564', '+201534567890', 'Dakahlia',   'Female', '25/06/2001', 'approved',       4 * day),
  sub('kyc_demo-0005', 'Youssef Samir Fawzy',   '29901011234565', '+201045678901', 'Cairo',      'Male',   '01/01/1999', 'rejected',       6 * day, false),
];

const ns = (msAgo) => String((now - msAgo) * 1e6);
const auditEntry = (action, principal, target, msAgo, seq) => ([
  `${ns(msAgo).padStart(20, '0')}:${String(seq).padStart(10, '0')}`,
  JSON.stringify({ action, principal, target, ts: Number(ns(msAgo)) }),
]);

export const DEMO_AUDIT_LOG = [
  auditEntry('submit_kyc',            'demo-user-aaaa', 'kyc_demo-0001', 2 * 60 * 60 * 1000, 14),
  auditEntry('consent_recorded',      'demo-user-aaaa', 'kyc_demo-0001', 2.1 * 60 * 60 * 1000, 13),
  auditEntry('submit_kyc',            'demo-user-bbbb', 'kyc_demo-0002', 5 * 60 * 60 * 1000, 12),
  auditEntry('api_session_created',   'demo-gateway',   'api_demo01 by client_demo_acme', 8 * 60 * 60 * 1000, 11),
  auditEntry('update_kyc_status',     'demo-admin',     'kyc_demo-0003 -> approved', 2 * day, 10),
  auditEntry('email_sent',            'demo-admin',     'kyc_demo-0003', 2 * day, 9),
  auditEntry('update_kyc_status',     'demo-admin',     'kyc_demo-0004 -> approved', 4 * day, 8),
  auditEntry('update_kyc_status',     'demo-admin',     'kyc_demo-0005 -> rejected', 6 * day, 7),
  auditEntry('api_client_status',     'demo-admin',     'client_demo_acme -> active', 7 * day, 6),
  auditEntry('api_client_registered', 'demo-gateway',   'client_demo_acme', 8 * day, 5),
  auditEntry('admin_bulk_read',       'demo-admin',     'get_all_kyc_submissions', 9 * day, 4),
  auditEntry('delete_my_kyc',         'demo-user-cccc', 'kyc_demo-old01', 12 * day, 3),
];

export const DEMO_API_CLIENTS = [
  ['client_demo_acme', JSON.stringify({
    client_id: 'client_demo_acme', name: 'Acme Exchange (Demo)',
    website: 'https://acme-exchange.example', contact_email: 'integrations@acme.example',
    status: 'active', created_at: (now - 8 * day) * 1e6, request_count: 1342,
  })],
  ['client_demo_nile', JSON.stringify({
    client_id: 'client_demo_nile', name: 'Nile Lending (Demo)',
    website: 'https://nile-lending.example', contact_email: 'tech@nile.example',
    status: 'pending', created_at: (now - 1 * day) * 1e6, request_count: 0,
  })],
];

export const DEMO_OCR_RESULT = {
  full_name: 'Mona Adel Mostafa',
  national_id: '29904121234566',
  birth_date: '12/04/1999',
  address: '8 Tahrir Square, Apt 4',
  governorate: 'Cairo',
  gender: 'Female',
  serial: 'D123456',
  first_name: 'Mona',
  second_name: 'Adel',
  // Merged in when the (mandatory) back of the card is captured in demo mode.
  // Factory serial comes from the front (`serial` above); the back carries the
  // NID cross-check + marital/occupation/dates.
  back: {
    national_id_back: '29904121234566',
    marital_status: 'Single',
    occupation: 'Software Engineer',
    issue_date: '2021/05/10',
    expiry_date: '2028/05/09',
  },
};

export const DEMO_OTP_CODE = '123456';
export const DEMO_API_KEY = 'kyc_demo_d3m0aaaabbbbccccddddeeeeffff';
