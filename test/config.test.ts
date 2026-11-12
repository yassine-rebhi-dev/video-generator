import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("applies defaults when nothing but the required key is set", () => {
    const config = loadConfig({ GEMINI_API_KEY: "k" });
    expect(config).toMatchObject({ PORT: 3000, LLM_PROVIDER: "gemini", TTS_PROVIDER: "kokoro", VIDEO_WIDTH: 1080, VIDEO_HEIGHT: 1920, VIDEO_FPS: 30 });
  });
  it("requires the key that the chosen script provider needs", () => {
    expect(() => loadConfig({})).toThrow(/GEMINI_API_KEY/);
    expect(() => loadConfig({ LLM_PROVIDER: "openai" })).toThrow(/OPENAI_BASE_URL[\s\S]*OPENAI_API_KEY[\s\S]*OPENAI_MODEL/);
    expect(() => loadConfig({ LLM_PROVIDER: "fake" })).not.toThrow();
  });
  it("treats empty strings as unset", () => {
    expect(() => loadConfig({ GEMINI_API_KEY: "" })).toThrow(ConfigError);
    expect(loadConfig({ LLM_PROVIDER: "fake", PORT: "" }).PORT).toBe(3000);
  });
  it("coerces numbers and rejects bad values with the variable named", () => {
    expect(loadConfig({ LLM_PROVIDER: "fake", PORT: "8080" }).PORT).toBe(8080);
    expect(() => loadConfig({ LLM_PROVIDER: "fake", PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ LLM_PROVIDER: "fake", TTS_PROVIDER: "siri" })).toThrow(/TTS_PROVIDER/);
  });
  it("requires a token for the Hugging Face video provider", () => {
    expect(() => loadConfig({ LLM_PROVIDER: "fake", VIDEO_PROVIDER: "hf-space" })).toThrow(/HF_TOKEN/);
  });
});
