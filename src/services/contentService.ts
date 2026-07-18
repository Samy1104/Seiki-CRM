import { supabase } from './supabaseClient';
import { callEdgeFunction } from './edgeFunctions';

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
    const data = await callEdgeFunction<GeneratePostResult & { error?: string }>(
      'generate-linkedin-post',
      { brief, voice, language }
    );

    if (!data.success) {
      throw new Error(data.error || 'Erreur génération');
    }

    return data.post;
  },

  async learnFromEdit(voice: ContentVoice, original: LinkedInPost, edited: LinkedInPost): Promise<void> {
    const data = await callEdgeFunction<{ success: boolean; error?: string }>(
      'learn-linkedin-style',
      { voice, original, edited }
    );

    if (!data.success) {
      throw new Error(data.error || 'Erreur apprentissage');
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
