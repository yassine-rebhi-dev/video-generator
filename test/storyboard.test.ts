import { describe, expect, it } from "vitest";
import { SAMPLE_STORYBOARD } from "../src/llm/fake.js";
import { extractJson, type LlmProvider } from "../src/llm/llm.js";
import { budgetFor, checkStoryboard, clipPrompt, storyboardSchema, type Storyboard } from "../src/storyboard/schema.js";
import { StoryboardService } from "../src/storyboard/storyboard.service.js";

const sample = storyboardSchema.parse(SAMPLE_STORYBOARD);
const request = { topic: "t", style: "s", durationSec: 40 };

class Scripted implements LlmProvider {
  readonly name = "scripted";
  calls: string[] = [];
  constructor(private readonly replies: string[]) {}
  async complete(r: { system: string; user: string }): Promise<string> {
    this.calls.push(r.user);
    return this.replies[Math.min(this.calls.length - 1, this.replies.length - 1)]!;
  }
}

describe("extractJson", () => {
  it("reads bare JSON, fenced JSON and JSON with chatter around it", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} hope it helps')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("no json")).toThrow();
  });
});

describe("checkStoryboard", () => {
  it("accepts the bundled sample for its intended length", () => {
    expect(checkStoryboard(sample, budgetFor(40))).toEqual([]);
  });
  it("reports word count, a long hook and unknown or untagged characters", () => {
    const bad: Storyboard = structuredClone(sample);
    bad.scenes[0]!.narration = "This hook sentence simply goes on for far too many words to hold any attention at all.";
    bad.scenes[1]!.visual = "The keeper climbs the stairs holding a lantern in the upper part of the frame.";
    bad.scenes[2]!.visual = "<ghost> floats above an open logbook on a wooden desk by candlelight.";
    const problems = checkStoryboard(bad, budgetFor(15)).join("\n");
    expect(problems).toMatch(/Narration has \d+ words/);
    expect(problems).toMatch(/hook/);
    expect(problems).toMatch(/Scene 2 visual names keeper without the <keeper> tag/);
    expect(problems).toMatch(/<ghost> which is not in the character list/);
  });
});

describe("clipPrompt", () => {
  it("replaces character tags with the full look and adds framing and style", () => {
    const prompt = clipPrompt(sample, sample.scenes[1]!);
    expect(prompt).not.toContain("<keeper>");
    expect(prompt).toContain("grey beard");
    expect(prompt.startsWith("Medium shot.")).toBe(true);
    expect(prompt).toContain(sample.styleBlock);
    expect(prompt.endsWith("Vertical 9:16 frame.")).toBe(true);
  });
});

describe("StoryboardService", () => {
  it("returns a passing storyboard on the first attempt", async () => {
    const llm = new Scripted([JSON.stringify(sample)]);
    const result = await new StoryboardService(llm).write(request, "");
    expect(result.attempts).toBe(1);
    expect(result.remainingProblems).toEqual([]);
  });
  it("sends the problems back and accepts the corrected reply", async () => {
    const llm = new Scripted(["not json at all", JSON.stringify(sample)]);
    const result = await new StoryboardService(llm).write(request, "");
    expect(result.attempts).toBe(2);
    expect(llm.calls[1]).toContain("not a valid JSON object");
  });
  it("keeps the best storyboard when checks still fail after the last attempt", async () => {
    const llm = new Scripted([JSON.stringify(sample)]);
    const result = await new StoryboardService(llm, 2).write({ ...request, durationSec: 15 }, "");
    expect(result.attempts).toBe(2);
    expect(result.remainingProblems.length).toBeGreaterThan(0);
  });
  it("fails when no reply ever has the right shape", async () => {
    const llm = new Scripted(['{"title":"x"}']);
    await expect(new StoryboardService(llm, 2).write(request, "")).rejects.toThrow(/usable storyboard/);
  });
});
