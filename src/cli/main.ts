#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ConfigError, loadConfig } from "../config/env.js";
import type { GenerateRequest } from "../core/types.js";
import { createPipeline } from "../pipeline/factory.js";
import type { JobResult } from "../pipeline/pipeline.js";

function newJobId(topic: string): string {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `${stamp}-${slug || "video"}`;
}

function report(result: JobResult): void {
  console.log(`\nVideo: ${result.file}`);
  console.log(`Length: ${result.duration.toFixed(1)} s`);
  console.log(`Stage times (s): ${Object.entries(result.timings).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(
    `Captions: ${result.alignment.recognizedScenes}/${result.alignment.scenes} scenes timed from speech, ` +
      `${(result.alignment.meanMatched * 100).toFixed(0)}% of words matched`,
  );
  if (result.fallbackClips > 0) console.log(`Clips replaced by a placeholder: ${result.fallbackClips}`);
  for (const problem of result.storyProblems) console.log(`Story check not met: ${problem}`);
  for (const check of result.qa.checks) console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
  console.log(result.qa.pass ? "All output checks passed." : "Some output checks FAILED.");
}

const BENCHMARK: GenerateRequest[] = [
  { topic: "the lighthouse keeper who vanished in 1900", style: "dark-mystery", durationSec: 40 },
  { topic: "the librarian who hid a city's books from the fire", style: "historical", durationSec: 40 },
  { topic: "a bus driver who waited for the same passenger every day", style: "uplifting", durationSec: 30 },
];

async function main() {
  const program = new Command().name("story-shorts").description("Topic in, narrated vertical AI story short out.");

  program
    .command("generate")
    .requiredOption("--topic <text>", "what the story is about")
    .option("--style <name>", "a preset in styles/ or free text", "dark-mystery")
    .option("--duration <seconds>", "target length, 15 to 60", "40")
    .option("--voice <id>", "voice id for the speech provider")
    .action(async (options: { topic: string; style: string; duration: string; voice?: string }) => {
      const durationSec = Number(options.duration);
      if (!Number.isFinite(durationSec) || durationSec < 15 || durationSec > 60) {
        throw new Error("--duration must be a number from 15 to 60");
      }
      const pipeline = createPipeline(loadConfig());
      const jobId = newJobId(options.topic);
      console.log(`Job ${jobId}`);
      report(await pipeline.run(jobId, { topic: options.topic, style: options.style, durationSec, voice: options.voice }, (s) => console.log(`- ${s}`)));
    });

  program
    .command("resume <jobId>")
    .description("continue a job from the files it already produced")
    .action(async (jobId: string) => {
      const config = loadConfig();
      const pipeline = createPipeline(config);
      const request = JSON.parse(await readFile(path.join(pipeline.jobDir(jobId), "request.json"), "utf8")) as GenerateRequest;
      report(await pipeline.run(jobId, request, (s) => console.log(`- ${s}`)));
    });

  program
    .command("benchmark")
    .description("render three sample videos and print a comparison table")
    .action(async () => {
      const pipeline = createPipeline(loadConfig());
      const rows: Array<Record<string, string | number>> = [];
      for (const [i, request] of BENCHMARK.entries()) {
        const started = Date.now();
        const result = await pipeline.run(`benchmark-${i + 1}`, request, (s) => console.log(`[${i + 1}] ${s}`));
        rows.push({
          video: i + 1,
          style: request.style,
          "length s": Number(result.duration.toFixed(1)),
          "total s": Number(((Date.now() - started) / 1000).toFixed(1)),
          "render s": result.timings["render"] ?? 0,
          "words matched %": Math.round(result.alignment.meanMatched * 100),
          "fallback clips": result.fallbackClips,
          checks: result.qa.pass ? "pass" : "FAIL",
        });
      }
      console.table(rows);
    });

  await program.parseAsync();
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError || error instanceof Error ? error.message : error);
  process.exit(1);
});
