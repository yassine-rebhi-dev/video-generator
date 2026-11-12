import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAss, DEFAULT_CAPTION_STYLE } from "../src/captions/ass.js";
import { buildPages } from "../src/captions/paging.js";
import { probe, run } from "../src/core/exec.js";
import { buildFinalRender, buildTimeline, clipLength, MAX_SLOWDOWN, normalizeClipArgs, planFit } from "../src/render/graph.js";

const OPTIONS = { width: 1080, height: 1920, fps: 30, gap: 0.2, tail: 0.5, crossfade: 0.2, minScene: 1.2 };
const scene = (audioDuration: number, i: number) => ({ audioDuration, audioPath: `a${i}.wav`, clipPath: `c${i}.mp4` });

describe("planFit", () => {
  it("leaves a long enough clip alone", () => {
    expect(planFit(5, 3)).toEqual({ speed: 1, hold: 0 });
  });
  it("slows a slightly short clip to fit exactly", () => {
    const plan = planFit(4, 5);
    expect(plan.speed).toBeCloseTo(1.25);
    expect(plan.hold).toBe(0);
  });
  it("caps the slowdown and holds the last frame for the rest", () => {
    const plan = planFit(2, 6);
    expect(plan.speed).toBe(MAX_SLOWDOWN);
    expect(plan.hold).toBeCloseTo(6 - 2 * MAX_SLOWDOWN);
  });
  it("rejects nonsense durations", () => {
    expect(() => planFit(0, 3)).toThrow();
  });
});

describe("buildTimeline", () => {
  const timeline = buildTimeline([scene(2, 0), scene(0.5, 1), scene(3, 2)], OPTIONS);
  it("lays scenes end to end with a gap, a minimum length and a tail", () => {
    expect(timeline.scenes.map((s) => [s.start, s.end])).toEqual([[0, 2.2], [2.2, 3.4], [3.4, 6.9]]);
    expect(timeline.duration).toBe(6.9);
  });
  it("makes every clip but the last longer by the crossfade", () => {
    expect(clipLength(timeline, 0)).toBeCloseTo(2.4);
    expect(clipLength(timeline, 2)).toBeCloseTo(3.5);
  });
  it("uses no crossfade for a single scene", () => {
    expect(buildTimeline([scene(2, 0)], OPTIONS).crossfade).toBe(0);
  });
});

describe("buildFinalRender", () => {
  const timeline = buildTimeline([scene(2, 0), scene(2, 1), scene(2, 2)], OPTIONS);
  const options = { captionsFile: "captions.ass", output: "final.mp4", musicVolume: 0.35, loudnessTarget: -14 };

  it("starts each crossfade where the next scene starts", () => {
    const { filterComplex } = buildFinalRender(timeline, ["n0.mp4", "n1.mp4", "n2.mp4"], options);
    expect(filterComplex).toContain("[0:v][1:v]xfade=transition=fade:duration=0.2:offset=2.2[x1]");
    expect(filterComplex).toContain("[x1][2:v]xfade=transition=fade:duration=0.2:offset=4.4[x2]");
    expect(filterComplex).toContain("[x2]ass=captions.ass");
  });
  it("pads each narration to its scene length and joins them", () => {
    const { filterComplex } = buildFinalRender(timeline, ["n0.mp4", "n1.mp4", "n2.mp4"], options);
    expect(filterComplex).toContain("[3:a]aresample=48000,aformat=channel_layouts=mono,apad=whole_dur=2.2,atrim=0:2.2");
    expect(filterComplex).toContain("[s0][s1][s2]concat=n=3:v=0:a=1[nar]");
    expect(filterComplex).not.toContain("sidechaincompress");
  });
  it("ducks music under the voice when a track is present", () => {
    const { filterComplex, args } = buildFinalRender({ ...timeline, musicPath: "/m/tense.mp3" }, ["n0.mp4", "n1.mp4", "n2.mp4"], options);
    expect(filterComplex).toContain("[6:a]");
    expect(filterComplex).toContain("sidechaincompress");
    expect(args).toContain("/m/tense.mp3");
  });
  it("orders inputs as clips, then scene audio", () => {
    const { args } = buildFinalRender(timeline, ["n0.mp4", "n1.mp4", "n2.mp4"], options);
    const inputs = args.filter((_, i) => args[i - 1] === "-i");
    expect(inputs).toEqual(["n0.mp4", "n1.mp4", "n2.mp4", "a0.wav", "a1.wav", "a2.wav"]);
  });
  it("refuses a wrong clip count or an unsafe captions file name", () => {
    expect(() => buildFinalRender(timeline, ["n0.mp4"], options)).toThrow();
    expect(() => buildFinalRender(timeline, ["n0.mp4", "n1.mp4", "n2.mp4"], { ...options, captionsFile: "a:b.ass" })).toThrow();
  });
});

describe("ffmpeg composition (runs ffmpeg)", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "render-test-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("renders a short two-scene video with the planned size, length, codecs and audio", async () => {
    const size = { width: 270, height: 480, fps: 30 };
    const inputs = [];
    for (const [i, hz] of [440, 660].entries()) {
      await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=1.0`, path.join(dir, `a${i}.wav`)]);
      await run("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=160x120:r=24:d=0.8", "-pix_fmt", "yuv420p", path.join(dir, `c${i}.mp4`)]);
      inputs.push(scene(1.0, i));
    }
    const timeline = buildTimeline(inputs, { ...OPTIONS, ...size });
    const normalized = [];
    for (const s of timeline.scenes) {
      const out = `n${s.index}.mp4`;
      await run("ffmpeg", normalizeClipArgs(s.clipPath, out, 0.8, clipLength(timeline, s.index), size), { cwd: dir });
      const info = await probe("ffprobe", path.join(dir, out));
      expect(info.width).toBe(270);
      expect(info.height).toBe(480);
      expect(info.duration).toBeCloseTo(clipLength(timeline, s.index), 1);
      normalized.push(out);
    }
    const pages = buildPages([
      { text: "Hello", sceneIndex: 0, start: 0, end: 0.5 },
      { text: "world", sceneIndex: 1, start: 1.3, end: 1.8 },
    ]);
    await writeFile(path.join(dir, "captions.ass"), buildAss(pages, { ...DEFAULT_CAPTION_STYLE, font: "DejaVu Sans" }, size.width, size.height));
    const render = buildFinalRender(timeline, normalized, { captionsFile: "captions.ass", output: "final.mp4", musicVolume: 0.3, loudnessTarget: -14 });
    await run("ffmpeg", render.args, { cwd: dir });

    const info = await probe("ffprobe", path.join(dir, "final.mp4"));
    expect(info).toMatchObject({ width: 270, height: 480, videoCodec: "h264", audioCodec: "aac", pixFmt: "yuv420p", hasAudio: true });
    expect(info.fps).toBeCloseTo(30, 1);
    expect(Math.abs(info.duration - timeline.duration)).toBeLessThan(0.15);
  });
});
