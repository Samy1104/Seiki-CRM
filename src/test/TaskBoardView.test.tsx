import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskBoardView } from '../views/tasks/TaskBoardView';
import type { Task } from '../services/tasksService';
import type { TaskWidgetHandlers } from '../views/tasks/TaskWidgets';

const makeTask = (overrides: Partial<Task>): Task => ({
  id: 'task-1',
  description: 'Test task',
  lead_id: null,
  assigned_to: null,
  created_by: null,
  priority: 'medium',
  status: 'todo',
  due_date: null,
  completed_at: null,
  position: 0,
  is_auto_generated: false,
  sequence_step_id: null,
  created_at: '2026-07-21T00:00:00Z',
  updated_at: '2026-07-21T00:00:00Z',
  ...overrides,
});

const mockWidgets: TaskWidgetHandlers = {
  teamMembers: [],
  leads: [],
  activeDropdown: null,
  setActiveDropdown: vi.fn(),
  dropdownWrapperRef: { current: null },
  onToggleAssignee: vi.fn(),
  onUpdateDueDate: vi.fn(),
  onUpdatePriority: vi.fn(),
  onUpdateLead: vi.fn(),
};

describe('TaskBoardView', () => {
  const todoTask = makeTask({ id: 'task-todo', description: 'Todo task', status: 'todo' });
  const inProgressTask = makeTask({ id: 'task-in-progress', description: 'In progress task', status: 'in_progress' });
  const doneTask = makeTask({ id: 'task-done', description: 'Done task', status: 'done' });

  it('renders no status-switch buttons for any task status', () => {
    const { container } = render(
      <TaskBoardView
        todoTasks={[todoTask]}
        inProgressTasks={[inProgressTask]}
        doneTasks={[doneTask]}
        onAddTask={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteTask={vi.fn()}
        widgets={mockWidgets}
      />
    );

    const buttonTexts = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttonTexts.some((t) => t?.includes('En cours'))).toBe(false);
    expect(buttonTexts.some((t) => t?.includes('À faire'))).toBe(false);
    expect(buttonTexts.some((t) => t?.includes('Fini'))).toBe(false);
    expect(buttonTexts.some((t) => t?.includes('Ouvrir'))).toBe(false);
    expect(buttonTexts.some((t) => t === 'Supprimer')).toBe(false);
  });

  it('renders exactly one delete button per card, each calling onDeleteTask with its own task id', () => {
    const onDeleteTask = vi.fn();
    const { container } = render(
      <TaskBoardView
        todoTasks={[todoTask]}
        inProgressTasks={[inProgressTask]}
        doneTasks={[doneTask]}
        onAddTask={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDeleteTask={onDeleteTask}
        widgets={mockWidgets}
      />
    );

    const deleteButtons = Array.from(
      container.querySelectorAll('button[aria-label="Supprimer la tâche"]')
    ) as HTMLButtonElement[];
    expect(deleteButtons).toHaveLength(3);

    fireEvent.click(deleteButtons[0]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-todo');

    fireEvent.click(deleteButtons[1]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-in-progress');

    fireEvent.click(deleteButtons[2]);
    expect(onDeleteTask).toHaveBeenCalledWith('task-done');
  });
});
