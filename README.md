# Prompt-to-Paper

An AI exam-paper generator for teachers. Describe an exam in plain English (e.g. _"CBSE Class 10 Maths, 80 marks, 3 hours, heavy on Trigonometry"_) and get a complete, board-ready question paper — sectioned, mark-balanced, with proper LaTeX math and a full answer key — that you can print straight to PDF.

Built with Next.js 14 (App Router) + Gemini + KaTeX. The LaTeX renderer and paper layout are reused from a production teacher LMS.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY (free: https://aistudio.google.com/app/apikey)
npm run dev                  # http://localhost:4200
```
