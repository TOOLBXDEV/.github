import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

/** Big-box store JSON (same payload as legacy /api/big-box-stores). Hyphenated path 404s on some Vercel builds; use this route. */
export async function GET() {
  try {
    const path = join(process.cwd(), "public", "big-box-stores.json");
    const raw = await readFile(path, "utf8");
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json(
      { stores: [], count: 0, note: "public/big-box-stores.json missing from deployment" },
      { status: 200 }
    );
  }
}
