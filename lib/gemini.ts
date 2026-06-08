// Minimal Gemini REST client — adapted from the production Varenyam LMS.
// Calls generateContent with retry on transient 5xx and returns the raw text.

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

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 60_000;
const ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

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
}

export async function geminiGenerateJson(
  prompt: string,
  opts: { temperature?: number; timeoutMs?: number; model?: string } = {}
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "NO_KEY",
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const model = opts.model ?? DEFAULT_MODEL;
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

  const url = `${ENDPOINT_BASE}/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const TRANSIENT = new Set([502, 503, 504]);
  const BACKOFF_MS = [1500, 3000];

  let res: Response | null = null;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as { name?: string })?.name === "AbortError") {
        throw new GeminiError("TIMEOUT", `Gemini timed out after ${timeoutMs}ms`);
      }
      throw new GeminiError("NETWORK", `Gemini network error: ${(err as Error).message}`);
    }
    clearTimeout(timer);
    if (!TRANSIENT.has(res.status)) break;
    const backoff = BACKOFF_MS[attempt];
    if (backoff === undefined) break;
    await new Promise((r) => setTimeout(r, backoff));
  }
  if (!res) throw new GeminiError("NETWORK", "Gemini request failed without a response");

  if (res.status === 401 || res.status === 403)
    throw new GeminiError("AUTH_FAIL", `Gemini auth failed (HTTP ${res.status})`, res.status);
  if (res.status === 429)
    throw new GeminiError("RATE_LIMIT", "Gemini rate limit exceeded", res.status);
  if (!res.ok) {
    let detail = "";
    try {
      const errBody = (await res.json()) as GeminiRestResponse;
      detail = errBody.error?.message ?? "";
    } catch {
      /* body wasn't JSON */
    }
    throw new GeminiError(
      "BAD_RESPONSE",
      `Gemini returned HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
      res.status
    );
  }

  let payload: GeminiRestResponse;
  try {
    payload = (await res.json()) as GeminiRestResponse;
  } catch {
    throw new GeminiError("BAD_RESPONSE", "Gemini response was not valid JSON");
  }

  const text = payload.candidates?.[0]?.content?.parts?.find(
    (p) => typeof p.text === "string"
  )?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new GeminiError(
      "BAD_RESPONSE",
      `Gemini response missing text${
        payload.candidates?.[0]?.finishReason
          ? ` (finishReason: ${payload.candidates[0].finishReason})`
          : ""
      }`
    );
  }

  return { text, totalTokens: payload.usageMetadata?.totalTokenCount ?? 0 };
}
