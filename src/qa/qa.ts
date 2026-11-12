import { mkdir } from "node:fs/promises";
import path from "node:path";
import { probe, run } from "../core/exec.js";
import type { Timeline, WordTiming } from "../core/types.js";

export interface QaCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface QaReport {
  pass: boolean;
  checks: QaCheck[];
  frames: string[];
}

/** Integrated loudness of a file in LUFS, measured by ffmpeg's EBU R128 meter. */
export async function measureLoudness(ffmpeg: string, file: string): Promise<number | undefined> {
  const { stderr } = await run(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128", "-f", "null", "-"]);
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const match = summary.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
  return match ? Number(match[1]) : undefined;
}

/** Checks the finished file against the output spec and saves one frame per scene for inspection. */
export async function inspect(
  file: string,
  timeline: Timeline,
  words: WordTiming[],
  framesDir: string,
  tools: { ffmpeg: string; ffprobe: string },
  limits = { minSec: 15, maxSec: 60 },
): Promise<QaReport> {
  const info = await probe(tools.ffprobe, file);
  const loudness = await measureLoudness(tools.ffmpeg, file);
  const firstWord = words[0]?.start ?? Infinity;
  const checks: QaCheck[] = [
    { name: "resolution", pass: info.width === timeline.width && info.height === timeline.height, detail: `${info.width}x${info.height}` },
    { name: "frame rate", pass: Math.abs((info.fps ?? 0) - timeline.fps) < 0.01, detail: `${info.fps?.toFixed(2)} fps` },
    { name: "codecs", pass: info.videoCodec === "h264" && info.audioCodec === "aac" && info.pixFmt === "yuv420p", detail: `${info.videoCodec}/${info.pixFmt}/${info.audioCodec}` },
    { name: "duration matches timeline", pass: Math.abs(info.duration - timeline.duration) < 0.15, detail: `${info.duration.toFixed(2)} s vs ${timeline.duration.toFixed(2)} s planned` },
    { name: "duration in range", pass: info.duration >= limits.minSec && info.duration <= limits.maxSec, detail: `${info.duration.toFixed(1)} s (allowed ${limits.minSec}-${limits.maxSec})` },
    { name: "hook starts at once", pass: firstWord <= 0.3, detail: `first caption at ${Number.isFinite(firstWord) ? firstWord.toFixed(2) : "never"} s` },
    { name: "loudness", pass: loudness !== undefined && loudness > -17 && loudness < -11, detail: loudness === undefined ? "not measured" : `${loudness.toFixed(1)} LUFS (target -14)` },
  ];

  await mkdir(framesDir, { recursive: true });
  const frames: string[] = [];
  for (const scene of timeline.scenes) {
    const at = (scene.start + scene.end) / 2;
    const out = path.join(framesDir, `scene-${String(scene.index + 1).padStart(2, "0")}.jpg`);
    await run(tools.ffmpeg, ["-y", "-v", "error", "-ss", at.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", out]);
    frames.push(out);
  }
  return { pass: checks.every((c) => c.pass), checks, frames };
}
