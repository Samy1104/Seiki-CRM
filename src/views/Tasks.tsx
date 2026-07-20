import React, { useEffect, useMemo, useRef, useState } from 'react';

import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { TeamMember } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { List, Kanban, Calendar, X, SlidersHorizontal, Plus } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import { withLoadingState } from '../utils/withLoadingState';
import { confirmAction } from '../utils/confirmAction';
import type { ActiveDropdown, TaskWidgetHandlers } from './tasks/TaskWidgets';
import { TaskListView } from './tasks/TaskListView';
import type { ColWidths } from './tasks/TaskListView';
import { TaskBoardView } from './tasks/TaskBoardView';
import { NewTaskModal } from './tasks/NewTaskModal';

const getColumnIndicators = (column: string): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-column="${column}"]`));

const clearColumnHighlights = (column: string, els?: HTMLElement[]) => {
  const indicators = els || getColumnIndicators(column);
  indicators.forEach(i => { i.style.opacity = '0'; });
};

const getNearestIndicator = (e: React.DragEvent, indicators: HTMLElement[]) => {
  const DISTANCE_OFFSET = 50;
  return indicators.reduce<{ offset: number; element: HTMLElement }>(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = e.clientY - (box.top + DISTANCE_OFFSET);
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: indicators[indicators.length - 1] }
  );
};

const highlightColumnIndicator = (e: React.DragEvent, column: string) => {
  const indicators = getColumnIndicators(column);
  clearColumnHighlights(column, indicators);
  const { element } = getNearestIndicator(e, indicators);
  if (element) element.style.opacity = '1';
};

const COL_KEYS: (keyof ColWidths)[] = ['name', 'assignee', 'date', 'priority', 'lead'];

const computeDefaultColWidths = (): ColWidths => {
  // Default calculation to fill the page dynamically
  const availableWidth = typeof window !== 'undefined' ? window.innerWidth - 320 : 1200; // Account for sidebar and padding
  const dynamicWidth = Math.max(800, availableWidth - 118 - 32); // 118px = fixed cells, 32px = row padding

  return {
    name: Math.floor(dynamicWidth * (1.8 / 6)),
    assignee: Math.floor(dynamicWidth * (1 / 6)),
    date: Math.floor(dynamicWidth * (1 / 6)),
    priority: Math.floor(dynamicWidth * (1 / 6)),
    lead: Math.floor(dynamicWidth * (1.2 / 6))
  };
};

const getInitialColWidths = (): ColWidths => {
  const defaults = computeDefaultColWidths();

  try {
    const saved = localStorage.getItem('tasksColWidths');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults so a stale/partial shape (e.g. after a schema
      // change) never leaves a column with an undefined/NaN width.
      const merged = { ...defaults };
      for (const key of COL_KEYS) {
        if (typeof parsed?.[key] === 'number' && Number.isFinite(parsed[key])) {
          merged[key] = parsed[key];
        }
      }
      return merged;
    }
  } catch (err) {
    console.error('Error reading saved col widths', err);
  }

  return defaults;
};

export const Tasks: React.FC = () => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterPriority, setFilterPriority] = useState<'high' | 'medium' | 'low' | ''>('');
  const [filterLeadId, setFilterLeadId] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');
  const [sortByDue, setSortByDue] = useState<'asc' | ''>(''); // 'asc' = plus proche en premier

  // Column Widths for resizing like ClickUp
  const [colWidths, setColWidths] = useState(getInitialColWidths);

  // Save to localStorage whenever widths change
  useEffect(() => {
    localStorage.setItem('tasksColWidths', JSON.stringify(colWidths));
  }, [colWidths]);

  // New task form state
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newLeadId, setNewLeadId] = useState('');
  const [newStatus, setNewStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Interactive inline editing dropdowns
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown | null>(null);
  const dropdownWrapperRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownWrapperRef.current && !dropdownWrapperRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const loadTasksData = () => withLoadingState(async () => {
    const fetchedTasks = await tasksService.getTasks();
    const fetchedLeads = await leadsService.getLeads();
    const fetchedMembers = await settingsService.getTeamMembers();

    setTasks(fetchedTasks);
    setLeads(fetchedLeads);
    setTeamMembers(fetchedMembers);
  }, {
    setLoading,
    onError: (err) => {
      console.error('Error loading tasks:', err);
      showToast('Erreur lors du chargement des tâches', 'error');
    }
  });

  useLoadOnMount(loadTasksData);

  const openTaskModal = (status: 'todo' | 'in_progress' | 'done' = 'todo') => {
    setNewStatus(status);
    setTaskModalOpen(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;

    try {
      await tasksService.createTask({
        description: newDesc.trim(),
        lead_id: newLeadId || null,
        assigned_to: newAssigneeIds[0] || null, // fallback
        assignee_ids: newAssigneeIds,
        created_by: null,
        priority: newPriority,
        status: newStatus,
        due_date: newDueDate || null
      });

      setNewDesc('');
      setNewDueDate('');
      setNewPriority('medium');
      setNewAssigneeIds([]);
      setNewLeadId('');
      setNewStatus('todo');
      setTaskModalOpen(false);

      showToast('Tâche ajoutée');
      loadTasksData();
    } catch (err) {
      console.error('Error creating task:', err);
      showToast('Erreur lors de la création', 'error');
    }
  };

  const handleToggleStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await tasksService.updateTask(taskId, { status: nextStatus });
      loadTasksData();
      showToast(nextStatus === 'done' ? 'Tâche terminée' : 'Tâche rouverte');
    } catch (err) {
      console.error('Error updating task:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirmAction('Supprimer cette tâche ?')) {
      try {
        await tasksService.deleteTask(taskId);
        showToast('Tâche supprimée');
        loadTasksData();
      } catch (err) {
        console.error('Error deleting task:', err);
        showToast('Erreur lors de la suppression', 'error');
      }
    }
  };

  // Toggle single member assignment in task_assignees list
  const handleToggleAssignee = async (task: Task, memberId: string) => {
    const currentAssignees = task.assignees || [];
    const isCurrentlyAssigned = currentAssignees.some(a => a.id === memberId);

    let newAssigneeIds: string[];
    if (isCurrentlyAssigned) {
      newAssigneeIds = currentAssignees.filter(a => a.id !== memberId).map(a => a.id);
    } else {
      newAssigneeIds = [...currentAssignees.map(a => a.id), memberId];
    }

    try {
      // Optimistic UI update
      setTasks(prev => prev.map(t => {
        if (t.id === task.id) {
          const updatedAssignees = teamMembers.filter(m => newAssigneeIds.includes(m.id));
          return {
            ...t,
            assignees: updatedAssignees,
            assigned_to: newAssigneeIds[0] || null,
            assignee: updatedAssignees[0] || null
          };
        }
        return t;
      }));

      await tasksService.updateTask(task.id, { assignee_ids: newAssigneeIds });
      showToast('Assignations mises à jour');
      loadTasksData();
    } catch (err) {
      console.error('Error toggling assignee:', err);
      showToast('Erreur lors de la modification', 'error');
      loadTasksData();
    }
  };

  // Update a specific task parameter inline (due_date, priority, lead, status)
  const handleUpdateTaskParam = async (
    taskId: string,
    field: 'due_date' | 'priority' | 'lead_id' | 'status',
    value: string | null
  ) => {
    try {
      // Optimistic UI update
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const updated = { ...t };
          if (field === 'due_date') {
            updated.due_date = value;
          } else if (field === 'priority') {
            updated.priority = value as Task['priority'];
          } else if (field === 'lead_id') {
            updated.lead_id = value;
            const linkedLead = leads.find(l => l.id === value);
            updated.lead = linkedLead ? { company_name: linkedLead.company_name } : null;
          } else if (field === 'status') {
            updated.status = value as Task['status'];
          }
          return updated;
        }
        return t;
      }));

      await tasksService.updateTask(taskId, { [field]: value });
      showToast('Tâche mise à jour');
      loadTasksData();
    } catch (err) {
      console.error('Error updating task parameter:', err);
      showToast('Erreur de mise à jour', 'error');
      loadTasksData();
    }
  };

  const handleUpdateDueDate = (taskId: string, value: string | null) => handleUpdateTaskParam(taskId, 'due_date', value);
  const handleUpdatePriority = (taskId: string, priority: 'high' | 'medium' | 'low') => handleUpdateTaskParam(taskId, 'priority', priority);
  const handleUpdateLead = (taskId: string, leadId: string | null) => handleUpdateTaskParam(taskId, 'lead_id', leadId);
  const handleUpdateStatus = (taskId: string, status: 'todo' | 'in_progress' | 'done') => handleUpdateTaskParam(taskId, 'status', status);

  const widgetHandlers: TaskWidgetHandlers = {
    teamMembers,
    leads,
    activeDropdown,
    setActiveDropdown,
    dropdownWrapperRef,
    onToggleAssignee: handleToggleAssignee,
    onUpdateDueDate: handleUpdateDueDate,
    onUpdatePriority: handleUpdatePriority,
    onUpdateLead: handleUpdateLead,
  };

  // ClickUp Column Resizing Logic
  const activeResizeCleanup = useRef<(() => void) | null>(null);

  // Ensure any in-flight resize listeners are removed if the component unmounts
  // mid-drag (e.g. user navigates away via the sidebar while dragging).
  useEffect(() => {
    return () => activeResizeCleanup.current?.();
  }, []);

  const startResize = (e: React.MouseEvent, column: keyof ColWidths) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = colWidths[column];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      setColWidths(prev => ({
        ...prev,
        [column]: Math.max(90, startWidth + deltaX) // Minimum width 90px
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      activeResizeCleanup.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    activeResizeCleanup.current = handleMouseUp;
  };

  // --- DRAG & DROP HANDLERS (LIST VIEW) ---
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  // Row-level drag over — for intra-section reordering
  const handleDragOverTask = (e: React.DragEvent, taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStatus(status);
    setDragOverTaskId(taskId);
  };

  const handleDragLeaveTask = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const targetTaskId = dragOverTaskId;
    setDraggedTaskId(null);
    setDragOverStatus(null);
    setDragOverTaskId(null);

    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status !== targetStatus) {
      // Move between sections
      try {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));
        await tasksService.updateTask(taskId, { status: targetStatus });
        showToast(`Tâche déplacée dans "${targetStatus === 'todo' ? 'À faire' : targetStatus === 'in_progress' ? 'En cours' : 'Terminé'}"`);
        loadTasksData();
      } catch (err) {
        console.error('Error updating drag status:', err);
        showToast('Erreur lors du déplacement de la tâche', 'error');
        loadTasksData();
      }
    } else if (targetTaskId && targetTaskId !== taskId) {
      // Reorder within same section — optimistic update
      const updated = [...tasks];
      const fromIdx = updated.findIndex(t => t.id === taskId);
      const toIdx = updated.findIndex(t => t.id === targetTaskId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = updated.splice(fromIdx, 1);
      const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx;
      updated.splice(adjustedTo, 0, moved);
      setTasks(updated);

      const sectionTasks = updated.filter(t => t.status === targetStatus);
      try {
        await Promise.all(sectionTasks.map((t, i) => tasksService.updateTask(t.id, { position: i })));
        showToast('Ordre mis à jour');
      } catch (err) {
        console.error('Error persisting task order:', err);
        showToast('Erreur lors de la sauvegarde de l\'ordre', 'error');
        loadTasksData();
      }
    }
  };

  // --- BOARD VIEW DRAG & DROP — indicator-line based (mirrors reference kanban) ---
  const handleBoardDragOver = (e: React.DragEvent, column: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    setDragOverStatus(column);
    highlightColumnIndicator(e, column);
  };

  const handleBoardDragLeave = (column: 'todo' | 'in_progress' | 'done') => {
    setDragOverStatus(null);
    clearColumnHighlights(column);
  };

  const handleBoardDrop = async (e: React.DragEvent, targetStatus: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const indicators = getColumnIndicators(targetStatus);
    const { element } = getNearestIndicator(e, indicators);
    const beforeTaskId = element?.dataset.before || '-1';

    setDraggedTaskId(null);
    setDragOverStatus(null);
    clearColumnHighlights(targetStatus, indicators);

    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status !== targetStatus) {
      // Move between sections, dropped at the position the indicator line marks
      const updated = tasks.filter(t => t.id !== taskId);
      const movedTask = { ...task, status: targetStatus };
      if (beforeTaskId === '-1' || beforeTaskId === taskId) {
        updated.push(movedTask);
      } else {
        const insertIndex = updated.findIndex(t => t.id === beforeTaskId);
        if (insertIndex === -1) {
          updated.push(movedTask);
        } else {
          updated.splice(insertIndex, 0, movedTask);
        }
      }
      setTasks(updated);

      try {
        await tasksService.updateTask(taskId, { status: targetStatus });
        showToast(`Tâche déplacée dans "${targetStatus === 'todo' ? 'À faire' : targetStatus === 'in_progress' ? 'En cours' : 'Terminé'}"`);
        loadTasksData();
      } catch (err) {
        console.error('Error updating drag status:', err);
        showToast('Erreur lors du déplacement de la tâche', 'error');
        loadTasksData();
      }
    } else if (beforeTaskId !== '-1' && beforeTaskId !== taskId) {
      // Reorder within same section — optimistic update
      const updated = [...tasks];
      const fromIdx = updated.findIndex(t => t.id === taskId);
      const toIdx = updated.findIndex(t => t.id === beforeTaskId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = updated.splice(fromIdx, 1);
      const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx;
      updated.splice(adjustedTo, 0, moved);
      setTasks(updated);

      const sectionTasks = updated.filter(t => t.status === targetStatus);
      try {
        await Promise.all(sectionTasks.map((t, i) => tasksService.updateTask(t.id, { position: i })));
        showToast('Ordre mis à jour');
      } catch (err) {
        console.error('Error persisting task order:', err);
        showToast('Erreur lors de la sauvegarde de l\'ordre', 'error');
        loadTasksData();
      }
    }
  };

  // Active filter count for badge
  const activeFilterCount = [filterPriority, filterLeadId, filterAssigneeId, sortByDue].filter(Boolean).length;

  // Apply filters + optional due-date sort
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterPriority) {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (filterLeadId) {
      result = result.filter(t => t.lead_id === filterLeadId);
    }
    if (filterAssigneeId) {
      result = result.filter(t => (t.assignees || []).some(a => a.id === filterAssigneeId));
    }
    if (sortByDue === 'asc') {
      result.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;   // no date goes to the end
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }

    return result;
  }, [tasks, filterPriority, filterLeadId, filterAssigneeId, sortByDue]);

  // Groups for views
  const todoTasks = useMemo(() => filteredTasks.filter(t => t.status === 'todo'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(t => t.status === 'in_progress'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter(t => t.status === 'done'), [filteredTasks]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="mt-3 text-ink-soft">Chargement des tâches...</div>
      </div>
    );
  }

  return (
    <div className={viewMode === 'board' ? 'flex h-full flex-col p-6' : 'p-6'}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-display text-3xl font-bold text-ink">Tâches</div>
        </div>

        <div className="flex gap-2">
          <Button variant={viewMode === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('list')}>
            <List size={14} />
            Liste
          </Button>
          <Button variant={viewMode === 'board' ? 'primary' : 'ghost'} size="sm" onClick={() => setViewMode('board')}>
            <Kanban size={14} />
            Tableau
          </Button>
          <Button variant="primary" size="sm" onClick={() => openTaskModal('todo')}>
            <Plus size={14} />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-surface border border-line bg-elevated p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <SlidersHorizontal size={13} className="flex-shrink-0 text-ink-faint" />
          <span className="text-xs font-semibold text-ink-soft">Filtres</span>

          <Select value={filterPriority} onValueChange={val => setFilterPriority(val as 'high' | 'medium' | 'low' | '')}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Priorité — Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Priorité — Toutes</SelectItem>
              <SelectItem value="high">Urgent</SelectItem>
              <SelectItem value="medium">Normal</SelectItem>
              <SelectItem value="low">Basse</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterLeadId} onValueChange={val => setFilterLeadId(val)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Lead — Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Lead — Tous</SelectItem>
              {leads.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterAssigneeId} onValueChange={val => setFilterAssigneeId(val)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Assigné — Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Assigné — Tous</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${sortByDue === 'asc' ? 'border-line-focus bg-amber-soft text-ink' : 'border-line-strong text-ink-soft hover:bg-hover'}`}
            onClick={() => setSortByDue(v => v === 'asc' ? '' : 'asc')}
            title="Trier par échéance (plus proche en premier)"
          >
            <Calendar size={12} />
            Échéance {sortByDue === 'asc' ? '↑' : ''}
          </button>

          {activeFilterCount > 0 && (
            <button
              className="inline-flex items-center gap-1 rounded-control px-2 py-1.5 text-xs text-ink-faint transition-colors hover:text-danger cursor-pointer"
              onClick={() => {
                setFilterPriority('');
                setFilterLeadId('');
                setFilterAssigneeId('');
                setSortByDue('');
              }}
              title="Réinitialiser les filtres"
            >
              <X size={11} />
              Réinitialiser ({activeFilterCount})
            </button>
          )}
        </div>

        {activeFilterCount > 0 && (
          <span className="text-xs text-ink-faint">
            {filteredTasks.length} / {tasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* View Panels */}
      {viewMode === 'list' && (
        <TaskListView
          todoTasks={todoTasks}
          inProgressTasks={inProgressTasks}
          doneTasks={doneTasks}
          colWidths={colWidths}
          onStartResize={startResize}
          dragOverStatus={dragOverStatus}
          dragOverTaskId={dragOverTaskId}
          draggedTaskId={draggedTaskId}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragOverTask={handleDragOverTask}
          onDragLeaveTask={handleDragLeaveTask}
          onDrop={handleDrop}
          onToggleStatus={handleToggleStatus}
          onDeleteTask={handleDeleteTask}
          widgets={widgetHandlers}
        />
      )}

      {viewMode === 'board' && (
        <TaskBoardView
          todoTasks={todoTasks}
          inProgressTasks={inProgressTasks}
          doneTasks={doneTasks}
          dragOverStatus={dragOverStatus}
          onDragOver={handleBoardDragOver}
          onDragLeave={handleBoardDragLeave}
          onDrop={handleBoardDrop}
          onDragStart={handleDragStart}
          onAddTask={openTaskModal}
          onUpdateStatus={handleUpdateStatus}
          onDeleteTask={handleDeleteTask}
          widgets={widgetHandlers}
        />
      )}

      {/* New Task Modal */}
      {taskModalOpen && (
        <NewTaskModal
          leads={leads}
          teamMembers={teamMembers}
          desc={newDesc}
          dueDate={newDueDate}
          priority={newPriority}
          assigneeIds={newAssigneeIds}
          leadId={newLeadId}
          status={newStatus}
          onDescChange={setNewDesc}
          onDueDateChange={setNewDueDate}
          onPriorityChange={setNewPriority}
          onToggleAssigneeId={(memberId) => setNewAssigneeIds(prev =>
            prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
          )}
          onLeadIdChange={setNewLeadId}
          onStatusChange={setNewStatus}
          onSubmit={handleAddTask}
          onClose={() => setTaskModalOpen(false)}
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown}
          dropdownWrapperRef={dropdownWrapperRef}
        />
      )}
    </div>
  );
};
