import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SeikiKanbanBoard } from '../components/ui/SeikiKanbanBoard';

describe('SeikiKanbanBoard', () => {
  const columns = [
    { id: 'col-1', title: 'To Do', color: '#ff0000' },
    { id: 'col-2', title: 'Done', color: '#00ff00' },
  ];

  const cards = [
    { id: 'card-1', columnId: 'col-1', title: 'First Task' },
    { id: 'card-2', columnId: 'col-2', title: 'Second Task' },
  ];

  it('renders column headers correctly', () => {
    render(
      <SeikiKanbanBoard
        columns={columns}
        cards={cards}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(card) => card.id}
        getCardColumnId={(card) => card.columnId}
        renderCard={(card) => <div>{card.title}</div>}
        onCardMove={vi.fn()}
      />
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('First Task')).toBeInTheDocument();
  });

  it('renders the inner column area transparent, not the library default white', () => {
    const { container } = render(
      <SeikiKanbanBoard
        columns={columns}
        cards={cards}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(card) => card.id}
        getCardColumnId={(card) => card.columnId}
        renderCard={(card) => <div>{card.title}</div>}
        onCardMove={vi.fn()}
      />
    );

    const innerColumn = container.querySelector('.rkk-column');
    expect(innerColumn).not.toBeNull();
    expect(innerColumn).toHaveStyle('background-color: rgba(0, 0, 0, 0)');
  });

  it('fillWidth: columns flex to fill available width with no max-width cap', () => {
    const { container } = render(
      <SeikiKanbanBoard
        columns={columns}
        cards={cards}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(card) => card.id}
        getCardColumnId={(card) => card.columnId}
        renderCard={(card) => <div>{card.title}</div>}
        onCardMove={vi.fn()}
        fillWidth
      />
    );

    const columnOuter = container.querySelector('.rkk-column-outer');
    expect(columnOuter).not.toBeNull();
    expect(columnOuter).toHaveStyle({ minWidth: '220px', maxWidth: 'none' });
  });

  it('without fillWidth, columns keep the existing fixed-width behavior (Pipeline unchanged)', () => {
    const { container } = render(
      <SeikiKanbanBoard
        columns={columns}
        cards={cards}
        getColumnId={(col) => col.id}
        getColumnTitle={(col) => col.title}
        getColumnColor={(col) => col.color}
        getCardId={(card) => card.id}
        getCardColumnId={(card) => card.columnId}
        renderCard={(card) => <div>{card.title}</div>}
        onCardMove={vi.fn()}
      />
    );

    const columnOuter = container.querySelector('.rkk-column-outer');
    expect(columnOuter).not.toBeNull();
    expect(columnOuter).toHaveStyle({ minWidth: '260px', maxWidth: '264px' });
  });
});
