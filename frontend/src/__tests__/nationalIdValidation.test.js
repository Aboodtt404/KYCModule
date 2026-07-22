import { describe, it, expect } from 'vitest';

// Mirrors the regex used in KYCStatusPage.jsx line 25
const EGYPTIAN_NID_REGEX = /^[23]\d{13}$/;

function isValidNationalId(id) {
  return EGYPTIAN_NID_REGEX.test(id.trim());
}

describe('Egyptian National ID validation', () => {
  it('accepts valid 1900s IDs (starting with 2)', () => {
    expect(isValidNationalId('29501010112345')).toBe(true);
    expect(isValidNationalId('20001010112345')).toBe(true);
  });

  it('accepts valid 2000s IDs (starting with 3)', () => {
    expect(isValidNationalId('30501010112345')).toBe(true);
    expect(isValidNationalId('31001010112345')).toBe(true);
  });

  it('rejects IDs with wrong century digit', () => {
    expect(isValidNationalId('19501010112345')).toBe(false);
    expect(isValidNationalId('49501010112345')).toBe(false);
    expect(isValidNationalId('09501010112345')).toBe(false);
  });

  it('rejects IDs that are too short', () => {
    expect(isValidNationalId('2950101011234')).toBe(false); // 13 digits
  });

  it('rejects IDs that are too long', () => {
    expect(isValidNationalId('295010101123456')).toBe(false); // 15 digits
  });

  it('rejects IDs with letters', () => {
    expect(isValidNationalId('2950101011234A')).toBe(false);
    expect(isValidNationalId('A9501010112345')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidNationalId('')).toBe(false);
  });

  it('trims whitespace before validation', () => {
    expect(isValidNationalId(' 29501010112345 ')).toBe(true);
  });
});
