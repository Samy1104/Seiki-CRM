import { supabase } from './supabaseClient';
import type { TeamMember } from './settingsService';

export interface Task {
  id: string;
  description: string;
  lead_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  due_date: string | null;
  completed_at: string | null;
  position: number;
  is_auto_generated: boolean;
  sequence_step_id: string | null;
  created_at: string;
  updated_at: string;
  lead?: { company_name: string } | null;
  assignee?: TeamMember | null;
  assignees?: TeamMember[];
}

export const tasksService = {
  async getTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        lead:leads!lead_id(company_name),
        task_assignees(
          team_members(*)
        )
      `)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map(task => {
      const assignees = (task.task_assignees || []).map((ta: any) => ta.team_members).filter(Boolean);
      return {
        ...task,
        assignees,
        assignee: assignees[0] || null
      };
    });
  },

  async getTasksByLead(leadId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_assignees(
          team_members(*)
        )
      `)
      .eq('lead_id', leadId)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map(task => {
      const assignees = (task.task_assignees || []).map((ta: any) => ta.team_members).filter(Boolean);
      return {
        ...task,
        assignees,
        assignee: assignees[0] || null
      };
    });
  },

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'position' | 'is_auto_generated' | 'sequence_step_id'> & { assignee_ids?: string[] }): Promise<Task> {
    const { assignee_ids, ...taskData } = task;

    if (assignee_ids && assignee_ids.length > 0) {
      taskData.assigned_to = assignee_ids[0];
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select(`
        *,
        lead:leads!lead_id(company_name)
      `)
      .single();

    if (error) throw error;

    if (assignee_ids && assignee_ids.length > 0) {
      const inserts = assignee_ids.map(memberId => ({
        task_id: data.id,
        team_member_id: memberId
      }));
      const { error: assocError } = await supabase
        .from('task_assignees')
        .insert(inserts);
      if (assocError) throw assocError;
    }

    if (task.lead_id) {
      await supabase
        .from('history')
        .insert([{
          lead_id: task.lead_id,
          action_type: 'task_created',
          content: `Tâche créée : "${task.description}" (Échéance : ${task.due_date || 'sans'}).`,
          metadata: { task_id: data.id }
        }]);
    }

    const { data: fullTask, error: fetchError } = await supabase
      .from('tasks')
      .select(`
        *,
        lead:leads!lead_id(company_name),
        task_assignees(
          team_members(*)
        )
      `)
      .eq('id', data.id)
      .single();

    if (fetchError) throw fetchError;

    const assignees = (fullTask.task_assignees || []).map((ta: any) => ta.team_members).filter(Boolean);
    return {
      ...fullTask,
      assignees,
      assignee: assignees[0] || null
    };
  },

  async updateTask(id: string, updates: Partial<Task> & { assignee_ids?: string[] }): Promise<void> {
    const { assignee_ids, ...otherUpdates } = updates;

    if (Object.keys(otherUpdates).length > 0) {
      const isCompleted = otherUpdates.status === 'done';
      const completedAt = isCompleted ? new Date().toISOString() : (otherUpdates.status ? null : undefined);

      const dataToUpdate: any = { ...otherUpdates };
      if (completedAt !== undefined) {
        dataToUpdate.completed_at = completedAt;
      }

      const { data: originalTask, error: fetchError } = await supabase
        .from('tasks')
        .select('status, lead_id, description')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('tasks')
        .update({ ...dataToUpdate, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      if (originalTask.lead_id && originalTask.status !== 'done' && otherUpdates.status === 'done') {
        await supabase
          .from('history')
          .insert([{
            lead_id: originalTask.lead_id,
            action_type: 'note',
            content: `Tâche accomplie : "${originalTask.description}"`,
            metadata: { task_id: id }
          }]);
      }
    }

    if (assignee_ids !== undefined) {
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', id);

      if (deleteError) throw deleteError;

      if (assignee_ids.length > 0) {
        const inserts = assignee_ids.map(memberId => ({
          task_id: id,
          team_member_id: memberId
        }));
        const { error: insertError } = await supabase
          .from('task_assignees')
          .insert(inserts);

        if (insertError) throw insertError;

        await supabase
          .from('tasks')
          .update({ assigned_to: assignee_ids[0] })
          .eq('id', id);
      } else {
        await supabase
          .from('tasks')
          .update({ assigned_to: null })
          .eq('id', id);
      }
    }
  },

  async deleteTask(id: string): Promise<void> {
    const { data: originalTask, error: fetchError } = await supabase
      .from('tasks')
      .select('lead_id, description')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    if (originalTask.lead_id) {
      await supabase
        .from('history')
        .insert([{
          lead_id: originalTask.lead_id,
          action_type: 'note',
          content: `Tâche supprimée : "${originalTask.description}"`,
          metadata: { task_id: id }
        }]);
    }
  }
};
