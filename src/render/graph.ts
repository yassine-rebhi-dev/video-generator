import type { Timeline } from "../core/types.js";

export interface FitPlan {
  /** Multiplier applied to presentation timestamps (1 = unchanged, 1.5 = half slower). */
  speed: number;
  /** Seconds of the last frame to hold after the stretched clip ends. */
  hold: number;
}

/** Clips are slowed by at most this factor before the last frame is held instead. */
export const MAX_SLOWDOWN = 1.6;

/** Decides how a source clip is made to last exactly `target` seconds. */
export function planFit(sourceDuration: number, target: number): FitPlan {
  if (!(sourceDuration > 0) || !(target > 0)) throw new Error("Durations must be positive");
  if (sourceDuration >= target) return { speed: 1, hold: 0 };
  const speed = Math.min(target / sourceDuration, MAX_SLOWDOWN);
  const hold = Math.max(0, target - sourceDuration * speed);
  return { speed, hold };
}

const f = (n: number) => Number(n.toFixed(3)).toString();

/** ffmpeg arguments that turn any clip into a silent, exact-length, full-canvas clip. */
export function normalizeClipArgs(
  input: string,
  output: string,
  sourceDuration: number,
  target: number,
  size: { width: number; height: number; fps: number },
): string[] {
  const plan = planFit(sourceDuration, target);
  const filters = [
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${size.width}:${size.height}`,
    "setsar=1",
  ];
  if (plan.speed !== 1) filters.push(`setpts=${f(plan.speed)}*PTS`);
  filters.push(`fps=${size.fps}`);
  if (plan.hold > 0) filters.push(`tpad=stop_mode=clone:stop_duration=${f(plan.hold + 0.1)}`);
  return [
    "-y", "-v", "error", "-i", input, "-an",
    "-vf", filters.join(","),
    "-t", f(target),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p",
    output,
  ];
}

/** Length each normalised clip must have: its scene plus the overlap into the next. */
export function clipLength(timeline: Timeline, index: number): number {
  const scene = timeline.scenes[index]!;
  const isLast = index === timeline.scenes.length - 1;
  return scene.end - scene.start + (isLast ? 0 : timeline.crossfade);
}

export interface FinalRender {
  args: string[];
  filterComplex: string;
}

export interface FinalOptions {
  captionsFile: string;
  output: string;
  musicVolume: number;
  loudnessTarget: number;
}

/**
 * Builds the single ffmpeg call that joins the scene clips with crossfades,
 * burns the captions, lays narration over ducked music and encodes the result.
 * Inputs are ordered: clips, then scene audio files, then music if present.
 * `captionsFile` must be a plain relative name; ffmpeg runs in its directory.
 */
export function buildFinalRender(timeline: Timeline, clips: string[], options: FinalOptions): FinalRender {
  const n = timeline.scenes.length;
  if (n === 0) throw new Error("Timeline has no scenes");
  if (clips.length !== n) throw new Error("One clip per scene is required");
  if (/[:'\\,\[\];]/.test(options.captionsFile)) throw new Error("Captions file name must be plain");

  const parts: string[] = [];
  let video = "0:v";
  for (let i = 1; i < n; i++) {
    const out = `x${i}`;
    if (timeline.crossfade > 0) {
      const offset = timeline.scenes[i]!.start;
      parts.push(`[${video}][${i}:v]xfade=transition=fade:duration=${f(timeline.crossfade)}:offset=${f(offset)}[${out}]`);
    } else {
      parts.push(`[${video}][${i}:v]concat=n=2:v=1:a=0[${out}]`);
    }
    video = out;
  }
  parts.push(`[${video}]ass=${options.captionsFile},format=yuv420p[vout]`);

  const voices: string[] = [];
  timeline.scenes.forEach((scene, i) => {
    const length = scene.end - scene.start;
    parts.push(
      `[${n + i}:a]aresample=48000,aformat=channel_layouts=mono,apad=whole_dur=${f(length)},atrim=0:${f(length)},asetpts=PTS-STARTPTS[s${i}]`,
    );
    voices.push(`[s${i}]`);
  });
  parts.push(`${voices.join("")}concat=n=${n}:v=0:a=1[nar]`);

  const loud = `loudnorm=I=${options.loudnessTarget}:TP=-1.5:LRA=11,aresample=48000`;
  if (timeline.musicPath) {
    const fadeStart = Math.max(0, timeline.duration - 1.5);
    parts.push(
      `[${2 * n}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${f(timeline.duration)},volume=${f(options.musicVolume)},afade=t=in:d=0.3,afade=t=out:st=${f(fadeStart)}:d=1.5[mus]`,
    );
    parts.push("[nar]asplit=2[nar1][nar2]");
    parts.push("[mus][nar2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck]");
    parts.push(`[nar1][duck]amix=inputs=2:normalize=0:duration=first,${loud}[aout]`);
  } else {
    parts.push(`[nar]${loud}[aout]`);
  }

  const filterComplex = parts.join(";");
  const args = ["-y", "-v", "error"];
  for (const clip of clips) args.push("-i", clip);
  for (const scene of timeline.scenes) args.push("-i", scene.audioPath);
  if (timeline.musicPath) args.push("-stream_loop", "-1", "-i", timeline.musicPath);
  args.push(
    "-filter_complex", filterComplex,
    "-map", "[vout]", "-map", "[aout]",
    "-t", f(timeline.duration),
    "-r", String(timeline.fps),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart",
    options.output,
  );
  return { args, filterComplex };
}

export interface TimelineInput {
  audioDuration: number;
  audioPath: string;
  clipPath: string;
}

export interface TimelineOptions {
  width: number;
  height: number;
  fps: number;
  /** Silence after each scene's narration. */
  gap: number;
  /** Extra hold after the final line. */
  tail: number;
  crossfade: number;
  minScene: number;
}

/** Lays scenes end to end. Each scene lasts as long as its narration plus a gap. */
export function buildTimeline(scenes: TimelineInput[], options: TimelineOptions): Timeline {
  let cursor = 0;
  const placed = scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const length = Math.max(options.minScene, scene.audioDuration + (isLast ? options.tail : options.gap));
    const start = cursor;
    cursor = Number((cursor + length).toFixed(3));
    return { index, start, end: cursor, ...scene };
  });
  const shortest = Math.min(...placed.map((s) => s.end - s.start));
  return {
    width: options.width,
    height: options.height,
    fps: options.fps,
    duration: cursor,
    crossfade: placed.length > 1 ? Math.min(options.crossfade, shortest / 2) : 0,
    scenes: placed,
  };
}
