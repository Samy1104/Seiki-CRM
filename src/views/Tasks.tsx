import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';

import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { leadsService } from '../services/leadsService';
import type { Lead } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import type { TeamMember } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { List, Kanban, Calendar, Trash2, Flag, Tag, User, SlidersHorizontal, X, Plus } from 'lucide-react';

// Board column drop indicator — a thin line inserted between cards showing
// exactly where the dragged card will land. Opacity is toggled imperatively
// (not via React state) so dragging over many cards doesn't cause re-renders.
const DropIndicator: React.FC<{ beforeId: string | null; column: string }> = ({ beforeId, column }) => (
  <div data-before={beforeId || '-1'} data-column={column} className="task-drop-indicator" />
);

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

interface ActiveDropdown {
  taskId: string;
  type: 'assignee' | 'priority' | 'lead';
  x: number;
  y: number;
}

interface ColWidths {
  name: number;
  assignee: number;
  date: number;
  priority: number;
  lead: number;
}

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

  useEffect(() => {
    loadTasksData();
  }, []);

  const loadTasksData = async () => {
    try {
      const fetchedTasks = await tasksService.getTasks();
      const fetchedLeads = await leadsService.getLeads();
      const fetchedMembers = await settingsService.getTeamMembers();

      setTasks(fetchedTasks);
      setLeads(fetchedLeads);
      setTeamMembers(fetchedMembers);
    } catch (err) {
      console.error('Error loading tasks:', err);
      showToast('Erreur lors du chargement des tâches', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    if (window.confirm('Supprimer cette tâche ?')) {
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
    value: any
  ) => {
    try {
      // Optimistic UI update
      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const updated = { ...t };
          if (field === 'due_date') {
            updated.due_date = value;
          } else if (field === 'priority') {
            updated.priority = value;
          } else if (field === 'lead_id') {
            updated.lead_id = value;
            const linkedLead = leads.find(l => l.id === value);
            updated.lead = linkedLead ? { company_name: linkedLead.company_name } : null;
          } else if (field === 'status') {
            updated.status = value;
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

  // ClickUp Column Resizing Logic
  const activeResizeCleanup = useRef<(() => void) | null>(null);

  // Ensure any in-flight resize listeners are removed if the component unmounts
  // mid-drag (e.g. user navigates away via the sidebar while dragging).
  useEffect(() => {
    return () => activeResizeCleanup.current?.();
  }, []);

  const startResize = (e: React.MouseEvent, column: keyof typeof colWidths) => {
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

  // --- DRAG & DROP HANDLERS ---
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Chargement des tâches...</div>
      </div>
    );
  }

  // Active filter count for badge
  const activeFilterCount = [filterPriority, filterLeadId, filterAssigneeId, sortByDue].filter(Boolean).length;

  // Apply filters + optional due-date sort
  const filteredTasks = (() => {
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
  })();

  // Groups for views
  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  // Helper formatting priority color
  const getPriorityInfo = (priority: string | null) => {
    switch (priority) {
      case 'high': return { label: 'Urgent', color: 'var(--red)', bg: 'rgba(248, 113, 113, 0.12)' };
      case 'medium': return { label: 'Normal', color: 'var(--gold)', bg: 'rgba(245, 183, 49, 0.12)' };
      case 'low': return { label: 'Basse', color: 'var(--green)', bg: 'rgba(74, 222, 128, 0.12)' };
      default: return { label: 'Sans', color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)' };
    }
  };

  // Custom Inline Widgets
  const renderAssigneeWidget = (task: Task) => {
    const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'assignee';
    const taskAssignees = task.assignees || [];

    return (
      <div className="clickup-inline-dropdown-wrap">
        <div
          onClick={(e) => {
            if (isDropdownOpen) { setActiveDropdown(null); return; }
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setActiveDropdown({ taskId: task.id, type: 'assignee', x: r.left, y: r.bottom + 4 });
          }}
          className="clickup-assignees-trigger-list"
          style={{ cursor: 'pointer' }}
        >
          {taskAssignees.length > 0 ? (
            <div className="assignees-overlapping-list">
              {taskAssignees.slice(0, 3).map((a, idx) => (
                <div
                  key={a.id}
                  className="member-avatar small-avatar"
                  style={{
                    background: a.color,
                    zIndex: 10 - idx,
                    marginLeft: idx > 0 ? '-6px' : '0px'
                  }}
                  title={a.full_name}
                >
                  {a.initials}
                </div>
              ))}
              {taskAssignees.length > 3 && (
                <div
                  className="member-avatar small-avatar count"
                  style={{ background: '#334155', zIndex: 5, marginLeft: '-6px' }}
                  title={`${taskAssignees.length} personnes assignées`}
                >
                  +{taskAssignees.length - 3}
                </div>
              )}
            </div>
          ) : (
            <div className="avatar-placeholder-btn" title="Assigner des membres">
              <User size={12} />
            </div>
          )}
        </div>

        {isDropdownOpen && createPortal(
          <div
            ref={dropdownWrapperRef}
            className="clickup-dropdown-menu"
            style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
          >
            <div className="clickup-dropdown-title">Assigner des membres...</div>
            {teamMembers.map(m => {
              const isAssigned = taskAssignees.some(a => a.id === m.id);
              return (
                <div
                  key={m.id}
                  className={`clickup-dropdown-item ${isAssigned ? 'selected' : ''}`}
                  onClick={() => handleToggleAssignee(task, m.id)}
                >
                  <div className="clickup-dropdown-checkbox">
                    {isAssigned ? '✓' : ''}
                  </div>
                  <div className="member-avatar small-avatar" style={{ background: m.color, marginRight: '8px' }}>{m.initials}</div>
                  <span>{m.full_name}</span>
                </div>
              );
            })}
          </div>,
          document.body
        )}
      </div>
    );
  };

  const renderDatePickerWidget = (task: Task) => {
    const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';
    const isToday = task.due_date === new Date().toISOString().slice(0, 10) && task.status !== 'done';

    let dueClass = 'card-icon-btn';
    if (task.due_date) {
      dueClass += ' active';
      if (isOverdue) dueClass += ' overdue';
      else if (isToday) dueClass += ' today';
    }

    return (
      <div className="clickup-inline-date-picker-wrap">
        <button className={dueClass} title={task.due_date ? `Échéance : ${task.due_date}` : "Définir l'échéance"}>
          <Calendar size={13} style={{ marginRight: task.due_date ? '4px' : '0' }} />
          {task.due_date ? (
            <span style={{ fontSize: '11px', fontWeight: '700' }}>
              {new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          ) : (
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.3)' }}>—</span>
          )}
        </button>
        <input
          type="date"
          className="clickup-hidden-date-input"
          value={task.due_date || ''}
          onChange={(e) => handleUpdateTaskParam(task.id, 'due_date', e.target.value || null)}
        />
      </div>
    );
  };

  const renderPriorityWidget = (task: Task) => {
    const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'priority';
    const prio = getPriorityInfo(task.priority);
    return (
      <div className="clickup-inline-dropdown-wrap">
        <div
          onClick={(e) => {
            if (isDropdownOpen) { setActiveDropdown(null); return; }
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setActiveDropdown({ taskId: task.id, type: 'priority', x: r.left, y: r.bottom + 4 });
          }}
          className={`card-icon-btn ${task.priority ? 'active' : ''}`}
          style={{ gap: '6px' }}
          title={`Priorité : ${prio.label}`}
        >
          <Flag size={13} style={{ color: task.priority ? prio.color : 'inherit' }} />
          <span style={{ fontSize: '11px', fontWeight: '600' }}>{prio.label}</span>
        </div>

        {isDropdownOpen && createPortal(
          <div
            ref={dropdownWrapperRef}
            className="clickup-dropdown-menu"
            style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
          >
            <div className="clickup-dropdown-title">Priorité</div>
            <div
              className={`clickup-dropdown-item ${task.priority === 'high' ? 'selected' : ''}`}
              onClick={() => {
                handleUpdateTaskParam(task.id, 'priority', 'high');
                setActiveDropdown(null);
              }}
            >
              <Flag size={12} style={{ color: 'var(--red)', marginRight: '8px' }} />
              Urgent
            </div>
            <div
              className={`clickup-dropdown-item ${task.priority === 'medium' ? 'selected' : ''}`}
              onClick={() => {
                handleUpdateTaskParam(task.id, 'priority', 'medium');
                setActiveDropdown(null);
              }}
            >
              <Flag size={12} style={{ color: 'var(--gold)', marginRight: '8px' }} />
              Normal
            </div>
            <div
              className={`clickup-dropdown-item ${task.priority === 'low' ? 'selected' : ''}`}
              onClick={() => {
                handleUpdateTaskParam(task.id, 'priority', 'low');
                setActiveDropdown(null);
              }}
            >
              <Flag size={12} style={{ color: 'var(--green)', marginRight: '8px' }} />
              Basse
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  const renderLeadWidget = (task: Task) => {
    const isDropdownOpen = activeDropdown?.taskId === task.id && activeDropdown?.type === 'lead';
    return (
      <div className="clickup-inline-dropdown-wrap">
        <div
          onClick={(e) => {
            if (isDropdownOpen) { setActiveDropdown(null); return; }
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setActiveDropdown({ taskId: task.id, type: 'lead', x: r.left, y: r.bottom + 4 });
          }}
          className={`card-icon-btn ${task.lead_id ? 'active' : ''}`}
          style={{ gap: '6px' }}
          title={task.lead ? `Lead : ${task.lead.company_name}` : "Associer un Lead"}
        >
          <Tag size={13} style={{ color: task.lead_id ? 'var(--purple)' : 'inherit' }} />
          <span style={{ fontSize: '11px', fontWeight: '600' }}>
            {task.lead ? task.lead.company_name : 'Lier lead'}
          </span>
        </div>

        {isDropdownOpen && createPortal(
          <div
            ref={dropdownWrapperRef}
            className="clickup-dropdown-menu scrollable"
            style={{ position: 'fixed', top: activeDropdown!.y, left: activeDropdown!.x, zIndex: 9999, transform: 'none' }}
          >
            <div className="clickup-dropdown-title">Lier à un lead...</div>
            {leads.map(l => (
              <div
                key={l.id}
                className={`clickup-dropdown-item ${task.lead_id === l.id ? 'selected' : ''}`}
                onClick={() => {
                  handleUpdateTaskParam(task.id, 'lead_id', l.id);
                  setActiveDropdown(null);
                }}
              >
                <span>{l.company_name}</span>
              </div>
            ))}
            {task.lead_id && (
              <div
                className="clickup-dropdown-item clear-btn"
                onClick={() => {
                  handleUpdateTaskParam(task.id, 'lead_id', null);
                  setActiveDropdown(null);
                }}
              >
                Retirer le lead
              </div>
            )}
          </div>,
          document.body
        )}
      </div>
    );
  };

  const renderTableRows = (tasksList: Task[], statusKey: 'todo' | 'in_progress' | 'done') => {
    return (
      <div
        className={`clickup-section-body ${dragOverStatus === statusKey ? 'drag-over' : ''}`}
        onDragOver={(e) => handleDragOver(e, statusKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, statusKey)}
      >
        {tasksList.length > 0 ? (
          tasksList.map(task => {
            return (
              <div
                key={task.id}
                className={`clickup-task-row${dragOverTaskId === task.id && draggedTaskId !== task.id ? ' drag-insert-before' : ''}`}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOverTask(e, task.id, statusKey)}
                onDragLeave={handleDragLeaveTask}
              >
                {/* Drag handle */}
                <div className="clickup-cell clickup-cell-drag" style={{ width: 32, flexGrow: 0, flexShrink: 0 }}>
                  <div className="drag-handle">⋮⋮</div>
                </div>

                {/* Checkbox */}
                <div className="clickup-cell clickup-cell-check" style={{ width: 36, flexGrow: 0, flexShrink: 0 }}>
                  <div
                    className={`task-check ${task.status === 'done' ? 'done' : ''}`}
                    onClick={() => handleToggleStatus(task.id, task.status)}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </div>
                </div>

                {/* Task Name */}
                <div className="clickup-cell clickup-cell-name" style={{ width: colWidths.name, flexGrow: 0, flexShrink: 1 }}>
                  <span className={`task-text ${task.status === 'done' ? 'done' : ''}`}>
                    {task.description}
                  </span>
                </div>

                {/* Assignee */}
                <div className="clickup-cell clickup-cell-assignee" style={{ width: colWidths.assignee, flexGrow: 0, flexShrink: 1 }}>
                  {renderAssigneeWidget(task)}
                </div>

                {/* Due Date */}
                <div className="clickup-cell clickup-cell-date" style={{ width: colWidths.date, flexGrow: 0, flexShrink: 1 }}>
                  {renderDatePickerWidget(task)}
                </div>

                {/* Priority */}
                <div className="clickup-cell clickup-cell-priority" style={{ width: colWidths.priority, flexGrow: 0, flexShrink: 1 }}>
                  {renderPriorityWidget(task)}
                </div>

                {/* Lead */}
                <div className="clickup-cell clickup-cell-lead" style={{ width: colWidths.lead, flexGrow: 0, flexShrink: 1 }}>
                  {renderLeadWidget(task)}
                </div>

                {/* Actions */}
                <div className="clickup-cell clickup-cell-actions" style={{ width: 50, flexGrow: 0, flexShrink: 0 }}>
                  <button className="btn-icon-del" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="clickup-row-empty">Aucune tâche dans cette section</div>
        )}
      </div>
    );
  };

  return (
    <div className={`view-section on ${viewMode === 'board' ? 'tasks-board-fullscreen' : ''}`}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Tâches</div>
          <div className="page-sub">Gestion des tâches</div>
        </div>

        {/* Toggle view mode */}
        <div className="tab-buttons">
          <button
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-grad' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} style={{ marginRight: '4px' }} />
            Liste
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'board' ? 'btn-grad' : ''}`}
            onClick={() => setViewMode('board')}
          >
            <Kanban size={14} style={{ marginRight: '4px' }} />
            Tableau
          </button>
          <button
            className="btn btn-sm btn-grad"
            onClick={() => openTaskModal('todo')}
          >
            <Plus size={14} style={{ marginRight: '4px' }} />
            Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="tasks-filter-bar">
        <div className="tasks-filter-bar-inner">
          <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span className="tasks-filter-label">Filtres</span>

          {/* Priority filter */}
          <select
            className="tasks-filter-select"
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as any)}
          >
            <option value="">Priorité — Toutes</option>
            <option value="high">Urgent</option>
            <option value="medium">Normal</option>
            <option value="low">Basse</option>
          </select>

          {/* Lead filter */}
          <select
            className="tasks-filter-select"
            value={filterLeadId}
            onChange={e => setFilterLeadId(e.target.value)}
          >
            <option value="">Lead — Tous</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.company_name}</option>
            ))}
          </select>

          {/* Assignee filter */}
          <select
            className="tasks-filter-select"
            value={filterAssigneeId}
            onChange={e => setFilterAssigneeId(e.target.value)}
          >
            <option value="">Assigné — Tous</option>
            {teamMembers.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>

          {/* Due date sort toggle */}
          <button
            className={`tasks-filter-sort-btn ${sortByDue === 'asc' ? 'active' : ''}`}
            onClick={() => setSortByDue(v => v === 'asc' ? '' : 'asc')}
            title="Trier par échéance (plus proche en premier)"
          >
            <Calendar size={12} />
            Échéance {sortByDue === 'asc' ? '↑' : ''}
          </button>

          {/* Reset button — show only when filters active */}
          {activeFilterCount > 0 && (
            <button
              className="tasks-filter-reset"
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

        {/* Results count */}
        {activeFilterCount > 0 && (
          <span className="tasks-filter-count">
            {filteredTasks.length} / {tasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* View Panels */}
      {/* 1. LIST VIEW */}
      {viewMode === 'list' && (
        <div className="clickup-list-container">
          {/* Header Row with Resizers */}
          <div className="clickup-table-header">
            <div className="clickup-hdr-cell clickup-cell-drag" style={{ width: 32, flexGrow: 0, flexShrink: 0 }}></div>
            <div className="clickup-hdr-cell clickup-cell-check" style={{ width: 36, flexGrow: 0, flexShrink: 0 }}></div>

            <div className="clickup-hdr-cell clickup-cell-name" style={{ width: colWidths.name, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
              Tâche
              <div className="clickup-col-resizer" onMouseDown={(e) => startResize(e, 'name')} />
            </div>

            <div className="clickup-hdr-cell clickup-cell-assignee" style={{ width: colWidths.assignee, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
              Assignés
              <div className="clickup-col-resizer" onMouseDown={(e) => startResize(e, 'assignee')} />
            </div>

            <div className="clickup-hdr-cell clickup-cell-date" style={{ width: colWidths.date, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
              Échéance
              <div className="clickup-col-resizer" onMouseDown={(e) => startResize(e, 'date')} />
            </div>

            <div className="clickup-hdr-cell clickup-cell-priority" style={{ width: colWidths.priority, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
              Priorité
              <div className="clickup-col-resizer" onMouseDown={(e) => startResize(e, 'priority')} />
            </div>

            <div className="clickup-hdr-cell clickup-cell-lead" style={{ width: colWidths.lead, flexGrow: 0, flexShrink: 1, position: 'relative' }}>
              Lead associé
              <div className="clickup-col-resizer" onMouseDown={(e) => startResize(e, 'lead')} />
            </div>

            <div className="clickup-hdr-cell clickup-cell-actions" style={{ width: 50, flexGrow: 0, flexShrink: 0 }}></div>
          </div>

          {/* TO DO Section */}
          <div className="clickup-section">
            <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--red)' }}>
              <span className="sect-title" style={{ color: 'var(--red)' }}>À FAIRE</span>
              <span className="sect-count">{todoTasks.length}</span>
            </div>
            {renderTableRows(todoTasks, 'todo')}
          </div>

          {/* IN PROGRESS Section */}
          <div className="clickup-section" style={{ marginTop: '20px' }}>
            <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--gold)' }}>
              <span className="sect-title" style={{ color: 'var(--gold)' }}>EN COURS</span>
              <span className="sect-count">{inProgressTasks.length}</span>
            </div>
            {renderTableRows(inProgressTasks, 'in_progress')}
          </div>

          {/* DONE Section */}
          <div className="clickup-section" style={{ marginTop: '20px' }}>
            <div className="clickup-section-header" style={{ borderLeft: '4px solid var(--green)' }}>
              <span className="sect-title" style={{ color: 'var(--green)' }}>TERMINÉES</span>
              <span className="sect-count">{doneTasks.length}</span>
            </div>
            {renderTableRows(doneTasks, 'done')}
          </div>
        </div>
      )}

      {/* 2. KANBAN BOARD VIEW */}
      {viewMode === 'board' && (
        <div className="pipe-wrap" style={{ gap: '16px' }}>
          {/* TO DO Column */}
          <div
            className={`pipe-col ${dragOverStatus === 'todo' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleBoardDragOver(e, 'todo')}
            onDragLeave={() => handleBoardDragLeave('todo')}
            onDrop={(e) => handleBoardDrop(e, 'todo')}
          >
            <div className="pipe-head" style={{ borderBottomColor: 'var(--red)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                À faire <span>{todoTasks.length}</span>
              </span>
              <button className="pipe-head-add-btn" onClick={() => openTaskModal('todo')} title="Ajouter une tâche">
                <Plus size={13} />
              </button>
            </div>
            <div className="pipe-cards-container">
              {todoTasks.map(task => {
                const pColor = getPriorityInfo(task.priority).color;
                return (
                  <React.Fragment key={task.id}>
                    <DropIndicator beforeId={task.id} column="todo" />
                    <div draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
                      <motion.div layout layoutId={task.id} className="task-board-card">
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '12px' }}>
                          {task.description}
                        </div>

                        {/* Interactive ClickUp Parameters Row */}
                        <div className="task-board-card-clickup-row">
                          {renderAssigneeWidget(task)}
                          {renderDatePickerWidget(task)}
                          {renderPriorityWidget(task)}
                          {renderLeadWidget(task)}
                        </div>

                        <div className="task-card-actions">
                          <button className="hist-btn" onClick={() => handleUpdateTaskParam(task.id, 'status', 'in_progress')}>En cours →</button>
                          <button className="hist-btn del" onClick={() => handleDeleteTask(task.id)}>Supprimer</button>
                        </div>
                        <div className="task-card-priority-dot" style={{ background: pColor }}></div>
                      </motion.div>
                    </div>
                  </React.Fragment>
                );
              })}
              <DropIndicator beforeId={null} column="todo" />
            </div>
          </div>

          {/* IN PROGRESS Column */}
          <div
            className={`pipe-col ${dragOverStatus === 'in_progress' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleBoardDragOver(e, 'in_progress')}
            onDragLeave={() => handleBoardDragLeave('in_progress')}
            onDrop={(e) => handleBoardDrop(e, 'in_progress')}
          >
            <div className="pipe-head" style={{ borderBottomColor: 'var(--gold)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                En cours <span>{inProgressTasks.length}</span>
              </span>
              <button className="pipe-head-add-btn" onClick={() => openTaskModal('in_progress')} title="Ajouter une tâche">
                <Plus size={13} />
              </button>
            </div>
            <div className="pipe-cards-container">
              {inProgressTasks.map(task => {
                const pColor = getPriorityInfo(task.priority).color;
                return (
                  <React.Fragment key={task.id}>
                    <DropIndicator beforeId={task.id} column="in_progress" />
                    <div draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
                      <motion.div layout layoutId={task.id} className="task-board-card">
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-h)', marginBottom: '12px' }}>
                          {task.description}
                        </div>

                        {/* Interactive ClickUp Parameters Row */}
                        <div className="task-board-card-clickup-row">
                          {renderAssigneeWidget(task)}
                          {renderDatePickerWidget(task)}
                          {renderPriorityWidget(task)}
                          {renderLeadWidget(task)}
                        </div>

                        <div className="task-card-actions">
                          <button className="hist-btn" onClick={() => handleUpdateTaskParam(task.id, 'status', 'todo')}>← À faire</button>
                          <button className="hist-btn" onClick={() => handleUpdateTaskParam(task.id, 'status', 'done')}>Fini ✓</button>
                        </div>
                        <div className="task-card-priority-dot" style={{ background: pColor }}></div>
                      </motion.div>
                    </div>
                  </React.Fragment>
                );
              })}
              <DropIndicator beforeId={null} column="in_progress" />
            </div>
          </div>

          {/* DONE Column */}
          <div
            className={`pipe-col ${dragOverStatus === 'done' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleBoardDragOver(e, 'done')}
            onDragLeave={() => handleBoardDragLeave('done')}
            onDrop={(e) => handleBoardDrop(e, 'done')}
          >
            <div className="pipe-head" style={{ borderBottomColor: 'var(--green)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Terminé <span>{doneTasks.length}</span>
              </span>
              <button className="pipe-head-add-btn" onClick={() => openTaskModal('done')} title="Ajouter une tâche">
                <Plus size={13} />
              </button>
            </div>
            <div className="pipe-cards-container">
              {doneTasks.map(task => {
                const pColor = getPriorityInfo(task.priority).color;
                return (
                  <React.Fragment key={task.id}>
                    <DropIndicator beforeId={task.id} column="done" />
                    <div draggable="true" onDragStart={(e) => handleDragStart(e, task.id)}>
                      <motion.div layout layoutId={task.id} className="task-board-card" style={{ opacity: 0.7 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-h)', textDecoration: 'line-through', marginBottom: '12px' }}>
                          {task.description}
                        </div>

                        {/* Interactive ClickUp Parameters Row */}
                        <div className="task-board-card-clickup-row">
                          {renderAssigneeWidget(task)}
                          {renderDatePickerWidget(task)}
                          {renderPriorityWidget(task)}
                          {renderLeadWidget(task)}
                        </div>

                        <div className="task-card-actions">
                          <button className="hist-btn" onClick={() => handleUpdateTaskParam(task.id, 'status', 'in_progress')}>← Ouvrir</button>
                          <button className="hist-btn del" onClick={() => handleDeleteTask(task.id)}>Supprimer</button>
                        </div>
                        <div className="task-card-priority-dot" style={{ background: pColor }}></div>
                      </motion.div>
                    </div>
                  </React.Fragment>
                );
              })}
              <DropIndicator beforeId={null} column="done" />
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {taskModalOpen && (
        <div className="modal-overlay open" onClick={() => setTaskModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nouvelle tâche</h2>
              <button className="btn-icon" onClick={() => setTaskModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddTask} className="modal-form">
              <div className="gen-field-group">
                <label className="gen-label">Description *</label>
                <input
                  className="gen-input"
                  placeholder="Écrire une tâche à faire..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="gen-field-row">
                <div className="gen-field-group">
                  <label className="gen-label">Échéance</label>
                  <input
                    className="gen-input"
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                  />
                </div>
                <div className="gen-field-group">
                  <label className="gen-label">Priorité</label>
                  <select
                    className="gen-select"
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                  >
                    <option value="high">Haute</option>
                    <option value="medium">Moyenne</option>
                    <option value="low">Basse</option>
                  </select>
                </div>
              </div>

              <div className="gen-field-row">
                <div className="gen-field-group">
                  <label className="gen-label">Assignés</label>
                  <div className="clickup-inline-dropdown-wrap">
                    <button
                      type="button"
                      className="gen-select"
                      onClick={(e) => {
                        if (activeDropdown?.taskId === 'new-task') { setActiveDropdown(null); return; }
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setActiveDropdown({ taskId: 'new-task', type: 'assignee', x: r.left, y: r.bottom + 4 });
                      }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {newAssigneeIds.length === 0
                          ? 'Assigner'
                          : `${newAssigneeIds.length} assigné(s)`}
                      </span>
                      <span style={{ fontSize: '10px' }}>▼</span>
                    </button>

                    {activeDropdown?.taskId === 'new-task' && activeDropdown?.type === 'assignee' && createPortal(
                      <div
                        ref={dropdownWrapperRef}
                        className="clickup-dropdown-menu"
                        style={{ position: 'fixed', top: activeDropdown.y, left: activeDropdown.x, zIndex: 9999, transform: 'none' }}
                      >
                        <div className="clickup-dropdown-title">Assigner à...</div>
                        {teamMembers.map(m => {
                          const isSelected = newAssigneeIds.includes(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`clickup-dropdown-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setNewAssigneeIds(prev =>
                                  prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                );
                              }}
                            >
                              <div className="clickup-dropdown-checkbox">{isSelected ? '✓' : ''}</div>
                              <div className="member-avatar small-avatar" style={{ background: m.color, marginRight: '8px' }}>{m.initials}</div>
                              <span>{m.full_name}</span>
                            </div>
                          );
                        })}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
                <div className="gen-field-group">
                  <label className="gen-label">Lead lié</label>
                  <select
                    className="gen-select"
                    value={newLeadId}
                    onChange={e => setNewLeadId(e.target.value)}
                  >
                    <option value="">— Aucun</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.company_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="gen-field-group">
                <label className="gen-label">Statut</label>
                <select
                  className="gen-select"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as any)}
                >
                  <option value="todo">À faire</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminé</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost-sm" onClick={() => setTaskModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn-primary-sm">
                  <Plus size={13} />
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
