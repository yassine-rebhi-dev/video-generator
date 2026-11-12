export interface LlmRequest {
  system: string;
  user: string;
}

/** A text model that is asked for a single JSON object. */
export interface LlmProvider {
  readonly name: string;
  /** Returns the raw text of the model's reply. */
  complete(request: LlmRequest): Promise<string>;
}

export const LLM = Symbol("LlmProvider");

/** Pulls the first JSON object out of a reply that may be wrapped in a code fence. */
export function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1]! : reply).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Reply contains no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LLM request failed with ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async complete(request: LlmRequest): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const data = (await postJson(url, { "x-goog-api-key": this.apiKey }, {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 1 },
    })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error(`Gemini returned no text (finish reason: ${candidate?.finishReason ?? "unknown"})`);
    return text;
  }
}

/** Works with any endpoint that speaks the OpenAI chat-completions format (Groq, OpenRouter, Ollama). */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name = "openai";
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly model: string) {}

  async complete(request: LlmRequest): Promise<string> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const data = (await postJson(url, { authorization: `Bearer ${this.apiKey}` }, {
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
    })) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("The model returned no text");
    return text;
  }
}
