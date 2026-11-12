import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClipRequest, ClipResult, VideoProvider } from "./video.js";

export interface HfSpaceOptions {
  /** Space id, e.g. "Lightricks/ltx-video-distilled". Its API must match that Space's /text_to_video. */
  space: string;
  token?: string;
  width: number;
  height: number;
  negativePrompt: string;
}

/** Longest clip the LTX Space accepts, in seconds. */
const MAX_SECONDS = 8;

/** The arguments of the LTX-Video Space's /text_to_video endpoint, as its API lists them. */
export function textToVideoPayload(request: ClipRequest, options: HfSpaceOptions): Record<string, unknown> {
  return {
    prompt: request.prompt,
    negative_prompt: options.negativePrompt,
    input_image_filepath: null,
    input_video_filepath: null,
    height_ui: options.height,
    width_ui: options.width,
    mode: "text-to-video",
    duration_ui: Number(Math.min(MAX_SECONDS, Math.max(2, request.seconds)).toFixed(1)),
    ui_frames_to_use: 9,
    seed_ui: 42,
    randomize_seed: true,
    ui_guidance_scale: 1,
    improve_texture_flag: true,
  };
}

export function isQuotaError(error: unknown): boolean {
  const text = `${(error as { title?: string })?.title ?? ""} ${(error as { message?: string })?.message ?? ""} ${String(error)}`;
  return /quota/i.test(text);
}

function describe(error: unknown): string {
  const e = error as { title?: string; message?: string };
  return [e?.title, e?.message].filter(Boolean).join(": ") || String(error);
}

interface GradioClient {
  predict(endpoint: string, payload: Record<string, unknown>): Promise<{ data: unknown[] }>;
}

/**
 * Generates clips by calling a public text-to-video Space on Hugging Face's
 * free shared GPU. The free daily allowance is small (this Space reserves 120
 * seconds per clip), so once the allowance runs out the remaining clips are
 * reported as failed at once rather than retried.
 */
export class HfSpaceVideoProvider implements VideoProvider {
  readonly name = "hf-space";
  private client?: Promise<GradioClient>;

  constructor(private readonly options: HfSpaceOptions) {}

  private connect(): Promise<GradioClient> {
    this.client ??= (async () => {
      const { Client } = (await import("@gradio/client")) as unknown as {
        Client: { connect(space: string, options: Record<string, unknown>): Promise<GradioClient> };
      };
      return Client.connect(this.options.space, this.options.token ? { token: this.options.token } : {});
    })();
    return this.client;
  }

  async generate(requests: ClipRequest[]): Promise<ClipResult[]> {
    const results: ClipResult[] = [];
    let outOfQuota: string | undefined;
    for (const request of requests) {
      if (outOfQuota) {
        results.push({ index: request.index, error: outOfQuota });
        continue;
      }
      try {
        const client = await this.connect();
        const reply = await client.predict("/text_to_video", textToVideoPayload(request, this.options));
        const first = reply.data[0] as { url?: string; video?: { url?: string } } | undefined;
        const url = first?.video?.url ?? first?.url;
        if (!url) throw new Error("The Space returned no video");
        const response = await fetch(url, {
          headers: this.options.token ? { authorization: `Bearer ${this.options.token}` } : {},
        });
        if (!response.ok) throw new Error(`Downloading the clip failed with ${response.status}`);
        await mkdir(path.dirname(request.outPath), { recursive: true });
        await writeFile(request.outPath, Buffer.from(await response.arrayBuffer()));
        results.push({ index: request.index, path: request.outPath });
      } catch (error) {
        const message = describe(error);
        if (isQuotaError(error)) outOfQuota = message;
        results.push({ index: request.index, error: message });
      }
    }
    return results;
  }
}
