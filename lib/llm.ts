// Server-side VLM extraction for uploaded documents.
//   Real mode -> gpt-4o-mini reads the page image and returns typed fields with
//                confidence + a normalized bounding box per field.
//   Mock mode -> no key set: returns an empty result that tells the user to add
//                a key. (Bundled samples never hit this path — they render from
//                baked ground truth in the browser.)
import OpenAI from "openai";

import { Bbox, Extraction, Field } from "@/lib/types";

export const MOCK = !process.env.OPENAI_API_KEY;
export const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

function costUsd(model: string, p: number, c: number): number {
  const pr = PRICING[model];
  if (!pr) return 0;
  return (p / 1_000_000) * pr.input + (c / 1_000_000) * pr.output;
}

const SYSTEM = `You are a precise document data-extraction engine. Read the document image and return STRICT JSON only, no prose.
Shape:
{ "doc_type": "invoice|receipt|id_card|other",
  "fields": [ { "key": "snake_case_field", "value": "string", "confidence": 0.0-1.0, "bbox": [x0,y0,x1,y1] } ],
  "line_items": [ { "description": "", "qty": "", "amount": "" } ] }
Rules:
- Use snake_case keys (e.g. invoice_number, invoice_date, due_date, vendor_name, bill_to, subtotal, tax, total, merchant, payment_method, full_name, id_number, date_of_birth, issue_date, expiry_date, address).
- bbox is the tight box around the VALUE text, as fractions of image size: x0,y0 = top-left, x1,y1 = bottom-right, each 0..1.
- Copy values verbatim. confidence = how sure you are. Omit fields not present. line_items only for invoices/receipts.`;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function toBbox(raw: unknown): Bbox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const b = raw.map((x) => clamp01(Number(x)));
  if (b.some((x) => Number.isNaN(x))) return null;
  if (b[2] <= b[0] || b[3] <= b[1]) return null;
  return [b[0], b[1], b[2], b[3]];
}

export async function extractUpload(dataUrl: string): Promise<Extraction> {
  if (MOCK) {
    return {
      engine: "vlm",
      doc_type: "unknown",
      fields: [],
      line_items: [],
      note: "Demo is running without an OpenAI key, so live uploads are disabled. The bundled samples still work. (Set OPENAI_API_KEY to enable uploads.)",
    };
  }

  const client = new OpenAI();
  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract this document." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  const raw = resp.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { doc_type: "unknown", fields: [] };
  }

  const fields: Field[] = (parsed.fields || [])
    .filter((f: any) => f?.key && f?.value !== undefined && f?.value !== "")
    .map((f: any) => ({
      key: String(f.key),
      value: String(f.value),
      confidence: typeof f.confidence === "number" ? clamp01(f.confidence) : 0.8,
      bbox: toBbox(f.bbox),
    }));

  const line_items = (parsed.line_items || [])
    .filter((li: any) => li?.description)
    .map((li: any) => ({
      description: String(li.description),
      qty: li.qty != null ? String(li.qty) : "",
      amount: li.amount != null ? String(li.amount) : "",
    }));

  const u = resp.usage;
  return {
    engine: "vlm",
    doc_type: parsed.doc_type || "unknown",
    fields,
    line_items,
    note: `Live extraction via ${MODEL}.`,
    usage: {
      prompt_tokens: u?.prompt_tokens ?? 0,
      completion_tokens: u?.completion_tokens ?? 0,
      cost_usd: costUsd(MODEL, u?.prompt_tokens ?? 0, u?.completion_tokens ?? 0),
    },
  };
}
