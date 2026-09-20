---
status: accepted
---

# A prefetch of these surfaces renders nothing, so a reader who scrolls spends nothing

> **ACCEPTED 2026-09-20, whole, in one repository.** The measurement is below; the cost is asserted
> at [[0103-tests-bite-at-package-exports-and-the-router]]'s fourth seam
> (`apps/web/e2e/import-page.test.ts`), where a request carrying Next's own prefetch headers is held
> to render nothing the fan-out produced; and the CONDITION it holds under is held to the tree by
> `packages/config/src/prefetch-condition.test.ts`. No procedure changed and no provider repository
> is touched. [[0046-delete-previews-its-consequences]],
> [[0149-a-found-record-reaches-its-container-on-a-click-not-a-search]] and
> [[0151-a-query-beside-a-record-is-a-road-back-not-a-question]] have their cost sentences corrected
> IN PLACE rather than restated here, because a rule written three times and checked none is the
> fault this record exists to end.

Three records reached the same conclusion from the same pair of claims, and each wrote the pair out
again in its own words. One of the two is true and the other was never measured.

**TRUE: Next prefetches a `<Link>`'s own address when it enters the viewport.** That is the
component's documented default, and it was verified against the `<Link>` reference bundled inside
the installed 16.3.5 rather than recalled: under *`prefetch`*, `"auto"` or `null` is the default and
only `false` disables it.

**FALSE: that the prefetch therefore SPENDS what the address costs.** ADR-0149 said a link would
spend one Provider request per candidate "because a reader scrolled past". ADR-0151 said "that
address spent a lookup at a third party" and "A link there would run it for a reader who merely
scrolled". ADR-0046 said "a list of links would spend a purge's locks per provider because a reader
scrolled past". None of it happens. **Prefetching an ADDRESS is not rendering the PAGE.**

## What was measured

Measured on a production instance -- `NODE_ENV=production`, the standalone server, Next 16.3.5 --
on 2026-09-20, under CNCORE-245 and CNCORE-240:

| Request | Bytes | Time | Results rendered |
| -- | -- | -- | -- |
| `GET /import?q=Cyberman` | 27,803 | 152 ms | yes |
| same, with `RSC: 1` and `Next-Router-Prefetch: 1` | **298** | **6 ms** | no |
| `GET /import?q=Sontaran` | 27,803 | 116 ms | yes |
| same, prefetched | **298** | **7 ms** | no |
| `GET /import?provider=..&container=286338` | 158,341 | * | yes |
| same, prefetched | **396** | * | no |

And in a browser, scrolling a results page carrying 100 Container links produced 12 RSC prefetch
requests totalling 10,213 bytes, the largest 1,193 -- read from
`performance.getEntriesByType('resource')`. A rendered page on these surfaces is 27 to 158 KB.

What comes back for a prefetch is a routing payload naming the segment, which ECHOES THE ADDRESS
BACK and renders none of it. That echo is the one trap in asserting this, and the seam's comment
says so: a witness that appears in the query as well as in the results would be found inside the
echo and would report a fan-out that never ran.

## Why: the route is dynamic, and a dynamic route's prefetch is skipped

Next's own documentation as shipped inside the installed package -- `next/dist/docs`, which is the
owner for a version-exact question, where a hosted copy is not -- says it under *Prefetching static
vs. dynamic routes*: without Cache Components, a static route is prefetched in full, **while a
dynamic route is skipped unless it has a `loading.js` boundary**. Its table spells the same thing as
"No, unless `loading.js`".

Every surface here that spends a Provider's time is dynamic. `/import` reads `searchParams`, which
[[0117-a-read-surface-renders-per-request]] names as one of the two ways of declaring it, and `/`,
`/works` and `/search` `await connection()`, which that record names as the other. There is no
`loading` file anywhere under `apps/web/src/app`, no `<Link>` in this repository sets `prefetch`,
and neither `cacheComponents` nor `partialPrefetching` is enabled.

Two further reasons the asserted cost could never have been observed, neither of which the three
records mention. **Prefetching is production-only** -- the `<Link>` reference says so in as many
words -- so nothing in development or in a test run was ever going to show it. And `connection()`
"stays suspended until a full user navigation reaches the server, so it also blocks prefetches",
which is the `io()` reference's own sentence about the three surfaces that use it.

## The condition, which is the half a sentence would lose

**"A PREFETCH SPENDS NOTHING" IS TRUE OF THIS CONFIGURATION, NOT OF NEXT.** The protection is real,
and three changes each end it. Each is one line somebody could write for an unrelated reason, which
is why they are held by a check rather than by this paragraph:

- **An explicit `prefetch={true}`.** The reference is unambiguous: the full route is prefetched for
  a dynamic route as well as a static one, uncached content included. This is the one that puts the
  cost back exactly as the three records described it.
- **Partial Prefetching**, which needs `cacheComponents` and `partialPrefetching` together, renders
  a prefetchable route's tree again at prefetch time -- a server invocation per prefetchable link.
- **A `loading.tsx` above a read.** A boundary makes the route prefetchable down to itself, and a
  Server Component ABOVE it runs when the route is prefetched rather than when it is visited.

**THE THIRD ONE WAS MEASURED HERE AND IS NARROWER THAN IT READS.** A `loading.tsx` was added at
`apps/web/src/app/import/` on 2026-09-20 and the fourth seam's prefetch assertion STAYED GREEN: the
search sits in `page.tsx`, below the boundary, so it remained suspended and no Provider was asked.
What the boundary did do was turn four unrelated assertions in that file red, because the page began
streaming and a `fetch` read a partial list -- 6 rows where 100 were expected, 30 where 465 were. So
the danger is a read moving ABOVE a boundary rather than a boundary appearing at all, and the check
refuses the boundary anyway: it is the documented trigger, its blast radius is wider than this
record's subject, and a rule that asked "is the read above or below it" is one no check can answer.

## What this does NOT loosen

**THE `<Form>` CONTROLS STAY, AND THE REASON IS FIRMER THAN WHEN IT WAS WRONG.** What changes is the
stated COST, never the choice. A string-action `<Form>` is the right control for a thing that ACTS,
its fields are not known until submission, and a GET address that spends a third party's time is
worse hygiene than a form whichever way the framework prefetches -- which is ADR-0046's own sentence
at its Evidence section, written before any of this was measured and untouched by it.

**NOTHING IS LOOSENED AT `/groups`.** The Delete control's form has a second reason that never
depended on prefetching: it asks before it acts, and the ellipsis is the convention for a command
that does.

**ADR-0151'S VERSION FACT IS CORRECT AND IS NOT CORRECTED.** That `prefetch` defaults to `auto` and
that only `false` disables it is exactly right for 16.3.5. The error in all three records is the
INFERENCE drawn from the fact, not the fact -- which is why each correction lands in the sentence
that draws it and nowhere else.

**AND A `<Link>` IS NOT FREE.** It is free HERE, because of the four conditions above. A surface that
becomes prerenderable puts the cost back without anybody editing a link.

## What CNCORE-240 asked, answered

That ticket asked whether `/import`'s Group picker spends a Provider fan-out per Group on scroll, and
said in terms that the claim was composed rather than observed: "NOT MEASURED against a running
instance ... so that ticket measures it before it changes anything." It is measured above and it does
not reproduce. **Nothing on the page is changed**, the picker's links stay ordinary `<Link>`s, and
the catalogue Listings' own pickers -- whose cost is a database read rather than a fan-out -- keep
the prefetch they have. The `TODO(CNCORE-240)` that stood beside the picker is gone with it.

## As built, under CNCORE-245 and CNCORE-240

**BUILT: the measurement, the assertion and the condition.** `prefetchAt` in `apps/web/e2e/document.ts`
asks an address the way Next's router asks it; the fourth seam holds `/import?q=` to rendering no
Provider's answer under those headers, with a fingerprint that cannot be confused with the echoed
query; and `packages/config/src/prefetch-condition.test.ts` refuses a `loading` boundary, an explicit
`prefetch` prop and either half of Partial Prefetching, each failure naming this record. Each of the
three guards was broken on purpose on 2026-09-20 and seen to fail.

**BUILT: the three corrections, in the sentences that were wrong.** ADR-0046, ADR-0149 and ADR-0151
each carry the corrected cost in place, and the code comments that restate it on `/import` and
`/groups` carry it too -- a correction placed beside a claim leaves the claim standing.

**NOT BUILT: any check that a FOURTH document cannot state the old rule tomorrow.** Nothing sweeps
prose for the sentence "because a reader scrolled past". The three records and the comments were
found by reading them, and the next one is held by this record and by review.

**THE FENCE AROUND ADR-0046 WAS CROSSED DELIBERATELY, AND NARROWLY.** CNCORE-245 ruled that record
out of scope, reasoning from its Evidence section, where the `<Form>` leg holds "whichever version
prefetches" -- which is true, and that fence protected a DECISION from being re-litigated. Its body
carried the same FACTUAL claim as the other two, and a false sentence is not a decision. Only that
sentence is corrected; the Evidence section and the `<Form>` decision are untouched. **Decided by the
DISPATCHER on 2026-09-20, not by the Owner**, as was folding CNCORE-240 into this work.
