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
    stage_id?: string | null;
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
  reply_ai_classification_enabled: boolean;
  reply_positive_stage_id: string | null;
  reply_negative_stage_id: string | null;
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
  is_closed_lost?: boolean;
  is_active: boolean;
}

export interface DashboardTargets {
  target_ca: number;
  target_leads_count: number;
  target_win_rate: number;
  target_prospection_positive: number;
}

export interface CodirMeeting {
  id: string;
  meeting_date: string;
  label: string | null;
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
      reply_ai_classification_enabled: (find('reply_ai_classification_enabled')?.enabled as boolean) ?? true,
      reply_positive_stage_id: (find('reply_positive_stage_id')?.stage_id as string | null | undefined) ?? null,
      reply_negative_stage_id: (find('reply_negative_stage_id')?.stage_id as string | null | undefined) ?? null,
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
    if (updates.reply_ai_classification_enabled !== undefined) jobs.push(this.updateSetting('reply_ai_classification_enabled', { enabled: updates.reply_ai_classification_enabled }));
    if (updates.reply_positive_stage_id !== undefined) jobs.push(this.updateSetting('reply_positive_stage_id', { stage_id: updates.reply_positive_stage_id }));
    if (updates.reply_negative_stage_id !== undefined) jobs.push(this.updateSetting('reply_negative_stage_id', { stage_id: updates.reply_negative_stage_id }));
    await Promise.all(jobs);
  },

  async updateSetting(key: string, value: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) throw error;
  },

  async saveSetting(key: string, value: Record<string, any>, label = key, category = 'pipeline'): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, label, category, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) {
      const { error: updateErr } = await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);

      if (updateErr) {
        const { error: insertErr } = await supabase
          .from('app_settings')
          .insert([{ key, value, label, category }]);

        if (insertErr) throw insertErr;
      }
    }
  },

  async getLostStageIds(): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pipeline_lost_stage_ids')
        .maybeSingle();

      if (data?.value && Array.isArray(data.value.stage_ids)) {
        return data.value.stage_ids as string[];
      }
    } catch {
      // Ignore setting load failure
    }
    return [];
  },

  async setLostStageId(stageId: string, isLost: boolean): Promise<void> {
    const current = await this.getLostStageIds();
    let updated: string[];
    if (isLost) {
      updated = Array.from(new Set([...current, stageId]));
    } else {
      updated = current.filter(id => id !== stageId);
    }
    await this.saveSetting('pipeline_lost_stage_ids', { stage_ids: updated }, 'Étapes de perte', 'pipeline');
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

    const lostIds = await this.getLostStageIds();
    return (data || []).map(st => {
      const name = (st.name || '').toLowerCase();
      const isLostByName = name.includes('perdu') || name.includes('lost') || name.includes('abandon');
      return {
        ...st,
        is_closed_lost: Boolean(st.is_closed_lost || lostIds.includes(st.id) || isLostByName)
      };
    });
  },

  async addPipelineStage(stage: Omit<PipelineStage, 'id'>): Promise<PipelineStage> {
    let createdStage: PipelineStage;
    const { data, error } = await supabase
      .from('pipeline_stages')
      .insert([stage])
      .select()
      .single();

    if (error) {
      if ('is_closed_lost' in stage && (error.message?.includes('is_closed_lost') || error.code === 'PGRST204')) {
        const { is_closed_lost: _, ...fallbackStage } = stage;
        const { data: fbData, error: fbError } = await supabase
          .from('pipeline_stages')
          .insert([fallbackStage])
          .select()
          .single();
        if (fbError) throw fbError;
        createdStage = { ...fbData, is_closed_lost: stage.is_closed_lost };
      } else {
        throw error;
      }
    } else {
      createdStage = data;
    }

    if (stage.is_closed_lost !== undefined) {
      await this.setLostStageId(createdStage.id, !!stage.is_closed_lost);
    }

    return createdStage;
  },

  async updatePipelineStage(id: string, updates: Partial<PipelineStage>): Promise<void> {
    if (updates.is_closed_lost !== undefined) {
      await this.setLostStageId(id, updates.is_closed_lost);
    }

    const { error } = await supabase
      .from('pipeline_stages')
      .update(updates)
      .eq('id', id);

    if (error) {
      if ('is_closed_lost' in updates && (error.message?.includes('is_closed_lost') || error.code === 'PGRST204' || String(error.message).includes('column'))) {
        const { is_closed_lost: _, ...fallbackUpdates } = updates;
        const { error: fbError } = await supabase
          .from('pipeline_stages')
          .update(fallbackUpdates)
          .eq('id', id);
        if (fbError) throw fbError;
        return;
      }
      throw error;
    }
  },

  async deletePipelineStage(id: string): Promise<void> {
    await this.setLostStageId(id, false);
    const { error } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async reorderPipelineStages(stage1Id: string, pos1: number, stage2Id: string, pos2: number): Promise<void> {
    const { error: err1 } = await supabase
      .from('pipeline_stages')
      .update({ position: pos2 })
      .eq('id', stage1Id);
    if (err1) throw err1;

    const { error: err2 } = await supabase
      .from('pipeline_stages')
      .update({ position: pos1 })
      .eq('id', stage2Id);
    if (err2) throw err2;
  },

  async getDashboardTargets(): Promise<DashboardTargets> {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'dashboard_targets')
      .maybeSingle();

    return data?.value || {
      target_ca: 100,
      target_leads_count: 20,
      target_win_rate: 20,
      target_prospection_positive: 10,
    };
  },

  async updateDashboardTargets(targets: DashboardTargets): Promise<void> {
    await supabase.from('app_settings').upsert({
      key: 'dashboard_targets',
      value: targets,
      label: 'Objectifs du Dashboard Commercial',
      category: 'general',
    });
  },

  async getCodirHistory(): Promise<CodirMeeting[]> {
    const { data, error } = await supabase
      .from('codir_meetings')
      .select('id, meeting_date, label')
      .order('meeting_date', { ascending: true });

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('codir_meetings'))) {
        const { data: legacy } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'codir_history')
          .maybeSingle();

        const dates: string[] = legacy?.value?.dates || [];
        return dates.map((d, i) => ({ id: `legacy-${i}`, meeting_date: d, label: 'Migré depuis app_settings' }));
      }
      throw error;
    }
    return data || [];
  },

  async addCodirDate(dateIso?: string, label: string | null = null): Promise<CodirMeeting[]> {
    const targetDate = dateIso || new Date().toISOString();
    const { error } = await supabase.from('codir_meetings').insert([
      { meeting_date: targetDate, label },
    ]);

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('codir_meetings'))) {
        const current = await this.getCodirHistory();
        const dateOnly = targetDate.slice(0, 10);
        const dates = [...current.map((m) => m.meeting_date), dateOnly];
        await supabase.from('app_settings').upsert({
          key: 'codir_history',
          value: { dates },
          label: 'Historique des réunions CODIR',
          category: 'general',
        });
        return this.getCodirHistory();
      }
      throw error;
    }
    return this.getCodirHistory();
  }
};
