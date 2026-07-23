export interface LearnedRuleEntry {
  rule: string;
  reason: string;
  learned_at: string;
}

export interface PostShapeForLearning {
  hook: string;
  corps: string;
  hashtags: string[];
}

export function appendLearnedRule(
  existing: LearnedRuleEntry[],
  entry: LearnedRuleEntry
): LearnedRuleEntry[] {
  return [...existing, entry];
}

export function formatLearnedRulesForPrompt(entries: LearnedRuleEntry[]): string | null {
  if (entries.length === 0) return null;
  return entries.map((e) => `- ${e.rule}`).join('\n');
}

function formatPostForLearning(post: PostShapeForLearning): string {
  return `Hook: ${post.hook}\nCorps: ${post.corps}\nHashtags: ${post.hashtags.map((h) => `#${h}`).join(' ')}`;
}

export function buildExtractionPrompt(
  voiceLabel: string,
  existing: LearnedRuleEntry[],
  original: PostShapeForLearning,
  edited: PostShapeForLearning
): string {
  const existingBlock = existing.length > 0
    ? existing.map((e) => `- ${e.rule}`).join('\n')
    : '(aucune règle apprise pour le moment)';

  return `Tu observes les corrections d'un utilisateur sur des posts LinkedIn générés pour la voix "${voiceLabel}".

RÈGLES DÉJÀ APPRISES :
${existingBlock}

VERSION ORIGINALE (générée par l'IA) :
${formatPostForLearning(original)}

VERSION ÉDITÉE (par l'utilisateur) :
${formatPostForLearning(edited)}

Compare les deux versions. Si l'édition révèle une préférence de style généralisable et NOUVELLE (pas déjà couverte par les règles ci-dessus), formule-la en UNE règle concise. Si ce n'est qu'une correction ponctuelle (faute de frappe, fait spécifique au brief) ou si la règle existe déjà, réponds avec "rule": null.

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
{
  "rule": "La nouvelle règle concise, ou null si rien de généralisable.",
  "reason": "Courte justification basée sur le diff observé, ou null."
}`;
}
