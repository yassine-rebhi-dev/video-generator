import { describe, expect, it } from "vitest";
import { assColor, assEscape, assTime, buildAss, DEFAULT_CAPTION_STYLE, displayText } from "../src/captions/ass.js";
import { buildPages, DEFAULT_PAGING } from "../src/captions/paging.js";
import type { WordTiming } from "../src/core/types.js";

function words(text: string, sceneIndex = 0, start = 0, step = 0.3): WordTiming[] {
  return text.split(" ").map((t, i) => ({ text: t, sceneIndex, start: start + i * step, end: start + i * step + step * 0.9 }));
}

describe("buildPages", () => {
  it("keeps pages within the word and character limits", () => {
    const pages = buildPages(words("the extraordinarily long lighthouse stood there for a hundred years"));
    for (const page of pages) {
      expect(page.words.length).toBeLessThanOrEqual(DEFAULT_PAGING.maxWords);
      if (page.words.length > 1) expect(page.words.map((w) => w.text).join(" ").length).toBeLessThanOrEqual(DEFAULT_PAGING.maxChars);
    }
    expect(pages.flatMap((p) => p.words.map((w) => w.text)).join(" ")).toBe("the extraordinarily long lighthouse stood there for a hundred years");
  });

  it("starts a new page after a sentence end, at a pause and at a scene change", () => {
    expect(buildPages(words("He left. Nobody"))[0]!.words.map((w) => w.text)).toEqual(["He", "left."]);
    const paused: WordTiming[] = [...words("one"), ...words("two", 0, 2)];
    expect(buildPages(paused)).toHaveLength(2);
    const scenes: WordTiming[] = [...words("one", 0), ...words("two", 1, 0.3)];
    expect(buildPages(scenes)).toHaveLength(2);
  });

  it("never overlaps pages and never ends a page before its last word", () => {
    const pages = buildPages(words("a b c d e f g h i j k l m n"));
    for (let i = 0; i < pages.length; i++) {
      expect(pages[i]!.end).toBeGreaterThanOrEqual(pages[i]!.words.at(-1)!.end);
      if (i > 0) expect(pages[i]!.start).toBeGreaterThanOrEqual(pages[i - 1]!.end - 1e-9);
    }
  });

  it("returns nothing for no words", () => {
    expect(buildPages([])).toEqual([]);
  });
});

describe("ASS helpers", () => {
  it("formats time as h:mm:ss.cc", () => {
    expect(assTime(0)).toBe("0:00:00.00");
    expect(assTime(61.234)).toBe("0:01:01.23");
    expect(assTime(3725.999)).toBe("1:02:06.00");
    expect(assTime(-1)).toBe("0:00:00.00");
  });
  it("converts RRGGBB to ASS BGR order", () => {
    expect(assColor("FFE14A")).toBe("&H004AE1FF");
    expect(() => assColor("red")).toThrow();
  });
  it("removes override syntax from narration", () => {
    expect(assEscape("{\\b1}bold{\\b0}")).toBe("b1boldb0");
  });
  it("drops pause marks and quotes on screen but keeps ? and !", () => {
    expect(displayText("burning,")).toBe("burning");
    expect(displayText("“Wait!”")).toBe("Wait!");
    expect(displayText("gone.")).toBe("gone");
    expect(displayText("why?")).toBe("why?");
    expect(displayText("—")).toBe("—");
  });
});

describe("buildAss", () => {
  const pages = buildPages(words("The lamp was"));
  const ass = buildAss(pages, DEFAULT_CAPTION_STYLE, 1080, 1920);
  const events = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));

  it("declares the canvas size", () => {
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
  });
  it("writes one event per word, each highlighting a different word", () => {
    expect(events).toHaveLength(3);
    expect(events[0]).toMatch(/\{\\c&H004AE1FF&\\fscx112\\fscy112\}THE\{\\r\} LAMP WAS$/);
    expect(events[2]).toMatch(/THE LAMP \{[^}]+\}WAS\{\\r\}$/);
  });
  it("chains events with no gap inside a page", () => {
    const times = events.map((e) => e.split(",").slice(1, 3));
    expect(times[0]![1]).toBe(times[1]![0]);
    expect(times[1]![1]).toBe(times[2]![0]);
  });
});
