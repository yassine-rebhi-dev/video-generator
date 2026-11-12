import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WordRecognizer } from "../align/recognizer.js";
import { alignScene, proportionalTimings } from "../align/words.js";
import { buildAss } from "../captions/ass.js";
import { buildPages } from "../captions/paging.js";
import type { AppConfig } from "../config/env.js";
import { probe, run } from "../core/exec.js";
import type { GenerateRequest, Timeline, WordTiming } from "../core/types.js";
import type { LlmProvider } from "../llm/llm.js";
import { inspect, type QaReport } from "../qa/qa.js";
import { buildFinalRender, buildTimeline, clipLength, normalizeClipArgs } from "../render/graph.js";
import { clipPrompt, wordCount, WORDS_PER_SECOND, type Storyboard } from "../storyboard/schema.js";
import { StoryboardService, type StoryboardResult } from "../storyboard/storyboard.service.js";
import { generateClips, PlaceholderVideoProvider, type VideoProvider } from "../visuals/video.js";
import { speakScenes, type SceneAudio, type TtsProvider } from "../voice/voice.js";
import { loadStyle } from "./styles.js";

export interface Providers {
  llm: LlmProvider;
  tts: TtsProvider;
  video: VideoProvider;
  /** Absent means captions are timed proportionally. */
  recognizer?: WordRecognizer;
}

export const STAGES = ["storyboard", "voice+video", "align", "captions", "render", "qa"] as const;
export type Stage = (typeof STAGES)[number];

export interface JobResult {
  jobId: string;
  dir: string;
  file: string;
  duration: number;
  qa: QaReport;
  /** Seconds spent in each stage; 0 for stages restored from disk. */
  timings: Record<string, number>;
  alignment: { recognizedScenes: number; scenes: number; meanMatched: number };
  fallbackClips: number;
  storyProblems: string[];
}

interface ClipRecord {
  index: number;
  file: string;
  fallback: boolean;
  error?: string;
}

const exists = (file: string) => access(file).then(() => true, () => false);
const pad = (n: number) => String(n + 1).padStart(2, "0");

export class Pipeline {
  constructor(private readonly config: AppConfig, private readonly providers: Providers) {}

  jobDir(jobId: string): string {
    return path.resolve(this.config.OUTPUT_DIR, jobId);
  }

  /** Runs a job. Calling it again with the same id continues from the files already on disk. */
  async run(jobId: string, request: GenerateRequest, onStage: (stage: Stage) => void = () => {}): Promise<JobResult> {
    const dir = this.jobDir(jobId);
    await mkdir(dir, { recursive: true });
    const tools = { ffmpeg: this.config.FFMPEG_PATH, ffprobe: this.config.FFPROBE_PATH };
    const timings: Record<string, number> = {};
    const timed = async <T>(stage: Stage, work: () => Promise<T>): Promise<T> => {
      onStage(stage);
      const started = Date.now();
      const value = await work();
      timings[stage] = Number(((Date.now() - started) / 1000).toFixed(1));
      return value;
    };
    /** Returns the saved JSON artifact, or computes and saves it. */
    const artifact = async <T>(name: string, compute: () => Promise<T>): Promise<T> => {
      const file = path.join(dir, name);
      if (await exists(file)) return JSON.parse(await readFile(file, "utf8")) as T;
      const value = await compute();
      await writeFile(file, JSON.stringify(value, null, 2));
      return value;
    };

    await writeFile(path.join(dir, "request.json"), JSON.stringify(request, null, 2));
    const style = await loadStyle(request.style, this.config.CAPTION_FONT);

    const story = await timed("storyboard", () =>
      artifact<StoryboardResult>("storyboard.json", () =>
        new StoryboardService(this.providers.llm).write(request, style.notes),
      ),
    );
    const storyboard: Storyboard = story.storyboard;
    const scenes = storyboard.scenes;

    const [audio, clips] = await timed("voice+video", () =>
      Promise.all([
        artifact<Array<{ file: string; duration: number }>>("voice.json", async () => {
          const spoken = await speakScenes(
            this.providers.tts,
            scenes.map((s) => s.narration),
            path.join(dir, "audio"),
            tools,
            request.voice ?? style.voice,
          );
          return spoken.map((s: SceneAudio) => ({ file: path.relative(dir, s.path), duration: s.duration }));
        }),
        artifact<ClipRecord[]>("clips.json", async () => {
          const requests = scenes.map((scene, index) => ({
            index,
            prompt: clipPrompt(storyboard, scene),
            seconds: wordCount(scene.narration) / WORDS_PER_SECOND + 0.6,
            outPath: path.join(dir, "clips", `scene-${pad(index)}.mp4`),
          }));
          await mkdir(path.join(dir, "clips"), { recursive: true });
          const made = await generateClips(
            this.providers.video,
            new PlaceholderVideoProvider(tools.ffmpeg, false),
            requests,
          );
          return made.map((c) => ({ index: c.index, file: path.relative(dir, c.path), fallback: c.fallback, error: c.error }));
        }),
      ]),
    );

    const timeline: Timeline = buildTimeline(
      scenes.map((_, i) => ({
        audioDuration: audio[i]!.duration,
        audioPath: audio[i]!.file,
        clipPath: clips.find((c) => c.index === i)!.file,
      })),
      { width: this.config.VIDEO_WIDTH, height: this.config.VIDEO_HEIGHT, fps: this.config.VIDEO_FPS, gap: 0.18, tail: 0.6, crossfade: 0.2, minScene: 1.2 },
    );
    timeline.musicPath = await this.pickMusic(storyboard.musicMood);
    await writeFile(path.join(dir, "timeline.json"), JSON.stringify(timeline, null, 2));

    const aligned = await timed("align", () =>
      artifact<{ words: WordTiming[]; matched: number[]; methods: string[] }>("words.json", async () => {
        const words: WordTiming[] = [];
        const matched: number[] = [];
        const methods: string[] = [];
        for (const scene of timeline.scenes) {
          const text = scenes[scene.index]!.narration;
          const speechEnd = scene.start + scene.audioDuration;
          let result = { words: proportionalTimings(text, scene.index, scene.start, speechEnd), matched: 0, method: "proportional" as string };
          if (this.providers.recognizer) {
            try {
              const heard = await this.providers.recognizer.recognize(path.join(dir, scene.audioPath));
              result = alignScene(text, scene.index, scene.start, speechEnd,
                heard.map((h) => ({ ...h, start: h.start + scene.start, end: h.end + scene.start })));
            } catch (error) {
              methods.push(`scene ${scene.index + 1} recogniser error: ${String(error).slice(0, 120)}`);
            }
          }
          words.push(...result.words);
          matched.push(Number(result.matched.toFixed(3)));
          methods.push(result.method);
        }
        return { words, matched, methods };
      }),
    );

    await timed("captions", async () => {
      const pages = buildPages(aligned.words);
      await writeFile(path.join(dir, "captions.ass"), buildAss(pages, style.caption, timeline.width, timeline.height));
    });

    const output = path.join(dir, "final.mp4");
    await timed("render", async () => {
      await mkdir(path.join(dir, "norm"), { recursive: true });
      const normalized: string[] = [];
      for (const scene of timeline.scenes) {
        const target = clipLength(timeline, scene.index);
        const out = path.join("norm", `scene-${pad(scene.index)}.mp4`);
        normalized.push(out);
        const source = await probe(tools.ffprobe, path.join(dir, scene.clipPath));
        await run(tools.ffmpeg, normalizeClipArgs(scene.clipPath, out, source.duration, target, timeline), { cwd: dir });
      }
      const render = buildFinalRender(timeline, normalized, {
        captionsFile: "captions.ass", output: "final.mp4", musicVolume: 0.35, loudnessTarget: -14,
      });
      await run(tools.ffmpeg, render.args, { cwd: dir });
    });

    const qa = await timed("qa", () => inspect(output, timeline, aligned.words, path.join(dir, "frames"), tools));
    await writeFile(path.join(dir, "qa.json"), JSON.stringify(qa, null, 2));
    await writeFile(
      path.join(dir, "metadata.json"),
      JSON.stringify(
        {
          title: storyboard.title,
          description: storyboard.description,
          hashtags: storyboard.hashtags,
          uploadNote: "This video uses AI-generated visuals and an AI voice. Turn on the AI-content label when uploading to Instagram and YouTube.",
        },
        null,
        2,
      ),
    );

    const recognizedScenes = aligned.methods.filter((m) => m === "recognized").length;
    return {
      jobId,
      dir,
      file: output,
      duration: timeline.duration,
      qa,
      timings,
      alignment: {
        recognizedScenes,
        scenes: scenes.length,
        meanMatched: aligned.matched.reduce((a, b) => a + b, 0) / Math.max(1, aligned.matched.length),
      },
      fallbackClips: clips.filter((c) => c.fallback).length,
      storyProblems: story.remainingProblems,
    };
  }

  /** Picks a track whose file name contains the mood, else any track, else none. */
  private async pickMusic(mood: string): Promise<string | undefined> {
    const dir = path.resolve(this.config.MUSIC_DIR);
    const files = (await readdir(dir).catch(() => [] as string[]))
      .filter((f) => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f))
      .sort();
    if (files.length === 0) return undefined;
    const wanted = mood.toLowerCase().split(/\s+/)[0] ?? "";
    const match = files.find((f) => wanted && f.toLowerCase().includes(wanted)) ?? files[0]!;
    return path.join(dir, match);
  }
}
