import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/check-url?url=https://...
 * Server-side HEAD request — avoids CORS issues from browser
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json({ status: 400, error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "SEO-Admin-Check/1.0" },
      // 5s timeout
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json({ status: res.status, ok: res.ok });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ status: 0, error: msg });
  }
}
