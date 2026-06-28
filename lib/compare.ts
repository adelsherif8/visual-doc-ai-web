import { CompareRow, Extraction, label } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// One row per field the VLM found, noting whether the baseline matched it.
export function compare(baseline: Extraction, vlm: Extraction): CompareRow[] {
  const b = new Map(baseline.fields.map((f) => [f.key, f]));
  return vlm.fields.map((f) => {
    const bf = b.get(f.key);
    let status: CompareRow["status"];
    if (!bf) status = "missed";
    else if (norm(bf.value) === norm(f.value)) status = "match";
    else status = "differs";
    return {
      field: label(f.key),
      vlm: f.value,
      baseline: bf ? bf.value : "—",
      confidence: f.confidence,
      status,
    };
  });
}
