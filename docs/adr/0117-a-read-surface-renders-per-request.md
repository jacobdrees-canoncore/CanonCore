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

## Evidence

Next.js 16.3.4's own documentation, read from `node_modules/next/dist/docs` on 2026-09-11, as
`apps/web/AGENTS.md` instructs: `01-app/03-api-reference/04-functions/connection.md` and
`01-app/02-guides/caching-without-cache-components.md`. This app sets no `cacheComponents`, so the
route segment config and `connection()` are both live and the `use cache` directive is not in play.

## As built, under CNCORE-65

`apps/web/src/app/page.tsx` calls `connection()` as the first line of its read. The test that would
have caught it before it shipped is `apps/web/e2e/front-page.test.ts`, which asks two instances of
one build for the same path and expects different answers.
