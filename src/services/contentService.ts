export type ContentVoice = 'seiki' | 'jaafar';
export type ContentLanguage = 'fr' | 'en';

export interface LinkedInPost {
  hook: string;
  corps: string;
  hashtags: string[];
}

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
};
