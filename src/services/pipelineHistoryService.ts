import { supabase } from './supabaseClient';

export interface LeadStageHistoryEntry {
  id: string;
  lead_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  changed_at: string;
}

export const pipelineHistoryService = {
  async getStageHistory(limit = 5000): Promise<LeadStageHistoryEntry[]> {
    const { data, error } = await supabase
      .from('lead_stage_history')
      .select('*')
      .order('changed_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
