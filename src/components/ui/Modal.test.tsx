import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={vi.fn()} header="Titre">Contenu</Modal>);
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument();
  });

  it('renders header and children when open', () => {
    render(<Modal open onClose={vi.fn()} header="Détail du lead">Contenu</Modal>);
    expect(screen.getByText('Détail du lead')).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('calls onClose when the overlay is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the modal box itself is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} header="Titre">Contenu</Modal>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });
});
