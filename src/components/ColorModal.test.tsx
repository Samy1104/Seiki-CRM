import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorModal } from './ColorModal';

describe('ColorModal', () => {
  it('renders popover when anchorRef is positioned', () => {
    const dummyButton = document.createElement('button');
    vi.spyOn(dummyButton, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 120,
      left: 50,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {},
    });

    const anchorRef = { current: dummyButton };
    render(
      <ColorModal
        value="#6B5FE6"
        onChange={vi.fn()}
        onClose={vi.fn()}
        anchorRef={anchorRef}
      />
    );

    expect(screen.getByText('Choisir une couleur')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    const dummyButton = document.createElement('button');
    vi.spyOn(dummyButton, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 120,
      left: 50,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 100,
      toJSON: () => {},
    });

    const anchorRef = { current: dummyButton };
    render(
      <ColorModal
        value="#6B5FE6"
        onChange={vi.fn()}
        onClose={handleClose}
        anchorRef={anchorRef}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
