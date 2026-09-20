---
status: accepted
---

# A value a page both asks with and quotes is two values

> **ACCEPTED 2026-09-20, whole, in one repository.** `/search` bounds `?q=` on both of ADR-0123's
> levers where it READS the parameter, through one `boundedTo` call at a ceiling of 80 that sits
> beside the sentence it bounds; the bounded value reaches the heading alone, and the whole query
> reaches the read path and every link the page writes. Three tests at ADR-0103's fourth seam drive
> a crafted address against a served document (`apps/web/e2e/search.test.ts`): the cut, the control
> strip, and the two values being different. The last two were each checked RED against the wrong
> implementation -- `shortenTo` in place of `boundedTo`, and the bounded value passed to
> `readSearch`. No provider repository is touched, so nothing is owed at a second one.

[[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]] requires a parameter landing inside a
sentence this app speaks in its own voice to be bounded WHERE IT IS READ. Five sites answer it:
`bounded` in `@canoncore/providers`, the repeat's refusal in `@canoncore/db`, the overlong-id
refusal in `@canoncore/api`, a task's detail in `@canoncore/tasks`, and `?refused=` on `/settings`.

**`/search` was the sixth and answered nothing.** `const query = oneValue(q) ?? ""` went straight
into `<h2>Nothing matched <TheirWords>{query}</TheirWords></h2>`, and `TheirWords` says of itself
that it does not "quote, bound or attribute" -- it settles WIDTH by breaking a long word
([[0142-text-the-page-did-not-write-wraps-anywhere-through-one-component]]), and a value of any
length still occupies the page.

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

## The other five bound ONE value, and this surface cannot

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

So the read seam yields **two values with two names**: `query`, which the catalogue is asked and the
links carry, and `quoted`, which the heading speaks. `NothingFound` takes `quoted` and has no access
to the other, because a component reaching for the whole query to print would be the seam moved back
into the render.

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

## What this does not change

**The search box owes nothing.** It renders an empty `<Input name="q">` and replays no query, so
there is no `defaultValue` path of the kind [[0165-a-picker-reaches-past-its-cap-through-the-listings-own-search]]
excuses for `?placing=`. That record's reasoning is untouched: it turns on where a value LANDS, and
this one lands in a sentence while that one lands in a form field.

**The Group's name and the kind's label stay unbounded in the same heading**, and deliberately.
They are the catalogue's own words -- a Group the Owner named, and one of `item_kinds`' seven labels
-- rather than a stranger's, which is the distinction ADR-0123 draws and CNCORE-281 applied when it
took `TheirWords` off the front page's kind. `?kind=` reaches that heading only as a label looked up
in the closed set, and `?group=` only as a Group that exists.
