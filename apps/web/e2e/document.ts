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
  return { status: response.status, text: decoded(await response.text()) };
}

/**
 * One served document, with React's escaping undone.
 *
 * SHARED WITH `submit` BELOW rather than written twice. A form replayed into the
 * page comes back as the same page, and two readings of it that differed over
 * `&#x27;` would make an assertion pass on a `GET` and fail on a `POST` of the
 * same surface.
 */
function decoded(raw: string): string {
  return raw
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/** The seeded instance, which is the one most of this suite asks. */
export async function documentAt(path: string): Promise<{ status: number; text: string }> {
  return documentFrom(inject("baseUrl"), path);
}

/**
 * One `<form>` the server rendered: where it posts, and every field it carries.
 *
 * THE FIELDS INCLUDE NEXT'S OWN. A Server Action renders as a `POST` form with a
 * hidden `$ACTION_ID_<hash>` input and no visible action attribute, and that
 * input is how the request names which action to run -- so a replay that picked
 * only the fields this app wrote would post a form the server cannot route.
 */
export interface RenderedForm {
  /** The form's `action`. Empty means the document's own URL, query included. */
  action: string;
  fields: [string, string][];
}

/**
 * Every `POST` form on a page, in document order.
 *
 * PARSED CASE-INSENSITIVELY, because React emits `encType` and `method="POST"`
 * while HTML matches attribute names and this method name without regard to
 * case. A reader that looked for `enctype` would find no forms at all and report
 * a page that plainly has them as having none.
 */
export function postFormsIn(text: string): RenderedForm[] {
  return [...text.matchAll(/<form\b([^>]*)>(.*?)<\/form>/gis)]
    .filter(([, attributes]) => /method\s*=\s*"post"/i.test(attributes ?? ""))
    .map(([, attributes, body]) => ({
      action: /\baction\s*=\s*"([^"]*)"/i.exec(attributes ?? "")?.[1] ?? "",
      fields: [...(body ?? "").matchAll(/<input\b([^>]*)>/gi)].flatMap(([, input]) => {
        const name = /\bname\s*=\s*"([^"]*)"/i.exec(input ?? "")?.[1];
        if (name === undefined) return [];
        return [
          [name, /\bvalue\s*=\s*"([^"]*)"/i.exec(input ?? "")?.[1] ?? ""] as [string, string],
        ];
      }),
    }));
}

/**
 * Submits one rendered form, exactly as a browser with JavaScript switched off
 * submits it.
 *
 * WHICH IS WHY THIS IS STILL THE PAGE-OVER-HTTP SEAM AND NOT A BROWSER. A Server
 * Action form needs no script to work -- React's progressive enhancement posts
 * it as an ordinary `multipart/form-data` request -- so replaying the form the
 * server just rendered observes exactly what such a browser would, at no
 * dependency and no browser binaries in CI. ADR-0103's reservation of Playwright
 * for "what genuinely needs a browser" is untouched: a form that submits without
 * script does not.
 *
 * THE `Origin` HEADER IS SENT, because a browser sends one and Next checks it:
 * without it the server logs `Missing 'origin' header from a forwarded Server
 * Actions request` and goes on -- a warning today, and exactly the kind of
 * leniency that becomes a refusal in a later version. Measured on 16.3.4.
 *
 * AN EMPTY `action` IS THE DOCUMENT'S OWN URL, QUERY INCLUDED, which is the HTML
 * rule and is load-bearing here: the surface re-renders its own search after the
 * action runs, and a replay that dropped the query string would come back to a
 * page with nothing on it.
 */
export async function submit(
  baseUrl: string,
  at: string,
  form: RenderedForm,
): Promise<{ status: number; text: string }> {
  const body = new FormData();
  for (const [name, value] of form.fields) body.append(name, value);
  const response = await fetch(`${baseUrl}${form.action === "" ? at : form.action}`, {
    method: "POST",
    headers: { origin: baseUrl },
    body,
  });
  return { status: response.status, text: decoded(await response.text()) };
}
