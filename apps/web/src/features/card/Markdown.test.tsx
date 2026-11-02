import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders common markdown formatting and safe external links', () => {
    const { container } = render(
      <Markdown
        content={'## Plan\n\n**Ship** the `board`\n\n- one\n- two\n\n[API](https://example.com)'}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Plan' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('Ship');
    expect(container.querySelector('code')).toHaveTextContent('board');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    const link = screen.getByRole('link', { name: 'API' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render raw HTML or javascript links', () => {
    const { container } = render(
      <Markdown content={'<script>alert(1)</script>\n\nplain\n\n[bad](javascript:alert(1))'} />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('plain')).toBeInTheDocument();

    expect(screen.getByText('bad')).toBeInTheDocument();
    expect(container.querySelector('a[href*="javascript"]')).toBeNull();
  });

  it('preserves single line breaks and renders task lists', () => {
    const { container } = render(
      <Markdown content={'line one\nline two\n\n- [x] done\n- [ ] todo'} />,
    );

    expect(container.querySelectorAll('br')).toHaveLength(1);

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);
  });
});
