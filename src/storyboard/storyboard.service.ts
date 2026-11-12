import type { GenerateRequest } from "../core/types.js";
import { extractJson, type LlmProvider } from "../llm/llm.js";
import { revisionUser, writerUser, WRITER_SYSTEM } from "./prompts.js";
import { budgetFor, checkStoryboard, storyboardSchema, type Storyboard } from "./schema.js";

export interface StoryboardResult {
  storyboard: Storyboard;
  /** Problems still present after the last attempt. Empty when the storyboard passes. */
  remainingProblems: string[];
  attempts: number;
}

/**
 * Writes a storyboard, checks it mechanically, and sends it back for revision
 * with the list of problems. A storyboard with the right shape is accepted
 * after the last attempt even if some checks still fail; a reply that is not
 * valid JSON in the right shape is an error.
 */
export class StoryboardService {
  constructor(private readonly llm: LlmProvider, private readonly maxAttempts = 3) {}

  async write(request: GenerateRequest, styleNotes: string): Promise<StoryboardResult> {
    const budget = budgetFor(request.durationSec);
    let user = writerUser(request, budget, styleNotes);
    let best: { storyboard: Storyboard; problems: string[] } | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const reply = await this.llm.complete({ system: WRITER_SYSTEM, user });
      let problems: string[];
      try {
        const parsed = storyboardSchema.safeParse(extractJson(reply));
        if (parsed.success) {
          problems = checkStoryboard(parsed.data, budget);
          if (!best || problems.length < best.problems.length) best = { storyboard: parsed.data, problems };
          if (problems.length === 0) return { storyboard: parsed.data, remainingProblems: [], attempts: attempt };
        } else {
          problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
          lastError = new Error(problems.join("; "));
        }
      } catch (error) {
        problems = ["The reply was not a valid JSON object."];
        lastError = error;
      }
      user = revisionUser(reply.slice(0, 12_000), problems);
    }

    if (best) return { storyboard: best.storyboard, remainingProblems: best.problems, attempts: this.maxAttempts };
    throw new Error(`The model never produced a usable storyboard: ${String(lastError)}`);
  }
}
