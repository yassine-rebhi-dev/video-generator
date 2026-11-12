import { describe, expect, it } from "vitest";
import { isQuotaError, textToVideoPayload } from "../src/visuals/hf-space.js";

const options = { space: "x/y", width: 480, height: 832, negativePrompt: "blurry" };

describe("textToVideoPayload", () => {
  it("asks for a vertical text-to-video clip with the scene prompt", () => {
    const payload = textToVideoPayload({ index: 0, prompt: "a lighthouse", seconds: 4.26, outPath: "o.mp4" }, options);
    expect(payload).toMatchObject({ prompt: "a lighthouse", mode: "text-to-video", width_ui: 480, height_ui: 832, duration_ui: 4.3, input_image_filepath: null });
  });
  it("keeps the requested length inside what the Space accepts", () => {
    expect(textToVideoPayload({ index: 0, prompt: "p", seconds: 0.5, outPath: "o" }, options)["duration_ui"]).toBe(2);
    expect(textToVideoPayload({ index: 0, prompt: "p", seconds: 30, outPath: "o" }, options)["duration_ui"]).toBe(8);
  });
});

describe("isQuotaError", () => {
  it("recognises the Space's quota refusal", () => {
    expect(isQuotaError({ title: "ZeroGPU quota exceeded", message: "You have exceeded your ZeroGPU quota (120s requested vs. -60s left)." })).toBe(true);
    expect(isQuotaError(new Error("connection reset"))).toBe(false);
  });
});
