// Browser-side OCR with tesseract.js (its native home — runs as a Web Worker,
// caches the model in the browser after first use). Keeping OCR on the client
// keeps the serverless function fast (it only does the VLM call).
import { OcrResult, OcrWord } from "@/lib/ocr-core";

let _workerP: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (!_workerP) {
    _workerP = import("tesseract.js")
      .then(({ createWorker }) => createWorker("eng"))
      .catch((e) => {
        _workerP = null;
        throw e;
      });
  }
  return _workerP;
}

function imageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 });
    im.onerror = reject;
    im.src = dataUrl;
  });
}

// Run OCR in the browser; returns normalized word boxes + page size.
export async function ocrBrowser(dataUrl: string): Promise<OcrResult> {
  const [{ w, h }, worker] = await Promise.all([imageDims(dataUrl), getWorker()]);
  const { data } = await worker.recognize(dataUrl, {}, { blocks: true });

  const words: OcrWord[] = [];
  for (const blk of data.blocks || [])
    for (const par of blk.paragraphs || [])
      for (const ln of par.lines || [])
        for (const wd of ln.words || []) {
          const t = (wd.text || "").trim();
          if (!t || !wd.bbox) continue;
          words.push({
            text: t,
            bbox: [wd.bbox.x0 / w, wd.bbox.y0 / h, wd.bbox.x1 / w, wd.bbox.y1 / h],
          });
        }

  return { words, width: w, height: h, fullText: words.map((x) => x.text).join(" ") };
}
