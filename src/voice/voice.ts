import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { probe, run } from "../core/exec.js";

/** Turns one scene's narration into a speech file. */
export interface TtsProvider {
  readonly name: string;
  /** Writes speech for `text` to `outPath` (any format ffmpeg reads). */
  synthesize(text: string, outPath: string, voice?: string): Promise<void>;
}

export const TTS = Symbol("TtsProvider");

/** ffmpeg's built-in flite voice: robotic, but needs no download and no network. */
export class FliteProvider implements TtsProvider {
  readonly name = "flite";
  constructor(private readonly ffmpeg: string) {}

  async synthesize(text: string, outPath: string): Promise<void> {
    const textFile = `${outPath}.txt`;
    await writeFile(textFile, text.replace(/\s+/g, " ").trim());
    try {
      await run(this.ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", `flite=textfile=${path.basename(textFile)}:voice=slt`, path.basename(outPath)], {
        cwd: path.dirname(outPath),
      });
    } finally {
      await rm(textFile, { force: true });
    }
  }
}

interface KokoroAudio {
  save(path: string): Promise<void> | void;
}
interface KokoroModel {
  generate(text: string, options: { voice: string }): Promise<KokoroAudio>;
}

/** Kokoro-82M running in-process on CPU. The model downloads once into the cache. */
export class KokoroProvider implements TtsProvider {
  readonly name = "kokoro";
  private model?: Promise<KokoroModel>;

  constructor(
    private readonly modelId: string,
    private readonly dtype: string,
    private readonly defaultVoice: string,
  ) {}

  private load(): Promise<KokoroModel> {
    this.model ??= (async () => {
      const { KokoroTTS } = (await import("kokoro-js")) as unknown as {
        KokoroTTS: { from_pretrained(id: string, o: { dtype: string; device: string }): Promise<KokoroModel> };
      };
      return KokoroTTS.from_pretrained(this.modelId, { dtype: this.dtype, device: "cpu" });
    })();
    return this.model;
  }

  async synthesize(text: string, outPath: string, voice?: string): Promise<void> {
    const model = await this.load();
    const audio = await model.generate(text, { voice: voice ?? this.defaultVoice });
    await audio.save(outPath);
  }
}

export interface SceneAudio {
  path: string;
  duration: number;
}

const TRIM =
  "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03," +
  "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse";

/**
 * Speaks every scene and returns one trimmed 48 kHz mono WAV per scene with its
 * exact length. Silence at both ends is cut so scene timing follows the words.
 */
export async function speakScenes(
  provider: TtsProvider,
  narrations: string[],
  dir: string,
  tools: { ffmpeg: string; ffprobe: string },
  voice?: string,
): Promise<SceneAudio[]> {
  await mkdir(dir, { recursive: true });
  const results: SceneAudio[] = [];
  for (let i = 0; i < narrations.length; i++) {
    const id = String(i + 1).padStart(2, "0");
    const raw = path.join(dir, `scene-${id}.raw.wav`);
    const out = path.join(dir, `scene-${id}.wav`);
    await provider.synthesize(narrations[i]!, raw, voice);
    await run(tools.ffmpeg, ["-y", "-v", "error", "-i", raw, "-af", TRIM, "-ar", "48000", "-ac", "1", out]);
    await rm(raw, { force: true });
    const { duration } = await probe(tools.ffprobe, out);
    if (!(duration > 0.1)) throw new Error(`Scene ${i + 1} produced no speech`);
    results.push({ path: out, duration });
  }
  return results;
}
