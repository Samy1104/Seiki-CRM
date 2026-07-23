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
