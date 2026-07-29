import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

describe('ConfirmDeleteModal', () => {
  it('renders title and message when open', () => {
    render(
      <ConfirmDeleteModal
        isOpen={true}
        title="Supprimer la tâche"
        message="Êtes-vous sûr ?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Supprimer la tâche')).toBeInTheDocument();
    expect(screen.getByText('Êtes-vous sûr ?')).toBeInTheDocument();
  });

  it('triggers onConfirm and onCancel callbacks', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ConfirmDeleteModal
        isOpen={true}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    fireEvent.click(screen.getByText('Supprimer'));
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Annuler'));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    const handleCancel = vi.fn();

    render(
      <ConfirmDeleteModal
        isOpen={true}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
