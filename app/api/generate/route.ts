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
  let lastParseErr: unknown = null;

  // The model occasionally botches LaTeX backslash escaping into invalid JSON.
  // It's non-deterministic, so one clean retry recovers nearly every miss.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, totalTokens } = await geminiGenerateJson(prompt, {
        temperature: attempt === 0 ? 0.35 : 0.2,
      });
      const paper = parsePaper(text);
      return NextResponse.json({ paper, totalTokens });
    } catch (err) {
      if (err instanceof GeminiError) {
        if (err.code === "NO_KEY") {
          return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
        }
        // Overload / rate-limit / timeout: the model chain was momentarily
        // busy. Surface a calm, actionable message rather than a raw HTTP code.
        const busy =
          err.code === "RATE_LIMIT" || err.code === "TIMEOUT" || err.status === 503;
        return NextResponse.json(
          {
            error: busy
              ? "The AI is briefly overloaded with demand. Please click Generate again — it usually clears within a few seconds."
              : err.message,
            code: err.code,
          },
          { status: busy ? 503 : 502 }
        );
      }
      // SyntaxError / bad-shape — retry once, then give up.
      lastParseErr = err;
    }
  }

  console.error("[generate] parse failed after retry:", lastParseErr);
  return NextResponse.json(
    { error: "The model returned a malformed paper. Please try again." },
    { status: 502 }
  );
}
