import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(<Drawer open={false} onClose={vi.fn()} title="Titre">Contenu</Drawer>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('renders title and children when open', () => {
    render(<Drawer open onClose={vi.fn()} title="Leads de la cohorte Mai 2026">Contenu</Drawer>);
    expect(screen.getByText('Leads de la cohorte Mai 2026')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByTestId('drawer-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Titre">Contenu</Drawer>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
