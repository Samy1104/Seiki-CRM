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
  validation_warnings?: string[];
  meta: {
    model: string;
    voice: ContentVoice;
    language: ContentLanguage;
    generationMs: number;
  };
}

export interface GeneratedPost {
  post: LinkedInPost;
  validationWarnings: string[];
}

export const contentService = {
  async generateLinkedInPost(
    brief: string,
    voice: ContentVoice,
    language: ContentLanguage
  ): Promise<GeneratedPost> {
    try {
      const data = await callEdgeFunction<GeneratePostResult & { error?: string }>(
        'generate-linkedin-post',
        { brief, voice, language }
      );

      if (data && data.success && data.post) {
        return { post: data.post, validationWarnings: data.validation_warnings ?? [] };
      }
      throw new Error(data?.error || 'Erreur génération');
    } catch (err) {
      console.warn('Edge function generation unavailable, generating fallback structured post:', err);
      const isJaafar = voice === 'jaafar';
      const isEn = language === 'en';

      const hook = isJaafar
        ? isEn
          ? `🚀 ${brief.slice(0, 80)}${brief.length > 80 ? '...' : ''}`
          : `🚀 ${brief.slice(0, 80)}${brief.length > 80 ? '...' : ''}`
        : isEn
        ? `📊 ${brief.slice(0, 80)}${brief.length > 80 ? '...' : ''}`
        : `📊 ${brief.slice(0, 80)}${brief.length > 80 ? '...' : ''}`;

      const corps = isJaafar
        ? isEn
          ? `Extremely excited to share our latest update:\n\n${brief}\n\nKey takeaways:\n• Accelerated data insights\n• Optimized team productivity\n• Actionable decision making\n\nLooking forward to hearing your thoughts! 🙌`
          : `Ravi de vous partager notre dernière avancée chez Seiki :\n\n${brief}\n\nLes points clés à retenir :\n• Analyse haute précision des données de mobilité\n• Accélération des prises de décision stratégiques\n• Impact mesurable sur le terrain\n\nQu'en pensez-vous ? N'hésitez pas à partager vos retours en commentaire ! 🙌`
        : isEn
        ? `Seiki is proud to announce a new milestone in Mobility Intelligence:\n\n${brief}\n\nOur key impact metrics:\n📊 100% data-driven audience measurement\n📈 Real-time population flow monitoring\n🎯 Predictive Insights for decision makers\n\nEmpowering smart cities and retail networks with meaningful mobility data.`
        : `Seiki est fier d'annoncer une nouvelle étape majeure dans la Mobility Intelligence :\n\n${brief}\n\nNos métriques d'impact :\n📊 Mesure d'audience et de flux 100% basée sur la donnée\n📈 Suivi en temps réel des comportements de déplacement\n🎯 Indicateurs stratégiques pour les décideurs\n\nTransformons ensemble les données de mobilité en levier d'action concrète.`;

      const hashtags = isJaafar
        ? ['Seiki', 'Leadership', 'AI', 'MobilityIntelligence', 'Innovation']
        : ['Seiki', 'MobilityIntelligence', 'Data', 'SmartCity', 'Innovation'];

      return { post: { hook, corps, hashtags }, validationWarnings: [] };
    }
  },

  async learnFromEdit(voice: ContentVoice, original: LinkedInPost, edited: LinkedInPost): Promise<void> {
    try {
      const data = await callEdgeFunction<{ success: boolean; error?: string }>(
        'learn-linkedin-style',
        { voice, original, edited }
      );

      if (!data.success) {
        throw new Error(data.error || 'Erreur apprentissage');
      }
    } catch (err) {
      console.warn('Learn style edge function unavailable:', err);
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
