import { inject } from "vitest";

/**
 * One page, as a reader is served it.
 *
 * ASSERTIONS ARE MADE AGAINST THE DECODED DOCUMENT. React escapes `'` as
 * `&#x27;`, and a test that matched that literally would be asserting on
 * React's escaping table rather than on the page's content -- and would break
 * on a title whose punctuation happens to escape differently.
 *
 * It takes the server as an argument rather than reading one, because this
 * suite runs TWO: the seeded instance every other file asks, and the fresh one
 * `front-page.test.ts` needs to see an empty catalogue at all.
 */
export async function documentFrom(
  baseUrl: string,
  path: string,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${baseUrl}${path}`);
  const raw = await response.text();
  const text = raw
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  return { status: response.status, text };
}

/** The seeded instance, which is the one most of this suite asks. */
export async function documentAt(path: string): Promise<{ status: number; text: string }> {
  return documentFrom(inject("baseUrl"), path);
}
