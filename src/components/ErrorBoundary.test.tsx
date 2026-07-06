import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): ReactElement {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders a fallback UI when a child throws, and recovers on retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();

    // Swapping in safe children while the error state is still set must not
    // re-throw: the boundary short-circuits on state, not on the new props.
    rerender(
      <ErrorBoundary>
        <div>recovered</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Réessayer'));
    expect(screen.getByText('recovered')).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
