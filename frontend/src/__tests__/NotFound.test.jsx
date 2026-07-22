import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../pages/NotFound';

function renderNotFound() {
  return render(
    <MemoryRouter>
      <NotFound />
    </MemoryRouter>
  );
}

describe('NotFound page', () => {
  it('shows the 404 heading', () => {
    renderNotFound();
    expect(screen.getByText('404')).toBeTruthy();
  });

  it('shows the page-not-found message', () => {
    renderNotFound();
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('has a link to the home page', () => {
    renderNotFound();
    const homeLink = screen.getByText('Go to Home');
    expect(homeLink.closest('a')?.getAttribute('href')).toBe('/');
  });

  it('has a link to the KYC status page', () => {
    renderNotFound();
    const statusLink = screen.getByText('Check KYC Status');
    expect(statusLink.closest('a')?.getAttribute('href')).toBe('/status');
  });
});
