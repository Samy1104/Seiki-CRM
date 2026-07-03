import { supabase } from './supabaseClient';

export interface AppSetting {
  id: string;
  key: string;
  value: {
    days?: number;
    name?: string;
    enabled?: boolean;
  };
  label: string;
  category: string;
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
