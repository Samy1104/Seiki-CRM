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

  it('fillWidth: sets the flexible-width inline style contract on the column (no max-width cap)', () => {
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

  // The actual flex item that must grow to fill the board's width is an
  // unstyled <div> react-kanban-kit renders between `.rkk-board` and
  // `.rkk-column-outer` — not `.rkk-column-outer` itself, which the two
  // tests above check inline styles on. That growth comes from a global
  // CSS rule (`.rkk-fill-width > div:not(.rkk-column-adder)` in
  // src/index.css), scoped by this `rkk-fill-width` class on the board
  // root. jsdom has no layout engine and doesn't load src/index.css in
  // this test file, so it can't verify the resulting pixel widths —
  // that was verified live in a real browser instead. This test only
  // locks in the CSS hook (the class toggle) so a regression there
  // still fails a test, even though the cascade effect itself can't be
  // asserted here.
  it('fillWidth: the board root carries the rkk-fill-width class (the CSS hook that grows the real flex item)', () => {
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

    const board = container.querySelector('.rkk-board');
    expect(board).not.toBeNull();
    expect(board?.className.split(' ')).toContain('rkk-fill-width');
  });

  it('without fillWidth, the board root does not carry the rkk-fill-width class', () => {
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

    const board = container.querySelector('.rkk-board');
    expect(board).not.toBeNull();
    expect(board?.className.split(' ')).not.toContain('rkk-fill-width');
  });
});
