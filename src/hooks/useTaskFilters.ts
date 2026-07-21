import { useState, useMemo } from 'react';
import type { Task } from '../services/tasksService';

export function useTaskFilters(tasks: Task[]) {
  const [filterPriority, setFilterPriority] = useState<'high' | 'medium' | 'low' | ''>('');
  const [filterLeadId, setFilterLeadId] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');
  const [sortByDue, setSortByDue] = useState<'asc' | ''>('');

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterLeadId && t.lead_id !== filterLeadId) return false;
      if (
        filterAssigneeId &&
        !t.assignees?.some((a) => a.id === filterAssigneeId)
      ) {
        return false;
      }
      return true;
    });

    if (sortByDue === 'asc') {
      result = [...result].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
    }

    return result;
  }, [tasks, filterPriority, filterLeadId, filterAssigneeId, sortByDue]);

  const hasActiveFilters = Boolean(filterPriority || filterLeadId || filterAssigneeId || sortByDue);

  const clearFilters = () => {
    setFilterPriority('');
    setFilterLeadId('');
    setFilterAssigneeId('');
    setSortByDue('');
  };

  return {
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
  };
}
