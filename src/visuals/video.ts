import { mkdir } from "node:fs/promises";
import path from "node:path";
import { run } from "../core/exec.js";

export interface ClipRequest {
  index: number;
  /** Full self-contained description of the shot. */
  prompt: string;
  /** Minimum useful length; providers may return a shorter clip, which is then slowed or held. */
  seconds: number;
  outPath: string;
}

export interface ClipResult {
  index: number;
  /** Path of the generated clip, or undefined when generation failed. */
  path?: string;
  error?: string;
}

/** Generates one short video clip per scene. */
export interface VideoProvider {
  readonly name: string;
  generate(requests: ClipRequest[]): Promise<ClipResult[]>;
}

export const VIDEO = Symbol("VideoProvider");

const PALETTES: Array<[string, string]> = [
  ["0x0b1d2a", "0x1f6f78"], ["0x1a1033", "0x7a3b69"], ["0x101820", "0xb8742a"],
  ["0x0d2b1d", "0x3f7d58"], ["0x2a0f0f", "0x8c3b2e"], ["0x111133", "0x3b5ba5"],
];

/**
 * Draws a moving colour gradient with the scene number. It contains no AI and
 * exists so that everything around video generation can be built and tested,
 * and so a failed clip never stops a video from finishing.
 */
export class PlaceholderVideoProvider implements VideoProvider {
  readonly name = "placeholder";
  constructor(private readonly ffmpeg: string, private readonly label = true) {}

  async generate(requests: ClipRequest[]): Promise<ClipResult[]> {
    const results: ClipResult[] = [];
    for (const request of requests) {
      try {
        await this.draw(request);
        results.push({ index: request.index, path: request.outPath });
      } catch (error) {
        results.push({ index: request.index, error: String(error) });
      }
    }
    return results;
  }

  async draw(request: ClipRequest): Promise<void> {
    await mkdir(path.dirname(request.outPath), { recursive: true });
    const [c0, c1] = PALETTES[request.index % PALETTES.length]!;
    const seconds = Math.max(1, request.seconds).toFixed(2);
    const source = `gradients=s=480x832:c0=${c0}:c1=${c1}:x0=0:y0=0:x1=480:y1=832:speed=0.02:r=24:d=${seconds}`;
    const text = `drawtext=text='SCENE ${request.index + 1}':fontcolor=white@0.55:fontsize=44:x=(w-tw)/2:y=h*0.28`;
    await run(this.ffmpeg, [
      "-y", "-v", "error", "-f", "lavfi", "-i", source,
      ...(this.label ? ["-vf", text] : []),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", request.outPath,
    ]);
  }
}

/**
 * Asks the provider for every clip, then fills any gap with a plain placeholder
 * so the caller always gets one usable file per scene.
 */
export async function generateClips(
  provider: VideoProvider,
  fallback: PlaceholderVideoProvider,
  requests: ClipRequest[],
): Promise<Array<ClipResult & { path: string; fallback: boolean }>> {
  const results = await provider.generate(requests).catch((error: unknown) =>
    requests.map((r): ClipResult => ({ index: r.index, error: String(error) })),
  );
  const out: Array<ClipResult & { path: string; fallback: boolean }> = [];
  for (const request of requests) {
    const result = results.find((r) => r.index === request.index);
    if (result?.path) {
      out.push({ ...result, path: result.path, fallback: false });
      continue;
    }
    await fallback.draw(request);
    out.push({ index: request.index, path: request.outPath, error: result?.error ?? "no result", fallback: true });
  }
  return out;
}
