---
status: accepted
---

# A read surface renders per request, and says so in its own file

Every page that reads the catalogue declares that it needs a request before it renders. In Next that
is `await connection()` at the top of the read, or a request-time API the page was going to touch
anyway.

## The failure this exists to prevent

CanonCore is self-hosted software distributed as an image
([[0109-deployment-is-a-shape-not-a-vendor]]). Next prerenders a route at BUILD time unless
something in it depends on the request, and a page that reads a database through an ordinary
async driver depends on nothing Next can see: no `cookies`, no `headers`, no `searchParams`. So
`/` was prerendered against whatever `DATABASE_URL` the build happened to point at, and every
reader was served that HTML forever.

**On a self-hosted instance that is a front page frozen at the moment somebody built the image, and
no import would ever change it.** The catalogue would fill, the item pages would show the new items,
and the front page would go on showing what the builder's database held. Nothing errors, nothing
warns, and the one surface that answers "what do I have" is the one that stops being true first.

It is worse than a stale cache because it is not a cache: there is no revalidation interval, no
tag to invalidate and no request that ever rebuilds it. The HTML is a build artefact.

## How it was found, which is the part worth keeping

Not by reading the Next documentation, and not by looking at the page. CNCORE-65's suite starts the
SAME BUILD twice — once against a seeded database with an allowlist, once against an empty one with
none, because [[0094-a-fresh-install-starts-empty]] is a state the seeded instance does not have.
The two servers served byte-identical HTML.

**A second instance of the same build, differing only in its environment, is what made a build-time
artefact visible at all.** One server cannot detect this: its page looks correct, because the
database it was built against is the database it is serving.

## The rule, and why it is stated per file rather than per app

`export const dynamic = "force-dynamic"` in the root layout would cover every route at once and is
refused. It is a setting a reader of any one page cannot see, it opts in routes that genuinely are
static, and it survives exactly as long as nobody adds a second layout. The declaration goes in the
file that does the reading, next to the read, where somebody writing the next read surface meets it.

`connection()` is what Next documents for this shape — "a component doesn't use Request-time APIs
... but still needs to produce different output per request" — and it is finer than the segment
config: it names the point after which prerendering must stop, so a page can still prerender its
shell and wait only for the part that needs the request. Nothing does that yet, and the option
remains open because the declaration is where the read is.

**A page that touches a request-time API for its own reasons needs nothing added.** `/items/<id>`
reads `searchParams` for `?via=` ([[0066-path-is-identity-query-is-the-route]]) and is dynamic by
that alone, which is why this defect reached the front page and not the item page.

**THAT IS ABOUT A PAGE THAT HAS NEVER CARRIED THE LINE, NOT A REASON TO TAKE ONE AWAY.** `/` reads
`searchParams` itself since CNCORE-82 -- it carries the catalogue cursor
([[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]) -- and it KEEPS `connection()`
anyway. The declaration is the rule; being dynamic is the effect, and the effect is now owed to a
query parameter that is there to walk a listing rather than to promise anything about rendering. The
day paging changes shape, the page goes back to being a photograph of itself with nothing in the diff
that says so. A line removed because something else happened to make it redundant is a line nobody
will think to put back.

## The check a new read surface earns, stated because it is invisible afterwards

Naming the rule is not enough on its own, because the failure is silent in exactly the place a test
usually looks: one server's front page is correct, since the database it was built against is the
database it is serving. Nothing about the HTML looks wrong, and no error is raised anywhere.

**So the check is a SHAPE rather than an assertion about one page: ask two instances of one build,
pointed at different databases, for the same path, and expect different answers.** That is what
`apps/web/e2e/front-page.test.ts` does, and it is the only arrangement in this repo that can see a
build-time artefact at all. It is a fourth-seam check in
[[0103-tests-bite-at-package-exports-and-the-router]]'s terms — the app over real HTTP — and it
needs no browser, because a prerendered page and a per-request one differ in the bytes the server
returns.

**A new read surface earns that pair, not merely the `connection()` line.** The line without the
check is a rule somebody remembers; the second surface that forgets it looks exactly like the first
one that did not. What makes the pair cheap is that the second instance already exists: the harness
starts it for [[0094-a-fresh-install-starts-empty]]'s sake, so a new surface costs one more request
against a server that is already running.

This is written down because it is the kind of thing that is obvious once and invisible afterwards.

## Evidence

Next.js 16.3.4's own documentation, read from `node_modules/next/dist/docs` on 2026-09-11, as
`apps/web/AGENTS.md` instructs: `01-app/03-api-reference/04-functions/connection.md` and
`01-app/02-guides/caching-without-cache-components.md`. This app sets no `cacheComponents`, so the
route segment config and `connection()` are both live and the `use cache` directive is not in play.

## The surfaces that have earned the pair

- `/` — `apps/web/src/app/page.tsx`, under CNCORE-65. The defect that produced this record.
- `/search` — `apps/web/src/app/search/page.tsx`, under CNCORE-66. It adds **no `connection()`**,
  under the exemption two sections above: `q` is a request-time API it touches for its own reasons,
  and it is the page's entire input rather than decoration it might stop reading. What it does add
  is the check — `e2e/search.test.ts` asks the seeded and the fresh instance for the same
  `/search?q=…` and expects different answers — which is the half this record says is actually
  earned. `next build` agrees independently, listing the route as `ƒ (Dynamic)`.
- `/import` — `apps/web/src/app/import/page.tsx`, under CNCORE-68, and under the same exemption for
  the same reason: `q` is the page. Its pair is `e2e/import-page.test.ts`, and it compares the thing
  the CONFIGURATION decides rather than merely expecting two documents to differ — the fresh instance
  carries a "no provider is configured" section and the seeded one has none. Two pages can differ over
  a build id while both being photographs of the same state, so a bare inequality would be a check
  that cannot fail for the right reason.

`/items/<id>` is the third dynamic read surface and has no pair, which is the honest state rather
than an oversight: it was dynamic before this record existed, by `searchParams` it reads for `?via=`.

## What a surface that WRITES adds to this record, which is nothing -- under CNCORE-68

`/import` is the first surface that mutates, through Server Actions, and it is worth saying that this
record does not grow to meet it. A prerendered page cannot serve a POST, so the hazard named here has
no write-surface form of its own.

**The converse is not true, and that is the half worth keeping.** A page that writes almost always
reads back to report what it wrote -- `/import` re-renders its own search so the row that offered a
button names its Item afterwards -- and THAT reading is under this rule exactly as any other is. The
declaration belongs to the reading half, wherever the writing half sits.

## As built, under CNCORE-65

`apps/web/src/app/page.tsx` calls `connection()` as the first line of its read. The test that would
have caught it before it shipped is `apps/web/e2e/front-page.test.ts`, which asks two instances of
one build for the same path and expects different answers.

## The second read surface, under CNCORE-67

`/works` is the first page built AFTER this record, and it took the pair rather than only the line:
`apps/web/e2e/works-page.test.ts` asks the seeded instance and the fresh one for `/works` and expects
different bytes, in both directions. **The check was verified by MUTATION rather than assumed** --
stripping the page's two request-time dependencies fails it, and fails the empty-state assertion with
it, because the fresh instance then serves the seeded build's HTML.

**AND THE MUTATION IS WHAT SHOWS WHICH LINE IS LOAD-BEARING, which is worth recording because it is
not the obvious one.** Removing `connection()` ALONE changes nothing: the page reads `searchParams`
for [[0119-a-listing-is-walked-forward-from-the-last-item-it-showed]]'s cursor and is dynamic by that
anyway, exactly as `/items/<id>` is dynamic by reading `?via=`. The line is kept regardless, and the
reason is this record's own: the declaration is the rule and being dynamic is the effect. The day
paging changes shape, a page without the line goes back to being a photograph of itself with nothing
in the diff to say so.
