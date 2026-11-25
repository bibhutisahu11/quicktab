import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json({ error: "UNSPLASH_ACCESS_KEY not configured" }, { status: 503 });
  }

  try {
    // Add "food Indian" context to get better food photos
    const query = encodeURIComponent(`${q} food Indian dish`);
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=6&orientation=squarish&content_filter=high`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Unsplash error: ${res.status} ${err}` }, { status: 502 });
    }

    const data = await res.json();
    // Return small/regular URLs + attribution (Unsplash requires attribution)
    const photos = (data.results ?? []).map((p: {
      id: string;
      urls: { small: string; regular: string };
      user: { name: string; links: { html: string } };
      links: { html: string };
    }) => ({
      id: p.id,
      small: p.urls.small,
      regular: p.urls.regular,
      photographer: p.user.name,
      photographerUrl: p.user.links.html,
      unsplashUrl: p.links.html,
    }));

    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
