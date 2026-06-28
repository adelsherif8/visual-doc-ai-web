import { Bbox, Extraction, Field } from "@/lib/types";

export interface SampleMeta {
  doc_type: string;
  width: number;
  height: number;
  fields: { key: string; value: string; bbox: number[]; confidence: number }[];
  line_items: { description: string; qty?: string; amount?: string }[];
  baseline_keys: string[];
  full_text: string;
}

export interface Sample {
  name: string;
  label: string;
  icon: string; // Font Awesome class
}

export const SAMPLES: Sample[] = [
  { name: "invoice_techflow", label: "SaaS Invoice", icon: "fa-file-invoice-dollar" },
  { name: "receipt_greenleaf", label: "Store Receipt", icon: "fa-receipt" },
  { name: "id_card_ca", label: "ID Card", icon: "fa-id-card" },
];

function normBox(b: number[], w: number, h: number): Bbox {
  return [b[0] / w, b[1] / h, b[2] / w, b[3] / h];
}

// Build both engine results for a bundled sample from its baked ground truth.
// The VLM result IS the ground truth (deterministic, pixel-perfect); the
// baseline is the subset a naive OCR+regex pass would catch (baseline_keys).
export function sampleExtractions(meta: SampleMeta): {
  vlm: Extraction;
  baseline: Extraction;
} {
  const { width: w, height: h } = meta;

  const vlmFields: Field[] = meta.fields.map((f) => ({
    key: f.key,
    value: f.value,
    confidence: f.confidence,
    bbox: normBox(f.bbox, w, h),
  }));

  const baseKeys = new Set(meta.baseline_keys);
  const byKey = new Map(meta.fields.map((f) => [f.key, f]));
  const baseFields: Field[] = [...baseKeys]
    .filter((k) => byKey.has(k))
    .map((k) => {
      const f = byKey.get(k)!;
      return { key: k, value: f.value, confidence: 0.68, bbox: normBox(f.bbox, w, h) };
    });

  return {
    vlm: {
      engine: "vlm",
      doc_type: meta.doc_type,
      fields: vlmFields,
      line_items: meta.line_items || [],
      note: "Deterministic demo: bundled sample with baked ground truth.",
      usage: { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 },
    },
    baseline: {
      engine: "baseline",
      doc_type: meta.doc_type,
      fields: baseFields,
      line_items: [],
      note: "OCR + regex baseline: catches pattern-shaped fields, misses semantic ones (vendor, names, line items).",
    },
  };
}
