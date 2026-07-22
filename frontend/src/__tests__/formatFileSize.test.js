import { describe, it, expect } from 'vitest';
import { formatFileSize } from '../utils/formatFileSize';

describe('formatFileSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('rounds to one decimal place', () => {
    expect(formatFileSize(1234)).toBe('1.2 KB');
    expect(formatFileSize(1024 * 1024 * 1.55)).toBe('1.6 MB');
  });
});
