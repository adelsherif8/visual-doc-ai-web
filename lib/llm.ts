// Server-side VLM call only — gpt-4o-mini reads the document image and returns
// typed fields + confidence. OCR (bounding boxes) and the regex baseline run in
// the browser, so this function stays fast and well under the serverless limit.
import OpenAI from "openai";

import { Extraction, Field, LineItem } from "@/lib/types";

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
  "fields": [ { "key": "snake_case_field", "value": "string", "confidence": 0.0-1.0 } ],
  "line_items": [ { "description": "", "qty": "", "amount": "" } ] }
Rules:
- Use snake_case keys (e.g. invoice_number, invoice_date, due_date, vendor_name, bill_to, subtotal, tax, total, merchant, payment_method, full_name, id_number, date_of_birth, issue_date, expiry_date, address).
- Copy values verbatim as they appear (single line; do not include surrounding label text). confidence = how sure you are. Omit fields not present. line_items only for invoices/receipts.`;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export async function extractVlm(dataUrl: string): Promise<Extraction> {
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

  let parsed: any;
  try {
    parsed = JSON.parse(resp.choices[0]?.message?.content || "{}");
  } catch {
    parsed = { doc_type: "unknown", fields: [] };
  }

  const fields: Field[] = (parsed.fields || [])
    .filter((f: any) => f?.key && f?.value !== undefined && f?.value !== "")
    .map((f: any) => ({
      key: String(f.key),
      value: String(f.value),
      confidence: typeof f.confidence === "number" ? clamp01(f.confidence) : 0.8,
      bbox: null, // located against OCR words in the browser
    }));

  const line_items: LineItem[] = (parsed.line_items || [])
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
    note: `Live extraction via ${MODEL} · boxes grounded by in-browser OCR.`,
    usage: {
      prompt_tokens: u?.prompt_tokens ?? 0,
      completion_tokens: u?.completion_tokens ?? 0,
      cost_usd: costUsd(MODEL, u?.prompt_tokens ?? 0, u?.completion_tokens ?? 0),
    },
  };
}
