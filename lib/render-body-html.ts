import katex from "katex";

// LaTeX-aware renderer — adapted from the production Varenyam LMS paper-export
// pipeline. Splits a question/solution string into prose | inline-math |
// display-math segments and renders each math segment with KaTeX.
//
// Recognized delimiters:
//   \( ... \)   inline math
//   \[ ... \]   display math
//   $$ ... $$   display math (alt)
//   $ ... $     inline math (single-line)

export const SEGMENT_RE =
  /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

export type BodySegment =
  | { kind: "prose"; text: string }
  | { kind: "inline-math"; tex: string }
  | { kind: "display-math"; tex: string };

export function splitBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SEGMENT_RE.lastIndex = 0;
  while ((m = SEGMENT_RE.exec(body))) {
    if (m.index > last) {
      segments.push({ kind: "prose", text: body.slice(last, m.index) });
    }
    const tok = m[0];
    if (tok.startsWith("\\[")) {
      segments.push({ kind: "display-math", tex: tok.slice(2, -2) });
    } else if (tok.startsWith("\\(")) {
      segments.push({ kind: "inline-math", tex: tok.slice(2, -2) });
    } else if (tok.startsWith("$$")) {
      segments.push({ kind: "display-math", tex: tok.slice(2, -2) });
    } else {
      segments.push({ kind: "inline-math", tex: tok.slice(1, -1) });
    }
    last = SEGMENT_RE.lastIndex;
  }
  if (last < body.length) {
    segments.push({ kind: "prose", text: body.slice(last) });
  }
  return segments;
}

export function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      output: "html",
      strict: "ignore",
    });
  } catch {
    return escapeHtml(tex);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Render a body string to HTML: prose escaped, math rendered with KaTeX.
export function renderBodyToHtml(body: string | null | undefined): string {
  if (!body) return "";
  return splitBody(body)
    .map((seg) => {
      if (seg.kind === "prose") return escapeHtml(seg.text);
      if (seg.kind === "inline-math") return renderMath(seg.tex, false);
      return renderMath(seg.tex, true);
    })
    .join("");
}
