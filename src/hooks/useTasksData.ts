import { tasksService } from '../services/tasksService';
import type { Task } from '../services/tasksService';
import { leadsService } from '../services/leadsService';
import { settingsService } from '../services/settingsService';
import { useToast } from '../context/ToastContext';
import { useCachedResource } from './useCachedResource';

export function useTasksData() {
  const { showToast } = useToast();
  const onError = (err: unknown) => {
    console.error('Error loading tasks data:', err);
    showToast('Erreur lors du chargement des tâches', 'error');
  };

  const tasksRes = useCachedResource('tasks', () => tasksService.getTasks(), [], { onError });
  const leadsRes = useCachedResource('leads:false', () => leadsService.getLeads(), [], { onError });
  const teamMembersRes = useCachedResource('teamMembers', () => settingsService.getTeamMembers(), [], { onError });

  const tasks = tasksRes.data;
  const leads = leadsRes.data;
  const teamMembers = teamMembersRes.data;
  const loading = tasksRes.loading || leadsRes.loading || teamMembersRes.loading;

  const loadTasksData = () => Promise.all([
    tasksRes.reload(),
    leadsRes.reload(),
    teamMembersRes.reload(),
  ]).then(() => {});

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      await tasksService.updateTask(taskId, { status: newStatus });
      tasksRes.setData((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      showToast('Statut mis à jour');
    } catch (err) {
      console.error('Error updating task status:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksService.deleteTask(taskId);
      tasksRes.setData((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Tâche supprimée');
    } catch (err) {
      console.error('Error deleting task:', err);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const handlePriorityChange = async (taskId: string, priority: 'high' | 'medium' | 'low') => {
    try {
      await tasksService.updateTask(taskId, { priority });
      tasksRes.setData((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, priority } : t))
      );
      showToast('Priorité mise à jour');
    } catch (err) {
      console.error('Error updating priority:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const handleAssigneeToggle = async (task: Task, memberId: string) => {
    const currentIds = task.assignees?.map((a) => a.id) || [];
    const newIds = currentIds.includes(memberId)
      ? currentIds.filter((id) => id !== memberId)
      : [...currentIds, memberId];

    try {
      await tasksService.updateTask(task.id, { assignee_ids: newIds });
      loadTasksData();
      showToast('Assignation mise à jour');
    } catch (err) {
      console.error('Error updating assignees:', err);
      showToast('Erreur de mise à jour', 'error');
    }
  };

  const handleLeadChange = async (taskId: string, leadId: string | null) => {
    try {
      await tasksService.updateTask(taskId, { lead_id: leadId });
      loadTasksData();
      showToast('Lead associé mis à jour');
    } catch (err) {
      console.error('Error updating lead:', err);
      showToast('Erreur de mise à jour', 'error');
    }
  };

  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    try {
      await tasksService.updateTask(taskId, { due_date: dueDate });
      loadTasksData();
      showToast('Date d\'échéance mise à jour');
    } catch (err) {
      console.error('Error updating due date:', err);
      showToast('Erreur de mise à jour', 'error');
    }
  };

  const handleDescriptionChange = async (taskId: string, description: string) => {
    const trimmed = description.trim();
    if (!trimmed) return;

    // Immediate optimistic state update
    tasksRes.setData((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, description: trimmed } : t))
    );

    try {
      await tasksService.updateTask(taskId, { description: trimmed });
      showToast('Nom de la tâche mis à jour');
    } catch (err) {
      console.error('Error updating task description:', err);
      showToast('Erreur lors de la mise à jour', 'error');
      loadTasksData();
    }
  };

  return {
    tasks,
    leads,
    teamMembers,
    loading,
    reloadTasks: loadTasksData,
    handleStatusChange,
    handleDeleteTask,
    handlePriorityChange,
    handleAssigneeToggle,
    handleLeadChange,
    handleDueDateChange,
    handleDescriptionChange,
  };
}
