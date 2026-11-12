import type { WordTiming } from "../core/types.js";

export interface CaptionPage {
  start: number;
  end: number;
  words: WordTiming[];
}

export interface PagingOptions {
  maxChars: number;
  maxWords: number;
  /** A silence longer than this starts a new page. */
  gapSec: number;
  /** How long a page may stay on screen after its last word when nothing follows. */
  lingerSec: number;
}

export const DEFAULT_PAGING: PagingOptions = { maxChars: 18, maxWords: 3, gapSec: 0.6, lingerSec: 0.3 };

const SENTENCE_END = /[.!?…]["')\]]*$/;

/**
 * Groups timed words into short on-screen pages. A page closes when it is full,
 * at the end of a sentence, at a pause, or at a scene change. Pages never overlap.
 */
export function buildPages(words: WordTiming[], options: PagingOptions = DEFAULT_PAGING): CaptionPage[] {
  const groups: WordTiming[][] = [];
  let current: WordTiming[] = [];
  let chars = 0;

  const close = () => {
    if (current.length > 0) groups.push(current);
    current = [];
    chars = 0;
  };

  for (const word of words) {
    const previous = current[current.length - 1];
    if (previous) {
      const wouldBe = chars + 1 + word.text.length;
      if (
        current.length >= options.maxWords ||
        wouldBe > options.maxChars ||
        word.start - previous.end > options.gapSec ||
        word.sceneIndex !== previous.sceneIndex ||
        SENTENCE_END.test(previous.text)
      ) {
        close();
      }
    }
    current.push(word);
    chars += (chars > 0 ? 1 : 0) + word.text.length;
  }
  close();

  return groups.map((group, i) => {
    const start = group[0]!.start;
    const lastEnd = group[group.length - 1]!.end;
    const next = groups[i + 1]?.[0]?.start;
    const end = next === undefined ? lastEnd + options.lingerSec : Math.min(next, lastEnd + options.lingerSec);
    return { start, end: Math.max(end, lastEnd), words: group };
  });
}
