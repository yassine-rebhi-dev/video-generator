import type { WordTiming } from "../core/types.js";

export interface RecognizedWord {
  text: string;
  start: number;
  end: number;
}

/** Splits narration into display tokens. Punctuation stays attached to its word. */
export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter((t) => t.length > 0);
}

/** Form used for matching: lower case, letters and digits only. */
export function normalize(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Relative speaking time of a token: its length plus a pause after punctuation. */
export function weight(token: string): number {
  const base = Math.max(1, normalize(token).length);
  if (/[.!?…]["')\]]*$/.test(token)) return base + 4;
  if (/[,;:—–]["')\]]*$/.test(token)) return base + 2;
  return base;
}

function spread(tokens: string[], start: number, end: number): Array<{ start: number; end: number }> {
  const weights = tokens.map(weight);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, end - start);
  let cursor = start;
  return weights.map((w) => {
    const s = cursor;
    cursor += (w / total) * span;
    return { start: s, end: cursor };
  });
}

/** Timing with no recogniser: words share the scene's speech span by weight. */
export function proportionalTimings(
  text: string,
  sceneIndex: number,
  start: number,
  end: number,
): WordTiming[] {
  const tokens = tokenize(text);
  return spread(tokens, start, end).map((t, i) => ({ text: tokens[i]!, sceneIndex, ...t }));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return a.length > 0;
  return a.length >= 4 && b.length >= 4 && editDistanceAtMostOne(a, b);
}

/** Longest common subsequence between script and recognised words, as index pairs. */
export function matchWords(script: string[], heard: string[]): Array<[number, number]> {
  const n = script.length;
  const m = heard.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] = sameWord(script[i]!, heard[j]!)
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (sameWord(script[i]!, heard[j]!)) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  return pairs;
}

export interface AlignResult {
  words: WordTiming[];
  /** Share of script words that were matched to a recognised word (0..1). */
  matched: number;
  method: "recognized" | "proportional";
}

export interface AlignOptions {
  /** Below this share of matched words the recogniser is distrusted entirely. */
  minMatched?: number;
  minWordDuration?: number;
}

/**
 * Gives every script word a time. The script is the source of the text; the
 * recogniser only contributes timing for the words it heard correctly. Words it
 * missed are spread between the nearest matched neighbours. Times in `heard`
 * and in the result are on the same clock as `start` and `end`.
 */
export function alignScene(
  text: string,
  sceneIndex: number,
  start: number,
  end: number,
  heard: RecognizedWord[],
  options: AlignOptions = {},
): AlignResult {
  const minMatched = options.minMatched ?? 0.5;
  const minDur = options.minWordDuration ?? 0.06;
  const tokens = tokenize(text);
  if (tokens.length === 0) return { words: [], matched: 1, method: "proportional" };

  const usable = heard
    .filter((h) => Number.isFinite(h.start) && Number.isFinite(h.end) && h.end >= h.start)
    .map((h) => ({ ...h, start: clamp(h.start, start, end), end: clamp(h.end, start, end) }));
  const pairs = matchWords(tokens.map(normalize), usable.map((h) => normalize(h.text)));
  const matched = pairs.length / tokens.length;
  if (matched < minMatched) {
    return { words: proportionalTimings(text, sceneIndex, start, end), matched, method: "proportional" };
  }

  const times: Array<{ start: number; end: number } | undefined> = new Array(tokens.length).fill(undefined);
  for (const [si, hi] of pairs) times[si] = { start: usable[hi]!.start, end: usable[hi]!.end };

  let i = 0;
  while (i < tokens.length) {
    if (times[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && !times[j]) j++;
    const from = i > 0 ? times[i - 1]!.end : start;
    const to = j < tokens.length ? times[j]!.start : end;
    const filled = spread(tokens.slice(i, j), from, Math.max(from, to));
    for (let k = i; k < j; k++) times[k] = filled[k - i]!;
    i = j;
  }

  const words: WordTiming[] = [];
  let cursor = start;
  for (let k = 0; k < tokens.length; k++) {
    const t = times[k]!;
    const s = clamp(Math.max(t.start, cursor), start, end);
    const e = clamp(Math.max(t.end, s + minDur), s, Math.max(end, s));
    words.push({ text: tokens[k]!, sceneIndex, start: s, end: e });
    cursor = e;
  }
  return { words, matched, method: "recognized" };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}
