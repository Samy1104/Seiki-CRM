import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Media</Badge>);
    expect(screen.getByText('Media')).toBeInTheDocument();
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Media</Badge>);
    expect(screen.getByText('Media').className).toContain('text-ink-soft');
  });

  it('applies the success tone', () => {
    render(<Badge tone="success">Gagné</Badge>);
    expect(screen.getByText('Gagné').className).toContain('text-success');
  });

  it('applies the danger tone', () => {
    render(<Badge tone="danger">Perdu</Badge>);
    expect(screen.getByText('Perdu').className).toContain('text-danger');
  });

  it('applies the warning tone', () => {
    render(<Badge tone="warning">SLA 2j</Badge>);
    expect(screen.getByText('SLA 2j').className).toContain('text-amber');
  });
});
