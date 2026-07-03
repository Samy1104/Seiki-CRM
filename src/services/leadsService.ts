import { supabase } from './supabaseClient';
import type { TeamMember, PipelineStage } from './settingsService';

export interface LeadScoreDetail {
  id?: string;
  lead_id?: string;
  criterion: 'taille' | 'budget' | 'urgence' | 'decideur' | 'fit' | 'concurrence';
  value: number;
  max_value: number;
  label_selected: string;
  scored_by?: string;
}

export interface LeadHistoryItem {
  id: string;
  lead_id: string;
  user_id: string | null;
  action_type: string;
  content: string;
  metadata: Record<string, any>;
  is_auto: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    full_name: string;
    initials: string;
    color: string;
  } | null;
}

export interface Lead {
  id: string;
  owner_id: string | null;
  company_name: string;
  contact_name: string;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  domain: string | null;
  segment: 'Media' | 'Retail' | 'Instit';
  stage_id: string;
  score: number;
  deal_value: number;
  source: string;
  note: string | null;
  days_in_stage: number;
  stage_changed_at: string;
  is_archived: boolean;
  merged_into_id: string | null;
  sequence_id: string | null;
  sequence_status: 'idle' | 'active' | 'paused' | 'completed' | 'replied';
  created_at: string;
  updated_at: string;
  owner?: TeamMember | null;
  stage?: PipelineStage | null;
  scores?: LeadScoreDetail[];
  history?: LeadHistoryItem[];
}

export interface MergeProposal {
  id: string;
  source_lead_id: string;
  target_lead_id: string;
  similarity_score: number;
  match_reason: 'domain_match' | 'name_similarity' | 'email_match';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  source_lead?: { company_name: string; contact_name: string; email: string };
  target_lead?: { company_name: string; contact_name: string; email: string };
}

export const leadsService = {
  async getLeads(archived = false): Promise<Lead[]> {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        owner:team_members!owner_id(*),
        stage:pipeline_stages!stage_id(*)
      `)
      .eq('is_archived', archived)
      .is('merged_into_id', null)
      .order('score', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getLeadById(id: string): Promise<Lead> {
    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        *,
        owner:team_members!owner_id(*),
        stage:pipeline_stages!stage_id(*)
      `)
      .eq('id', id)
      .single();

    if (leadError) throw leadError;

    // Fetch scores details
    const { data: scores, error: scoresError } = await supabase
      .from('lead_scores')
      .select('*')
      .eq('lead_id', id);

    if (scoresError) throw scoresError;

    // Fetch history logs
    const { data: history, error: historyError } = await supabase
      .from('history')
      .select(`
        *,
        user:team_members!user_id(full_name, initials, color)
      `)
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (historyError) throw historyError;

    return {
      ...lead,
      scores: scores || [],
      history: history || []
    };
  },

  async createLead(
    lead: Omit<Lead, 'id' | 'score' | 'days_in_stage' | 'stage_changed_at' | 'is_archived' | 'merged_into_id' | 'sequence_id' | 'sequence_status' | 'created_at' | 'updated_at' | 'owner' | 'stage' | 'scores' | 'history'>,
    scores: Omit<LeadScoreDetail, 'id' | 'lead_id'>[]
  ): Promise<Lead> {
    // 1. Insert Lead
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert([lead])
      .select()
      .single();

    if (leadError) throw leadError;

    // 2. Insert Scores details
    if (scores.length > 0) {
      const scoresWithLeadId = scores.map(s => ({ ...s, lead_id: newLead.id }));
      const { error: scoresError } = await supabase
        .from('lead_scores')
        .insert(scoresWithLeadId);

      if (scoresError) throw scoresError;
    }

    // 3. Add History log
    const { error: histError } = await supabase
      .from('history')
      .insert([{
        lead_id: newLead.id,
        action_type: 'note',
        content: `Lead créé — Score ICP calculé.`,
        metadata: { score: newLead.score }
      }]);

    if (histError) throw histError;

    // Check for duplicate domain/email to trigger merge proposals
    if (newLead.email) {
      await this.detectDuplicates(newLead.id, newLead.email);
    }

    return newLead;
  },

  async updateLead(id: string, updates: Partial<Lead>, historyLog?: { type: string; content: string }): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    if (historyLog) {
      await supabase
        .from('history')
        .insert([{
          lead_id: id,
          action_type: historyLog.type,
          content: historyLog.content,
          metadata: { updates }
        }]);
    }
  },

  async updateLeadScores(leadId: string, scores: Omit<LeadScoreDetail, 'id' | 'lead_id'>[]): Promise<void> {
    // Delete existing scores
    const { error: deleteError } = await supabase
      .from('lead_scores')
      .delete()
      .eq('lead_id', leadId);

    if (deleteError) throw deleteError;

    // Insert new scores
    if (scores.length > 0) {
      const scoresWithLeadId = scores.map(s => ({ ...s, lead_id: leadId }));
      const { error: insertError } = await supabase
        .from('lead_scores')
        .insert(scoresWithLeadId);

      if (insertError) throw insertError;
    }

    // Trigger history note
    await supabase
      .from('history')
      .insert([{
        lead_id: leadId,
        action_type: 'score_update',
        content: `Score ICP mis à jour.`,
        metadata: { scores }
      }]);
  },

  async deleteLead(id: string): Promise<void> {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async addHistoryNote(leadId: string, content: string, userId: string | null = null): Promise<LeadHistoryItem> {
    const { data, error } = await supabase
      .from('history')
      .insert([{
        lead_id: leadId,
        user_id: userId,
        action_type: 'note',
        content,
        metadata: {}
      }])
      .select(`
        *,
        user:team_members(full_name, initials, color)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateHistoryNote(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('history')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteHistoryNote(id: string): Promise<void> {
    const { error } = await supabase
      .from('history')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async detectDuplicates(leadId: string, email: string): Promise<void> {
    const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : '';
    if (!domain || domain === 'gmail.com' || domain === 'yahoo.com' || domain === 'hotmail.com' || domain === 'outlook.com') return;

    // Search for existing leads with same domain or website
    const { data: matches, error } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, email')
      .eq('domain', domain)
      .neq('id', leadId)
      .is('merged_into_id', null);

    if (error) throw error;

    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Create a merge proposal
        await supabase
          .from('lead_merge_proposals')
          .insert([{
            source_lead_id: leadId,
            target_lead_id: match.id,
            similarity_score: 95.00,
            match_reason: 'domain_match',
            status: 'pending'
          }]);
      }
    }
  },

  async getMergeProposals(): Promise<MergeProposal[]> {
    const { data, error } = await supabase
      .from('lead_merge_proposals')
      .select(`
        *,
        source_lead:leads!source_lead_id(company_name, contact_name, email),
        target_lead:leads!target_lead_id(company_name, contact_name, email)
      `)
      .eq('status', 'pending');

    if (error) throw error;
    return (data || []) as any[];
  },

  async resolveMergeProposal(proposalId: string, status: 'approved' | 'rejected', resolverId: string | null = null): Promise<void> {
    const { data: proposal, error: getError } = await supabase
      .from('lead_merge_proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (getError) throw getError;

    const { error: updateError } = await supabase
      .from('lead_merge_proposals')
      .update({
        status,
        resolved_by: resolverId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (updateError) throw updateError;

    if (status === 'approved') {
      // Execute the Merge!
      // 1. Move source lead history to target lead
      const { error: historyError } = await supabase
        .from('history')
        .update({ lead_id: proposal.target_lead_id })
        .eq('lead_id', proposal.source_lead_id);

      if (historyError) throw historyError;

      // 2. Move source lead tasks to target lead
      const { error: tasksError } = await supabase
        .from('tasks')
        .update({ lead_id: proposal.target_lead_id })
        .eq('lead_id', proposal.source_lead_id);

      if (tasksError) throw tasksError;

      // 3. Mark source lead as merged and archive it
      const { error: leadMergeError } = await supabase
        .from('leads')
        .update({
          merged_into_id: proposal.target_lead_id,
          is_archived: true
        })
        .eq('id', proposal.source_lead_id);

      if (leadMergeError) throw leadMergeError;

      // 4. Log merge action in target lead history
      await supabase
        .from('history')
        .insert([{
          lead_id: proposal.target_lead_id,
          action_type: 'merge',
          content: `Lead fusionné avec doublon détecté. Historique et tâches importés.`,
          metadata: { merged_lead_id: proposal.source_lead_id }
        }]);
    }
  }
};
