---
status: proposed
---

# Text the page did not write wraps anywhere, through one component

Every string this app prints and did not write is printed through `TheirWords`, in
`apps/web/src/components/their-words.tsx`, which sets `overflow-wrap: anywhere` and nothing else. A
Provider's prose, a record's fields, an Item's values and a Group's name are all such text, whoever
wrote them: a Provider, a sidecar or the Owner. The page's own words are printed plainly. A new
surface printing text it did not write prints it through this component.

**THIS SUPERSEDES THE NAME AND THE REACH OF [[0123-a-failure-reason-is-bounded-and-says-who-wrote-it]]'s
`ProviderProse`, AND NOTHING ELSE IN THAT RECORD.** Its "Where the wrap lives" section decided three
things: a component rather than one rule on `body`, `anywhere` rather than `break-word`, and the wrap
on text whose shape the page did not choose rather than on the page's own words. All three stand,
and the figures behind them are that record's. What it did not decide was the Owner's text or a
record's fields: it named the component for one writer and handed the others to CNCORE-223. This is
the answer. `ProviderProse` is gone and `TheirWords` is the same component under a name that fits
everything that goes through it.

## A record's fields have no bound on their length, so width is the only lever

ADR-0123's CNCORE-165 section keeps a record's fields out of the manifest's cap on purpose: a record
is a source's claim, and cutting a title would corrupt the catalogue rather than protect a page.
`title`, `kind` and `released` are `z.string().min(1)`, or an array of `z.string()`, in `cmpp.ts`,
with no ceiling. An Item's title is a statement's value, and the Owner can write one of any length.
A Group's name is the Owner's words with no cap on them (`group.create`).

So nothing here bounds how LONG such text is, and this record does not change that. What the page can
still refuse is letting one word with no break in it decide how WIDE the page is, which is what each
of these did at 1,280 pixels, measured as `{element, document}` in the way ADR-0123's table is: how
far the element's content runs past its own box, and how far the page runs past the viewport.

| surface, with a field of 400 to 500 characters and no break in it | before |
| --- | --- |
| `/import`: a search result's title (a flex row) | `{1754, 1482}` |
| `/import`: a search result's kind | `{1832, 1560}` |
| `/import`: a search result's release date | `{2378, 2106}` |
| the Item page's heading (a block) | `{3932, 3660}` |
| the Item page's `Title` row under Values (flex) | `{1819, 1554}` |
| the catalogue's list on `/` (flex) | `{1802, 1530}` |
| the Group chips on `/`, with CNCORE-179's raw class taken off | `{2845, 2573}` |

Every row is `{0, 0}` with the text through `TheirWords`. The `/import` rows were inferred and not
walked when CNCORE-223 was filed; these figures are the walk.

**ONE PAGE HOLDS THE SAME TITLE IN THREE PLACES, AND ONLY THE DOCUMENT HALF SAW THE THIRD.** The Item
page prints its title in the heading, in the Values row it projects from (ADR-0014), and, derived by
ADR-0134, under the heading as `Sorts as`. With the heading alone wrapped, its own box was `0` and the
page still ran 1,554 pixels wide; with the Values row wrapped as well, 1,171, which was the sort
name. That is ADR-0123's case for asserting both halves, met on a page nobody had thought of as
having three copies of one word.

## One component, whoever wrote the text

The ticket's candidate was a second component beside `ProviderProse`, for text the page did not
shape. It would have had the same body, one `span` with `wrap-anywhere`, for the same reason, and
two components with one body put a question to every new surface that changes nothing the page
does: whose words are these? That question is hard to answer and costs something when it is got
wrong. **CNCORE-217 got it wrong once:** a Note's source label was on its list and is never a
Provider's, and a Values row's source label is the Owner's, a sidecar's or a Provider's depending on
the row. ADR-0123's own rule never needed the answer, since it is stated in terms of the page not
choosing the text's shape.

**AND THE OWNER'S WORDS ARE NO NARROWER THAN A STRANGER'S, WHICH IS WHERE ADR-0123 HAD REASONED THE
OTHER WAY.** It printed CanonCore's own sentence in `Reason` plainly because "every value in the
sentence is the Owner's own rather than a stranger's". The Group chips above are the Owner's words,
and they ran the page 2,573 pixels wide. That sentence is corrected in ADR-0123 where it stands. The
sentence itself is the page's own words and stays plain; the address inside it, which the Owner
typed, goes through this component under CNCORE-226.

**CNCORE-179'S RAW CLASS MOVES ONTO IT, AND SO DO CNCORE-180'S.** CNCORE-179 put `wrap-anywhere`
straight on a Group's name in the picker, for this record's reason, and CNCORE-180 carried the
picker into `Listing`'s module for `/works` and `/search` and put the same class on the heading each
of those prints over an empty Group. They work, and they are a second spelling of one rule that a
search for the component does not find. The name now goes through `TheirWords` in the picker, in
those headings, on `/groups` and on the Item page, and each heading wraps the name and not the words
around it. `/search`'s heading echoes the reader's query as well, which CNCORE-180 had wrapped with
the rest of the heading, so the query goes through `TheirWords` there too rather than losing the
wrap.

**A FALLBACK IN THE PAGE'S OWN WORDS MAY RIDE INSIDE IT.** `item.title ?? "Untitled item"` goes
through whole. `anywhere` breaks only a word that does not fit its line, and no word the page wrote
is that wide, so splitting the expression to keep `Untitled item` outside would cost a branch at
every title and change nothing a reader sees.

## What stays plain, and why

- **The page's own words**, including the words it puts around somebody else's (`Sorts as`,
  `holds nothing yet`, `matched nothing`), and the reader's word for an Item's kind, which
  `item_kinds` holds and `CONTEXT.md` settles (`Time span`). This is the header at 375 pixels:
  wrapping the page's own words mid-word is what ADR-0123 refused a global rule for.
- **An `<option>`.** The `Select` primitive is `w-full min-w-0`, so an option cannot widen the page,
  and a native select does not lay its options out as text in the page.
- **A heading that is `sr-only`**, which is clipped to one pixel and lays nothing out.

## Asserted in a browser, beside a Provider's name

The witnesses are in `apps/web/browser/prose-width.test.ts`, which ADR-0123's section "Asserted in a
browser, because only a browser can see it" explains, and they assert both halves of
`{element, document}` for the reason given there. A second stub Provider,
`aProviderThatFloodsItsRecord` in `e2e/stubs.ts`, has an ordinary name and answers one record per
field it floods, each found only by a query its own title holds. It is not
`aProviderThatFloodsItsName` grown, because that stub stands for one field and says it must not
grow into more. The fixture writes an Item titled as that record is, and a Group named with no break
in it.

- `/import`: a search result's title, kind and release date, each in its own row, which is flex.
- The Item page: the heading, which is a block, and the `Title` row under Values, which is flex. The
  sort name has no witness of its own; the document half of both is what caught it.
- `/`: the Item's row in the catalogue's list, and the Group chips.

**EACH WAS SEEN FAILING BEFORE ITS WRAP**, at the figures in the table, and the Group chips failed
with CNCORE-179's class removed and passed again with the name through the component. **AND THEY
TELL THE TWO RULES APART:** with `wrap-break-word` in the component in place of `wrap-anywhere`,
eight of the file's nine witnesses failed. Every flex row failed at its unwrapped figure, and the
Item page's heading kept its own box at `0` while the rows below it held the page 1,614 pixels wide.
The one that passed was `/import`'s heading over a Provider's answers, a block on a page with no
flex row holding the word, which is ADR-0123's reason for having a second witness at all. **The sites
without a witness** are the Item page's Members, `Also appears in`, `In Groups` and Note, the
headings on `/groups`, and the container title on `/import`'s browse. Each is a flex item or a block
already witnessed elsewhere on the same mechanism, which is ADR-0123's position for the credential
label and the attribution notice.

**THE NOTE IS THE ONE THAT IS NOT QUITE THE SAME MECHANISM**, because the wrap sits inside
`white-space: pre-wrap`, which keeps the Owner's own line breaks. So it was measured on its own, in
Chromium on a bare page with the Note's row and 480 characters of one word: raw `{2597, 2341}`,
`anywhere` inside the pre-wrap `{0, 0}`, and `break-word` inside it `{2597, 2341}`. The two rules
part there exactly as they do in a flex row without it.

## As built, under CNCORE-223

**Built:** the component; `ProviderProse` folded into it at every site it had; and every site that
prints a record's field, an Item's title, sort name, value or note, or a Group's name, in `/import`,
the Item page, `Listing` and the Group picker beside it (so every surface that renders them), the
empty Group's heading on `/`, `/works` and `/search`, and `/groups`. And the reader's query where
`/search` says nothing matched it, which the Group's name sits beside there.

**Not built, and why this record is `proposed`:** the rest of the text the page did not write.
CNCORE-223's sweep found it and it is CNCORE-226's, with a `TODO` naming that ticket at each site:

- the reader's own query, echoed in `/import`'s results heading;
- the container id the Owner typed, beside that container's title on `/import`;
- a Provider's base URL where `/import` and `/settings` print it, and the entry `/settings` refused;
- the names a device declares for itself, on `/devices`;
- the address inside CanonCore's own sentence in `Reason`.

Each is text the page did not write, and none is a record's field or an Item's, which was the class
CNCORE-223 was filed for. That ticket carries them and flips this record to `accepted`.

**NO NUMBER HERE WAS MEASURED BELOW 1,280 PIXELS.** ADR-0123 measured the header at 375 and refused
the global rule for it. This record puts the component on more sites and on no page-owned word, so it
reaches nothing that measurement found.
