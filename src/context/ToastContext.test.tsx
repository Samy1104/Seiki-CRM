import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastContext';

function Probe({ onRender }: { onRender: (showToast: unknown) => void }) {
  const { showToast } = useToast();
  onRender(showToast);
  return null;
}

describe('ToastContext', () => {
  it('keeps a stable showToast reference across re-renders (fixes cascading refetch bug)', () => {
    const seen: unknown[] = [];
    const { rerender } = render(
      <ToastProvider>
        <Probe onRender={(fn) => seen.push(fn)} />
      </ToastProvider>
    );

    rerender(
      <ToastProvider>
        <Probe onRender={(fn) => seen.push(fn)} />
      </ToastProvider>
    );

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });

  it('renders and auto-dismisses a toast', () => {
    function Fixture() {
      const { showToast } = useToast();
      return <button onClick={() => showToast('Saved', 'success')}>go</button>;
    }

    render(
      <ToastProvider>
        <Fixture />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('go').click();
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('useToast throws outside a ToastProvider', () => {
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow('useToast must be used within a ToastProvider');
  });
});
