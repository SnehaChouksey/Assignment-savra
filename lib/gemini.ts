// Minimal Gemini REST client — adapted from the production Varenyam LMS.
// Tries a primary model and fails over to a lighter one when the primary is
// transiently overloaded (HTTP 503 "high demand"), with a quick retry on each.

export type GeminiErrorCode =
  | "NO_KEY"
  | "AUTH_FAIL"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "BAD_RESPONSE"
  | "NETWORK";

export class GeminiError extends Error {
  code: GeminiErrorCode;
  status?: number;
  constructor(code: GeminiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

// Ordered fallback chain. 2.5-flash is best at the double-escaped LaTeX JSON;
// 2.5-flash-lite is the failover when 2.5-flash is overloaded — it's lighter
// and rarely congested at the same moment.
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
const DEFAULT_TIMEOUT_MS = 55_000;
const ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

interface GeminiRestResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { totalTokenCount?: number };
  error?: { message?: string };
}

export interface GeminiResult {
  text: string;
  totalTokens: number;
  model: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geminiGenerateJson(
  prompt: string,
  opts: {
    temperature?: number;
    timeoutMs?: number;
    model?: string;
    models?: string[];
  } = {}
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "NO_KEY",
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const models = opts.models ?? (opts.model ? [opts.model] : DEFAULT_MODELS);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.35,
      responseMimeType: "application/json",
      // A full paper + answer key is a large JSON payload — give it room so it
      // never truncates mid-object (which surfaces as malformed JSON). Leaving
      // "thinking" on (default) is deliberate: it reliably double-escapes the
      // LaTeX backslashes, which thinking-off mode botches into invalid JSON.
      maxOutputTokens: 16384,
    },
  };
  const payloadStr = JSON.stringify(body);

  let lastErr: GeminiError | null = null;

  // Try each model in turn; a transiently-overloaded model fails over to the
  // next. Each model gets one quick in-place retry before failing over.
  for (const model of models) {
    const url = `${ENDPOINT_BASE}/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payloadStr,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if ((err as { name?: string })?.name === "AbortError") {
          throw new GeminiError("TIMEOUT", `Gemini timed out after ${timeoutMs}ms`);
        }
        lastErr = new GeminiError("NETWORK", `Gemini network error: ${(err as Error).message}`);
        break; // fail over to next model
      }
      clearTimeout(timer);

      // Hard auth failure — a different model won't help, surface immediately.
      if (res.status === 401 || res.status === 403) {
        throw new GeminiError("AUTH_FAIL", `Gemini auth failed (HTTP ${res.status})`, res.status);
      }

      if (TRANSIENT.has(res.status)) {
        let detail = "";
        try {
          detail = ((await res.json()) as GeminiRestResponse).error?.message ?? "";
        } catch {
          /* ignore */
        }
        lastErr = new GeminiError(
          res.status === 429 ? "RATE_LIMIT" : "BAD_RESPONSE",
          `Gemini ${model} HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
          res.status
        );
        // One quick retry on the same model (overload spikes are brief), then
        // fall through to the next model.
        if (attempt === 0 && res.status !== 429) {
          await sleep(1500);
          continue;
        }
        break;
      }

      if (!res.ok) {
        let detail = "";
        try {
          detail = ((await res.json()) as GeminiRestResponse).error?.message ?? "";
        } catch {
          /* ignore */
        }
        throw new GeminiError(
          "BAD_RESPONSE",
          `Gemini returned HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
          res.status
        );
      }

      let json: GeminiRestResponse;
      try {
        json = (await res.json()) as GeminiRestResponse;
      } catch {
        throw new GeminiError("BAD_RESPONSE", "Gemini response was not valid JSON");
      }

      const text = json.candidates?.[0]?.content?.parts?.find(
        (p) => typeof p.text === "string"
      )?.text;
      if (typeof text !== "string" || text.length === 0) {
        lastErr = new GeminiError(
          "BAD_RESPONSE",
          `Gemini ${model} returned no text${
            json.candidates?.[0]?.finishReason
              ? ` (finishReason: ${json.candidates[0].finishReason})`
              : ""
          }`
        );
        break; // fail over to next model
      }

      return { text, totalTokens: json.usageMetadata?.totalTokenCount ?? 0, model };
    }
  }

  throw lastErr ?? new GeminiError("BAD_RESPONSE", "All Gemini models failed");
}
