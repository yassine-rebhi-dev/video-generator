import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/** Runs a binary without a shell. Rejects with the tail of stderr on a non-zero exit. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const tail = String(stderr).split("\n").slice(-12).join("\n");
          reject(new Error(`${cmd} failed: ${error.message}\n${tail}`));
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

export interface MediaInfo {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  videoCodec?: string;
  audioCodec?: string;
  pixFmt?: string;
}

function parseRate(rate: string | undefined): number | undefined {
  if (!rate) return undefined;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return undefined;
  return num / den;
}

export async function probe(ffprobe: string, file: string): Promise<MediaInfo> {
  const { stdout } = await run(ffprobe, [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<Record<string, string | number | undefined>>;
  };
  const video = data.streams?.find((s) => s["codec_type"] === "video");
  const audio = data.streams?.find((s) => s["codec_type"] === "audio");
  return {
    duration: Number(data.format?.duration ?? 0),
    width: video ? Number(video["width"]) : undefined,
    height: video ? Number(video["height"]) : undefined,
    fps: parseRate(video?.["avg_frame_rate"] as string | undefined),
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video),
    videoCodec: video?.["codec_name"] as string | undefined,
    audioCodec: audio?.["codec_name"] as string | undefined,
    pixFmt: video?.["pix_fmt"] as string | undefined,
  };
}
