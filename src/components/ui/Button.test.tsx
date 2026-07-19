import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and responds to clicks', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Nouveau lead</Button>);

    const btn = screen.getByRole('button', { name: 'Nouveau lead' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the secondary variant and md size', () => {
    render(<Button>Action</Button>);
    const btn = screen.getByRole('button', { name: 'Action' });
    expect(btn.className).toContain('bg-elevated');
    expect(btn.className).toContain('px-4');
  });

  it('applies primary variant styling', () => {
    render(<Button variant="primary">Nouveau lead</Button>);
    const btn = screen.getByRole('button', { name: 'Nouveau lead' });
    expect(btn.className).toContain('bg-amber');
  });

  it('applies danger variant styling', () => {
    render(<Button variant="danger">Supprimer</Button>);
    const btn = screen.getByRole('button', { name: 'Supprimer' });
    expect(btn.className).toContain('text-danger');
  });

  it('respects the disabled prop', () => {
    render(<Button disabled>Nouveau lead</Button>);
    expect(screen.getByRole('button', { name: 'Nouveau lead' })).toBeDisabled();
  });
});
