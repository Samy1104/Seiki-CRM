# LinkedIn writing style system rebuild

## Why

Current style system (`generate-linkedin-post/index.ts`): `Voice = "seiki"|"jaafar"` enum, hardcoded bio/example/rule constants crammed in one file, prose `STYLE_RULES` the model often ignores, and an opaque self-learning loop (`learn-linkedin-style`) that re-merges edit-diffs into a single blob in `app_settings` with no visibility into what it "learned."

Problems driving rebuild: output sounds generic/AI-ish despite few-shot examples, explicit style rules get ignored, and the learning loop can't be reviewed or trusted. No new UI wanted — config stays in code, editable by hand.

## Architecture

```
_shared/voices/
  types.ts            VoiceProfile type
  seiki.ts             Seiki VoiceProfile
  jaafar.ts             Jaafar VoiceProfile
_shared/promptBuilder.ts   builds system/user prompts from a VoiceProfile
_shared/postValidator.ts   deterministic rule checks on generated output
generate-linkedin-post/index.ts   orchestration (load profile -> prompt -> Gemini -> validate -> retry once)
learn-linkedin-style/index.ts     unchanged trigger, new storage shape
```

## VoiceProfile type

```ts
type VoiceProfile = {
  id: "seiki" | "jaafar";
  bio: string;
  examples: { text: string; note?: string }[];
  tone: string[];
  hook: { minWords: number; maxWords: number; mustBe: string };
  bannedPhrases: string[];
  hashtags: { min: number; max: number };
  bodyStyle: "bullets" | "narrative" | "either";
};
```

Splits old free-text `STYLE_RULES` into prose fields (bio/examples/tone, feed the model's voice) and machine-checkable fields (bannedPhrases/hook/hashtags, feed `postValidator.ts`).

## Generation flow

1. Load `VoiceProfile` for requested voice.
2. Load learned rules for voice from `app_settings` (new shape, see below).
3. `buildSystemPrompt`: bio + tone + examples first (voice anchor) -> learned rules next -> hard constraints (bannedPhrases/hook/hashtags) LAST, closest to generation, for max instruction-following (recency bias fix for "ignores explicit rules").
4. `buildUserPrompt`: brief + language, unchanged JSON contract `{hook, corps, hashtags}`.
5. Call Gemini, parse JSON.
6. `postValidator.check(result, profile)`: hook word count, bannedPhrases substring match (case-insensitive), hashtag count. Returns `{valid}` or `{valid:false, violations}`.
7. If invalid: rebuild user prompt appending violation list, retry once (Gemini call #2, hard cap — no loop).
8. If still invalid after retry: return result anyway with `validation_warnings` field. Don't hard-block — a flagged imperfect post beats a blocked generation. Existing hardcoded client-side fallback in `contentService.ts` stays as-is, reserved for actual call/network failure only (not validation failure).

## Learning loop

`app_settings.linkedin_style_learned_{voice}` changes from opaque merged-text blob to structured array:

```json
[
  { "rule": "...", "reason": "diff observed on post from 2026-07-20", "learned_at": "2026-07-20T14:32:00Z" }
]
```

`learn-linkedin-style` appends new entries (no more full-blob re-merge via Gemini). Each new entry `console.log`'d on write -> reviewable via Supabase function logs, no new UI. `fetchLearnedRules()` joins `rule` strings into prompt same as today. No pruning/expiry -- out of scope, follow-up if list grows unwieldy.

## Error handling

Two failure modes stay distinct:
- Gemini call/network failure -> existing hardcoded fallback in `contentService.ts` (unchanged).
- Validation failure after 1 retry -> returned with `validation_warnings`, not blocked.

## Testing

- Unit tests for `postValidator.ts` (pure fn: banned-phrase detection, hook bounds, hashtag counts).
- `promptBuilder.ts` output verified manually -- generate real posts per voice, check against profile rules. Not unit-testable (prompt quality, not logic).
- No tests for the Gemini call itself (network-dependent), consistent with rest of codebase.

## Out of scope

- New voices/personas beyond seiki/jaafar.
- New UI for editing bio/examples/rules or reviewing learned rules.
- Pruning/expiry of learned-rules list.
- LLM self-critique pass (considered as Approach 3, not chosen -- 2x cost/latency per generation).
