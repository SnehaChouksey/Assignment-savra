"use client";

import { useState } from "react";
import { PaperPreview } from "@/components/PaperPreview";
import type { GeneratedPaper } from "@/lib/paper";

const EXAMPLES = [
  "CBSE Class 10 Maths unit test, 10 questions, 20 marks, Trigonometry & Quadratic Equations, 4 MCQs",
  "ICSE Class 9 Physics quiz, 10 questions, 15 marks, Motion and Force",
  "CBSE Class 12 Chemistry, 10 questions, 20 marks, Electrochemistry, mixed difficulty",
  "Class 7 Maths worksheet, 10 questions, 15 marks, Integers and Fractions, mostly easy",
];

export default function Home() {
  const [brief, setBrief] = useState("");
  const [schoolName, setSchoolName] = useState("Your School Name");
  const [showKey, setShowKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);

  async function generate() {
    if (brief.trim().length < 4) {
      setError("Describe the paper you want first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      // The response isn't always JSON: a platform timeout (504) returns an
      // HTML error page. Read text first and parse defensively so the user
      // gets a clean message instead of a raw "Unexpected token" error.
      const raw = await res.text();
      let data: { paper?: GeneratedPaper; error?: string } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          error:
            res.status === 504
              ? "That took too long and timed out. Try a smaller paper, or click Generate again."
              : "The server hit an unexpected error. Please click Generate again.",
        };
      }

      if (!res.ok || !data.paper) {
        throw new Error(data.error ?? "Generation failed — please try again.");
      }
      setPaper(data.paper);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      {/* Header */}
      <div className="no-print">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-teal">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-teal text-white">
            ✦
          </span>
          Prompt-to-Paper
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Describe an exam. Get a board-ready paper with real math —{" "}
          <span className="text-brand-teal">in seconds.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Built for teachers. Type what you need in plain English; an AI sets a
          complete paper — sectioned, mark-balanced, with proper LaTeX math and a
          full answer key you can print to PDF.
        </p>

        {/* Composer */}
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. CBSE Class 10 Maths unit test, 10 questions, 20 marks, Trigonometry and Quadratic Equations, include 4 MCQs…"
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-[15px] shadow-sm outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setBrief(ex)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-brand-teal hover:text-brand-teal"
                >
                  {ex.length > 52 ? ex.slice(0, 52) + "…" : ex}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              School / Institute name
            </label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-teal"
            />
            <label className="mt-1 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showKey}
                onChange={(e) => setShowKey(e.target.checked)}
                className="h-4 w-4 accent-brand-teal"
              />
              Include answer key &amp; solutions
            </label>
            <button
              onClick={generate}
              disabled={loading}
              className="mt-auto rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep disabled:opacity-60"
            >
              {loading ? "Setting paper…" : "Generate paper"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 animate-pulse rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">
            Drafting questions, balancing marks, and writing the answer key…
          </div>
        ) : null}

        {paper ? (
          <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-500">
              Paper ready — review below, then print to PDF.
            </p>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal hover:text-white"
            >
              ⬇ Print / Save as PDF
            </button>
          </div>
        ) : null}
      </div>

      {/* Paper */}
      {paper ? (
        <div className="mt-6">
          <PaperPreview paper={paper} schoolName={schoolName} showKey={showKey} />
        </div>
      ) : null}
    </main>
  );
}
