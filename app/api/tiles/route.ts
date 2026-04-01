import { NextRequest, NextResponse } from "next/server";
import { open, stat } from "fs/promises";
import path from "path";

const PMTILES_PATH = path.join(
  process.cwd(),
  "public",
  "data",
  "flood_pulse.pmtiles"
);

/**
 * Range-request proxy for the PMTiles file.
 * Next.js dev server doesn't support HTTP Range requests on static files,
 * so the pmtiles library can't read tiles directly from /data/*.pmtiles.
 * This route fills that gap in development. In production on Vercel,
 * the static file is served by the CDN with native range support.
 */
export async function GET(request: NextRequest) {
  try {
    const fileStat = await stat(PMTILES_PATH);
    const fileSize = fileStat.size;
    const range = request.headers.get("range");

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid range", { status: 416 });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
      const length = end - start + 1;

      const fd = await open(PMTILES_PATH, "r");
      const buffer = Buffer.alloc(length);
      await fd.read(buffer, 0, length, start);
      await fd.close();

      return new NextResponse(buffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(length),
          "Content-Type": "application/octet-stream",
          "Accept-Ranges": "bytes",
        },
      });
    }

    // Non-range: return file size header so PMTiles can determine archive size
    return new NextResponse(null, {
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": "application/octet-stream",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new NextResponse("PMTiles file not found", { status: 404 });
  }
}
