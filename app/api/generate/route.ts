import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateJson, GeminiError } from "@/lib/gemini";
import { buildPaperPrompt, parsePaper, type GenerateRequest } from "@/lib/paper";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brief = (body.brief ?? "").trim();
  if (brief.length < 4) {
    return NextResponse.json(
      { error: "Describe the paper you want (e.g. 'CBSE Class 10 Maths, 80 marks, 3 hours')." },
      { status: 400 }
    );
  }

  const prompt = buildPaperPrompt(brief);

  // geminiGenerateJson() fails over across the whole model chain internally, and
  // parsePaper() repairs under-escaped LaTeX. Here we additionally retry the
  // whole chain while there's time budget left: during a broad demand spike the
  // entire chain can be busy for a second or two, and a short backoff usually
  // lands on a free model — absorbing the blip instead of showing it to the
  // user. The deadline keeps us safely under Vercel's 60s function limit, so
  // this never compounds into a 504.
  const startedAt = Date.now();
  const DEADLINE_MS = 48_000;
  let lastErr: GeminiError | null = null;

  while (Date.now() - startedAt < DEADLINE_MS) {
    try {
      const { text, totalTokens, model } = await geminiGenerateJson(prompt, {
        temperature: 0.35,
      });
      const paper = parsePaper(text);
      return NextResponse.json({ paper, totalTokens, model });
    } catch (err) {
      if (err instanceof GeminiError) {
        if (err.code === "NO_KEY" || err.code === "AUTH_FAIL") {
          return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
        }
        lastErr = err;
        const busy =
          err.code === "RATE_LIMIT" || err.code === "TIMEOUT" || err.status === 503;
        // Busy/transient: short backoff and retry the chain if time allows.
        if (busy && Date.now() - startedAt < DEADLINE_MS - 8_000) {
          await new Promise((r) => setTimeout(r, 2_000));
          continue;
        }
        break;
      }
      // Parse/shape failure even after repair — one quick retry, then give up.
      console.error("[generate] parse failed:", err);
      lastErr = new GeminiError("BAD_RESPONSE", "malformed paper");
      if (Date.now() - startedAt < DEADLINE_MS - 12_000) continue;
      break;
    }
  }

  const busy =
    lastErr?.code === "RATE_LIMIT" ||
    lastErr?.code === "TIMEOUT" ||
    lastErr?.status === 503;
  return NextResponse.json(
    {
      error: busy
        ? "The AI is unusually busy right now. Please click Generate again in a few seconds."
        : "Couldn't generate the paper this time. Please click Generate again.",
      code: lastErr?.code,
    },
    { status: busy ? 503 : 502 }
  );
}
