import { describe, it, expect } from 'vitest';

// Mirrors the row-building logic in KYCSubmissions.jsx exportCSV
function buildCsvRow(id, json) {
  try {
    const d = JSON.parse(json);
    const kyc = d.kycData || d;
    const ocr = kyc.ocrData || {};
    return [
      id,
      kyc.timestamp || '',
      kyc.phone || '',
      ocr.full_name || '',
      ocr.national_id || '',
      ocr.birth_date || '',
      ocr.gender || '',
      ocr.governorate || '',
      ocr.address || '',
      kyc.faceVerified ? 'Yes' : 'No',
      kyc.status || 'pending_review',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  } catch {
    return `"${id}","parse error"`;
  }
}

describe('KYC CSV row builder', () => {
  it('builds a row from a wrapped kycData submission', () => {
    const json = JSON.stringify({
      kycData: {
        timestamp: '2024-01-15T10:00:00Z',
        phone: '+201001234567',
        faceVerified: true,
        status: 'approved',
        ocrData: {
          full_name: 'Ahmed Mohamed',
          national_id: '29501010112345',
          birth_date: '01/01/1995',
          gender: 'Male',
          governorate: 'Cairo',
          address: '123 Main St',
        },
      },
    });
    const row = buildCsvRow('sub-001', json);
    expect(row).toContain('"sub-001"');
    expect(row).toContain('"Ahmed Mohamed"');
    expect(row).toContain('"29501010112345"');
    expect(row).toContain('"Yes"');
    expect(row).toContain('"approved"');
  });

  it('handles flat (unwrapped) submission format', () => {
    const json = JSON.stringify({
      phone: '+201009876543',
      faceVerified: false,
      status: 'pending_review',
      ocrData: { full_name: 'Sara Ali', national_id: '30001010112345' },
    });
    const row = buildCsvRow('sub-002', json);
    expect(row).toContain('"Sara Ali"');
    expect(row).toContain('"No"');
    expect(row).toContain('"pending_review"');
  });

  it('escapes double quotes in field values', () => {
    const json = JSON.stringify({ kycData: { ocrData: { full_name: 'O\'Brien "Test"' } } });
    const row = buildCsvRow('sub-003', json);
    expect(row).toContain('""Test""');
  });

  it('falls back to empty strings for missing fields', () => {
    const json = JSON.stringify({ kycData: {} });
    const row = buildCsvRow('sub-004', json);
    expect(row).toContain('"No"');
    expect(row).toContain('"pending_review"');
    expect(row.split(',').length).toBe(11);
  });

  it('returns parse error row for invalid JSON', () => {
    const row = buildCsvRow('sub-005', 'not-json{{{');
    expect(row).toBe('"sub-005","parse error"');
  });
});
