// Server-side OCR / layout layer (pure-WASM tesseract.js — no system binary, so
// it runs in a Vercel serverless function). This is where bounding boxes come
// from: word-level pixel boxes, normalized to 0..1 of the page. The VLM decides
// what each value means; OCR decides where it is.
import imageSize from "image-size";
import { createWorker, type Worker } from "tesseract.js";

import { Bbox } from "@/lib/types";

export interface OcrWord {
  text: string;
  bbox: Bbox; // normalized [x0,y0,x1,y1]
}

export interface OcrResult {
  words: OcrWord[];
  width: number;
  height: number;
  fullText: string;
}

// Keep one warm worker across invocations; serialize recognize calls on it.
let _workerP: Promise<Worker> | null = null;
let _chain: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<Worker> {
  if (!_workerP) {
    _workerP = createWorker("eng", 1, { cachePath: "/tmp" }).catch((e) => {
      _workerP = null;
      throw e;
    });
  }
  return _workerP;
}

export async function ocr(buf: Buffer): Promise<OcrResult> {
  const dim = imageSize(buf);
  const width = dim.width || 1;
  const height = dim.height || 1;

  const worker = await getWorker();
  const run = _chain.then(() => worker.recognize(buf, {}, { blocks: true }));
  _chain = run.catch(() => {});
  const { data } = (await run) as any;

  const words: OcrWord[] = [];
  for (const blk of data.blocks || [])
    for (const par of blk.paragraphs || [])
      for (const ln of par.lines || [])
        for (const w of ln.words || []) {
          const t = (w.text || "").trim();
          if (!t || !w.bbox) continue;
          words.push({
            text: t,
            bbox: [w.bbox.x0 / width, w.bbox.y0 / height, w.bbox.x1 / width, w.bbox.y1 / height],
          });
        }

  return { words, width, height, fullText: words.map((w) => w.text).join(" ") };
}

const NORM = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function union(ws: OcrWord[]): Bbox {
  return [
    Math.min(...ws.map((w) => w.bbox[0])),
    Math.min(...ws.map((w) => w.bbox[1])),
    Math.max(...ws.map((w) => w.bbox[2])),
    Math.max(...ws.map((w) => w.bbox[3])),
  ];
}

// Find the box covering `value` by matching it to the closest run of OCR words.
export function locate(value: string, words: OcrWord[]): Bbox | null {
  if (!words.length || !value.trim()) return null;
  const target = NORM(value);
  if (!target) return null;

  let best: { score: number; box: Bbox } | null = null;
  for (let i = 0; i < words.length; i++) {
    let acc = "";
    for (let j = i; j < Math.min(i + 8, words.length); j++) {
      acc += NORM(words[j].text);
      const contains = acc.includes(target);
      const partial =
        target.includes(acc) && acc.length >= Math.max(3, Math.floor(target.length / 2));
      if (contains || partial) {
        const box = union(words.slice(i, j + 1));
        const score = -Math.abs(acc.length - target.length);
        if (!best || score > best.score) best = { score, box };
        if (contains) break;
      }
    }
  }
  return best ? best.box : null;
}
