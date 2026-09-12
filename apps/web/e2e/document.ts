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
  cookie?: string,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, { headers: headersWith(cookie) });
  return { status: response.status, text: decoded(await response.text()) };
}

/**
 * WHO IS ASKING, as a browser says it: a `Cookie` header or nothing at all.
 *
 * NOTHING IS THE DEFAULT, and that is the right default for this suite. Most of
 * what these files assert is the READ path, which ADR-0044 leaves open -- so a
 * test that says nothing about a session is asserting what a visitor to the demo
 * sees, which is the stricter of the two readings.
 */
function headersWith(cookie: string | undefined): HeadersInit {
  return cookie === undefined ? {} : { cookie };
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
  return (
    raw
      /*
       * REACT'S TEXT-NODE SEPARATOR, WHICH IS NOT CONTENT. Server-rendered HTML
       * carries an empty `<!-- -->` between two adjacent text nodes, so markup
       * written as `{count} items` arrives as `3<!-- --> items` -- invisible to a
       * reader and fatal to any assertion about the sentence they read. Removed
       * for the reason the escaping below is: what is asserted should be the
       * page's content rather than React's serialisation of it.
       */
      .replaceAll("<!-- -->", "")
      .replaceAll("&#x27;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
  );
}

/** The seeded instance, which is the one most of this suite asks. */
export async function documentAt(
  path: string,
  cookie?: string,
): Promise<{ status: number; text: string }> {
  return documentFrom(inject("baseUrl"), path, cookie);
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
 * Every NAVIGATING form on a page: the ones a browser turns into a `GET` with
 * the fields as search params.
 *
 * DEFINED AS "NOT A POST" RATHER THAN AS `method="get"`, because `GET` is HTML's
 * default and neither React nor `next/form` writes the attribute out for one. A
 * reader that looked for `method="get"` would find none of them and report a page
 * of search boxes as having no forms at all.
 */
export function navigatingFormsIn(text: string): RenderedForm[] {
  return formsIn(text).filter(({ method }) => method !== "post");
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
  return formsIn(text).filter(({ method }) => method === "post");
}

/** Every form on a page, in document order, whichever way it submits. */
function formsIn(text: string): (RenderedForm & { method: string })[] {
  return [...text.matchAll(/<form\b([^>]*)>(.*?)<\/form>/gis)].map(([, attributes, body]) => ({
    method: (/\bmethod\s*=\s*"([^"]*)"/i.exec(attributes ?? "")?.[1] ?? "get").toLowerCase(),
    action: /\baction\s*=\s*"([^"]*)"/i.exec(attributes ?? "")?.[1] ?? "",
    fields: [...inputsIn(body ?? ""), ...selectsIn(body ?? "")],
  }));
}

/**
 * Every `<input>` a browser would SUBMIT, which is not every `<input>` there is.
 *
 * AN UNCHECKED BOX SUBMITS NOTHING, and that is HTML's rule rather than a
 * convenience: a checkbox contributes its name and value only when checked, and
 * a form replayer that sent `isContainer=""` for a cleared box would post a
 * request no browser can produce -- turning "the owner left this alone" into a
 * value the server has to interpret. A CHECKED box with no `value` submits the
 * string `on`, which is where that default comes from.
 *
 * This was an open gap rather than a rule nobody had needed: until CNCORE-71 no
 * form in this app carried a checkbox, so every input on every page submitted
 * unconditionally and the distinction never arose.
 */
function inputsIn(body: string): [string, string][] {
  return [...body.matchAll(/<input\b([^>]*)>/gi)].flatMap(([, input]) => {
    const attributes = input ?? "";
    const name = /\bname\s*=\s*"([^"]*)"/i.exec(attributes)?.[1];
    if (name === undefined) return [];
    const value = /\bvalue\s*=\s*"([^"]*)"/i.exec(attributes)?.[1];
    const type = (/\btype\s*=\s*"([^"]*)"/i.exec(attributes)?.[1] ?? "text").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (!/\bchecked\b/i.test(attributes)) return [];
      return [[name, value ?? "on"] as [string, string]];
    }
    return [[name, value ?? ""] as [string, string]];
  });
}

/**
 * Every `<select>`, as the option the server marked selected.
 *
 * PARSED AT ALL, WHICH IT WAS NOT UNTIL CNCORE-71. This reader claims to submit
 * a form "exactly as a browser with JavaScript switched off submits it", and it
 * silently ignored selects -- so a page carrying one would have its form
 * replayed with that field missing entirely, and the test would be asserting
 * against a request no browser sends. A create form choosing one of ADR-0005's
 * seven kinds is the first form here to have one.
 *
 * FALLING BACK TO THE FIRST OPTION, which is what a browser does when no option
 * carries `selected`.
 */
function selectsIn(body: string): [string, string][] {
  return [...body.matchAll(/<select\b([^>]*)>(.*?)<\/select>/gis)].flatMap(([, attrs, options]) => {
    const name = /\bname\s*=\s*"([^"]*)"/i.exec(attrs ?? "")?.[1];
    if (name === undefined) return [];
    const all = [...(options ?? "").matchAll(/<option\b([^>]*)>/gi)].map(([, option]) => ({
      value: /\bvalue\s*=\s*"([^"]*)"/i.exec(option ?? "")?.[1] ?? "",
      selected: /\bselected\b/i.test(option ?? ""),
    }));
    const chosen = all.find((option) => option.selected) ?? all[0];
    return chosen === undefined ? [] : [[name, chosen.value] as [string, string]];
  });
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
  cookie?: string,
): Promise<{ status: number; text: string }> {
  const response = await post(baseUrl, form.action === "" ? at : form.action, form, cookie);
  return { status: response.status, text: decoded(await response.text()) };
}

/** The request itself, for the one caller that needs the response's headers. */
async function post(
  baseUrl: string,
  at: string,
  form: RenderedForm,
  cookie?: string,
  redirect: RequestRedirect = "follow",
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of form.fields) body.append(name, value);
  return fetch(`${baseUrl}${at}`, {
    method: "POST",
    headers: { origin: baseUrl, ...headersWith(cookie) },
    body,
    redirect,
  });
}

/**
 * One rendered login form with the password typed into it, leaving Next's own
 * hidden fields exactly as the server wrote them.
 *
 * SHARED WITH `login-page.test.ts`, which submits this form with the WRONG
 * password on purpose. Two copies of the same field-filling would be two places
 * to change on the day the form grows a field.
 */
export function carrying(form: RenderedForm, password: string): RenderedForm {
  return {
    ...form,
    fields: form.fields.map(([name, value]): [string, string] =>
      name === "password" ? [name, password] : [name, value],
    ),
  };
}

/**
 * Logs in the way an owner does: the form on `/login`, submitted with no
 * JavaScript, and the cookie the server hands back.
 *
 * EVERY FILE THAT WRITES GOES THROUGH HERE, because a write is the owner's since
 * CNCORE-109 and this is the only way to become the owner. The alternative --
 * minting a session in the database and spelling the cookie out -- would assert
 * the write path against a session the app never issued.
 *
 * `redirect: "manual"` IS LOAD-BEARING. The action answers `303` and the cookie
 * is on THAT response; `fetch` follows a redirect by default and hands back the
 * final one, which carries no `Set-Cookie` at all -- and node's fetch keeps no
 * jar, so the followed request would arrive logged out. A silent empty answer
 * rather than an error, which is why it is spelled out here.
 *
 * THE COOKIE'S NAME IS NOT WRITTEN DOWN, and is read off the response instead.
 * This suite is a browser's view of the app: a browser sends back what it was
 * given, and a name hardcoded here would be a second place to change it.
 */
export async function logInAt(baseUrl: string, password: string): Promise<string> {
  const { text } = await documentFrom(baseUrl, "/login");
  const [form] = postFormsIn(text);
  if (!form) throw new Error(`${baseUrl}/login offered no form to log in with`);

  const response = await post(baseUrl, "/login", carrying(form, password), undefined, "manual");
  const [issued] = response.headers.getSetCookie();
  if (issued === undefined) {
    throw new Error(`logging in at ${baseUrl} set no cookie; answered ${response.status}`);
  }
  // `name=value`, which is all a browser sends back. The attributes after it --
  // HttpOnly, Path, SameSite -- are instructions TO the browser rather than
  // anything it repeats.
  return issued.split(";")[0] ?? "";
}

/**
 * One `<section>` of a page, by the heading it is labelled with.
 *
 * IT THROWS RATHER THAN ANSWERING NOTHING, which is what makes
 * `expect(() => section(...)).toThrow()` a usable assertion that a surface is
 * ABSENT. A helper answering `undefined` would let a test that forgot to check
 * pass against a page missing the whole section.
 */
export function sectionIn(text: string, label: string): string {
  const found = text.match(new RegExp(`<section[^>]*aria-labelledby="${label}".*?</section>`))?.[0];
  if (!found) throw new Error(`the page rendered no \`${label}\` section`);
  return found;
}
