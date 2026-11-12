import { describe, expect, it } from "vitest";
import { alignScene, matchWords, normalize, proportionalTimings, tokenize, weight } from "../src/align/words.js";

describe("tokenize and normalize", () => {
  it("keeps punctuation on the display token and drops it for matching", () => {
    expect(tokenize("  He said, “Wait!”  ")).toEqual(["He", "said,", "“Wait!”"]);
    expect(normalize("“Wait!”")).toBe("wait");
    expect(normalize("1900.")).toBe("1900");
  });

  it("gives sentence ends more time than commas, and commas more than plain words", () => {
    expect(weight("gone.")).toBeGreaterThan(weight("gone,"));
    expect(weight("gone,")).toBeGreaterThan(weight("gone"));
  });
});

describe("proportionalTimings", () => {
  it("fills the span exactly, in order, with no overlap", () => {
    const words = proportionalTimings("The lamp was still burning.", 2, 10, 12);
    expect(words).toHaveLength(5);
    expect(words[0]!.start).toBe(10);
    expect(words.at(-1)!.end).toBeCloseTo(12, 6);
    for (let i = 1; i < words.length; i++) expect(words[i]!.start).toBeCloseTo(words[i - 1]!.end, 6);
    expect(words.every((w) => w.sceneIndex === 2)).toBe(true);
  });
});

describe("matchWords", () => {
  it("pairs words in order and tolerates a one-letter slip in longer words", () => {
    expect(matchWords(["the", "keeper", "vanished"], ["the", "keepers", "vanished"])).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it("skips words the recogniser added or dropped", () => {
    expect(matchWords(["a", "b", "c"], ["a", "x", "c"])).toEqual([[0, 0], [2, 2]]);
  });
});

describe("alignScene", () => {
  const heard = (list: Array<[string, number, number]>) => list.map(([text, start, end]) => ({ text, start, end }));

  it("always shows the script's words, with the recogniser's times", () => {
    const result = alignScene("Mr. Okonkwo vanished.", 0, 0, 3, heard([["Mister", 0.1, 0.4], ["Okonkwo", 0.5, 1.2], ["vanished", 1.4, 2.0]]));
    expect(result.method).toBe("recognized");
    expect(result.words.map((w) => w.text)).toEqual(["Mr.", "Okonkwo", "vanished."]);
    expect(result.words[1]).toMatchObject({ start: 0.5, end: 1.2 });
    expect(result.words[2]).toMatchObject({ start: 1.4, end: 2.0 });
  });

  it("places a word the recogniser missed between its neighbours", () => {
    const result = alignScene("one two three", 0, 0, 3, heard([["one", 0, 0.5], ["three", 2, 2.5]]));
    const two = result.words[1]!;
    expect(two.start).toBeGreaterThanOrEqual(0.5);
    expect(two.end).toBeLessThanOrEqual(2);
    expect(result.matched).toBeCloseTo(2 / 3);
  });

  it("falls back to proportional timing when too little was recognised", () => {
    const result = alignScene("the storm was the worst in years", 0, 5, 8, heard([["banana", 5, 6]]));
    expect(result.method).toBe("proportional");
    expect(result.words[0]!.start).toBe(5);
    expect(result.words.at(-1)!.end).toBeCloseTo(8, 6);
  });

  it("never lets times run backwards or leave the scene", () => {
    const result = alignScene("a b c d", 1, 10, 12, heard([["a", 11.5, 11.9], ["b", 10.2, 10.4], ["c", 13, 14], ["d", 11.9, 12]]));
    for (let i = 0; i < result.words.length; i++) {
      const w = result.words[i]!;
      expect(w.start).toBeGreaterThanOrEqual(10);
      expect(w.end).toBeLessThanOrEqual(12);
      expect(w.end).toBeGreaterThanOrEqual(w.start);
      if (i > 0) expect(w.start).toBeGreaterThanOrEqual(result.words[i - 1]!.end);
    }
  });

  it("handles empty narration", () => {
    expect(alignScene("   ", 0, 0, 1, []).words).toEqual([]);
  });
});
