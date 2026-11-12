import type { CaptionPage } from "./paging.js";

export interface CaptionStyle {
  font: string;
  fontSize: number;
  /** Colours as RRGGBB. */
  textColor: string;
  activeColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  /** Distance of the caption baseline from the bottom edge, in pixels. */
  marginBottom: number;
  /** Size of the spoken word relative to the others, in percent. */
  activeScale: number;
  uppercase: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  font: "Inter ExtraBold",
  fontSize: 92,
  textColor: "FFFFFF",
  activeColor: "FFE14A",
  outlineColor: "000000",
  outline: 7,
  shadow: 3,
  marginBottom: 560,
  activeScale: 112,
  uppercase: true,
};

/** ASS stores colours as &HAABBGGRR. */
export function assColor(rrggbb: string, alpha = "00"): string {
  const hex = rrggbb.replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(hex)) throw new Error(`Invalid colour: ${rrggbb}`);
  return `&H${alpha}${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`;
}

/** ASS timestamps are h:mm:ss.cc (centiseconds). */
export function assTime(seconds: number): string {
  const cs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/** Removes characters that would be read as ASS override syntax. */
export function assEscape(text: string): string {
  return text.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\r?\n/g, " ");
}

/** What a word looks like on screen: no quotes or pause marks, but ? and ! are kept. */
export function displayText(token: string): string {
  const cleaned = assEscape(token)
    .replace(/^["“”'‘(\[]+/, "")
    .replace(/["“”'’)\]]+$/, "")
    .replace(/[.,;:…—–]+$/, "");
  return cleaned.length > 0 ? cleaned : assEscape(token);
}

function header(style: CaptionStyle, width: number, height: number): string {
  const fields = [
    "Caption", style.font, style.fontSize,
    assColor(style.textColor), assColor(style.activeColor), assColor(style.outlineColor), assColor("000000", "80"),
    0, 0, 0, 0, 100, 100, 0, 0, 1, style.outline, style.shadow, 2, 60, 60, style.marginBottom, 1,
  ];
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: ${fields.join(",")}`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/**
 * Renders pages as an ASS subtitle file. Each page becomes one event per word:
 * the whole page stays visible while the word being spoken is tinted and enlarged.
 */
export function buildAss(pages: CaptionPage[], style: CaptionStyle, width: number, height: number): string {
  const active = `{\\c${assColor(style.activeColor)}&\\fscx${style.activeScale}\\fscy${style.activeScale}}`;
  const lines: string[] = [];
  for (const page of pages) {
    const shown = page.words.map((w) => {
      const text = displayText(w.text);
      return style.uppercase ? text.toUpperCase() : text;
    });
    page.words.forEach((word, i) => {
      const from = i === 0 ? page.start : word.start;
      const to = i === page.words.length - 1 ? page.end : page.words[i + 1]!.start;
      if (to - from < 0.01) return;
      const text = shown.map((t, k) => (k === i ? `${active}${t}{\\r}` : t)).join(" ");
      lines.push(`Dialogue: 0,${assTime(from)},${assTime(to)},Caption,,0,0,0,,${text}`);
    });
  }
  return `${header(style, width, height)}\n${lines.join("\n")}\n`;
}
