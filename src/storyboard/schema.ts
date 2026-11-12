import { z } from "zod";

export const SHOTS = ["wide", "medium", "close"] as const;

export const sceneSchema = z.object({
  narration: z.string().min(3).max(220),
  visual: z.string().min(20).max(700),
  motion: z.string().min(5).max(300),
  shot: z.enum(SHOTS),
});

export const storyboardSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(8),
  musicMood: z.string().min(2).max(40),
  styleBlock: z.string().min(20).max(600),
  characters: z
    .array(z.object({ id: z.string().min(1).max(30), look: z.string().min(20).max(500) }))
    .max(3),
  scenes: z.array(sceneSchema).min(4).max(16),
});

export type Storyboard = z.infer<typeof storyboardSchema>;
export type Scene = z.infer<typeof sceneSchema>;

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Narration is read at roughly this many words per second, pauses included. */
export const WORDS_PER_SECOND = 2.5;

export interface StoryBudget {
  minWords: number;
  maxWords: number;
  minScenes: number;
  maxScenes: number;
}

export function budgetFor(durationSec: number): StoryBudget {
  const target = durationSec * WORDS_PER_SECOND;
  const scenes = durationSec / 4.5;
  return {
    minWords: Math.round(target * 0.85),
    maxWords: Math.round(target * 1.1),
    minScenes: Math.max(4, Math.floor(scenes * 0.8)),
    maxScenes: Math.min(16, Math.ceil(scenes * 1.2)),
  };
}

/** Mechanical checks a reviewer should not need a model for. Empty means the storyboard passes. */
export function checkStoryboard(story: Storyboard, budget: StoryBudget): string[] {
  const problems: string[] = [];
  const total = story.scenes.reduce((sum, s) => sum + wordCount(s.narration), 0);
  if (total < budget.minWords || total > budget.maxWords) {
    problems.push(`Narration has ${total} words; it must have ${budget.minWords} to ${budget.maxWords}.`);
  }
  if (story.scenes.length < budget.minScenes || story.scenes.length > budget.maxScenes) {
    problems.push(`There are ${story.scenes.length} scenes; there must be ${budget.minScenes} to ${budget.maxScenes}.`);
  }
  const hookWords = wordCount(story.scenes[0]?.narration ?? "");
  if (hookWords > 14) problems.push(`The first scene's narration is the hook and has ${hookWords} words; the limit is 14.`);
  story.scenes.forEach((scene, i) => {
    const words = wordCount(scene.narration);
    if (i > 0 && words > 22) problems.push(`Scene ${i + 1} narration has ${words} words; the limit is 22.`);
    for (const character of story.characters) {
      const tag = `<${character.id}>`;
      if (scene.visual.includes(tag) || scene.motion.includes(tag)) continue;
      const bare = new RegExp(`\\b${character.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (bare.test(scene.visual)) problems.push(`Scene ${i + 1} visual names ${character.id} without the ${tag} tag.`);
    }
    for (const match of scene.visual.matchAll(/<([^<>]{1,30})>/g)) {
      if (!story.characters.some((c) => c.id === match[1])) {
        problems.push(`Scene ${i + 1} visual uses <${match[1]}> which is not in the character list.`);
      }
    }
  });
  return problems;
}

/**
 * The text a video model receives for one scene. Models never see names, so
 * each <id> tag is replaced by that character's full visual description.
 */
export function clipPrompt(story: Storyboard, scene: Scene): string {
  const expand = (text: string) =>
    text.replace(/<([^<>]{1,30})>/g, (whole, id: string) => {
      const character = story.characters.find((c) => c.id === id);
      return character ? character.look : whole;
    });
  const framing = { wide: "Wide shot.", medium: "Medium shot.", close: "Close-up." }[scene.shot];
  return [framing, expand(scene.visual), expand(scene.motion), story.styleBlock, "Vertical 9:16 frame."]
    .map((s) => s.trim())
    .join(" ");
}
