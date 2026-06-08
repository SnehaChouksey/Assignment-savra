"use client";

import { renderBodyToHtml } from "@/lib/render-body-html";
import {
  computeTotalMarks,
  countQuestions,
  type GeneratedPaper,
} from "@/lib/paper";

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const TEAL = "#0E6E84";
const RED = "#D63D2F";

function Html({ body, className }: { body?: string | null; className?: string }) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderBodyToHtml(body) }}
    />
  );
}

export function PaperPreview({
  paper,
  schoolName,
  showKey,
}: {
  paper: GeneratedPaper;
  schoolName: string;
  showKey: boolean;
}) {
  // Use the real sum of question marks as the authoritative total so the paper
  // is always internally consistent (header marks == sum of questions), even
  // when a lighter fallback model drifts off the requested total.
  const total = computeTotalMarks(paper) || paper.total_marks;
  let qNum = 0;

  return (
    <div className="print-area mx-auto w-full max-w-[820px] bg-white p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
      <div className="paper-body font-serifx text-[12.5px] leading-relaxed text-slate-800">
        {/* Header */}
        <header
          className="flex items-center gap-4 pb-2"
          style={{ borderBottom: `1px solid ${RED}` }}
        >
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-lg font-bold text-white"
            style={{ background: TEAL }}
          >
            {(schoolName || "S").trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 text-center">
            <div
              className="text-[22px] font-bold leading-tight"
              style={{ color: TEAL }}
            >
              {schoolName || "Your School Name"}
            </div>
          </div>
          <div className="w-11 flex-shrink-0" />
        </header>

        {paper.board_label ? (
          <div className="mt-2.5 text-[12px] font-bold" style={{ color: TEAL }}>
            {paper.board_label}
          </div>
        ) : null}

        <h1 className="mt-1.5 mb-3 text-center text-[16px] font-bold uppercase tracking-wide">
          {paper.title || "Question Paper"}
        </h1>

        {/* Meta grid */}
        <div className="mb-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[12px]">
          <div>
            <span className="font-bold" style={{ color: TEAL }}>
              Time:
            </span>{" "}
            {paper.duration_minutes} min
          </div>
          <div>
            <span className="font-bold" style={{ color: TEAL }}>
              Maximum Marks:
            </span>{" "}
            {total}
          </div>
          <div>
            <span className="font-bold" style={{ color: TEAL }}>
              Subject:
            </span>{" "}
            {paper.subject ?? "—"}
          </div>
        </div>

        {/* Instructions */}
        {paper.instructions?.length ? (
          <section
            className="mb-3 px-3 py-2"
            style={{ background: "#F0F6F7", borderLeft: `3px solid ${TEAL}` }}
          >
            <div
              className="mb-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: TEAL }}
            >
              General Instructions
            </div>
            <ol className="ml-4 list-decimal text-[11px]">
              {paper.instructions.map((line, i) => (
                <li key={i} className="mb-0.5">
                  {line}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Sections */}
        {paper.sections.map((section, si) => (
          <section key={si}>
            <div
              className="mb-1.5 mt-3.5 px-3 py-1 text-center text-[12px] font-bold uppercase tracking-wide text-white"
              style={{ background: TEAL }}
            >
              {section.label}
            </div>
            {section.instructions ? (
              <p className="mb-2 text-[11px] italic text-slate-500">
                {section.instructions}
              </p>
            ) : null}

            {section.questions.map((q, qi) => {
              qNum += 1;
              const isMcq = q.question_type === "mcq" && q.options?.length;
              return (
                <div key={qi} className="avoid-break mb-3">
                  <div className="flex items-start gap-1.5">
                    <span className="min-w-[26px] flex-shrink-0 font-bold">
                      Q{qNum}.
                    </span>
                    <Html className="flex-1" body={q.question_body} />
                    <span
                      className="ml-2 inline-block flex-shrink-0 rounded-full border px-2 text-[10px] font-bold"
                      style={{ borderColor: RED, color: RED }}
                    >
                      [ {q.marks} ]
                    </span>
                  </div>
                  {isMcq ? (
                    <div className="ml-7 mt-1 grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
                      {q.options!.slice(0, 4).map((opt, oi) => (
                        <div key={oi}>
                          <strong>({OPTION_LETTERS[oi]})</strong>{" "}
                          <Html body={opt} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}

        {/* Answer key */}
        {showKey ? (
          <section className="page-break mt-6">
            <div
              className="mb-2 px-3 py-1 text-center text-[12px] font-bold uppercase tracking-wide text-white"
              style={{ background: RED }}
            >
              Answer Key &amp; Solutions
            </div>
            {(() => {
              let k = 0;
              return paper.sections.flatMap((section) =>
                section.questions.map((q, qi) => {
                  k += 1;
                  return (
                    <div key={`${section.label}-${qi}`} className="avoid-break mb-2.5">
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-[26px] flex-shrink-0 font-bold">
                          Q{k}.
                        </span>
                        <div className="flex-1">
                          {q.answer ? (
                            <div>
                              <span className="font-bold" style={{ color: TEAL }}>
                                Ans:
                              </span>{" "}
                              <Html body={q.answer} />
                            </div>
                          ) : null}
                          {q.solution ? (
                            <div className="mt-0.5 text-[11.5px] text-slate-600">
                              <Html body={q.solution} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              );
            })()}
          </section>
        ) : null}

        <footer className="mt-6 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
          {countQuestions(paper)} questions · {total} marks · generated with
          Prompt-to-Paper
        </footer>
      </div>
    </div>
  );
}
