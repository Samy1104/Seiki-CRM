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
});
