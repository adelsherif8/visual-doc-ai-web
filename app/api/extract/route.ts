import { NextRequest, NextResponse } from "next/server";

import { extractDocument, MOCK, MODEL } from "@/lib/llm";

// Node runtime (OpenAI SDK + tesseract.js WASM); never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ mock: MOCK, model: MODEL });
}

export async function POST(req: NextRequest) {
  if (MOCK) {
    return NextResponse.json(
      { error: "No OPENAI_API_KEY set on the server, so live extraction is disabled." },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();
    const image: unknown = body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json({ error: "A base64 'image' data URL is required." }, { status: 400 });
    }
    const result = await extractDocument(image);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "extraction error" },
      { status: 500 }
    );
  }
}
