// Pure OCR helpers shared by the browser OCR layer and the baseline — no
// tesseract import here, so this is safe to bundle anywhere. Boxes are
// normalized [x0,y0,x1,y1] in 0..1 of the page.
import { Bbox } from "@/lib/types";

export interface OcrWord {
  text: string;
  bbox: Bbox;
}

export interface OcrResult {
  words: OcrWord[];
  width: number;
  height: number;
  fullText: string;
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
    for (let j = i; j < Math.min(i + 10, words.length); j++) {
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
