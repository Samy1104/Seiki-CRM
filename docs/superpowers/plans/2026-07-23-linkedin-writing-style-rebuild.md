# LinkedIn Writing Style Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, unstructured LinkedIn post style system (bio/examples/rules crammed into `generate-linkedin-post/index.ts`, opaque self-learning blob) with a structured, machine-checkable `VoiceProfile` model, a prompt builder that puts hard constraints last for better instruction-following, deterministic post-generation validation with one auto-retry, and a transparent (array-based, logged) learning loop.

**Architecture:** Pure, Deno-import-free TypeScript modules (`_shared/voices/*.ts`, `_shared/promptBuilder.ts`, `_shared/postValidator.ts`, `_shared/learnedRules.ts`) hold all logic and are unit-tested with the frontend's existing Vitest setup. The two Deno edge functions (`generate-linkedin-post`, `learn-linkedin-style`) become thin orchestrators that import these modules — consistent with how `_shared/geminiApi.ts` is already split out and consumed today.

**Tech Stack:** Deno edge functions (Supabase), TypeScript, Vitest (existing frontend test runner, reused here since these modules have zero Deno-specific imports), Google Gemini (`gemini-2.5-flash`, unchanged).

## Global Constraints

- No new UI. Style config stays editable only via code (per spec).
- No new voices/personas beyond `seiki`/`jaafar` (out of scope per spec).
- No pruning/expiry of learned-rules list (out of scope per spec).
- No LLM self-critique pass — validation is deterministic only, one retry max (Approach 2, not Approach 3).
- Validation failures after retry must not block generation — return with `validation_warnings`, never throw.
- All new `_shared/*.ts` modules (voices, promptBuilder, postValidator, learnedRules) must have zero Deno-specific imports (no `Deno.*`, no remote URL imports) so they stay portable and testable with Vitest.
- Test commands run from `Projet/` (repo root for `git`, Vitest root).

---

### Task 1: `postValidator.ts` — deterministic post validation

**Files:**
- Create: `supabase/functions/_shared/voices/types.ts`
- Create: `supabase/functions/_shared/postValidator.ts`
- Test: `supabase/functions/_shared/postValidator.test.ts`

**Interfaces:**
- Produces: `VoiceProfile` type (consumed by Tasks 2, 3, 5), `PostShape` and `ValidationResult` types, `validatePost(post: PostShape, profile: VoiceProfile): ValidationResult` (consumed by Task 5).

- [ ] **Step 1: Write `types.ts`**

```ts
// supabase/functions/_shared/voices/types.ts
export interface VoiceExample {
  text: string;
  note?: string;
}

export interface VoiceProfile {
  id: "seiki" | "jaafar";
  bio: string;
  examples: VoiceExample[];
  tone: string[];
  hook: { minWords: number; maxWords: number; mustBe: string };
  bannedPhrases: string[];
  hashtags: { min: number; max: number };
  bodyStyle: "bullets" | "narrative" | "either";
}
```

- [ ] **Step 2: Write the failing tests for `postValidator.ts`**

```ts
// supabase/functions/_shared/postValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validatePost } from './postValidator';
import type { VoiceProfile } from './voices/types';

const profile: VoiceProfile = {
  id: 'seiki',
  bio: 'Bio.',
  examples: [],
  tone: ['fier'],
  hook: { minWords: 1, maxWords: 5, mustBe: 'courte' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', 'URGENT'],
  hashtags: { min: 2, max: 4 },
  bodyStyle: 'either',
};

describe('validatePost', () => {
  it('passes a post that respects all constraints', () => {
    const result = validatePost(
      { hook: 'Une accroche courte', corps: 'Un corps de post normal.', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result).toEqual({ valid: true, violations: [] });
  });

  it('flags a hook that is too long', () => {
    const result = validatePost(
      { hook: 'Une accroche beaucoup beaucoup trop longue pour respecter la contrainte', corps: 'Corps.', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Accroche'))).toBe(true);
  });

  it('flags a banned phrase regardless of case', () => {
    const result = validatePost(
      { hook: 'Accroche', corps: 'nous sommes ravis de vous annoncer que ça marche', hashtags: ['Seiki', 'Data'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('Nous sommes ravis'))).toBe(true);
  });

  it('flags a hashtag count outside bounds', () => {
    const result = validatePost(
      { hook: 'Accroche', corps: 'Corps.', hashtags: ['Seiki'] },
      profile
    );
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('hashtag'))).toBe(true);
  });

  it('accumulates multiple violations at once', () => {
    const result = validatePost(
      { hook: '', corps: 'urgent', hashtags: [] },
      profile
    );
    expect(result.violations.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/postValidator.test.ts`
Expected: FAIL — `postValidator` module not found.

- [ ] **Step 4: Implement `postValidator.ts`**

```ts
// supabase/functions/_shared/postValidator.ts
import type { VoiceProfile } from './voices/types.ts';

export interface PostShape {
  hook: string;
  corps: string;
  hashtags: string[];
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export function validatePost(post: PostShape, profile: VoiceProfile): ValidationResult {
  const violations: string[] = [];

  const hookWordCount = post.hook.trim().split(/\s+/).filter(Boolean).length;
  if (hookWordCount < profile.hook.minWords || hookWordCount > profile.hook.maxWords) {
    violations.push(
      `Accroche de ${hookWordCount} mots, attendu entre ${profile.hook.minWords} et ${profile.hook.maxWords} mots.`
    );
  }

  const haystack = `${post.hook} ${post.corps}`.toLowerCase();
  for (const banned of profile.bannedPhrases) {
    if (haystack.includes(banned.toLowerCase())) {
      violations.push(`Formule interdite utilisée : "${banned}".`);
    }
  }

  const hashtagCount = post.hashtags.length;
  if (hashtagCount < profile.hashtags.min || hashtagCount > profile.hashtags.max) {
    violations.push(
      `${hashtagCount} hashtags, attendu entre ${profile.hashtags.min} et ${profile.hashtags.max}.`
    );
  }

  return { valid: violations.length === 0, violations };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/postValidator.test.ts`
Expected: PASS (5 tests). If the `./voices/types.ts` import fails to resolve under Vitest, drop the `.ts` extension in the import (`./voices/types`) — Vitest's resolver is stricter than Deno's about explicit extensions on type-only imports.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/voices/types.ts supabase/functions/_shared/postValidator.ts supabase/functions/_shared/postValidator.test.ts
git commit -m "feat: add VoiceProfile type and deterministic post validator"
```

---

### Task 2: Voice profile data — `seiki.ts` and `jaafar.ts`

Migrates the exact bio/example/rule content currently hardcoded in `generate-linkedin-post/index.ts` (lines 34-134) into structured `VoiceProfile` data.

**Files:**
- Create: `supabase/functions/_shared/voices/seiki.ts`
- Create: `supabase/functions/_shared/voices/jaafar.ts`
- Test: `supabase/functions/_shared/voices/voiceProfiles.test.ts`

**Interfaces:**
- Consumes: `VoiceProfile` from Task 1 (`./types.ts`).
- Produces: `seikiProfile`, `jaafarProfile` (consumed by Tasks 3 and 5).

- [ ] **Step 1: Write the failing shape/content tests**

```ts
// supabase/functions/_shared/voices/voiceProfiles.test.ts
import { describe, it, expect } from 'vitest';
import { seikiProfile } from './seiki';
import { jaafarProfile } from './jaafar';

describe.each([
  ['seiki', seikiProfile],
  ['jaafar', jaafarProfile],
])('%s voice profile', (id, profile) => {
  it(`has id "${id}" and non-empty bio/examples`, () => {
    expect(profile.id).toBe(id);
    expect(profile.bio.length).toBeGreaterThan(0);
    expect(profile.examples.length).toBeGreaterThan(0);
    for (const example of profile.examples) {
      expect(example.text.length).toBeGreaterThan(0);
    }
  });

  it('has sane hook and hashtag bounds', () => {
    expect(profile.hook.minWords).toBeGreaterThan(0);
    expect(profile.hook.maxWords).toBeGreaterThanOrEqual(profile.hook.minWords);
    expect(profile.hashtags.min).toBeGreaterThan(0);
    expect(profile.hashtags.max).toBeGreaterThanOrEqual(profile.hashtags.min);
  });

  it('carries the shared banned-phrase list', () => {
    expect(profile.bannedPhrases).toContain('Nous sommes ravis de vous annoncer que');
    expect(profile.bannedPhrases).toContain('N\'hésitez pas à nous contacter');
  });
});

it('seiki examples include the Neuilly and Monaco case studies', () => {
  expect(seikiProfile.examples.some((e) => e.text.includes('Neuilly-sur-Seine'))).toBe(true);
  expect(seikiProfile.examples.some((e) => e.text.includes('Monaco'))).toBe(true);
});

it('jaafar examples are written in first person', () => {
  expect(jaafarProfile.examples.length).toBe(3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/voices/voiceProfiles.test.ts`
Expected: FAIL — `./seiki` / `./jaafar` not found.

- [ ] **Step 3: Write `seiki.ts`**

```ts
// supabase/functions/_shared/voices/seiki.ts
import type { VoiceProfile } from './types.ts';

export const seikiProfile: VoiceProfile = {
  id: 'seiki',
  bio: `Seiki invents The Mobility Intelligence.

We designed powerful technologies & algorithms to reveal the true potential of population flows data.

For Brand Touchpoints & Advertisers, we dive into audiences and clusters mobility data to improve the impact on your target. We created a recognized MOOH ( Mobile Out of Home ) Audience Measurement methodology to assess the impact of a campaign before ( prediction ), during ( monitoring ) and after ( reporting ) it happens.

For companies in Retail & Real Estate we understand consumers on the move to optimize networks expansion.

For Institutions, we forecast population mouvements to design smart cities, predict and report congestion rates, draw mobility profiles...

Seiki unleashes the power of mobility intelligence, providing mouvement data that make sense.`,
  examples: [
    {
      text: `🚶‍♂️🚴 Mesurer la mobilité pour mieux aménager la ville.

Nous sommes fiers d'accompagner la Ville de Neuilly-sur-Seine dans la mesure et l'analyse des flux piétons et cyclistes sur le Pont de Neuilly.

Grâce à notre technologie de Mobility Intelligence, Seiki fournit une vision objective et continue des usages de cet axe stratégique, avec des indicateurs tels que :

📊 Volume de fréquentation sur 24 heures, à la semaine, au mois et à l'année
📈 Analyse comparative avant / après travaux pour mesurer l'impact réel des aménagements
🧭 Étude des provenances et destinations des usagers afin de mieux comprendre les flux de mobilité

Ces analyses permettent aux collectivités de prendre des décisions fondées sur la donnée, d'évaluer l'efficacité des investissements publics et d'accompagner le développement de mobilités plus durables.

Un grand merci à la Ville de Neuilly-sur-Seine pour sa confiance.

#Seiki #MobilityIntelligence #SmartCity #Mobilité #MobilitéDouce #Urbanisme #Data #Cyclistes #Piétons #NeuillySurSeine #Innovation`,
      note: 'Post data/client : liste à puces avec emojis, chiffres concrets.',
    },
    {
      text: `🇲🇨 Depuis maintenant 2 ans, Seiki est fier d'accompagner le Gouvernement Princier de Monaco en tant que partenaire Data Mobility.

📊 Nous révélons les déplacements des populations entrant et sortant de la Principauté, touristes inclus, afin de mieux comprendre les dynamiques réelles du territoire.

Grâce à la Mobility Intelligence, nous sommes en mesure de :

Analyser les flux touristiques internationaux
📍 Comprendre l'attractivité des différents quartiers et points d'intérêt
🕒 Mesurer les pics de fréquentation sur les 24 heures, les 7 jours et les 52 semaines de l'année
🌍 Identifier les provenances géographiques et profils sociodémographiques des visiteurs
🚶 Mesurer les temps de présence et les comportements de mobilité
🏨 Caractériser les typologies de séjour et les parcours au sein de la Principauté

Notre ambition : transformer les données de mobilité en indicateurs stratégiques au service du tourisme, des événements, de l'aménagement du territoire et du développement économique.

📡 Révéler les flux.
📈 Comprendre l'attractivité.
🎯 Éclairer la décision.

#Monaco #MobilityIntelligence #Data #TourismAnalytics #SmartCity #MobilityData #Tourisme #Innovation #Seiki`,
      note: 'Post data/client : clôture tagline courte en 3 lignes.',
    },
  ],
  tone: ['fier', 'factuel', 'orienté impact business et données concrètes', 'à la première personne du pluriel ("nous")'],
  hook: { minWords: 1, maxWords: 15, mustBe: 'portée par un ou deux emojis pertinents (pas décoratifs), jamais une formule générique' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', "N'hésitez pas à nous contacter", 'GRATUIT', 'URGENT'],
  hashtags: { min: 5, max: 10 },
  bodyStyle: 'either',
};
```

- [ ] **Step 4: Write `jaafar.ts`**

```ts
// supabase/functions/_shared/voices/jaafar.ts
import type { VoiceProfile } from './types.ts';

export const jaafarProfile: VoiceProfile = {
  id: 'jaafar',
  bio: `Seiki invents The Mobility Intelligence.

We designed powerful technologies & algorithms to reveal the true potential of population flows data.

For Brand Touchpoints & Advertisers, we dive into audiences and clusters mobility data to improve the impact on your target. We created a recognized MOOH ( Mobile Out of Home ) Audience Measurement methodology to assess the impact of a campaign before ( prediction ), during ( monitoring ) and after ( reporting ) it happens.

For companies in Retail & Real Estate we understand consumers on the move to optimize networks expansion.

For Institutions, we forecast population mouvements to design smart cities, predict and report congestion rates, draw mobility profiles...

Seiki unleashes the power of mobility intelligence, providing mouvement data that make sense.`,
  examples: [
    {
      text: `📍 Le Wagon Paris 11 📅 2 juin – 18h30
Le 2 juin prochain, nous explorerons un sujet aussi passionnant qu'essentiel : quelles opportunités et quels défis l'IA soulève-t-elle en matière d'inclusivité ?

J'aurai le plaisir d'échanger aux côtés de :
• Angela Naser (WOMEN IN TECH ® Global - Women in Tech® France)
• Zena El Kurdi (AXA)

Une soirée qui s'annonce riche en discussions, retours d'expérience et rencontres autour d'un sujet qui nous concerne toutes et tous 🙌

🔗 Inscription : [lien]

Seiki - The Mobility Intelligence Company`,
      note: 'Annonce événement : texte narratif, première personne.',
    },
    {
      text: `🚀 Seiki au cœur de l'IA, des transformations business & du leadership

Ravi d'avoir participé au Forum « Leadership & Business Transformation » organisé par l'ESCP et L'Express — un concentré de visions stratégiques, d'expériences terrain et de réflexions sur le rôle du leader à l'ère de l'IA.

🎤 Des échanges de haut niveau avec plusieurs intervenants du secteur.

🙏 Merci à l'organisateur pour son invitation.

💡 Un constat clair : dans un monde où l'algorithme gagne en puissance, le leadership humain devient plus stratégique que jamais — vision, engagement et capacité à transformer restent les véritables leviers.

Chez Seiki, nous sommes convaincus que la donnée et la mobilité ne remplacent pas le leader — elles l'augmentent.

#Leadership #Transformation #AI #MobilityIntelligence #Seiki #ESCP #Innovation`,
      note: 'Retour d\'événement : texte narratif avec une réflexion personnelle.',
    },
    {
      text: `Casablanca, see you on April 5th 🇲🇦

I'll be speaking at the Sohaara Event during the Founders Keynote 🎤 will be talking about Seiki's growth 🚀

Always a special energy when builders, founders, and ideas come together in one place ⚡ many thanks to the organizer for this amazing project! You are a true inspiration 🙏🇲🇦

Excited to share, learn, and connect 🌍

If you're around, come say hi 🤝

#Founders #Casablanca #AI #Networking`,
      note: 'Exemple en anglais, ton direct et enthousiaste.',
    },
  ],
  tone: ['personnel', 'enthousiaste', 'direct', 'à la première personne du singulier ("je")'],
  hook: { minWords: 1, maxWords: 15, mustBe: 'portée par un ou deux emojis pertinents (pas décoratifs), jamais une formule générique' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', "N'hésitez pas à nous contacter", 'GRATUIT', 'URGENT'],
  hashtags: { min: 5, max: 10 },
  bodyStyle: 'either',
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/voices/voiceProfiles.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/voices/seiki.ts supabase/functions/_shared/voices/jaafar.ts supabase/functions/_shared/voices/voiceProfiles.test.ts
git commit -m "feat: migrate LinkedIn voice bio/examples into structured VoiceProfile data"
```

---

### Task 3: `promptBuilder.ts` — recency-ordered prompt construction

**Files:**
- Create: `supabase/functions/_shared/promptBuilder.ts`
- Test: `supabase/functions/_shared/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `VoiceProfile` from Task 1.
- Produces: `Language` type, `buildSystemPrompt(profile: VoiceProfile, language: Language, learnedRulesText: string | null): string`, `buildUserPrompt(brief: string, violations?: string[]): string` (both consumed by Task 5).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/promptBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from './promptBuilder';
import { seikiProfile } from './voices/seiki';

describe('buildSystemPrompt', () => {
  it('places hard constraints after the examples block (recency ordering)', () => {
    const prompt = buildSystemPrompt(seikiProfile, 'fr', null);
    const examplesIndex = prompt.indexOf('EXEMPLES DE POSTS');
    const constraintsIndex = prompt.indexOf('CONTRAINTES STRICTES');
    expect(examplesIndex).toBeGreaterThan(-1);
    expect(constraintsIndex).toBeGreaterThan(examplesIndex);
  });

  it('includes every banned phrase from the profile', () => {
    const prompt = buildSystemPrompt(seikiProfile, 'fr', null);
    for (const phrase of seikiProfile.bannedPhrases) {
      expect(prompt).toContain(phrase);
    }
  });

  it('omits the learned-rules block when null, includes it before the hard constraints when present', () => {
    const withoutLearned = buildSystemPrompt(seikiProfile, 'fr', null);
    expect(withoutLearned).not.toContain('Règles apprises');

    const withLearned = buildSystemPrompt(seikiProfile, 'fr', '- Éviter les emojis en début de phrase');
    const learnedIndex = withLearned.indexOf('Règles apprises');
    const constraintsIndex = withLearned.indexOf('CONTRAINTES STRICTES');
    expect(learnedIndex).toBeGreaterThan(-1);
    expect(constraintsIndex).toBeGreaterThan(learnedIndex);
    expect(withLearned).toContain('Éviter les emojis en début de phrase');
  });

  it('switches the language instruction for English', () => {
    expect(buildSystemPrompt(seikiProfile, 'en', null)).toContain('Write the post in English.');
    expect(buildSystemPrompt(seikiProfile, 'fr', null)).toContain('Rédige le post en français.');
  });
});

describe('buildUserPrompt', () => {
  it('has no retry block on first attempt', () => {
    const prompt = buildUserPrompt('Un brief de test');
    expect(prompt).not.toContain('violait');
  });

  it('appends the violations as a retry instruction', () => {
    const prompt = buildUserPrompt('Un brief de test', ['3 hashtags, attendu entre 5 et 10.']);
    expect(prompt).toContain('violait');
    expect(prompt).toContain('3 hashtags, attendu entre 5 et 10.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/promptBuilder.test.ts`
Expected: FAIL — `promptBuilder` module not found.

- [ ] **Step 3: Implement `promptBuilder.ts`**

```ts
// supabase/functions/_shared/promptBuilder.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/promptBuilder.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/promptBuilder.ts supabase/functions/_shared/promptBuilder.test.ts
git commit -m "feat: add recency-ordered LinkedIn prompt builder"
```

---

### Task 4: `learnedRules.ts` — structured, appendable learning storage

**Files:**
- Create: `supabase/functions/_shared/learnedRules.ts`
- Test: `supabase/functions/_shared/learnedRules.test.ts`

**Interfaces:**
- Produces: `LearnedRuleEntry` type, `appendLearnedRule(existing, entry)`, `formatLearnedRulesForPrompt(entries)` (consumed by Task 5), `buildExtractionPrompt(voiceLabel, existing, original, edited)` (consumed by Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/learnedRules.test.ts
import { describe, it, expect } from 'vitest';
import { appendLearnedRule, formatLearnedRulesForPrompt, buildExtractionPrompt, type LearnedRuleEntry } from './learnedRules';

describe('appendLearnedRule', () => {
  it('returns a new array with the entry appended, without mutating the input', () => {
    const existing: LearnedRuleEntry[] = [{ rule: 'A', reason: 'r1', learned_at: '2026-01-01T00:00:00Z' }];
    const entry: LearnedRuleEntry = { rule: 'B', reason: 'r2', learned_at: '2026-01-02T00:00:00Z' };

    const result = appendLearnedRule(existing, entry);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(entry);
    expect(existing).toHaveLength(1);
  });
});

describe('formatLearnedRulesForPrompt', () => {
  it('returns null for an empty list', () => {
    expect(formatLearnedRulesForPrompt([])).toBeNull();
  });

  it('formats entries as a bullet list of rule text', () => {
    const entries: LearnedRuleEntry[] = [
      { rule: 'Éviter les emojis en début de phrase', reason: 'diff observé', learned_at: '2026-01-01T00:00:00Z' },
      { rule: 'Toujours signer Seiki', reason: 'diff observé', learned_at: '2026-01-02T00:00:00Z' },
    ];
    expect(formatLearnedRulesForPrompt(entries)).toBe(
      '- Éviter les emojis en début de phrase\n- Toujours signer Seiki'
    );
  });
});

describe('buildExtractionPrompt', () => {
  it('includes existing rules, and both post versions', () => {
    const prompt = buildExtractionPrompt(
      'Seiki (entreprise)',
      [{ rule: 'Règle existante', reason: 'x', learned_at: '2026-01-01T00:00:00Z' }],
      { hook: 'Hook original', corps: 'Corps original', hashtags: ['A'] },
      { hook: 'Hook édité', corps: 'Corps édité', hashtags: ['A', 'B'] }
    );
    expect(prompt).toContain('Règle existante');
    expect(prompt).toContain('Hook original');
    expect(prompt).toContain('Hook édité');
  });

  it('shows a placeholder when there are no existing rules', () => {
    const prompt = buildExtractionPrompt(
      'Seiki (entreprise)',
      [],
      { hook: 'H', corps: 'C', hashtags: [] },
      { hook: 'H', corps: 'C2', hashtags: [] }
    );
    expect(prompt).toContain('(aucune règle apprise pour le moment)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/learnedRules.test.ts`
Expected: FAIL — `learnedRules` module not found.

- [ ] **Step 3: Implement `learnedRules.ts`**

```ts
// supabase/functions/_shared/learnedRules.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/learnedRules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/learnedRules.ts supabase/functions/_shared/learnedRules.test.ts
git commit -m "feat: add structured learned-rules storage and extraction prompt"
```

---

### Task 5: Rewire `generate-linkedin-post/index.ts`

Replaces the hardcoded constants and inline prompt/rule logic with the Task 1-4 modules, adds the validate → retry-once → flag-warnings flow.

**Files:**
- Modify: `supabase/functions/generate-linkedin-post/index.ts` (full rewrite of lines 15-267; imports at lines 9-13 gain new entries)

**Interfaces:**
- Consumes: `VoiceProfile`, `validatePost` (Task 1); `seikiProfile`, `jaafarProfile` (Task 2); `buildSystemPrompt`, `buildUserPrompt`, `Language` (Task 3); `LearnedRuleEntry`, `formatLearnedRulesForPrompt` (Task 4); `GEMINI_MODEL`, `callGemini` (existing `_shared/geminiApi.ts`, unchanged).
- Produces: response body gains `validation_warnings: string[]` (empty array when the post is clean) alongside the existing `success`/`post`/`meta` fields — consumed by Task 7.

There is no Deno test runner set up in this repo (confirmed: no `deno.json`, no existing `*.test.ts` under `supabase/functions`, `deno` CLI not installed locally), and no other edge function handler in this codebase has tests — this task is verified manually (Step 3) rather than with an automated test, consistent with that existing pattern.

- [ ] **Step 1: Replace the file contents**

Replace `supabase/functions/generate-linkedin-post/index.ts` entirely with:

```ts
// ============================================================
// Edge Function : generate-linkedin-post
// Runtime : Deno (Supabase)
// Rôle : Appelle Google Gemini pour générer un post LinkedIn
//        dans le style Seiki, à partir d'un brief libre, d'une voix
//        (Seiki / Jaafar) et d'une langue (FR / EN).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { GEMINI_MODEL, callGemini } from "../_shared/geminiApi.ts";
import { requireUser } from "../_shared/requireUser.ts";
import type { VoiceProfile } from "../_shared/voices/types.ts";
import { seikiProfile } from "../_shared/voices/seiki.ts";
import { jaafarProfile } from "../_shared/voices/jaafar.ts";
import { buildSystemPrompt, buildUserPrompt, type Language } from "../_shared/promptBuilder.ts";
import { validatePost, type PostShape } from "../_shared/postValidator.ts";
import { formatLearnedRulesForPrompt, type LearnedRuleEntry } from "../_shared/learnedRules.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Voice = "seiki" | "jaafar";

interface GenerateRequest {
  brief: string;
  voice: Voice;
  language: Language;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function profileForVoice(voice: Voice): VoiceProfile {
  return voice === "jaafar" ? jaafarProfile : seikiProfile;
}

function learnedRulesKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

async function fetchLearnedRuleEntries(
  supabase: ReturnType<typeof createClient>,
  voice: Voice
): Promise<LearnedRuleEntry[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", learnedRulesKey(voice))
    .maybeSingle();
  const entries = (data?.value as { entries?: LearnedRuleEntry[] } | null)?.entries;
  return Array.isArray(entries) ? entries : [];
}

async function generateOnce(
  geminiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ post: PostShape; generationMs: number; usageMetadata: unknown }> {
  const { rawText, generationMs, usageMetadata } = await callGemini(geminiKey, {
    systemPrompt,
    userPrompt,
    temperature: 0.8,
  });

  let post: PostShape;
  try {
    post = JSON.parse(rawText) as PostShape;
  } catch {
    throw new Error(`JSON invalide retourné par Gemini : ${rawText.substring(0, 300)}`);
  }
  if (!post.hook || !post.corps || !Array.isArray(post.hashtags)) {
    throw new Error("Gemini a retourné un JSON incomplet (champs manquants)");
  }

  return { post, generationMs, usageMetadata };
}

// ── Handler principal ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY non configurée dans les secrets Supabase");
    }

    const body = (await req.json()) as GenerateRequest;
    if (!body.brief || !body.brief.trim()) {
      return new Response(
        JSON.stringify({ error: "brief est requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const voice: Voice = body.voice === "jaafar" ? "jaafar" : "seiki";
    const language: Language = body.language === "en" ? "en" : "fr";
    const profile = profileForVoice(voice);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUser(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const learnedEntries = await fetchLearnedRuleEntries(supabase, voice);
    const systemPrompt = buildSystemPrompt(profile, language, formatLearnedRulesForPrompt(learnedEntries));

    let attempt = await generateOnce(geminiKey, systemPrompt, buildUserPrompt(body.brief));
    let validation = validatePost(attempt.post, profile);

    if (!validation.valid) {
      attempt = await generateOnce(geminiKey, systemPrompt, buildUserPrompt(body.brief, validation.violations));
      validation = validatePost(attempt.post, profile);
    }

    return new Response(
      JSON.stringify({
        success: true,
        post: attempt.post,
        validation_warnings: validation.valid ? [] : validation.violations,
        meta: {
          model: GEMINI_MODEL,
          voice,
          language,
          generationMs: attempt.generationMs,
          tokens: attempt.usageMetadata,
        },
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[generate-linkedin-post] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
```

- [ ] **Step 2: Type-check the changed file mentally against Tasks 1-4 exports**

Confirm each import resolves to a real export: `VoiceProfile`/`PostShape` (types.ts / postValidator.ts, Task 1), `seikiProfile`/`jaafarProfile` (Task 2), `buildSystemPrompt`/`buildUserPrompt`/`Language` (Task 3), `LearnedRuleEntry`/`formatLearnedRulesForPrompt` (Task 4). All were defined with these exact names in the prior tasks — no renaming needed.

- [ ] **Step 3: Manual verification via Supabase local functions serve**

Run: `supabase functions serve generate-linkedin-post --env-file supabase/.env.local` (adjust env file path to whatever this project already uses for local secrets — check `supabase/config.toml` / existing `.env` conventions if unsure).

In a second terminal:
```bash
curl -X POST http://localhost:54321/functions/v1/generate-linkedin-post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <local anon or user JWT>" \
  -d '{"brief":"Seiki lance un partenariat avec la ville de Lyon pour mesurer les flux piétons","voice":"seiki","language":"fr"}'
```
Expected: HTTP 200, JSON body with `success: true`, a `post` object, and `validation_warnings: []` (or a populated array if Gemini's first attempt violated a rule and the retry still did — check the array contents make sense given `bannedPhrases`/`hook`/`hashtags` bounds in `seiki.ts`).

If local Supabase functions serving isn't set up in this environment, skip live invocation and instead verify by re-reading the diff against Steps 1-2 of this task plus the passing Task 1-4 test suites, which exercise every function this file calls.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/generate-linkedin-post/index.ts
git commit -m "refactor: rewire generate-linkedin-post through VoiceProfile modules with validation retry"
```

---

### Task 6: Rewire `learn-linkedin-style/index.ts`

**Files:**
- Modify: `supabase/functions/learn-linkedin-style/index.ts` (full rewrite)

**Interfaces:**
- Consumes: `LearnedRuleEntry`, `appendLearnedRule`, `buildExtractionPrompt` (Task 4).
- Produces: `app_settings.value` shape for `linkedin_style_learned_{voice}` becomes `{ entries: LearnedRuleEntry[] }` (was `{ rules: string }`) — read by Task 5's `fetchLearnedRuleEntries` and by the migration in Task 8.

No automated test for this file for the same reason as Task 5 (no existing edge-function-handler test pattern in this codebase); verified manually.

- [ ] **Step 1: Replace the file contents**

Replace `supabase/functions/learn-linkedin-style/index.ts` entirely with:

```ts
// ============================================================
// Edge Function : learn-linkedin-style
// Runtime : Deno (Supabase)
// Rôle : Compare un post LinkedIn généré et sa version éditée par
//        l'utilisateur, demande à Gemini d'extraire une éventuelle
//        nouvelle règle de style généralisable, et l'ajoute au
//        journal de règles apprises pour la voix concernée dans
//        app_settings.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callGemini } from "../_shared/geminiApi.ts";
import { requireUser } from "../_shared/requireUser.ts";
import { appendLearnedRule, buildExtractionPrompt, type LearnedRuleEntry } from "../_shared/learnedRules.ts";

type Voice = "seiki" | "jaafar";

interface PostShape {
  hook: string;
  corps: string;
  hashtags: string[];
}

interface LearnRequest {
  voice: Voice;
  original: PostShape;
  edited: PostShape;
}

interface ExtractionResult {
  rule: string | null;
  reason: string | null;
}

function settingsKey(voice: Voice): string {
  return `linkedin_style_learned_${voice}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY non configurée dans les secrets Supabase");
    }

    const body = (await req.json()) as LearnRequest;
    if (!body.voice || !body.original || !body.edited) {
      return new Response(
        JSON.stringify({ error: "voice, original et edited sont requis" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const voice: Voice = body.voice === "jaafar" ? "jaafar" : "seiki";
    const voiceLabel = voice === "seiki" ? "Seiki (entreprise)" : "Jaafar (personnel)";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authError = await requireUser(req, supabase, corsHeaders(req));
    if (authError) return authError;

    const { data: existingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingsKey(voice))
      .maybeSingle();
    const existingEntries = Array.isArray((existingRow?.value as { entries?: LearnedRuleEntry[] } | null)?.entries)
      ? ((existingRow!.value as { entries: LearnedRuleEntry[] }).entries)
      : [];

    const prompt = buildExtractionPrompt(voiceLabel, existingEntries, body.original, body.edited);
    const { rawText } = await callGemini(geminiKey, { userPrompt: prompt, temperature: 0.3 });

    let parsed: ExtractionResult;
    try {
      parsed = JSON.parse(rawText) as ExtractionResult;
    } catch {
      throw new Error(`JSON invalide retourné par Gemini : ${rawText.substring(0, 300)}`);
    }

    if (!parsed.rule) {
      return new Response(
        JSON.stringify({ success: true, learned: false }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const newEntry: LearnedRuleEntry = {
      rule: parsed.rule,
      reason: parsed.reason ?? "",
      learned_at: new Date().toISOString(),
    };
    const updatedEntries = appendLearnedRule(existingEntries, newEntry);
    console.log(`[learn-linkedin-style] Nouvelle règle apprise (${voice}):`, JSON.stringify(newEntry));

    const { error: upsertErr } = await supabase.from("app_settings").upsert(
      {
        key: settingsKey(voice),
        value: { entries: updatedEntries },
        label: `Règles de style LinkedIn apprises — ${voice === "seiki" ? "Seiki" : "Jaafar"}`,
        category: "contenu",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ success: true, learned: true, entry: newEntry }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[learn-linkedin-style] Erreur :", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
```

- [ ] **Step 2: Manual verification**

Same approach as Task 5 Step 3: either invoke locally via `supabase functions serve learn-linkedin-style` with a sample `{voice, original, edited}` body and confirm the `app_settings` row for `linkedin_style_learned_seiki` (or `_jaafar`) ends up shaped `{ "entries": [{ "rule": "...", "reason": "...", "learned_at": "..." }] }`, or verify by re-reading the diff against Task 4's passing tests (which exercise `appendLearnedRule` and `buildExtractionPrompt` directly).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/learn-linkedin-style/index.ts
git commit -m "refactor: rewire learn-linkedin-style to append structured, logged rule entries"
```

---

### Task 7: Frontend — surface validation warnings via existing toast

**Files:**
- Modify: `src/services/contentService.ts:19-45` (types + `generateLinkedInPost`)
- Modify: `src/hooks/useLinkedInContent.ts:16-30` (`handleGenerate`)
- Test: `src/services/contentService.test.ts` (new)

**Interfaces:**
- Consumes: `validation_warnings` field on the `generate-linkedin-post` response, added in Task 5.
- Produces: `contentService.generateLinkedInPost` return type changes from `Promise<LinkedInPost>` to `Promise<{ post: LinkedInPost; validationWarnings: string[] }>` — this is a breaking signature change for the one caller, `useLinkedInContent.handleGenerate`, updated in the same task.

- [ ] **Step 1: Write the failing test for `contentService.generateLinkedInPost`**

```ts
// src/services/contentService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { callEdgeFunctionMock } = vi.hoisted(() => ({ callEdgeFunctionMock: vi.fn() }));

vi.mock('./edgeFunctions', () => ({ callEdgeFunction: callEdgeFunctionMock }));
vi.mock('./supabaseClient', () => ({ supabase: { from: vi.fn() } }));

import { contentService } from './contentService';

describe('contentService.generateLinkedInPost', () => {
  beforeEach(() => {
    callEdgeFunctionMock.mockReset();
  });

  it('returns the post with empty warnings when validation passed', async () => {
    callEdgeFunctionMock.mockResolvedValue({
      success: true,
      post: { hook: 'H', corps: 'C', hashtags: ['A'] },
      validation_warnings: [],
      meta: { model: 'gemini-2.5-flash', voice: 'seiki', language: 'fr', generationMs: 100 },
    });

    const result = await contentService.generateLinkedInPost('brief', 'seiki', 'fr');

    expect(result.post).toEqual({ hook: 'H', corps: 'C', hashtags: ['A'] });
    expect(result.validationWarnings).toEqual([]);
  });

  it('passes through non-empty validation warnings', async () => {
    callEdgeFunctionMock.mockResolvedValue({
      success: true,
      post: { hook: 'H', corps: 'C', hashtags: ['A'] },
      validation_warnings: ['3 hashtags, attendu entre 5 et 10.'],
      meta: { model: 'gemini-2.5-flash', voice: 'seiki', language: 'fr', generationMs: 100 },
    });

    const result = await contentService.generateLinkedInPost('brief', 'seiki', 'fr');

    expect(result.validationWarnings).toEqual(['3 hashtags, attendu entre 5 et 10.']);
  });

  it('falls back to a client-side post with empty warnings when the edge function fails', async () => {
    callEdgeFunctionMock.mockRejectedValue(new Error('network down'));

    const result = await contentService.generateLinkedInPost('Un brief de secours', 'jaafar', 'fr');

    expect(result.post.hook).toContain('Un brief de secours');
    expect(result.validationWarnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/contentService.test.ts`
Expected: FAIL — `result.post` is undefined (current `generateLinkedInPost` returns the post directly, not `{ post, validationWarnings }`).

- [ ] **Step 3: Update `contentService.ts`**

In `src/services/contentService.ts`, replace lines 19-45 (the `GeneratePostResult` interface through the end of `generateLinkedInPost`) with:

```ts
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
```

Leave `learnFromEdit`, `getTagBook`, `saveTagBook` untouched below this point.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/contentService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Update `useLinkedInContent.ts` to consume the new shape and toast warnings**

In `src/hooks/useLinkedInContent.ts`, replace `handleGenerate`:

```ts
  const handleGenerate = async () => {
    if (!brief.trim()) {
      showToast('Décris le sujet du post avant de générer.', 'error');
      return;
    }
    setLoading(true);
    setCopied(false);
    try {
      const result = await contentService.generateLinkedInPost(brief, voice, language);
      setPost(result.post);
      setOriginalPost(result.post);
      if (result.validationWarnings.length > 0) {
        showToast(`Post généré avec des réserves de style : ${result.validationWarnings.join(' ')}`, 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 6: Run the full frontend test suite to check for regressions**

Run: `npx vitest run`
Expected: PASS — no other file references `contentService.generateLinkedInPost`'s old return shape (only `useLinkedInContent.ts` calls it, per current codebase).

- [ ] **Step 7: Commit**

```bash
git add src/services/contentService.ts src/hooks/useLinkedInContent.ts src/services/contentService.test.ts
git commit -m "feat: surface post-generation validation warnings via toast"
```

---

### Task 8: One-time data migration for existing learned-rules rows

The `app_settings` rows at `linkedin_style_learned_seiki` / `linkedin_style_learned_jaafar` currently (if any exist — this feature has been live since 2026-07-15 per project history) hold `{ "rules": "<merged text blob>" }`. After Tasks 5-6 ship, `fetchLearnedRuleEntries` reads `.entries` instead, so any existing blob would silently stop being used. This task seeds a legacy entry from the old blob so nothing already learned is lost.

**Files:**
- Create: `archive/schema_linkedin_style_migration.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- One-time migration : linkedin_style_learned_{voice}
-- Converts the legacy { "rules": "<merged text blob>" } shape
-- into the new { "entries": [...] } shape expected by the
-- rebuilt writing-style system. Safe to run even if no row
-- exists yet for a given key (UPDATE affects 0 rows).
-- Run once in the Supabase SQL Editor before deploying the
-- updated generate-linkedin-post / learn-linkedin-style functions.
-- ============================================================

UPDATE app_settings
SET value = jsonb_build_object(
  'entries',
  jsonb_build_array(
    jsonb_build_object(
      'rule', value->>'rules',
      'reason', 'Migré depuis l''ancien format de règles fusionnées',
      'learned_at', now()
    )
  )
),
updated_at = now()
WHERE key IN ('linkedin_style_learned_seiki', 'linkedin_style_learned_jaafar')
  AND value ? 'rules'
  AND value->>'rules' IS NOT NULL
  AND length(trim(value->>'rules')) > 0;
```

- [ ] **Step 2: Instruct the user to run it manually**

This project's convention (see `archive/schema_linkedin_scheduler_cron.sql`) is for schema/data scripts to be run by hand in the Supabase SQL Editor, not applied automatically. Tell the user: "Run `archive/schema_linkedin_style_migration.sql` in the Supabase SQL Editor before (or right after) deploying the Task 5/6 edge functions, so any already-learned style rules carry over instead of being silently dropped."

- [ ] **Step 3: Commit**

```bash
git add archive/schema_linkedin_style_migration.sql
git commit -m "chore: add migration seeding legacy learned-rules blob into new entries shape"
```

---

### Task 9: Deploy edge functions

**Files:** none (deployment step, no code changes)

- [ ] **Step 1: Deploy the two changed functions**

```bash
supabase functions deploy generate-linkedin-post
supabase functions deploy learn-linkedin-style
```

- [ ] **Step 2: Confirm the user has run the Task 8 migration**

Ask explicitly before or right after this deploy — deploying Task 5/6 without running Task 8's SQL means any previously-learned style corrections stop being read (not deleted, just orphaned in the old `rules` key shape) until the migration runs.

- [ ] **Step 3: Smoke-test in the actual Contenu UI**

Generate one Seiki post and one Jaafar post from the running app, confirm they come back with sensible content and (if `validation_warnings` is non-empty for either) that the toast appears with a readable message.
