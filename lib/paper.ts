// Shape of a generated exam paper. The Gemini model is instructed to return
// JSON matching this schema exactly.

export type QuestionType = "mcq" | "numerical" | "subjective";

export interface PaperQuestion {
  question_body: string; // may contain LaTeX in \( \) and \[ \]
  question_type: QuestionType;
  options?: string[]; // present for mcq (4 entries, may contain LaTeX)
  marks: number;
  answer?: string; // short answer / correct option
  solution?: string; // worked solution (may contain LaTeX)
}

export interface PaperSection {
  label: string; // e.g. "Section A — Multiple Choice (1 mark each)"
  instructions?: string;
  questions: PaperQuestion[];
}

export interface GeneratedPaper {
  title: string;
  board_label?: string; // e.g. "CBSE — Class 10"
  subject?: string;
  duration_minutes: number;
  total_marks: number;
  instructions: string[];
  sections: PaperSection[];
}

export interface GenerateRequest {
  brief: string;
  schoolName?: string;
}

// Compute the real marks total from the questions (the model can drift).
export function computeTotalMarks(paper: GeneratedPaper): number {
  return paper.sections.reduce(
    (sum, s) => sum + s.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0),
    0
  );
}

export function countQuestions(paper: GeneratedPaper): number {
  return paper.sections.reduce((n, s) => n + s.questions.length, 0);
}

const SCHEMA_EXAMPLE = `{
  "title": "Half-Yearly Examination — Mathematics",
  "board_label": "CBSE — Class 10",
  "subject": "Mathematics",
  "duration_minutes": 180,
  "total_marks": 80,
  "instructions": ["All questions are compulsory.", "Marks are indicated against each question."],
  "sections": [
    {
      "label": "Section A — Multiple Choice (1 mark each)",
      "instructions": "Choose the correct option.",
      "questions": [
        {
          "question_body": "The roots of \\\\( x^2 - 5x + 6 = 0 \\\\) are:",
          "question_type": "mcq",
          "options": ["\\\\( 2, 3 \\\\)", "\\\\( -2, -3 \\\\)", "\\\\( 1, 6 \\\\)", "\\\\( -1, -6 \\\\)"],
          "marks": 1,
          "answer": "(A) \\\\( 2, 3 \\\\)",
          "solution": "Factor: \\\\( x^2 - 5x + 6 = (x-2)(x-3) \\\\), so \\\\( x = 2 \\\\) or \\\\( x = 3 \\\\)."
        }
      ]
    }
  ]
}`;

export function buildPaperPrompt(brief: string): string {
  return `You are an expert exam paper setter for Indian school boards (CBSE, ICSE, and State boards), classes 6 to 12. You design clean, balanced, exam-ready question papers.

Generate a complete question paper from this teacher's brief:
"""
${brief}
"""

Output rules (follow EXACTLY):
- Return ONLY a single JSON object. No markdown fences, no commentary before or after.
- Match this schema and field names exactly:
${SCHEMA_EXAMPLE}
- ALL mathematics — every variable, equation, fraction, exponent, symbol, unit — MUST be written in LaTeX wrapped in \\( ... \\) for inline math and \\[ ... \\] for display math. Never write math in plain text. Write \\( x^2 \\) not x^2, write \\( \\frac{3}{4} \\) not 3/4.
- CRITICAL — JSON escaping: the output is JSON, so EVERY backslash in LaTeX must be written as a DOUBLE backslash. For example the value must be "Find \\( \\sin\\theta \\)" (double backslashes), never a single backslash. A single backslash makes the JSON invalid and unusable.
- Keep each "solution" concise — 1 to 3 short steps.
- Organise the paper into logical sections that follow the board's usual blueprint (e.g. Section A: 1-mark MCQs, Section B: 2-mark short answer, Section C: 3-mark, Section D: 5-mark long answer). Put the mark value in each section label.
- For "mcq" questions, provide exactly 4 entries in "options". For "numerical" and "subjective", omit "options".
- The marks across ALL questions MUST sum to the requested total marks exactly. Double-check the arithmetic before responding.
- Every question MUST include a concise "answer" and a clear worked "solution" (with LaTeX where relevant) — this becomes the answer key.
- Questions must be original, pedagogically sound, and matched to the class level and the difficulty mix requested. Cover the requested topics well.
- If the brief is vague, make sensible choices (e.g. default 3 hours / 80 marks for a board class) and proceed.

Return the JSON now.`;
}

export function parsePaper(raw: string): GeneratedPaper {
  // Gemini sometimes wraps JSON in ```json fences despite instructions.
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }

  let obj: GeneratedPaper;
  try {
    obj = JSON.parse(text) as GeneratedPaper;
  } catch {
    // Lighter models (the 503 failover) sometimes emit LaTeX with SINGLE
    // backslashes — e.g. "\( \sin\theta \)" — which is invalid JSON. When the
    // backslashes are consistently single, doubling every backslash that isn't
    // escaping a quote turns it back into valid JSON without disturbing the
    // already-correct quote escapes. Only runs after a normal parse fails, so
    // it can't corrupt well-formed responses.
    obj = JSON.parse(text.replace(/\\(?!")/g, "\\\\")) as GeneratedPaper;
  }

  if (!obj || !Array.isArray(obj.sections)) {
    throw new Error("Model returned JSON without a sections array");
  }
  return obj;
}
