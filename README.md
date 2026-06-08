# Savra Question Paper Generator

An AI exam-paper generator for teachers. Describe an exam in plain English (e.g. _"CBSE Class 10 Maths, 10 questions, 20 marks, heavy on Trigonometry"_) and get a complete, board-ready question paper — sectioned, mark-balanced, with proper LaTeX math and a full answer key — that you can print straight to PDF.

Built from scratch with Next.js 14 (App Router) + Gemini + KaTeX. A server route prompts Gemini for a structured JSON paper, a resilient model-fallback chain keeps it generating through demand spikes, and a KaTeX pipeline renders the math.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY (free: https://aistudio.google.com/app/apikey)
npm run dev                  # http://localhost:4200
```
