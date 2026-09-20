import type { AppRouterClient } from "@canoncore/api/routers";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
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
function headersWith(cookie: string | undefined): Record<string, string> {
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
 * One address AS NEXT'S OWN ROUTER ASKS FOR IT when a `<Link>` to it enters the
 * viewport, rather than as a reader asks for it.
 *
 * `RSC: 1` AND `Next-Router-Prefetch: 1` ARE THE WHOLE DIFFERENCE, and they are
 * the two headers the router sends on an automatic prefetch. What comes back is
 * what a reader who merely scrolled would have cost this instance -- which for
 * every dynamic route here is nothing at all (ADR-0161).
 *
 * THE HEADERS ARE SENT RATHER THAN A LINK SCROLLED INTO VIEW, because the
 * subject is what the SERVER does with such a request. A browser would answer
 * the second question -- whether the router issues one -- and Next's own
 * reference answers that already: prefetching is production-only, and this
 * suite serves a production build.
 */
export async function prefetchAt(
  path: string,
  cookie?: string,
): Promise<{ status: number; text: string }> {
  const response = await fetch(`${inject("baseUrl")}${path}`, {
    headers: { ...headersWith(cookie), "Next-Router-Prefetch": "1", RSC: "1" },
  });
  return { status: response.status, text: decoded(await response.text()) };
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
    fields: [...inputsIn(body ?? ""), ...selectsIn(body ?? ""), ...textareasIn(body ?? "")],
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
 * Every `<textarea>`, as the text the server put INSIDE it.
 *
 * PARSED AT ALL, WHICH IT WAS NOT UNTIL CNCORE-74, and the gap is the one
 * `selectsIn` above was until CNCORE-71: this reader claims to submit a form
 * "exactly as a browser with JavaScript switched off submits it", and a form
 * carrying a textarea would have been replayed with that field missing
 * entirely -- so a test would assert against a request no browser sends, and
 * the server would read the absence as a value. The Owner note is the first
 * field here that is free text over more than one line.
 *
 * ITS VALUE IS ITS CONTENT, not a `value` attribute -- which is HTML's rule for
 * this one element and the reason it needs a reader of its own rather than a
 * line in `inputsIn`. An empty textarea submits its name with an empty value,
 * which is what makes "the owner cleared the box" expressible here.
 *
 * THE CONTENT IS ALREADY DECODED by the time this runs, because `decoded`
 * reads the whole document before any form is parsed. What it cannot survive is
 * a value containing a literal `<`, which is the standing limit of every regex
 * in this file rather than a new one.
 */
function textareasIn(body: string): [string, string][] {
  return [...body.matchAll(/<textarea\b([^>]*)>(.*?)<\/textarea>/gis)].flatMap(
    ([, attributes, content]) => {
      const name = /\bname\s*=\s*"([^"]*)"/i.exec(attributes ?? "")?.[1];
      if (name === undefined) return [];
      return [[name, content ?? ""] as [string, string]];
    },
  );
}

/**
 * One rendered form with fields TYPED INTO, leaving Next's own hidden ones alone.
 *
 * IT REFUSES A NAME THE FORM DOES NOT CARRY, which is what stops a typo here
 * posting a field the server ignores and a test passing on a page that never
 * offered it.
 *
 * SHARED, BECAUSE TWO FILES NOW WRITE THROUGH FORMS. `item-write.test.ts` wrote
 * this first and kept it to itself; CNCORE-72 gave it a second caller, and two
 * copies of "fill a form the way a browser fills one" is how two suites come to
 * disagree about what a browser sends.
 */
export function withFields(form: RenderedForm, values: Record<string, string>): RenderedForm {
  const named = new Set(form.fields.map(([name]) => name));
  for (const name of Object.keys(values)) {
    if (!named.has(name)) {
      throw new Error(`that form carries no \`${name}\`: ${JSON.stringify(form.fields)}`);
    }
  }
  return {
    ...form,
    fields: form.fields.map(([name, value]): [string, string] => [name, values[name] ?? value]),
  };
}

/**
 * The form in a labelled section, which is the one that section's button posts.
 */
export function formIn(text: string, label: string): RenderedForm {
  const [form] = postFormsIn(sectionIn(text, label));
  if (!form) throw new Error(`the \`${label}\` section carried no form to submit`);
  return form;
}

/**
 * Submits one rendered form, exactly as a browser with JavaScript switched off
 * submits it.
 *
 * WHICH IS WHY THIS IS STILL THE PAGE-OVER-HTTP SEAM AND NOT A BROWSER. A Server
 * Action form needs no script to work -- React's progressive enhancement posts
 * it as an ordinary `multipart/form-data` request -- so replaying the form the
 * server just rendered observes exactly what such a browser would, at no
 * dependency and no browser binaries in CI.
 *
 * ADR-0103's Playwright reservation HAS since been spent -- on the drag, in
 * `apps/web/browser`, under CNCORE-73 -- and that changes nothing here, which
 * is worth saying rather than leaving a reader to check. The criterion was
 * always "what genuinely needs a browser", and a form that submits without
 * script does not. Nothing that can be replayed here belongs over there.
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
): Promise<Submitted> {
  return submitted(baseUrl, at, form, cookie);
}

/**
 * WHAT CAME BACK FROM A SUBMISSION: the document, and WHERE THE READER ENDED UP.
 *
 * `url` IS THE ADDRESS AFTER EVERY REDIRECT, which is the browser's address bar
 * and not the address the form was posted to. Most surfaces here answer the POST
 * itself, so the two are the same string and nothing reads this; a Server Action
 * that REDIRECTS makes them differ, and the difference is the whole of what a
 * reader keeps -- what a reload, a Back or a bookmark asks for next (CNCORE-290).
 *
 * READ OFF THE RESPONSE RATHER THAN PREDICTED, which is the point of taking it
 * from here at all. `fetch` follows the `303` and reports where it landed, so
 * this is the address the server chose; a test that rebuilt the expected address
 * the way the action builds it would agree with the action by construction.
 */
export interface Submitted {
  status: number;
  text: string;
  url: string;
}

/**
 * Submits one rendered form with ONE FIELD SENT AS A FILE PART.
 *
 * THE REQUEST NO BROWSER MAKES, which is the whole point of it (CNCORE-123). A
 * text input submits a part with no `filename` and `FormData.get` answers a
 * string for one; a part that CARRIES a filename is answered as a `File`
 * instead, whatever the field was called on the page that rendered it. A caller
 * composing a request by hand can send either, so this composes the one the app
 * never asked for -- and it is the only way to observe the server's answer to
 * it.
 *
 * A SUBMISSION RATHER THAN A FORM, which is why this is a second `submit` and
 * not a helper that edits `RenderedForm`. Every reader above produces strings
 * because the server renders text, and widening what a PARSED form may hold to
 * make one test expressible would put `File` in the type that five other files
 * read out as strings.
 *
 * IT REFUSES A NAME THE FORM DOES NOT CARRY, for the reason the helpers that
 * type into forms do: a typo here would post a field the server ignores, and the
 * test would pass against a surface that never offered it.
 */
export async function submitAsAFilePart(
  baseUrl: string,
  at: string,
  form: RenderedForm,
  name: string,
  cookie?: string,
): Promise<Submitted> {
  if (!form.fields.some(([key]) => key === name)) {
    throw new Error(`that form carries no \`${name}\`: ${JSON.stringify(form.fields)}`);
  }
  return submitted(baseUrl, at, form, cookie, name);
}

/**
 * One submission, however its parts are composed: where it goes, and the
 * document that comes back.
 *
 * AN EMPTY `action` IS THE DOCUMENT'S OWN URL, QUERY INCLUDED, which is the HTML
 * rule and is load-bearing here: the surface re-renders its own search after the
 * action runs, and a replay that dropped the query string would come back to a
 * page with nothing on it.
 */
async function submitted(
  baseUrl: string,
  at: string,
  form: RenderedForm,
  cookie?: string,
  asAFilePart?: string,
): Promise<Submitted> {
  const response = await post(baseUrl, form.action === "" ? at : form.action, form, cookie, {
    asAFilePart,
  });
  return { status: response.status, text: decoded(await response.text()), url: response.url };
}

/**
 * The body a browser would send for this form, with one part optionally sent as
 * a FILE rather than as text.
 *
 * `append` TAKES BOTH, and the difference is the part's `Content-Disposition`:
 * a string becomes a bare `name`, a `File` gains a `filename` -- which is what
 * makes `FormData.get` answer one on the server.
 */
function bodyOf(form: RenderedForm, asAFilePart?: string): FormData {
  const body = new FormData();
  for (const [name, value] of form.fields) {
    body.append(
      name,
      name === asAFilePart ? new File([value], "not-text.txt", { type: "text/plain" }) : value,
    );
  }
  return body;
}

/** The request itself, for the one caller that needs the response's headers. */
async function post(
  baseUrl: string,
  at: string,
  form: RenderedForm,
  cookie?: string,
  { redirect = "follow", asAFilePart }: { redirect?: RequestRedirect; asAFilePart?: string } = {},
): Promise<Response> {
  return fetch(`${baseUrl}${at}`, {
    method: "POST",
    headers: { origin: baseUrl, ...headersWith(cookie) },
    body: bodyOf(form, asAFilePart),
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

  const response = await post(baseUrl, "/login", carrying(form, password), undefined, {
    redirect: "manual",
  });
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
 * ONE GROUP, CREATED WHILE A COMPARISON IS HALF-MADE: the adversary the
 * byte-for-byte assertions are held against (CNCORE-253, CNCORE-271).
 *
 * THIS IS `import-page.test.ts`'S ACCIDENT, ARMED. That file creates three
 * Groups on the seeded instance from its own worker, and a Group landing
 * between two fetches of one address used to change what `<main>` held without
 * the address changing. Waiting for that timing is waiting on the scheduler --
 * it showed once in four full runs -- so the files that compare an address
 * against itself force it instead, every run.
 *
 * SHARED RATHER THAN WRITTEN TWICE, which is `withFields`' reason one file
 * over: `scope.test.ts` and `order-and-narrow.test.ts` both need it, and two
 * copies of "what another file does to this instance" is how two suites come
 * to disagree about what they are defending against.
 *
 * THROUGH THE ROUTER AS THE OWNER, which is the road the product takes -- a row
 * written straight into the database would put a Group on the page through a
 * door the app never opened. `group.create` is an `ownerProcedure`, so a
 * cookie that is not the Owner's answers `Unauthorized` and creates nothing,
 * and an adversary that quietly created nothing would leave every comparison
 * it guards passing for the wrong reason.
 */
export async function aGroupArrivesAt(baseUrl: string, cookie: string): Promise<void> {
  const asTheOwner: AppRouterClient = createORPCClient(
    new RPCLink({ url: `${baseUrl}/api/rpc`, headers: { cookie } }),
  );
  await asTheOwner.group.create({ name: `A Group that arrived mid-read ${crypto.randomUUID()}` });
}

/**
 * The sources ONE RENDERED ROW names, one string each.
 *
 * READ OFF THE ELEMENTS RATHER THAN OFF A SEPARATOR, which is the whole of
 * CNCORE-128: a label can carry any character, so a reader splitting on one
 * cannot tell `Acme, Inc.` from two sources, and neither could a test.
 *
 * IT THROWS ON ANYTHING BETWEEN TWO NAMES, which is the half a count alone
 * misses. Review found a rendering that put `, ` back BETWEEN the elements
 * passing every assertion: each name still its own element, and the reader
 * seeing the comma again. The separator is layout (ADR-0017), so what sits
 * between two names in the markup is nothing at all.
 *
 * SHARED, BECAUSE BOTH LISTS RENDER ONE COMPONENT. `AssertedBy` is the Members
 * list's and "Also appears in"'s alike since CNCORE-121, so two readings of it
 * in two files would be two ideas of what a row names.
 *
 * IT READS THE DECODED DOCUMENT, so a label carrying a literal `<` could still
 * split it -- the standing limit `textareasIn` names for every regex in this
 * file. Every label it reads is one this suite seeded, and none carries one.
 */
export function sourcesIn(row: string): string[] {
  const names = [...row.matchAll(/<span\b[^>]*\bdata-source\b[^>]*>/g)].map((opening) => {
    const from = (opening.index ?? 0) + opening[0].length;
    const to = closingSpan(row, from);
    return {
      from: opening.index ?? 0,
      to: to + "</span>".length,
      name: textOf(row.slice(from, to)),
    };
  });
  names.forEach((name, place) => {
    const next = names[place + 1];
    if (next === undefined) return;
    const between = row.slice(name.to, next.from);
    if (between !== "") {
      throw new Error(`that row puts \`${between}\` between two sources: ${row}`);
    }
  });
  return names.map(({ name }) => name);
}

/**
 * Where the `</span>` closing a span begins, given where its content starts.
 *
 * COUNTED RATHER THAN MATCHED LAZILY, because a source's name is printed
 * through `TheirWords` and so holds a span of its own (CNCORE-217). A lazy
 * match stops at THAT one's close, and reads the name as its inner tag's
 * opening with the outer close left over as something between two sources.
 */
function closingSpan(html: string, from: number): number {
  const tags = /<(\/?)span\b[^>]*>/g;
  tags.lastIndex = from;
  let depth = 0;
  for (let tag = tags.exec(html); tag !== null; tag = tags.exec(html)) {
    if (tag[1] === "") depth += 1;
    else if (depth === 0) return tag.index;
    else depth -= 1;
  }
  throw new Error(`a span never closes: ${html.slice(from)}`);
}

/**
 * What an element SAYS: its content with every tag inside it removed, which is
 * what a reader sees and what an assertion about the sentence is about.
 *
 * FOR A SENTENCE THAT NAMES A PROVIDER, which since CNCORE-217 prints the name
 * through `TheirWords` and so carries a span in the middle of what the Owner
 * reads as one line.
 */
export function textOf(html: string): string {
  return html.replaceAll(/<[^>]*>/g, "");
}

/**
 * What the page's one `<h1>` SAYS, which on an Item's page is its title.
 *
 * READ AS TEXT, since CNCORE-223 prints a title through `TheirWords` and so
 * inside a span of its own: an assertion about which title a page carries is
 * about the heading's words and not about how wide they may run. And EXACTLY
 * ONE heading, because a page with a second would make "the title" a guess.
 */
export function headingOf(text: string): string {
  const headings = [...text.matchAll(/<h1[^>]*>(.*?)<\/h1>/gs)];
  if (headings.length !== 1) throw new Error(`the page has ${headings.length} <h1>s, not one`);
  return textOf(headings[0]?.[1] ?? "");
}

/**
 * Everything a page QUOTES, one string per `<q>`.
 *
 * `<q>` IS THE WHOLE OF WHAT SAYS THE CATALOGUE IS NOT THE ONE MAKING A CLAIM
 * (ADR-0123), so "this sentence is quoted" is an assertion about the element and
 * what it says -- and not about the markup inside it, which since CNCORE-217 is a
 * span deciding how wide the quotation may run. Read as text, so a change to how
 * a quotation wraps is not a change to what it says.
 */
export function quotesIn(text: string): string[] {
  return [...text.matchAll(/<q\b[^>]*>(.*?)<\/q>/gs)].map(([, quoted]) => textOf(quoted ?? ""));
}

/**
 * One page's own content: everything the ROUTE rendered, without the shell
 * around it.
 *
 * IT EXISTS BECAUSE THE SHELL NOW ANSWERS THE SAME QUESTION THE PAGE DOES
 * (CNCORE-146). Since CNCORE-139 the header offers `/login` to every reader
 * with no session on an instance that has a password -- so on exactly the
 * instance where a refusal page MUST still name that step, a document-wide
 * `toContain('href="/login"')` passes whether the page names it or not. Four
 * surfaces assert that step; without this they would be asserting the shell and
 * calling it the page.
 *
 * READ AS THE `main` ELEMENT, which is the landmark the page's content IS to
 * anybody navigating by one. `headerOf` in `header.test.ts` reads the other
 * half of the same document the same way and refuses a second one for the same
 * reason: a helper that quietly took the first of two would assert against the
 * wrong element and pass.
 */
export function mainOf(text: string): string {
  const found = [...text.matchAll(/<main\b.*?<\/main>/gs)].map(([element]) => element);
  if (found.length === 0) throw new Error("that page rendered no main");
  if (found.length > 1) throw new Error(`that page rendered ${found.length} mains, not one`);
  return found[0] as string;
}

/**
 * `<main>` WITHOUT THE STATE THE WHOLE CATALOGUE DECIDES: today, the Group
 * picker, cut out along with its `<nav>`.
 *
 * WHAT IT IS FOR IS THE ONE ASSERTION THAT CANNOT BE MADE ANY OTHER WAY
 * (CNCORE-253, CNCORE-271). `scope` and `order-and-narrow` fetch one address
 * three times -- as the Owner, again, and with no session -- and require the
 * three answers to be IDENTICAL, because that is the only way to ask whether
 * the ADDRESS decides the page rather than a session or a script. Comparing
 * anything less than the whole region would let a difference hide in what was
 * left out.
 *
 * AND THE PICKER IS NOT SOMETHING THE ADDRESS DECIDES. `NarrowToAGroup` renders
 * EVERY Group there is, uncapped, and it sits inside `<main>` -- so on the
 * instance this suite shares, one Group created by another file between two of
 * those fetches is a byte difference in a region neither test is asking about.
 * `import-page.test.ts` creates three.
 *
 * NARROWING TO A STILL GROUP WAS THE PREVIOUS FIX AND IT REACHED THE ROWS ONLY.
 * `order-and-narrow`'s own docblock records it: the seeded Group nobody writes
 * to froze that Listing's Rows. The picker is catalogue-wide and sits in the
 * same `<main>`, so it went on moving -- which is CNCORE-271, the same
 * assertion failing again on Catalogue search four months of runs later.
 *
 * IT REFUSES A PAGE WITH NO PICKER rather than handing back the whole `<main>`.
 * Cutting a region out is how an assertion quietly stops covering it, and a
 * picker that vanished between two fetches is exactly the regression this
 * suite should go red on. `markedCurrentIn` beside each caller is the other
 * half: what the picker SAYS is still compared across all three fetches, as a
 * fact that does not depend on how many Groups exist.
 *
 * WHAT IT DOES NOT CUT is everything else in `<main>`, and that is deliberate.
 * `Holding`'s count is the NARROWED Listing's when there is a Group, the kind
 * picker is the `item_kinds` table's rather than the catalogue's, and the
 * alphabet is a constant -- so on a page narrowed to a Group nobody writes to,
 * the rest of `<main>` holds still already.
 */
export function steadyMainOf(text: string): string {
  const main = mainOf(text);
  const picker = oneNav(main, THE_GROUP_PICKER);
  // SPLICED BY INDEX RATHER THAN `replace`d, because a Group's name is the
  // Owner's own words: one holding `$&` would have `replace` paste the match
  // back in, and the cut would silently not happen.
  const cut = main.slice(0, picker.at) + main.slice(picker.at + picker.whole.length);
  /*
   * AND EXACTLY ONE OF THEM, which `mainOf` above demands of `<main>` for the
   * same reason. Cutting the first of two would leave the second INSIDE what is
   * compared -- catalogue-wide state back in the region, silently, and passing
   * every run until a Group happened to arrive. A page rendering two Group
   * pickers is a defect either way, so it is said rather than cut around.
   */
  if (hasNav(cut, THE_GROUP_PICKER)) {
    throw new Error(`that page rendered more than one ${THE_GROUP_PICKER}`);
  }
  return cut;
}

/**
 * One `<section>` of a page, by the heading it is labelled with.
 *
 * IT ENDS AT ITS OWN CLOSING TAG, COUNTED, which is the whole of CNCORE-147.
 * Every other way of finding the end is a bet on what the page renders NEXT,
 * and this suite has now lost that bet twice:
 *
 * - A NON-GREEDY MATCH stops at the FIRST `</section>`, so it truncates any
 *   section with one nested inside it. Every listing past the end of its walk
 *   renders `PastTheEnd`, whose own `<section>` is nested inside it -- and under
 *   the Members list's first one hid a defect, a second "Back to the start"
 *   below the notice's own, that no assertion could see (CNCORE-89 review).
 * - THE DOCUMENT'S LAST `</section>` was "Also appears in"'s end, on the
 *   reasoning that nothing renders after that list. `Attribution` does, and
 *   carries `aria-labelledby` of its own -- so on an item owing a notice the
 *   slice ran through the notices, and a count of `<li>` over it answered how
 *   many licences the item owed rather than how many orderings it sits in
 *   (CNCORE-135).
 * - THE NEXT SIBLING'S HEADING, NAMED, is the same bet one section along: the
 *   Members list ended where `also-appears-in` began, so anything rendered
 *   between the two would have been swallowed exactly as the notices were.
 *
 * Counting needs to know nothing about what follows, which is why it is the
 * reading that survives a page growing a section. THIS WAS SEVEN READINGS
 * BEFORE CNCORE-147 -- this one, two hand-rolled slices (`members` and
 * `alsoAppearsIn`), two verbatim copies of the non-greedy match in `front-page`
 * and `search`, and two more written inline (`values` in `item-page`,
 * `nothing-to-watch` in `works-page`) -- and they disagreed. `document.test.ts`
 * pins it on the shapes no fixture page renders.
 *
 * IT READS THE DECODED DOCUMENT, so owner text carrying a literal `<section>`
 * unbalances the count and this refuses the whole page: the standing limit
 * `textareasIn` names for every regex in this file rather than a new one. What
 * IS new is that it SAYS so. The non-greedy match answered such a page by luck,
 * stopping at the real closing tag because the owner's text carried no
 * `</section>` to stop at first. Nothing this suite seeds carries either.
 *
 * IT THROWS RATHER THAN ANSWERING NOTHING, which is what makes
 * `expect(() => sectionIn(...)).toThrow()` a usable assertion that a surface is
 * ABSENT. A helper answering `undefined` would let a test that forgot to check
 * pass against a page missing the whole section.
 *
 * THE TWO REFUSALS ARE DISTINCT, because a page that renders a section and
 * leaves it unclosed is a different fault from one that never rendered it, and
 * a reader told the wrong one goes looking in the wrong place.
 */
export function sectionIn(text: string, label: string): string {
  const opened = text.indexOf(`aria-labelledby="${label}"`);
  if (opened === -1) throw new Error(`the page rendered no \`${label}\` section`);
  /*
   * THE LABEL HAS TO BE INSIDE THAT OPENING TAG, which the non-greedy match
   * this replaced enforced by its shape (`<section[^>]*aria-labelledby=`) and
   * counting from the nearest `<section` alone does not. Without this the
   * nearest one is a previous SIBLING, and a label on anything else hands back
   * a whole section that is not the one asked for -- silently, and passing
   * every negative assertion made against it.
   */
  const start = text.lastIndexOf("<section", opened);
  if (start === -1 || text.slice(start, opened).includes(">")) {
    throw new Error(`the page rendered no \`${label}\` section`);
  }

  const tags = /<section\b|<\/section>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(text); tag !== null; tag = tags.exec(text)) {
    depth += tag[0] === "</section>" ? -1 : 1;
    if (depth === 0) return text.slice(start, tag.index + tag[0].length);
  }
  throw new Error(`the page left the \`${label}\` section unclosed`);
}

/**
 * Every moment a stretch of a page prints, as the markup marks them: the
 * machine-readable value and the words a reader sees.
 *
 * A MOMENT IS `<time>` OR IT IS NOT A MOMENT (CNCORE-177). Three surfaces print
 * one -- `/tasks`, `/devices` and `/settings` -- off three copies of the same
 * `Intl.DateTimeFormat` call, and one of them had lost the element: the words
 * were right and nothing that reads a page by its markup could tell that string
 * from any other. So this returns the PAIR rather than the text, because a
 * `<time>` whose `datetime` is unparseable is the same failure wearing the
 * right tag.
 *
 * READ WITH A REGEX, under the standing limit every reader in this file carries:
 * a page whose own content held a literal `<time>` would be miscounted. Nothing
 * this suite seeds does.
 */
export function momentsIn(text: string): { machine: string; printed: string }[] {
  return [...text.matchAll(/<time\b[^>]*\bdatetime="([^"]*)"[^>]*>(.*?)<\/time>/gi)].map(
    ([, machine, printed]) => ({ machine: machine as string, printed: printed as string }),
  );
}

/**
 * THE GROUP PICKER ON A LISTING PAGE, cut out of it so a link found in it is one
 * a reader picks a scope with rather than any link on the page that happens to
 * match (CNCORE-179).
 *
 * SHARED SINCE CNCORE-180, when the picker arrived on `/works` and `/search`
 * beside `/`: three copies of how a test finds it would be three readings of
 * one control, free to disagree about what counts as picking.
 */
export function scopesIn(text: string): string {
  return navIn(text, THE_GROUP_PICKER);
}

/**
 * THE GROUP PICKER'S LABEL, named once because two readers now need it: the one
 * above, which cuts it out to look INSIDE it, and `steadyMainOf`, which cuts it
 * out to look at everything else. Two spellings of it would be a page whose
 * picker one reader finds and the other silently does not.
 */
const THE_GROUP_PICKER = "Narrow to a Group";

/**
 * ONE PICKER ON A PAGE, by the words it is labelled with.
 *
 * WRITTEN ONCE BECAUSE THERE ARE THREE OF THEM NOW (CNCORE-175): the Group
 * picker above, the order and the kind. Each is a `nav` whose `aria-label` is
 * how a reader with a screen reader tells it from the others, so it is also how
 * a test tells them apart -- and three copies of this regex would be three
 * readings of what a picker IS, free to drift the day one of them renders
 * something else.
 */
export function navIn(text: string, label: string): string {
  return oneNav(text, label).inner;
}

/**
 * One picker as BOTH a slice and a position: what is inside it, and where the
 * whole element sits.
 *
 * THE POSITION IS WHAT `steadyMainOf` NEEDS and `navIn` never did, and it is
 * why this is one function rather than a second regex beside it. A reader that
 * found the picker to look inside it and a reader that found it to cut it out
 * would be two readings of what a picker IS, free to drift the day one of them
 * renders something else -- which is the argument `navIn` already made for
 * there being one of these at all.
 */
function oneNav(text: string, label: string): { at: number; whole: string; inner: string } {
  const found = navPattern(label).exec(text);
  if (!found) throw new Error(`the page offered no ${label}`);
  return { at: found.index, whole: found[0], inner: found[1] as string };
}

/** Whether a stretch of a page carries a picker with these words at all. */
function hasNav(text: string, label: string): boolean {
  return navPattern(label).test(text);
}

/**
 * ONE PICKER, BY ITS LABEL, as a pattern.
 *
 * THE LABEL IS ESCAPED, which matters now that a caller CUTS BYTES by the
 * match's index and length rather than only reading inside it. Every label
 * passed today is a literal, but these are aria-labels -- prose a designer
 * writes -- and the first one to carry a `(` or a `?` would make this match a
 * different span than the picker. Read, that is a wrong answer; cut, it silently
 * excises the wrong bytes and the comparison still passes.
 */
function navPattern(label: string): RegExp {
  return new RegExp(
    `<nav aria-label="${label.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>(.*?)</nav>`,
  );
}

/**
 * The address one picker links a choice at, by the words a reader picks it by
 * -- `scopeLinked` for any picker (CNCORE-175).
 */
export function pickedIn(text: string, label: string, words: string): string {
  const found = linkedIn(navIn(text, label), words);
  if (found === undefined) throw new Error(`the ${label} offered nothing called ${words}`);
  return found;
}

/** The words the given picker marks as the page's own. */
export function markedCurrentInPicker(text: string, label: string): string[] {
  return [...navIn(text, label).matchAll(/<a aria-current="true"[^>]*>(.*?)<\/a>/g)].map(
    ([, words]) => textOf(words ?? ""),
  );
}

/**
 * Where a stretch of a page links the words a reader follows, if it does.
 *
 * SHARED SINCE CNCORE-181, when the header came to be read for its links as the
 * picker already was: two copies of how a test finds a link by its words would
 * be two readings of one thing, free to disagree about what counts.
 *
 * THE WORDS ARE READ AS TEXT, `textOf` the link's inner markup, because since
 * CNCORE-223 a Group's name reaches the page through `TheirWords` and a link's
 * words are no longer bare text between its tags.
 */
export function linkedIn(html: string, words: string): string | undefined {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].find(
    ([, , linked]) => textOf(linked ?? "") === words,
  )?.[1];
}

/** The address the picker links a scope at, by the words a reader picks it by. */
export function scopeLinked(text: string, name: string): string {
  const found = linkedIn(scopesIn(text), name);
  if (found === undefined) throw new Error(`the picker offered nothing called ${name}`);
  return found;
}

/** The words of the one scope the picker marks as the page's own. */
export function markedCurrentIn(text: string): string[] {
  return [...scopesIn(text).matchAll(/<a aria-current="true"[^>]*>(.*?)<\/a>/g)].map(([, words]) =>
    textOf(words ?? ""),
  );
}

/**
 * Every Item one rendered page LISTS, in the order it lists them: each Row's
 * own link, which is the first link in its `<li>`.
 *
 * SHARED SINCE CNCORE-180, which would otherwise have made five copies of it
 * across three files: every walked Listing is oracled by the Items its pages
 * list, and a copy that drifted -- a `?via=` it stopped trimming, say -- would
 * be one walk counting differently from the rest.
 *
 * IT READ EVERY `/items/` LINK UNTIL CNCORE-184, when those stopped being the
 * same thing: a story's Row links each Ordering it sits in, so a page of a
 * hundred Rows links far more than a hundred Items.
 */
export function itemsListedOn(text: string): string[] {
  // `<li` AND THEN A SPACE OR THE `>`, so a `<link>` in the head is no Row.
  return [...text.matchAll(/<li(?:\s[^>]*)?>(?:(?!<\/li>).)*?href="\/items\/([^"?#]+)"/g)].map(
    ([, id]) => id as string,
  );
}

/**
 * Where the walk under a listing links the words a reader follows, if it does:
 * `Next`, `Previous`, `Back to the start` (CNCORE-174). The FIRST walk in what
 * it is handed, so an Item page's two Listings are read through `sectionIn`.
 *
 * SHARED SINCE CNCORE-174, when four files came to follow a step back.
 */
export function walkLinked(text: string, words: string): string | undefined {
  const walk = text.match(/<nav aria-label="More of this listing"[^>]*>(.*?)<\/nav>/)?.[1];
  return walk === undefined ? undefined : linkedIn(walk, words);
}

/** Where the letters above a listing link one of them, if they do (CNCORE-174). */
export function letterLinked(text: string, letter: string): string | undefined {
  const letters = text.match(/<nav aria-label="Jump to a letter"[^>]*>(.*?)<\/nav>/)?.[1];
  return letters === undefined ? undefined : linkedIn(letters, letter);
}

/** The letters the page marks as the one it was jumped to. */
export function lettersMarkedCurrentIn(text: string): string[] {
  const letters = text.match(/<nav aria-label="Jump to a letter"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
  return [...letters.matchAll(/<a [^>]*aria-current="true"[^>]*>(.*?)<\/a>/g)].map(([, words]) =>
    textOf(words ?? ""),
  );
}

/** A link the page was expected to offer, or a failure naming the one it did not. */
export function followed(href: string | undefined, words: string): string {
  if (href === undefined) throw new Error(`the page offered no ${words}`);
  return href;
}
