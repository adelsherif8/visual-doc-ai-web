# 📄 Visual Document AI — web (Next.js + Vercel)

Upload an **invoice, receipt, or ID** and get back the page with **bounding
boxes over every detected field**, **structured JSON with confidence**, and a
**baseline-vs-VLM** comparison. This is the Vercel-deployable web version of the
[Python/Gradio project](../visual-doc-ai).

## How it works

- **Bundled samples** (invoice, receipt, CA ID) render entirely in the browser
  from baked ground truth (`public/samples/*.json`) — pixel-perfect boxes and
  JSON with **no key and no server call**, so the demo always works.
- **Uploads** POST the image to a serverless route (`app/api/extract/route.ts`)
  that calls **gpt-4o-mini** vision and returns typed fields with confidence and
  a normalized bounding box per field. Boxes are drawn as overlays scaled to the
  image, so they stay aligned at any size.
- **Baseline vs VLM**: each sample ships the subset a naive OCR+regex pass would
  catch; the UI diffs it against the VLM field-for-field so you can see the gap.

## Run locally

```bash
npm install
cp .env.example .env.local      # add OPENAI_API_KEY to enable uploads (optional)
npm run dev                     # http://localhost:3000
```

Without a key the bundled samples still work; uploads are disabled with a note.

## Deploy to Vercel

```bash
vercel            # link + preview
vercel --prod     # production
```

Then set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in
**Project → Settings → Environment Variables** to enable live uploads. Never
commit the key — it lives only in Vercel's encrypted env.

## What it demonstrates

Vision-language extraction · structured output (typed JSON + confidence) ·
bounding-box overlays · a measured baseline-vs-VLM case study · a Next.js app
with a serverless OpenAI route, deployable in one command.
