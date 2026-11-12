import { spawn } from "node:child_process";
import type { RecognizedWord } from "./words.js";

/** Hears words in a speech file and reports when each was spoken (seconds from file start). */
export interface WordRecognizer {
  readonly name: string;
  recognize(audioPath: string): Promise<RecognizedWord[]>;
}

export const RECOGNIZER = Symbol("WordRecognizer");

/** Decodes any audio file to 16 kHz mono float samples, which is what Whisper expects. */
function decode(ffmpeg: string, file: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-v", "error", "-i", file, "-ar", "16000", "-ac", "1", "-f", "f32le", "pipe:1"]);
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed: ${stderr.slice(-300)}`));
      const buffer = Buffer.concat(chunks);
      const samples = new Float32Array(buffer.length / 4);
      for (let i = 0; i < samples.length; i++) samples[i] = buffer.readFloatLE(i * 4);
      resolve(samples);
    });
  });
}

type AsrPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

/** Whisper running in-process on CPU through transformers.js, with word-level timestamps. */
export class WhisperRecognizer implements WordRecognizer {
  readonly name = "whisper";
  private pipe?: Promise<AsrPipeline>;

  constructor(private readonly modelId: string, private readonly ffmpeg: string) {}

  private load(): Promise<AsrPipeline> {
    this.pipe ??= (async () => {
      const { pipeline } = (await import("@huggingface/transformers")) as unknown as {
        pipeline(task: string, model: string, options: Record<string, unknown>): Promise<AsrPipeline>;
      };
      return pipeline("automatic-speech-recognition", this.modelId, { dtype: "q8", device: "cpu" });
    })();
    return this.pipe;
  }

  async recognize(audioPath: string): Promise<RecognizedWord[]> {
    const [pipe, samples] = await Promise.all([this.load(), decode(this.ffmpeg, audioPath)]);
    const multilingual = !/\.en(_|$)/.test(this.modelId);
    const output = await pipe(samples, {
      return_timestamps: "word",
      chunk_length_s: 30,
      ...(multilingual ? { language: "english", task: "transcribe" } : {}),
    });
    const length = samples.length / 16000;
    return (output.chunks ?? [])
      .map((chunk) => ({
        text: chunk.text.trim(),
        start: chunk.timestamp[0],
        end: chunk.timestamp[1] ?? length,
      }))
      .filter((w) => w.text.length > 0);
  }
}
