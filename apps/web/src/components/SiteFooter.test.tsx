import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './SiteFooter';

function renderFooter() {
  return render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe('SiteFooter', () => {
  it('renders the brand, navigation groups, and copyright', () => {
    renderFooter();

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute('href', '/app');
    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      'https://kanbantask.readme.io',
    );
    expect(screen.getByText(/© \d{4} Kanban/)).toBeInTheDocument();
    expect(screen.getByText('Built for small teams')).toBeInTheDocument();
  });

  it('opens external resources safely in a new tab', () => {
    renderFooter();

    const github = screen.getByRole('link', { name: 'GitHub' });
    expect(github).toHaveAttribute('href', 'https://github.com/gemasaputera/taskboard');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noreferrer');
  });
});
