import { supabase } from './supabaseClient';

export interface AppSetting {
  id: string;
  key: string;
  value: {
    days?: number | number[];
    name?: string;
    enabled?: boolean;
    count?: number;
    mode?: string;
    date?: string;
    start?: string;
    end?: string;
  };
  label: string;
  category: string;
}

export interface ProspectionSettings {
  prospection_mode: 'manual' | 'auto';
  followup_1_days: number;
  followup_2_days: number;
  archive_after_followups: number;
  gmail_daily_cap: number | null;
  gmail_warmup_start_date: string | null;
  gmail_send_window: { days: number[]; start: string; end: string };
  gmail_from_name: string;
}

export interface SlaLimits {
  Media: number;
  Retail: number;
  Instit: number;
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
      followup_1_days: (find('followup_1_days')?.days as number) ?? 5,
      followup_2_days: (find('followup_2_days')?.days as number) ?? 10,
      archive_after_followups: (find('archive_after_followups')?.count as number) ?? 2,
      gmail_daily_cap: (find('gmail_daily_cap')?.count as number) ?? null,
      gmail_warmup_start_date: (find('gmail_warmup_start_date')?.date as string) ?? null,
      gmail_send_window: (find('gmail_send_window') as { days: number[]; start: string; end: string } | undefined)
        ?? { days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' },
      gmail_from_name: (find('gmail_from_name')?.name as string) ?? 'Seiki CRM',
    };
  },

  /** Récupère les seuils SLA par segment (délai en jours avant alerte), avec fallback par défaut. */
  async getSlaLimits(): Promise<SlaLimits> {
    const all = await this.getSettings();
    const limits: SlaLimits = { Media: 5, Retail: 7, Instit: 14 };
    all.forEach((s) => {
      if (s.key === 'sla_media' && s.value.days && typeof s.value.days === 'number') limits.Media = s.value.days;
      if (s.key === 'sla_retail' && s.value.days && typeof s.value.days === 'number') limits.Retail = s.value.days;
      if (s.key === 'sla_instit' && s.value.days && typeof s.value.days === 'number') limits.Instit = s.value.days;
    });
    return limits;
  },

  async updateProspectionSettings(updates: Partial<ProspectionSettings>): Promise<void> {
    const jobs: Promise<void>[] = [];
    if (updates.prospection_mode !== undefined) jobs.push(this.updateSetting('prospection_mode', { mode: updates.prospection_mode }));
    if (updates.followup_1_days !== undefined) jobs.push(this.updateSetting('followup_1_days', { days: updates.followup_1_days }));
    if (updates.followup_2_days !== undefined) jobs.push(this.updateSetting('followup_2_days', { days: updates.followup_2_days }));
    if (updates.archive_after_followups !== undefined) jobs.push(this.updateSetting('archive_after_followups', { count: updates.archive_after_followups }));
    if (updates.gmail_daily_cap !== undefined) jobs.push(this.updateSetting('gmail_daily_cap', { count: updates.gmail_daily_cap }));
    if (updates.gmail_warmup_start_date !== undefined) jobs.push(this.updateSetting('gmail_warmup_start_date', { date: updates.gmail_warmup_start_date }));
    if (updates.gmail_send_window !== undefined) jobs.push(this.updateSetting('gmail_send_window', updates.gmail_send_window));
    if (updates.gmail_from_name !== undefined) jobs.push(this.updateSetting('gmail_from_name', { name: updates.gmail_from_name }));
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
