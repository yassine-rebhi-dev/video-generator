import { WhisperRecognizer } from "../align/recognizer.js";
import type { AppConfig } from "../config/env.js";
import { FakeLlmProvider } from "../llm/fake.js";
import { GeminiProvider, OpenAiCompatibleProvider, type LlmProvider } from "../llm/llm.js";
import { HfSpaceVideoProvider } from "../visuals/hf-space.js";
import { PlaceholderVideoProvider, type VideoProvider } from "../visuals/video.js";
import { FliteProvider, KokoroProvider, type TtsProvider } from "../voice/voice.js";
import { Pipeline, type Providers } from "./pipeline.js";

function llm(config: AppConfig): LlmProvider {
  switch (config.LLM_PROVIDER) {
    case "gemini":
      return new GeminiProvider(config.GEMINI_API_KEY!, config.GEMINI_MODEL);
    case "openai":
      return new OpenAiCompatibleProvider(config.OPENAI_BASE_URL!, config.OPENAI_API_KEY!, config.OPENAI_MODEL!);
    case "fake":
      return new FakeLlmProvider();
  }
}

function tts(config: AppConfig): TtsProvider {
  return config.TTS_PROVIDER === "kokoro"
    ? new KokoroProvider(config.KOKORO_MODEL, config.KOKORO_DTYPE, config.KOKORO_VOICE)
    : new FliteProvider(config.FFMPEG_PATH);
}

function video(config: AppConfig): VideoProvider {
  if (config.VIDEO_PROVIDER === "placeholder") return new PlaceholderVideoProvider(config.FFMPEG_PATH);
  if (config.VIDEO_PROVIDER === "hf-space") {
    return new HfSpaceVideoProvider({
      space: config.HF_SPACE,
      token: config.HF_TOKEN,
      width: config.CLIP_WIDTH,
      height: config.CLIP_HEIGHT,
      negativePrompt: "worst quality, inconsistent motion, blurry, jittery, distorted, text, letters, watermark, logo",
    });
  }
  throw new Error(`VIDEO_PROVIDER=${config.VIDEO_PROVIDER} is not implemented yet; use "placeholder"`);
}

export function createProviders(config: AppConfig): Providers {
  return {
    llm: llm(config),
    tts: tts(config),
    video: video(config),
    recognizer: config.ALIGN_PROVIDER === "whisper" ? new WhisperRecognizer(config.WHISPER_MODEL, config.FFMPEG_PATH) : undefined,
  };
}

export function createPipeline(config: AppConfig): Pipeline {
  return new Pipeline(config, createProviders(config));
}
