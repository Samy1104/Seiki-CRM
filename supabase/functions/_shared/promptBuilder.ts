import type { VoiceProfile } from './voices/types.ts';

export type Language = 'fr' | 'en';

export function buildSystemPrompt(
  profile: VoiceProfile,
  language: Language,
  learnedRulesText: string | null
): string {
  const voiceLabel = profile.id === 'seiki'
    ? `la voix de l'entreprise Seiki (${profile.tone.join(', ')})`
    : `la voix personnelle de Jaafar, co-fondateur de Seiki (${profile.tone.join(', ')})`;

  const languageInstruction = language === 'fr'
    ? 'Rédige le post en français.'
    : 'Write the post in English.';

  const examplesBlock = profile.examples
    .map((ex, i) => `--- Exemple ${i + 1} ---\n${ex.text}`)
    .join('\n\n');

  const learnedRulesBlock = learnedRulesText
    ? `\n\nRègles apprises des retours utilisateur (priment sur les contraintes ci-dessous en cas de conflit) :\n${learnedRulesText}`
    : '';

  const hardConstraints = [
    `Accroche : entre ${profile.hook.minWords} et ${profile.hook.maxWords} mots, ${profile.hook.mustBe}.`,
    `Hashtags : entre ${profile.hashtags.min} et ${profile.hashtags.max}.`,
    `Formules interdites, à ne jamais utiliser : ${profile.bannedPhrases.map((p) => `"${p}"`).join(', ')}.`,
    `Corps du texte : ${profile.bodyStyle === 'either' ? 'liste à puces pour les posts data/client, texte narratif pour les posts événementiels/personnels' : profile.bodyStyle}.`,
    "N'invente JAMAIS de noms de personnes, clients ou partenaires non mentionnés dans le brief.",
  ].join('\n');

  return `Tu es l'agent de rédaction LinkedIn de Seiki, une entreprise de Mobility Intelligence.

BIO DU COMPTE :
${profile.bio}

Tu dois écrire dans ${voiceLabel}.

EXEMPLES DE POSTS DANS CETTE VOIX :
${examplesBlock}${learnedRulesBlock}

CONTRAINTES STRICTES (à respecter impérativement) :
${hardConstraints}

${languageInstruction}`;
}

export function buildUserPrompt(brief: string, violations?: string[]): string {
  const retryBlock = violations && violations.length > 0
    ? `\n\nTa tentative précédente violait ces contraintes : ${violations.join(' ')} Corrige et régénère en respectant toutes les contraintes.`
    : '';

  return `Génère un post LinkedIn à partir du brief suivant :

${brief}${retryBlock}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{
  "hook": "Ligne d'accroche courte avec emoji(s).",
  "corps": "Corps complet du post, incluant clôture si pertinent et sauts de ligne (\\n).",
  "hashtags": ["hashtag1", "hashtag2"]
}`;
}
