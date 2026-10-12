import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { clampThumbnailWidth, isThumbnailSource } from "@/app/lib/thumbnail";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_ENTRIES = 300;

// Small in-memory cache so a busy product is resized once per server, not once
// per visitor. Thumbnails are a few kilobytes, so 300 of them are cheap.
const cache = new Map<string, Buffer>();

function remember(key: string, value: Buffer) {
  if (cache.size >= CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/** The safe answer whenever a thumbnail cannot be made: the original photo. */
function original(source: string) {
  return NextResponse.redirect(source, { status: 302, headers: { "Cache-Control": "public, max-age=300" } });
}

/**
 * GET /api/thumb?src=<public photo url>&w=96
 *
 * A small WebP copy of one of the shop's own product photos. If anything goes
 * wrong (image library missing, photo unreachable, a format it cannot read)
 * the visitor is simply sent to the original photo, so this can only ever make
 * a page faster, never break an image.
 */
export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("src") ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!isThumbnailSource(source, supabaseUrl)) {
    return NextResponse.json({ error: "Not a product photo." }, { status: 400 });
  }
  if (!checkRateLimit(request, "thumb").allowed) {
    return original(source);
  }

  const width = clampThumbnailWidth(request.nextUrl.searchParams.get("w"));
  const key = `${width}:${source}`;
  const cached = cache.get(key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_CONTROL, "X-Thumb": "hit" },
    });
  }

  try {
    const upstream = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const type = upstream.headers.get("content-type") ?? "";
    const length = Number(upstream.headers.get("content-length") ?? 0);

    // SVG is already tiny and is not rasterised here; send it on as it is.
    if (!upstream.ok || !type.startsWith("image/") || type.includes("svg") || length > MAX_SOURCE_BYTES) {
      return original(source);
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > MAX_SOURCE_BYTES) return original(source);

    const { default: sharp } = await import("sharp");
    const output = await sharp(input, { failOn: "none", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();

    remember(key, output);
    return new NextResponse(new Uint8Array(output), {
      headers: { "Content-Type": "image/webp", "Cache-Control": CACHE_CONTROL, "X-Thumb": "miss" },
    });
  } catch {
    return original(source);
  }
}
