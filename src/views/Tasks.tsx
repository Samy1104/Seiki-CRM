import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTasksData } from '../hooks/useTasksData';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTaskColWidths } from '../hooks/useTaskColWidths';
import { tasksService } from '../services/tasksService';
import { useToast } from '../context/ToastContext';
import { confirmAction } from '../utils/confirmAction';
import { TasksHeader } from './tasks/TasksHeader';
import { TasksFilterBar } from './tasks/TasksFilterBar';
import { TaskListView, type ColWidths } from './tasks/TaskListView';
import { TaskBoardView } from './tasks/TaskBoardView';
import { NewTaskModal } from './tasks/NewTaskModal';
import type { ActiveDropdown, TaskWidgetHandlers } from './tasks/TaskWidgets';

export const Tasks: React.FC = () => {
  const { showToast } = useToast();
  const {
    tasks,
    leads,
    teamMembers,
    loading,
    reloadTasks,
    handleStatusChange,
    handleDeleteTask,
    handlePriorityChange,
    handleAssigneeToggle,
    handleLeadChange,
    handleDueDateChange,
  } = useTasksData();

  const {
    filterPriority,
    setFilterPriority,
    filterLeadId,
    setFilterLeadId,
    filterAssigneeId,
    setFilterAssigneeId,
    sortByDue,
    setSortByDue,
    filteredTasks,
    hasActiveFilters,
    clearFilters,
  } = useTaskFilters(tasks);

  const { colWidths, setColWidths } = useTaskColWidths();

  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  // New task form fields
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newLeadId, setNewLeadId] = useState('');
  const [newStatus, setNewStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Interactive inline editing dropdowns
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown | null>(null);
  const dropdownWrapperRef = useRef<HTMLDivElement | null>(null);

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

  // Split tasks by status for List and Board views
  const todoTasks = useMemo(() => filteredTasks.filter(t => t.status === 'todo'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(t => t.status === 'in_progress'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter(t => t.status === 'done'), [filteredTasks]);

  // Drag and drop handlers (pure React state management)
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDragOverTask = (e: React.DragEvent, taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
    setDragOverTaskId(taskId);
  };

  const handleDragLeaveTask = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent, status: 'todo' | 'in_progress' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    setDragOverStatus(null);
    setDragOverTaskId(null);
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== status) {
      await handleStatusChange(taskId, status);
    }
  };

  // Column Resizing Handler
  const handleStartResize = (e: React.MouseEvent, column: keyof ColWidths) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[column];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(80, startWidth + deltaX);
      setColWidths(prev => ({ ...prev, [column]: newWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) {
      showToast('La description est requise', 'error');
      return;
    }

    try {
      await tasksService.createTask({
        description: newDesc,
        due_date: newDueDate || null,
        priority: newPriority,
        lead_id: newLeadId || null,
        status: newStatus,
        assigned_to: newAssigneeIds[0] || null,
        created_by: null,
        assignee_ids: newAssigneeIds,
      });

      showToast('Tâche créée avec succès');
      setTaskModalOpen(false);
      setNewDesc('');
      setNewDueDate('');
      setNewPriority('medium');
      setNewAssigneeIds([]);
      setNewLeadId('');
      setNewStatus('todo');
      reloadTasks();
    } catch (err) {
      console.error('Error creating task:', err);
      showToast('Erreur lors de la création', 'error');
    }
  };

  const widgetHandlers: TaskWidgetHandlers = {
    teamMembers,
    leads,
    activeDropdown,
    setActiveDropdown,
    dropdownWrapperRef,
    onToggleAssignee: handleAssigneeToggle,
    onUpdateDueDate: handleDueDateChange,
    onUpdatePriority: handlePriorityChange,
    onUpdateLead: handleLeadChange,
  };

  const confirmDeleteTask = (taskId: string) => {
    if (confirmAction('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      handleDeleteTask(taskId);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
          Chargement des tâches...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" style={{ overflowY: 'auto' }}>
      {/* Page Header */}
      <TasksHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        onNewTaskClick={() => setTaskModalOpen(true)}
      />

      {/* Filter Toolbar */}
      <TasksFilterBar
        filterPriority={filterPriority}
        setFilterPriority={setFilterPriority}
        filterLeadId={filterLeadId}
        setFilterLeadId={setFilterLeadId}
        filterAssigneeId={filterAssigneeId}
        setFilterAssigneeId={setFilterAssigneeId}
        sortByDue={sortByDue}
        setSortByDue={setSortByDue}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        leads={leads}
        teamMembers={teamMembers}
      />

      {/* Main View Mode: List vs Board */}
      {viewMode === 'list' ? (
        <TaskListView
          todoTasks={todoTasks}
          inProgressTasks={inProgressTasks}
          doneTasks={doneTasks}
          colWidths={colWidths}
          onStartResize={handleStartResize}
          dragOverStatus={dragOverStatus}
          dragOverTaskId={dragOverTaskId}
          draggedTaskId={draggedTaskId}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragOverTask={handleDragOverTask}
          onDragLeaveTask={handleDragLeaveTask}
          onDrop={handleDrop}
          onToggleStatus={(taskId, currentStatus) => {
            const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
            handleStatusChange(taskId, nextStatus);
          }}
          onDeleteTask={confirmDeleteTask}
          widgets={widgetHandlers}
        />
      ) : (
        <TaskBoardView
          todoTasks={todoTasks}
          inProgressTasks={inProgressTasks}
          doneTasks={doneTasks}
          dragOverStatus={dragOverStatus}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onAddTask={(status) => {
            setNewStatus(status);
            setTaskModalOpen(true);
          }}
          onUpdateStatus={handleStatusChange}
          onDeleteTask={confirmDeleteTask}
          widgets={widgetHandlers}
        />
      )}

      {/* Create Task Modal */}
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
          onToggleAssigneeId={(memberId) => {
            setNewAssigneeIds((prev) =>
              prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
            );
          }}
          onLeadIdChange={setNewLeadId}
          onStatusChange={setNewStatus}
          onSubmit={handleCreateTask}
          onClose={() => setTaskModalOpen(false)}
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown}
          dropdownWrapperRef={dropdownWrapperRef}
        />
      )}
    </div>
  );
};
