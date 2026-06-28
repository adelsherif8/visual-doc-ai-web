// The real OCR + regex baseline — the "before" in the case study. It runs on
// the same OCR output the VLM boxes use, so the comparison is honest: this is
// genuinely what a regex pass over the OCR text recovers (and what it can't).
import { locate, OcrResult } from "@/lib/ocr";
import { Extraction, Field } from "@/lib/types";

const MONEY = /[$€£]\s?\d[\d,]*\.?\d{0,2}/g;
const DATE = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;
const INV = /\bINV[A-Z]*[-#\s:]*\d[\d-]*/i;
const IDNUM = /\b[A-Z]\d{6,}\b/;

export function guessDocType(text: string): string {
  const t = text.toLowerCase();
  if (/(driver license|passport|identification|date of birth|dob)/.test(t)) return "id_card";
  if (/(invoice|bill to|due date|amount due)/.test(t)) return "invoice";
  if (/(receipt|total|subtotal|thank you|change)/.test(t)) return "receipt";
  return "invoice";
}

export function extractBaseline(ocr: OcrResult, hint?: string): Extraction {
  const text = ocr.fullText;
  const dt = hint || guessDocType(text);
  const fields: Field[] = [];

  const f = (key: string, value: string, conf: number) =>
    fields.push({ key, value, confidence: conf, bbox: locate(value, ocr.words) });

  const monies = text.match(MONEY) || [];
  const dates = text.match(DATE) || [];

  if (dt === "invoice" || dt === "receipt") {
    if (dates.length) f(dt === "invoice" ? "invoice_date" : "date", dates[0]!, 0.71);
    if (dt === "invoice") {
      const m = INV.exec(text);
      if (m) f("invoice_number", m[0].trim(), 0.74);
      if (dates.length > 1) f("due_date", dates[1]!, 0.62);
    }
    if (monies.length) {
      const largest = monies.reduce((a, b) =>
        parseFloat(a.replace(/[^\d.]/g, "")) >= parseFloat(b.replace(/[^\d.]/g, "")) ? a : b
      );
      f("total", largest, 0.66);
    }
  } else if (dt === "id_card") {
    const idm = IDNUM.exec(text);
    if (idm) f("id_number", idm[0], 0.69);
    const keys = ["date_of_birth", "issue_date", "expiry_date"];
    dates.slice(0, 3).forEach((d, i) => f(keys[i]!, d, 0.6));
  }

  return {
    engine: "baseline",
    doc_type: dt,
    fields,
    line_items: [],
    note: "OCR + regex baseline: catches pattern-shaped fields, misses semantic ones (vendor, names, line items).",
  };
}
