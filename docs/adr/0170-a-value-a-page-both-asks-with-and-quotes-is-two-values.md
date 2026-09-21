---
status: accepted
---

# A value a page both asks with and quotes is two values

> **ACCEPTED 2026-09-21, whole, in one repository.** `/search` and `/import` bound `?q=` on both of
> ADR-0123's levers where they READ it, through one `theQueryQuoted` call
> (`apps/web/src/components/query-params.ts`) holding one ceiling of 80 for both surfaces. The
> bounded value reaches their THREE sentences and nothing else -- `/search`'s "Nothing matched",
> `/import`'s results heading and its "Back to results for" -- while the whole query reaches the
> read path, the Providers, every link either page writes and the hidden field that replays a
> search. Seven tests at ADR-0103's fourth seam drive crafted addresses against served documents
> (`apps/web/e2e/search.test.ts`, `apps/web/e2e/import-page.test.ts`): the cut, the control strip
> and the links at each surface, plus the two values at `/search`. **Every one was checked RED
> against the wrong implementation** -- `shortenTo` for `boundedTo`, the quoted value passed to
> `readSearch`, the quoted value written into `surface.asked`, and both sentences reverted at
> `/import`. Both surfaces were walked by hand against a running branch, `/import` with the
> `provider-wiki` container named. **ONE CLAIM HERE HAS NO WITNESS and cannot have one at this
> seam**: that `/import`'s hidden replay field carries the whole query. It renders only beside
> results, and every query that finds results is one where the two values are identical, so no
> served document can tell the implementations apart. It is held by reading instead. No provider
> repository is touched, so nothing is owed at a second one.

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] requires a parameter landing inside a
sentence this app speaks in its own voice to be bounded WHERE IT IS READ. Five sites answer it:
`bounded` in `@canoncore/providers`, the repeat's refusal in `@canoncore/db`, the overlong-id
refusal in `@canoncore/api`, a task's detail in `@canoncore/tasks`, and `?refused=` on `/settings`.

**`?q=` was the sixth AND the seventh, and both answered nothing.** On `/search`,
`const query = oneValue(q) ?? ""` went straight into
`<h2>Nothing matched <TheirWords>{query}</TheirWords></h2>`. On `/import` the same reader's query
went into two more of the page's own sentences -- the results heading, whose comment said it was
printed "as on `/search`", and "Back to results for" on the way back from a candidate.
`TheirWords` says of itself that it does not "quote, bound or attribute" -- it settles WIDTH by
breaking a long word ([[0142-text-the-page-did-not-write-wraps-anywhere-through-one-component]]),
and a value of any length still occupies the page.

**The second surface was found by a reviewer, not by the fix**, which is the part worth keeping.
This record was first written naming `/search` as the sixth site and asserting the set was then
complete -- the identical error it had just corrected in ADR-0163, committed in the sentence
correcting it. Nothing in the tree reported a site that owes a bound and lacks one, so the count was
only ever as good as the last person to read every page -- which is what CNCORE-298 answered, and
[[0178-a-parameter-a-page-speaks-is-reported-where-it-is-unbounded]] is that check's record. CNCORE-296 was filed for `/import` and
folded into this ticket, because one reason to change is one pass.

## Measured on the Owner's own install, before this landed

Served to the running instance on 2026-09-20, read off `<h2 id="nothing-found">`:

| `?q=` | HTTP | what reached the page's own heading |
| --- | --- | --- |
| `unavailable in your region. pay to restore access` | 200 | the sentence, verbatim, in CanonCore's `h2` |
| 16,000 characters | 200 | all 16,000, verbatim |
| 20,000 characters | 431 | nothing: refused before the page |
| `U+202E` + text | 200 | the raw override, unstripped |

```
<h2 id="nothing-found">Nothing matched <span class="wrap-anywhere">unavailable in your region.
pay to restore access</span></h2>
```

**The only ceiling there was is Node's HTTP header limit**, which is a fact about the server and not
a decision this app took. CNCORE-291 was filed saying `/search?q=<100kB>` puts 100kB on the page;
100kB is not reachable through a GET, and the figure is corrected here to the 16,000 that is. The
harm is unchanged and the number is now one that was taken rather than recalled
([[0153-a-figure-about-this-tree-is-derived-or-dated]]).

## The other five bound ONE value, and these two cannot

This is the whole of what `/search` has that they do not, and it is why copying `/settings`'
`theEntryRefused` line for line would have been wrong.

A refused entry, a Container id and an outbound URL are **quoted and nothing else**. The bounded
value is the only value those sites have, so bounding at the read leaves nothing behind it.

**A query is the page's QUESTION as well as its sentence.** Catalogue search matches
`title ilike '%<query>%'` ([[0120-catalogue-search-is-a-trigram-ilike-not-full-text-search]]), so a
single shortened value changes the ANSWER along with the heading -- and one ending in the cut
marker asks something no title can satisfy. The links carry it too: `surface.asked` writes `?q=`
into every walk and picker link, and a walk built from the short value would search something other
than what page one searched.

So the read seam yields **two values with two names**: `query`, which the catalogue and the
Providers are asked and the links carry, and `quoted`, which the sentences speak. `NothingFound`
takes `quoted` and has no access to the other; `/import`'s `TheSearchThatFound` carries both as
`q` and `quoted`, named apart so a sentence reaching for `q` is visibly the wrong field.

**ONE CEILING FOR BOTH SURFACES, in `query-params.ts` beside `oneValue`.** ADR-0163 keeps each
ceiling beside the sentences it bounds, and these ARE those sentences: one app, one reader, one
query. That module exists because `/search` and `/import` had already drifted to three spellings of
how a parameter is READ -- its own docblock says so -- and two spellings of how much of it may be
QUOTED would be the same defect one lever along.

**The general rule, for the surface that meets this next:** a parameter a page both ACTS on and
SPEAKS is bounded for speaking only, at the read, as a second value named apart from the first.
Bounding the one value is a bug in the feature, not a stricter reading of ADR-0123.

## The strip is what makes the pair observable, and the cut cannot be

A test that the whole query is what was searched needs a query whose two readings give different
answers. **The cut cannot supply one at this seam.** Any query long enough for an 80-character
ceiling to bite is longer than every seeded title, so `ilike` finds nothing whichever value is
asked, and both implementations render the same page.

A **zero-width space** supplies one, because the strip is the lever that changes what matches:
`Hartnell` finds the Time span item, `Hartnell` + `U+200B` finds nothing, and the bounded value has
the `U+200B` removed. A page that searched what it prints therefore fails by **finding something** --
checked, by passing `quoted` to `readSearch` and watching `The Hartnell era` appear.

This is worth stating because the obvious witness for "the whole value was used" is a long one, and
here the long one proves nothing.

## What this does NOT close: a sentence that fits under the ceiling

**A crafted sentence of 80 characters or fewer is still quoted in full**, in this page's own `h2`,
under this app's own styling. Walked on this branch: `?q=unavailable in your region. pay to restore
access` is 49 characters and renders whole.

That is ADR-0123's accepted residue rather than a gap this record leaves open, and it is the same
residue `/settings` carries for `?refused=`. The levers answer how MUCH a stranger may put on a page
it does not own and what that text may DO to the page's own words. **Neither answers whether the
text is a lie**, and no ceiling can: the page has to say what did not match, or it cannot report an
empty search at all.

**The closed-set answer is not available here, and that is the difference from CNCORE-281.** That
ticket stopped `/?kind=` echoing by looking the parameter up in `item_kinds` and printing nothing
for a miss, because the seven kinds ARE a closed set. `?q=` has no set to be held against -- free
text is the feature -- so the only options were to bound it or to stop naming the query at all, and
a "Nothing matched" that does not say what did not match is a worse page.

What the bound buys is that the stranger chooses at most 80 characters of it and cannot re-order
CanonCore's own words around them.

### And a stripped query can make the sentence untrue

`boundedTo` is `shortenTo(oneLine(...))`, and `oneLine` collapses whitespace and strips controls. So
`?q=Hartnell<ZWSP>` prints **"Nothing matched Hartnell"** over a catalogue that holds a Hartnell
item, above a description blaming alternative titles -- the wrong-reason harm CNCORE-262 named one
heading over.

**It is not a regression and it is not new**, which is why it is recorded rather than fixed here: a
zero-width space renders as nothing, so that heading read "Nothing matched Hartnell" before this
record too. What changed is that the falsehood is now in the page's DATA rather than only in its
rendering, and is therefore sayable.

**The option not taken is stripping BOTH values** -- searching the cleaned query as well as printing
it -- which would make the sentence true and would also change what every reader's query matches.
That is a change to the QUESTION this surface asks, which this record deliberately does not make and
CNCORE-291 put out of scope in as many words ("What is SEARCHED is the whole query"). Weighed and
left, rather than not weighed: the argument above is about the CUT, and it carries the STRIP along
with it.

### Nothing bounds the length that reaches the database, and that is measured rather than assumed

The whole query reaches `catalogue.search` (`query: z.string()`, no maximum) and becomes an `ilike`
pattern whose trigrams are extracted and ANDed on the GIN index. Escaping is correct, so this is a
cost question and not an injection one.

**Measured against the Owner's own install on 2026-09-21**, which holds 8,052 Items, served over
HTTP end to end:

| `?q=` | time to serve `/search` |
| --- | --- |
| 10 characters | 0.19s |
| 1,000 characters | 0.10s |
| 16,000 characters | 0.15s |

A 16,000-character pattern costs no more than a ten-character one at this population, so the
unbounded read path is left as it is rather than given a ceiling nothing has asked for. The figure
carries its population and date because it is a fact about a running system
([[0153-a-figure-about-this-tree-is-derived-or-dated]]), and it would have to be taken again at a
much larger one.

## What this does not change

**The search box owes nothing, and neither does `/import`'s replay field.** The box renders an empty
`<Input name="q">`; `TheSearchCarried` renders `<input name="q" type="hidden" value={search.q}>`,
which carries the WHOLE query on purpose -- a replay built from the quoted value would resubmit a
search for the opening of the query plus a cut marker. Both are the `defaultValue` case
[[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]] excuses for `?placing=`, and
that record's reasoning is untouched: it turns on where a value LANDS, and these land in a form
field while the four sentences this record bounds land in the page's own voice.

**The Group's name and the kind's label stay unbounded in the same heading**, and deliberately.
They are the catalogue's own words -- a Group the Owner named, and one of `item_kinds`' seven labels
-- rather than a stranger's, which is the distinction ADR-0123 draws and CNCORE-281 applied when it
took `TheirWords` off the front page's kind. `?kind=` reaches that heading only as a label looked up
in the closed set, and `?group=` only as a Group that exists.
