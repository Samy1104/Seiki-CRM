import { supabase } from './supabaseClient';

export type ContentVoice = 'seiki' | 'jaafar';
export type ContentLanguage = 'fr' | 'en';

export interface LinkedInPost {
  hook: string;
  corps: string;
  hashtags: string[];
}

export interface TagEntry {
  alias: string;
  name: string;
  urn: string;
}

const TAG_BOOK_KEY = 'linkedin_tag_book';

interface GeneratePostResult {
  success: boolean;
  post: LinkedInPost;
  meta: {
    model: string;
    voice: ContentVoice;
    language: ContentLanguage;
    generationMs: number;
  };
}

export const contentService = {
  async generateLinkedInPost(
    brief: string,
    voice: ContentVoice,
    language: ContentLanguage
  ): Promise<LinkedInPost> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-linkedin-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ brief, voice, language }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur génération (${response.status})`);
    }

    return (data as GeneratePostResult).post;
  },

  async learnFromEdit(voice: ContentVoice, original: LinkedInPost, edited: LinkedInPost): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/learn-linkedin-style`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ voice, original, edited }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Erreur apprentissage (${response.status})`);
    }
  },

  async getTagBook(): Promise<TagEntry[]> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', TAG_BOOK_KEY)
      .maybeSingle();
    if (error) throw error;
    return (data?.value as { tags?: TagEntry[] } | null)?.tags ?? [];
  },

  async saveTagBook(tags: TagEntry[]): Promise<void> {
    const { error } = await supabase.from('app_settings').upsert(
      {
        key: TAG_BOOK_KEY,
        value: { tags },
        label: 'Comptes LinkedIn tagués (alias)',
        category: 'contenu',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
    if (error) throw error;
  },
};
