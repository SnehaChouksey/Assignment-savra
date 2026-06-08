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

  // Single bounded pass: geminiGenerateJson() already fails over flash -> lite
  // internally, and parsePaper() repairs the under-escaped LaTeX that the fast
  // (thinking-off) model can emit. No outer retry — that's what compounded past
  // Vercel's 60s limit and produced 504s.
  try {
    const { text, totalTokens, model } = await geminiGenerateJson(prompt, {
      temperature: 0.35,
    });
    const paper = parsePaper(text);
    return NextResponse.json({ paper, totalTokens, model });
  } catch (err) {
    if (err instanceof GeminiError) {
      if (err.code === "NO_KEY") {
        return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
      }
      // Overload / quota / timeout: the model chain was momentarily unavailable.
      const busy =
        err.code === "RATE_LIMIT" || err.code === "TIMEOUT" || err.status === 503;
      return NextResponse.json(
        {
          error: busy
            ? "The AI is busy right now (high demand or rate limit). Please click Generate again in a few seconds."
            : err.message,
          code: err.code,
        },
        { status: busy ? 503 : 502 }
      );
    }
    // Parse/shape failure even after repair — rare. Ask the user to retry.
    console.error("[generate] parse failed:", err);
    return NextResponse.json(
      { error: "The model returned a malformed paper. Please click Generate again." },
      { status: 502 }
    );
  }
}
