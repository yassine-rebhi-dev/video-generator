import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from "../captions/ass.js";

const styleSchema = z.object({
  name: z.string(),
  /** Guidance handed to the story writer. */
  notes: z.string(),
  voice: z.string().optional(),
  caption: z
    .object({ activeColor: z.string(), textColor: z.string(), fontSize: z.number() })
    .partial()
    .optional(),
});

export interface StylePreset {
  name: string;
  notes: string;
  voice?: string;
  caption: CaptionStyle;
}

/**
 * Loads `styles/<name>.json`. A style with no preset file is passed to the
 * writer as free text, so `--style "cosy fairy tale"` works without a file.
 */
export async function loadStyle(name: string, font: string, dir = "styles"): Promise<StylePreset> {
  const base: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, font };
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  let raw: string;
  try {
    raw = await readFile(path.join(dir, `${slug}.json`), "utf8");
  } catch {
    return { name, notes: "", caption: base };
  }
  const preset = styleSchema.parse(JSON.parse(raw));
  return { name: preset.name, notes: preset.notes, voice: preset.voice, caption: { ...base, ...preset.caption } };
}
