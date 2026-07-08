import { supabase } from './supabaseClient';

export interface AppSetting {
  id: string;
  key: string;
  value: {
    days?: number;
    name?: string;
    enabled?: boolean;
    count?: number;
    mode?: string;
  };
  label: string;
  category: string;
}

export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  daily_send_quota: number;
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  initials: string;
  color: string;
  role_label: string;
  is_active: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string;
  is_closed_won: boolean;
  is_active: boolean;
}

export const settingsService = {
  async getSettings(): Promise<AppSetting[]> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .order('key');
    if (error) throw error;
    return data || [];
  },

  async getProspectionSettings(): Promise<ProspectionSettings> {
    const all = await this.getSettings();
    const find = (key: string) => all.find((s) => s.key === key)?.value as Record<string, unknown> | undefined;
    return {
      prospection_mode: (find('prospection_mode')?.mode as 'manual' | 'auto') ?? 'manual',
      daily_send_quota: (find('daily_send_quota')?.count as number) ?? 100,
      followup_1_days: (find('followup_1_days')?.days as number) ?? 5,
      followup_2_days: (find('followup_2_days')?.days as number) ?? 10,
      archive_after_followups: (find('archive_after_followups')?.count as number) ?? 2,
    };
  },

  async updateProspectionSettings(updates: Partial<ProspectionSettings>): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (updates.prospection_mode !== undefined) jobs.push(this.updateSetting('prospection_mode', { mode: updates.prospection_mode }));
    if (updates.daily_send_quota !== undefined) jobs.push(this.updateSetting('daily_send_quota', { count: updates.daily_send_quota }));
    if (updates.followup_1_days !== undefined) jobs.push(this.updateSetting('followup_1_days', { days: updates.followup_1_days }));
    if (updates.followup_2_days !== undefined) jobs.push(this.updateSetting('followup_2_days', { days: updates.followup_2_days }));
    if (updates.archive_after_followups !== undefined) jobs.push(this.updateSetting('archive_after_followups', { count: updates.archive_after_followups }));
    await Promise.all(jobs);
  },

  async updateSetting(key: string, value: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) throw error;
  },

  async getTeamMembers(): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('full_name');
    if (error) throw error;
    return data || [];
  },

  async addTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert([member])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteTeamMember(id: string): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async getPipelineStages(): Promise<PipelineStage[]> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .order('position');
    if (error) throw error;
    return data || [];
  },

  async addPipelineStage(stage: Omit<PipelineStage, 'id'>): Promise<PipelineStage> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert([stage])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePipelineStage(id: string, updates: Partial<PipelineStage>): Promise<void> {
    const { error } = await supabase
      .from('pipeline_stages')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deletePipelineStage(id: string): Promise<void> {
    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
