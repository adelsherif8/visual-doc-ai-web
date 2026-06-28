// Shared shapes for an extraction. `bbox` is normalized [x0, y0, x1, y1] in
// 0..1 of the page, so the browser can draw it over the image at any size.

export type Bbox = [number, number, number, number];

export interface Field {
  key: string;
  value: string;
  confidence: number;
  bbox: Bbox | null;
}

export interface LineItem {
  description: string;
  qty?: string;
  amount?: string;
}

export interface Extraction {
  engine: "baseline" | "vlm";
  doc_type: string;
  fields: Field[];
  line_items: LineItem[];
  note: string;
  usage?: { prompt_tokens: number; completion_tokens: number; cost_usd: number };
}

export interface ApiResult {
  vlm: Extraction;
  baseline: Extraction;
  doc_type: string;
  ocr: boolean; // whether OCR produced word boxes
}

export interface CompareRow {
  field: string;
  vlm: string;
  baseline: string;
  confidence: number;
  status: "match" | "differs" | "missed";
}

// Human labels for known field keys (kept in sync with the Python schema).
export const LABELS: Record<string, string> = {
  invoice_number: "Invoice #",
  invoice_date: "Invoice Date",
  due_date: "Due Date",
  vendor_name: "Vendor",
  bill_to: "Bill To",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  merchant: "Merchant",
  date: "Date",
  payment_method: "Payment",
  document_type: "Document Type",
  full_name: "Full Name",
  id_number: "ID Number",
  date_of_birth: "Date of Birth",
  issue_date: "Issue Date",
  expiry_date: "Expiry Date",
  address: "Address",
};

export function label(key: string): string {
  return (
    LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
