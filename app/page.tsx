"use client";

import { useEffect, useState } from "react";

import { compare } from "@/lib/compare";
import { sampleExtractions, SAMPLES, SampleMeta } from "@/lib/samples";
import { CompareRow, Extraction, Field, label } from "@/lib/types";

function confColor(c: number): string {
  return c >= 0.85 ? "#10b981" : c >= 0.65 ? "#d97706" : "#dc2626";
}

function highlightJson(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return json
    .replace(/"([^"]+)":/g, '<span class="jkey">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="jstr">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="jnum">$1</span>');
}

function jsonView(ext: Extraction) {
  const fields: Record<string, string> = {};
  ext.fields.forEach((f) => (fields[f.key] = f.value));
  const out: any = { doc_type: ext.doc_type, fields };
  if (ext.line_items.length) out.line_items = ext.line_items;
  return out;
}

function Boxes({ fields }: { fields: Field[] }) {
  return (
    <>
      {fields
        .filter((f) => f.bbox)
        .map((f, i) => {
          const [x0, y0, x1, y1] = f.bbox!;
          const c = confColor(f.confidence);
          const below = y0 < 0.045;
          return (
            <div
              key={i}
              className={`box${below ? " below" : ""}`}
              style={{
                left: `${x0 * 100}%`,
                top: `${y0 * 100}%`,
                width: `${(x1 - x0) * 100}%`,
                height: `${(y1 - y0) * 100}%`,
                borderColor: c,
                background: `${c}1f`,
              }}
            >
              <span className="tag" style={{ background: c }}>
                {label(f.key)}
              </span>
            </div>
          );
        })}
    </>
  );
}

export default function Page() {
  const [status, setStatus] = useState<{ mock: boolean; model: string } | null>(null);
  const [active, setActive] = useState<string>(SAMPLES[0].name);
  const [imgUrl, setImgUrl] = useState<string>(`/samples/${SAMPLES[0].name}.png`);
  const [vlm, setVlm] = useState<Extraction | null>(null);
  const [baseline, setBaseline] = useState<Extraction | null>(null);
  const [hasBaseline, setHasBaseline] = useState(true);
  const [engine, setEngine] = useState<"vlm" | "baseline">("vlm");
  const [tab, setTab] = useState<"json" | "compare">("json");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetch("/api/extract")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ mock: true, model: "gpt-4o-mini" }));
    loadSample(SAMPLES[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSample(name: string) {
    setActive(name);
    setEngine("vlm");
    setHasBaseline(true);
    setError("");
    setImgUrl(`/samples/${name}.png`);
    const meta: SampleMeta = await fetch(`/samples/${name}.json`).then((r) => r.json());
    const { vlm: v, baseline: b } = sampleExtractions(meta);
    setVlm(v);
    setBaseline(b);
  }

  async function onUpload(file: File) {
    setError("");
    setLoading(true);
    setEngine("vlm");
    setHasBaseline(false);
    setActive("");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImgUrl(dataUrl);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "extraction failed");
        setVlm(data as Extraction);
        setBaseline({ engine: "baseline", doc_type: data.doc_type, fields: [], line_items: [], note: "" });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const shown = engine === "vlm" ? vlm : baseline;
  const rows: CompareRow[] = vlm && baseline && hasBaseline ? compare(baseline, vlm) : [];
  const missed = rows.filter((r) => r.status === "missed").length;

  return (
    <div className="wrap">
      <header className="hero">
        <div className="eyebrow">Document Intelligence</div>
        <h1 className="title">
          Visual <span className="grad">Document AI</span>
        </h1>
        <p className="sub">
          Turn invoices, receipts &amp; IDs into structured data — with bounding boxes over every
          field, confidence scores, and a side-by-side of OCR+regex vs a vision-language model.
        </p>
        <div className="badges">
          {status && (
            <span className={`badge ${status.mock ? "mock" : "live"}`}>
              {status.mock ? "🟣 Sample demo (no key)" : "🟢 Live uploads enabled"}
            </span>
          )}
          <span className="badge">model {status?.model || "gpt-4o-mini"}</span>
          <span className="badge">VLM extraction</span>
          <span className="badge">bounding boxes + confidence</span>
        </div>
      </header>

      <div className="controls">
        {SAMPLES.map((s) => (
          <button
            key={s.name}
            className={`pick${active === s.name ? " active" : ""}`}
            onClick={() => loadSample(s.name)}
          >
            {s.label}
          </button>
        ))}
        <label className="pick upload">
          ⬆ Upload your own
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </label>
      </div>

      <div className="grid">
        {/* Document + boxes */}
        <div className="card">
          <h3>
            Annotated document
            <span className="spacer" />
            {hasBaseline && (
              <span className="toggle">
                <button className={engine === "vlm" ? "on" : ""} onClick={() => setEngine("vlm")}>
                  ✨ VLM
                </button>
                <button className={engine === "baseline" ? "on" : ""} onClick={() => setEngine("baseline")}>
                  ⚙️ Baseline
                </button>
              </span>
            )}
          </h3>
          <div className="docwrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imgUrl ? <img src={imgUrl} alt="document" /> : <div className="placeholder">No document</div>}
            {!loading && shown && <Boxes fields={shown.fields} />}
            {loading && (
              <div className="placeholder">
                <span className="spin" /> &nbsp;extracting with the VLM…
              </div>
            )}
          </div>
          <div className="note">
            🟩 high · 🟧 medium · 🟥 low confidence.{" "}
            {shown?.note}
          </div>
        </div>

        {/* Fields + KPIs */}
        <div className="card">
          <h3>Detected fields</h3>
          {vlm && (
            <div className="kpis">
              <span className="kpi">
                doc type <b>{(shown || vlm).doc_type}</b>
              </span>
              {hasBaseline && baseline && (
                <span className="kpi">
                  baseline <b>{baseline.fields.length}</b>
                </span>
              )}
              <span className="kpi win">
                VLM fields <b>{vlm.fields.length}</b>
              </span>
              {hasBaseline && (
                <span className="kpi win">
                  recovered <b>+{missed}</b>
                </span>
              )}
              {vlm.usage && vlm.usage.cost_usd > 0 && (
                <span className="kpi">
                  cost <b>${vlm.usage.cost_usd.toFixed(5)}</b>
                </span>
              )}
            </div>
          )}
          {error && <div className="note" style={{ color: "#dc2626" }}>⚠ {error}</div>}
          {shown && shown.fields.length === 0 && <div className="note">{shown.note}</div>}
          {shown?.fields.map((f, i) => {
            const pct = Math.round(f.confidence * 100);
            return (
              <div className="fld" key={i}>
                <div className="fld-top">
                  <span className="fld-key">{label(f.key)}</span>
                  <span className="fld-val mono">{f.value}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${pct}%`, background: confColor(f.confidence) }} />
                </div>
                <div className="confnote">confidence {pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* JSON + comparison */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="tabs2">
          <button className={`tab2${tab === "json" ? " on" : ""}`} onClick={() => setTab("json")}>
            Structured JSON
          </button>
          <button className={`tab2${tab === "compare" ? " on" : ""}`} onClick={() => setTab("compare")}>
            Baseline vs VLM
          </button>
        </div>
        {tab === "json" && vlm && (
          <pre className="json" dangerouslySetInnerHTML={{ __html: highlightJson(jsonView(vlm)) }} />
        )}
        {tab === "compare" &&
          (rows.length ? (
            <table className="cmp">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>VLM value</th>
                  <th>Baseline (OCR+regex)</th>
                  <th>Conf.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.field}</td>
                    <td className="mono">{r.vlm}</td>
                    <td className="mono">{r.status === "missed" ? "— not found —" : r.baseline}</td>
                    <td>{Math.round(r.confidence * 100)}%</td>
                    <td>
                      <span className={`statustag ${r.status}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="note">
              The OCR+regex baseline runs on the bundled samples (and in the local Python version).
              Pick a sample above to see the side-by-side.
            </div>
          ))}
      </div>

      <div className="foot">
        Boxes are grounded on the page; the VLM (gpt-4o-mini) decides what each value means.
        Bundled samples render from baked ground truth so the demo always works.
      </div>
    </div>
  );
}
