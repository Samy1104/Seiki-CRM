import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TagAutoCompleteCombobox } from './TagAutoCompleteCombobox';

describe('TagAutoCompleteCombobox', () => {
  const mockTagBook = [
    { alias: 'seiki', name: 'Seiki Tech', urn: 'urn:li:organization:123', type: 'organization' as const },
    { alias: 'jaafar', name: 'Jaafar Bounaim', urn: 'urn:li:person:456', type: 'person' as const },
  ];

  it('renders tag options matching filter query', () => {
    const handleSelect = vi.fn();
    const handleOpenQuickAdd = vi.fn();

    render(
      <TagAutoCompleteCombobox
        filterQuery="seiki"
        tagBook={mockTagBook}
        onSelectTag={handleSelect}
        onOpenQuickAdd={handleOpenQuickAdd}
      />
    );

    expect(screen.getByText('Seiki Tech')).toBeInTheDocument();
    expect(screen.queryByText('Jaafar Bounaim')).not.toBeInTheDocument();
  });

  it('calls onSelectTag when a tag option is clicked', () => {
    const handleSelect = vi.fn();
    const handleOpenQuickAdd = vi.fn();

    render(
      <TagAutoCompleteCombobox
        filterQuery=""
        tagBook={mockTagBook}
        onSelectTag={handleSelect}
        onOpenQuickAdd={handleOpenQuickAdd}
      />
    );

    fireEvent.mouseDown(screen.getByText('Seiki Tech'));
    expect(handleSelect).toHaveBeenCalledWith(mockTagBook[0]);
  });

  it('renders quick add button and triggers onOpenQuickAdd', () => {
    const handleSelect = vi.fn();
    const handleOpenQuickAdd = vi.fn();

    render(
      <TagAutoCompleteCombobox
        filterQuery="newcompany"
        tagBook={mockTagBook}
        onSelectTag={handleSelect}
        onOpenQuickAdd={handleOpenQuickAdd}
      />
    );

    const quickAddBtn = screen.getByText(/Nouveau compte "newcompany"/i);
    expect(quickAddBtn).toBeInTheDocument();

    fireEvent.mouseDown(quickAddBtn);
    expect(handleOpenQuickAdd).toHaveBeenCalledWith('newcompany');
  });
});
