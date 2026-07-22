import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Suppress expected console.error output in test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

function ThrowOnMount({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test crash');
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders the fallback error screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Test crash')).toBeTruthy();
  });

  it('renders a custom fallback function when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <div>Custom: {err.message}</div>}>
        <ThrowOnMount shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom: Test crash')).toBeTruthy();
  });

  it('shows a Try again button when crashed', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow={true} />
      </ErrorBoundary>
    );
    // The button must be present and clickable (no throw on click)
    const btn = screen.getByText('Try again');
    expect(btn).toBeTruthy();
    // Clicking resets state; child re-throws, so the error screen reappears — that's expected
    fireEvent.click(btn);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});
