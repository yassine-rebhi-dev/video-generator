import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    OUTPUT_DIR: z.string().min(1).default("output"),
    FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    FFPROBE_PATH: z.string().min(1).default("ffprobe"),

    LLM_PROVIDER: z.enum(["gemini", "openai", "fake"]).default("gemini"),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-flash-latest"),
    OPENAI_BASE_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),

    TTS_PROVIDER: z.enum(["kokoro", "flite"]).default("kokoro"),
    KOKORO_MODEL: z.string().min(1).default("onnx-community/Kokoro-82M-v1.0-ONNX"),
    KOKORO_DTYPE: z.enum(["fp32", "fp16", "q8", "q4", "q4f16"]).default("q8"),
    KOKORO_VOICE: z.string().min(1).default("am_michael"),

    ALIGN_PROVIDER: z.enum(["whisper", "proportional"]).default("whisper"),
    WHISPER_MODEL: z.string().min(1).default("onnx-community/whisper-base_timestamped"),

    VIDEO_PROVIDER: z.enum(["placeholder", "hf-space", "kaggle"]).default("placeholder"),
    HF_TOKEN: z.string().optional(),

    MUSIC_DIR: z.string().min(1).default("assets/music"),
    CAPTION_FONT: z.string().min(1).default("Inter ExtraBold"),
    VIDEO_WIDTH: z.coerce.number().int().positive().default(1080),
    VIDEO_HEIGHT: z.coerce.number().int().positive().default(1920),
    VIDEO_FPS: z.coerce.number().int().min(24).max(60).default(30),
  })
  .superRefine((env, ctx) => {
    if (env.LLM_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["GEMINI_API_KEY"], message: "required when LLM_PROVIDER=gemini" });
    }
    if (env.LLM_PROVIDER === "openai") {
      for (const key of ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "required when LLM_PROVIDER=openai" });
      }
    }
    if (env.VIDEO_PROVIDER === "hf-space" && !env.HF_TOKEN) {
      ctx.addIssue({ code: "custom", path: ["HF_TOKEN"], message: "required when VIDEO_PROVIDER=hf-space" });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {}

/** Validates the environment once at start-up and fails with every problem listed. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n${lines.join("\n")}`);
  }
  return result.data;
}
