import { NextRequest, NextResponse } from "next/server";

import { extractUpload, MOCK, MODEL } from "@/lib/llm";

// Node runtime (OpenAI SDK); never statically cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ mock: MOCK, model: MODEL });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const image: unknown = body?.image;
    if (typeof image !== "string" || !image.startsWith("data:image")) {
      return NextResponse.json(
        { error: "A base64 'image' data URL is required." },
        { status: 400 }
      );
    }
    const result = await extractUpload(image);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || "extraction error" },
      { status: 500 }
    );
  }
}
