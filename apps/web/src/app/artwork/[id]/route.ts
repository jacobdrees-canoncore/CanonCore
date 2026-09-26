import { getDb, readArtwork } from "@canoncore/db";

/**
 * ONE STORED PICTURE'S BYTES, served from this instance (ADR-0037, CNCORE-358).
 *
 * THIS IS WHAT REPLACES HOTLINKING. The Item page points here and never at the
 * source, so no reader's browser is sent to a third party and nothing a
 * provider does to a path reaches a picture already stored.
 *
 * AND IT KEEPS THE BYTES INSIDE THIS INSTANCE, which the wiki's permission
 * requires: it reaches one person (ADR-0057), so nothing may point at these
 * from elsewhere (ADR-0089). Each header below is one half of that:
 *
 * - `Cross-Origin-Resource-Policy: same-origin` is what a browser refuses a
 *   cross-origin `<img>` on, so another site -- another instance included --
 *   cannot embed one.
 * - `Cache-Control: private` keeps a shared cache from holding a copy, and
 *   `no-cache` makes the browser ask again before reusing its own, so a
 *   picture past its source's ceiling stops showing on the next view rather
 *   than an hour after it.
 * - `X-Content-Type-Options: nosniff` holds the browser to the stored type,
 *   which the fetch admitted only as a raster image.
 *
 * AN ID ADDRESSING NOTHING IS A 404 WHETHER OR NOT IT COULD BE ONE (ADR-0066),
 * so a caller cannot tell a malformed id from one nobody minted.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const stored = await readArtwork(getDb(), id);
  if (!stored) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(stored.bytes), {
    headers: {
      "content-type": stored.mediaType,
      "cross-origin-resource-policy": "same-origin",
      "cache-control": "private, no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}
