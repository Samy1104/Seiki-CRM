// ============================================================
// linkedinService.ts
// Accès CRUD à la file de posts LinkedIn programmés et aux
// comptes LinkedIn connectés.
// ============================================================

import { supabase } from './supabaseClient';

export type LinkedinTargetType = 'personal' | 'company';
export type ScheduledPostStatus = 'scheduled' | 'posted' | 'failed';

export interface LinkedinAccount {
  id: string;
  target_type: LinkedinTargetType;
  label: string;
  expires_at: string;
  connected_at: string;
}

export interface ScheduledPost {
  id: string;
  hook: string;
  corps: string;
  hashtags: string[];
  image_path: string | null;
  target_account_id: string;
  scheduled_at: string;
  status: ScheduledPostStatus;
  error_message: string | null;
  linkedin_post_urn: string | null;
  created_at: string;
}

export interface SchedulePostInput {
  hook: string;
  corps: string;
  hashtags: string[];
  imagePath?: string | null;
  targetAccountId: string;
  scheduledAt: string;
}

export const linkedinService = {
  async listAccounts(): Promise<LinkedinAccount[]> {
    const { data, error } = await supabase
      .from('linkedin_accounts')
      .select('id, target_type, label, expires_at, connected_at')
      .order('label', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listScheduledPosts(): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
      .from('scheduled_linkedin_posts')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async schedulePost(input: SchedulePostInput): Promise<ScheduledPost> {
    const { data, error } = await supabase
      .from('scheduled_linkedin_posts')
      .insert([{
        hook: input.hook,
        corps: input.corps,
        hashtags: input.hashtags,
        image_path: input.imagePath ?? null,
        target_account_id: input.targetAccountId,
        scheduled_at: input.scheduledAt,
        status: 'scheduled',
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateScheduledPost(id: string, input: Partial<SchedulePostInput>): Promise<void> {
    const { error } = await supabase
      .from('scheduled_linkedin_posts')
      .update({
        ...(input.hook !== undefined && { hook: input.hook }),
        ...(input.corps !== undefined && { corps: input.corps }),
        ...(input.hashtags !== undefined && { hashtags: input.hashtags }),
        ...(input.imagePath !== undefined && { image_path: input.imagePath }),
        ...(input.targetAccountId !== undefined && { target_account_id: input.targetAccountId }),
        ...(input.scheduledAt !== undefined && { scheduled_at: input.scheduledAt }),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async cancelScheduledPost(id: string): Promise<void> {
    const { error } = await supabase.from('scheduled_linkedin_posts').delete().eq('id', id);
    if (error) throw error;
  },

  async retryScheduledPost(id: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_linkedin_posts')
      .update({ status: 'scheduled', error_message: null, scheduled_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async uploadImage(file: File): Promise<string> {
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('linkedin-media').upload(path, file);
    if (error) throw error;
    return path;
  },

  oauthConnectUrl(target: LinkedinTargetType, label: string): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const params = new URLSearchParams({ target, label });
    return `${supabaseUrl}/functions/v1/linkedin-oauth-start?${params.toString()}`;
  },
};
