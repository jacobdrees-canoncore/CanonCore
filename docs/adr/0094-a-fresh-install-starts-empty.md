---
status: accepted
---

# A fresh install starts empty, and the archive is never shipped or demoed

The archive is NOT shipped seed data. A fresh install starts EMPTY — anyone else's, and the Owner's
own: no items, no placements, no editions, nothing in the catalogue. It is NOT on the public demo,
which is deliberately other material (`docs/demo.md`).

**"EMPTY" IS ABOUT WHAT IS SHIPPED RATHER THAN WHO RUNS IT, AND NEVER ABOUT A REPOSITORY OR A DEVELOPER'S BOX.**
An earlier version of this record said "no content of any kind", which the committed fixture
contradicts on its face, and a first attempt at this correction then overcorrected into a second
false claim — that no setup step loads archive-derived content. It does. Three things are being run
together and they need separating:

1. **A CLONE.** ADR-0057's named fixture is committed, in the wiki provider's repository rather than
   this one. It exists to be read by tests and nothing loads it into a catalogue.
2. **A DEVELOPER'S DATABASE.** `pnpm db:setup` seeds one item titled *The Daleks' Master Plan* — an
   archive row's name, hand-written in `packages/db/src/seed.ts` rather than extracted — because
   CNCORE-4 and CNCORE-5 need something on the page to look at. That is archive-derived content in a
   database, and pretending otherwise is how this record acquires a false claim for the second time.
3. **AN INSTALL.** A running instance, somebody else's or the Owner's own. THAT is what starts
   empty, and it is the only one of the three this record governs.

   **"SOMEBODY ELSE'S" IS WHAT THIS READ UNTIL 2026-09-13, AND IT EXCLUDED THE ONE INSTALL THE
   AUTHOR WOULD RUN.** The category was right and its label was not: an install the Owner stands up
   from `compose.yaml` is this category, not a fourth. It is the same artefact by construction —
   [[0044-one-owner-row]] gives every install one owner row with an id generated per install, and the
   demo is "not a mode, not a deployment flag, not a build" but an instance that never sets
   `OWNER_PASSWORD`. **That is sameness of artefact, NOT indistinguishability from outside**, and an
   earlier version of this correction claimed the latter: ADR-0044 says a visitor is TOLD, through
   `session.configured`, and the only answer it makes deliberately ambiguous is `logIn`'s
   `UNAUTHORIZED` for a wrong password and a no-password instance alike.

   The exclusion was in three places and the opening sentence was one of them, so fixing this label
   alone would have left the record saying it twice over.

The line is not clone-versus-install; it is whether content travels TO A STRANGER. A seeded worktree
is ours and a fixture is a test input. Neither is a catalogue handed to someone who did not ask for
it, and that is the thing being refused.

The archive has three private jobs and an earlier version of this paragraph credited them all to one
record. ADR-0057 gives it two: a queried source for that fixture, and a stress test to size the
model against. The third, THE OWNER'S OWN LIBRARY, is `CONTEXT.md`'s alone — no ADR states it, this
one included, and sending a reader to ADR-0057 for it wastes their time.

This record is the negative half of the same decision, and it is the easier half to get wrong,
because seeding a new install with the data you already have is the path of least resistance and it
is how someone else's catalogue becomes the product.

## Empty is not the same as UNEXPLAINED, and this record governs only the first

What content ships is decided above. **What the resulting screen says is not decided here, and
reading this record alone as the whole answer is what produced the defect below.**

Two shards of the competitor sweep independently rated a fresh CanonCore's first run HIGH:
`sweep-plex-support-C.md` ("Every decision in the prompt is individually right and together they
produce the worst possible first five minutes") and `sweep-jellyfin-repo.md` ("A self-hosted
product's first five minutes are unspecified in the prompt", classified ABSENT — HIGH). A third
shard names the mechanism without rating it: "CanonCore's equivalent path has an extra mandatory
step nobody has written down — connect a provider." The mandatory step is real and was not merely
undocumented: the allowlist defaults to empty, which refuses every provider, and the README did not
mention it at all. (It was `PROVIDER_ALLOWLIST` then; the default survived the move to a Setting
under CNCORE-99 unchanged, which is the half that mattered.) CNCORE-64 gave it a row in the
README's `### What it reads` table and a line in `.env.example`, and CNCORE-65 put it on the front
page. The default is untouched and still deliberate; what changed is that it is now told to the
person it governs.

So an install that starts empty is correct, and an install that starts empty WITHOUT SAYING WHAT TO
DO NEXT is a separate failure this record does not licence.
[[0115-the-public-release-comes-before-the-playback-half]] is where that is closed. Nothing in the
refusal above softens: no seed data travels to a stranger, and the fix is words on a page rather
than rows in a database.

## As built, under CNCORE-65, and accepted under CNCORE-105

**THIS RECORD IS `accepted`, AND THE WORD IT WAITED ON WAS "INSTALL".** Its own subject is what
travels to a stranger, and when CNCORE-65 landed there was no install path — no image and no
documented command. CNCORE-63 published the image, CNCORE-64 documented the command, and CNCORE-64
then WALKED it: the README followed from a directory with no checkout, with no `auths` entry in
`~/.docker/config.json` at all, which is what proves the run a stranger gets rather than the one
the owner gets. That run read the page as well as the status code — it served `Your catalogue is
empty` and `No provider is allowlisted` — so this record's own subject was observed on it rather
than inferred from a 200. CNCORE-70 repeated the walk at `v0.1.0` from a clean volume, and CNCORE-75 at `v0.2.0`
from a volume it had removed first: `items`, `placements` and `statements` all zero before a hand
touched them, the schema's own furniture written by the ladder as before. A record
about what an install starts with can be accepted once somebody other than its author can start one,
and they can -- which is the harder case and so the one the gate was set on. The flip was owed by CNCORE-64 and is made by CNCORE-105.

**AND THE EMPTINESS HAS A SECOND WAY OUT, WHICH THE PAGE NAMES SINCE CNCORE-131.** This record's
other half is that an install starting empty must say what to do next, and the front page said it in
two steps that were both about a Provider: allowlist one, then import from it. Since v0.2.0 neither
is necessary — an owner fills a catalogue by hand, and the walk that found this configured no
Provider at all (CNCORE-75). So that copy was not wrong and was not the whole answer either: a
reader whose instance reached nothing was sent to go and find something for it to reach, past the
shorter path already on the page they were looking at. **THE PAGE OFFERS TWO ROUTES NOW, AND THE ONE
THAT NEEDS NO PROVIDER GOES FIRST** — `/new`, which makes an Item with no file and no provider
record (ADR-0003) — beside the provider's route, which keeps both its steps and names the two
Settings it needs (ADR-0121). It offers them TO ITS OWNER, which CNCORE-131 did not decide and
CNCORE-133 below did. It was FILED rather than fixed inside the release ticket, because it
is product copy and the header's own `New item` link meant the capability was reachable rather than
hidden. Reachable and unsaid is exactly what this record does not licence, which is why reachable
was not an answer.

**AND THE ROUTE IS OFFERED WHETHER OR NOT A PROVIDER IS ALLOWLISTED**, which is the half that needed
a fixture rather than words. Every empty instance in the suite was also an unconfigured one, so
"the catalogue holds nothing" and "this instance reaches nothing" moved together and no assertion
could tell which of them the page was reading. The e2e harness stands up an instance in the
missing combination — an allowlist that admits something, a catalogue that is still empty — so an
empty state that acquired a second condition, shown only where nothing is reachable, fails there
rather than passing everything. **That instance now holds ONE HALF of it and the other half has no
instance at all**, which CNCORE-133 below both caused and accounts for.

**AND THE ROUTES ARE THE OWNER'S, WHICH IS THE READER THIS RECORD NEVER NAMED (CNCORE-133).** Both
routes end at a surface behind a session: `/new` answers a visitor "Only the owner of this catalogue
can add to it" — on an instance that has a password, which is the qualifier CNCORE-144 below had to
add to this sentence — and `/import` renders with every button disabled (ADR-0044). The front page
read the catalogue and the allowlist and nothing about WHO WAS ASKING, so it told every reader to do
two
things and most of them were refused on arrival — and on an instance that sets no `OWNER_PASSWORD`
there was not even a login to take, because that is ADR-0044's read-only instance where nobody can
log in including the owner. Two reviewers of CNCORE-131's PR named it independently.

**SO THE LIST IS RENDERED FOR A SESSION, AND THE READER WITHOUT ONE IS OFFERED THE STEP THAT WOULD
MAKE THEM ONE.** Three answers off two facts. An owner sees the two routes, unchanged. A reader with
no session on an instance that HAS a password is told only the owner can fill it and offered
`/login` — which is not a consolation but the correct next step, and the one the README already
names first ("the first thing to do … is log in with the one you just generated"). A reader on an
instance with NO password is told that plainly, in the sentence `/login` uses for the same fact with
the verb a catalogue needs — "nothing can be ADDED through it" where that page says "CHANGED", which
is the drift CNCORE-146 below found in this very clause and ended by making the shared half one
string — and offered nothing: a login link there would be the door with no key cut for it that that
page already refuses to render. `session.configured` is what answers the second fact, which is the
shape it was built for one setting over from `provider.allowlisted`.

**THE ALTERNATIVES, AND WHY EACH IS WORSE.** Gating on `session.configured` ALONE — render the
routes wherever a login is possible — fixes only the read-only instance and goes on offering
`/new` to every visitor of an ordinary self-hosted one, which is the shape most
people run. Rendering them
for everyone and letting each surface refuse is what produced the defect. Making `/new` render a
DISABLED form to match `/import` makes the refusal prettier without making the route takeable, and
the criterion is that a reader is not SENT towards somewhere that will refuse them — advised by an
empty state or listed in a nav alike, which is the width CNCORE-139 gave the word below. What does
not change is the first sentence: "it starts that way on purpose, CanonCore ships no catalogue" is
every reader's, because the "empty is not UNEXPLAINED" half above is owed to somebody who cannot
fill it either.

**AND "ADVISED" WAS NOT THE EXACT WORD, WHICH IS WHY THE HEADER THINS ITSELF TOO (CNCORE-139).**
This paragraph used to defend the header, where `New item` and `Import` sat on every page offered
to every reader: the two cases differ IN KIND, it said — a nav link is a map of what the product
HAS and a reader who follows one asked a question, while an empty state is ADVICE the product
volunteers, and advice that cannot be taken is the defect. The header is gated on a session now and
that argument is replaced rather than merely overruled, because it was reasonable and it was wrong
in two places that are worth writing down.

**THE HEADER WAS NEVER THAT MAP.** `/settings`, `/tasks` and `/devices` are the owner's surfaces
too, and not one of them has ever been in the nav. So it was already a selection of what a reader
can USE rather than an index of what exists, and a defence that would equally justify listing those
three is not describing the thing it defends. What made the two links look different from the other
three is only that they predate there being a session to gate them on.

**AND THE OBSTACLE WAS NOT ONE.** "The header is a client component and a session is a server-side
cookie, so it cannot read one" was a true sentence about the FILE and a false one about the header:
nothing in it had state, an effect or a handler, and the two children that need script —
`ModeToggle` and the search box — declare `"use client"` for themselves. A server component renders
a client one, so the directive bought nothing and cost the header the only fact it lacked. The
directive came off and neither child changed.

**SO THE HEADER ANSWERS THE SAME THREE ANSWERS OFF THE SAME TWO FACTS AS THE EMPTY STATE.** An
owner sees both routes, unchanged. A reader with no session on an instance that HAS a password is
offered `/login`, and that link PREVENTS A GAP RATHER THAN CLOSING ONE, which is worth stating the
right way round. A rendered path to `/login` already existed and ran through the very link this
change removes: `New item` in the nav, followed to `/new`, which answers a caller with no session
"Only the owner of this catalogue can add to it" and — on an instance that has a password, which is
the only instance this gap can exist on — offers the login itself. Thinning the nav takes
that path away, and the empty state's own login goes with the first Item, so a header that offered
nothing in their place would leave the owner of a filled catalogue reaching `/login` by typing it.
A reader on an instance with NO password is offered neither, for the reason nothing else offers
that reader a login either: nobody can log in there, the owner included.

**AND EVERY SURFACE THAT OFFERS A LOGIN NOW READS WHETHER THERE IS ONE, WHICH IS SEVEN RATHER THAN
TWO (CNCORE-144, CNCORE-146).** `/new`, `/import`, `/tasks`, `/settings` and `/devices` each
rendered their refusal off the SESSION alone, so on ADR-0044's read-only instance each offered a
door with no key cut for it and following it landed on the one page that says nobody can. They read
`session.configured` beside the session now, and answer as the empty state and the header do: the
owner gets the surface, a reader with no session on an instance that HAS a password gets the refusal
and `/login`, and a reader on an instance with NONE gets the refusal and no link. With `/login`
itself, which refuses to render a form there, that is every surface in the app that has anything to
say about logging in.

**THE SENTENCE THEY SAY IT WITH IS ONE SENTENCE NOW, AND THE REASON IS A DRIFT THIS RECORD
CONTAINED.** The paragraph above claimed the empty state speaks "in the words `/login` uses for the
same fact", and it did not: `/login` says "nothing can be CHANGED through it" and the empty state
says "ADDED". Both are right where they are — one is about an instance, the other about filling a
catalogue — but three places claimed a sentence matched another surface's while it did not, this
record among them, and CNCORE-144's first draft of `/new` made the same claim a fourth time. The
sentence above is corrected where it stands rather than only here, because a correction placed
beside a claim leaves the claim standing. TWO copies were enough to drift, and this change would
have made seven, so the clause every surface really does share lives in
`apps/web/src/components/no-password.ts` and the verb is its argument.

**IT SURVIVED TWO TICKETS BECAUSE BOTH CITED `/new` AS EVIDENCE FOR GATING SOMETHING ELSE.** The
paragraphs above quote "`/new` answers a visitor ..." twice — CNCORE-133 to show that the empty
state's routes end behind a session, CNCORE-139 to show that a path to `/login` already existed —
and a surface quoted as the fixed point is not one anybody re-reads. Both quotations were true of
the instance each argument was about and neither was true of all of them, which is why the fix is
the qualifier now standing in both sentences rather than a correction to either argument. The
lesson is narrower than "check the citations": a claim about what another surface SAYS is a claim
about that surface's current code, and it ages the moment that surface grows a second answer.

**ASSERTED ON BOTH INSTANCES, AT THE SEAM THE OTHER TWO USE.** `new-page.test.ts`,
`import-page.test.ts`, `tasks-page.test.ts`, `settings-page.test.ts` and `devices-page.test.ts` each
ask the fresh install for their page and refuse any `href="/login"` in the document — the header
offers none there either, so nothing on those pages may — and ask an instance that HAS a password
for the same page to hold the answer that must not be lost. That second reading is scoped to the
page's own content rather than to the document, by `mainOf` or by the refusal's own section: since
CNCORE-139 the header carries that same link on every page of such an instance, so a document-wide
check would pass against a page that had gone silent inside a shell that had not. It is the mistake
`item-write.test.ts` was already making, found while fixing this.

**ONE HALF OF `/import` HAS NO INSTANCE, AND IS NAMED RATHER THAN LEFT TO BE DISCOVERED.** That page
does not hide its surface, only its buttons (ADR-0072), so a notice stands where each control would
— and a notice only renders where there is a control, which needs a provider this instance is
configured to reach. THREE servers in the suite set no owner password, and all three also reach
nothing: no instance here is in the combination that half needs, which is no password AND a provider
configured. A fourth would recover it, and the eleventh server this record twice
said ADR-0104 refuses is now standing (CNCORE-178) — so the refusal below is corrected rather than
repeated here, and what is still missing is a server nobody has had reason to add. (The first draft of this paragraph said the fresh install
was the ONLY password-less server. It is not — `aCatalogueLargerThanOnePage` and
`aCatalogueThatHoldsStill` set none either — and the sentence is corrected rather than merely
softened, because a false reason for a true conclusion is the thing this record keeps being caught
by.) What IS asserted there is the page-level notice, which that instance does
render: `/import` says once, at the top, that nobody can log in — because a reader told only "only
the owner can import" beside every button is still left looking for the way to become one.

**WHAT IT COSTS IS STATED IN ADR-0117 RATHER THAN HERE**, because it is that record's subject: the
shell reads the caller on every page, so every route renders per request, and `/_not-found` is the
one route the build table shows changing. What does not change is that a reader who TYPES an
address still meets the page's own refusal. That is the division this record always described —
the surface renders, its buttons do not — and it is now the only way to reach one.

**AND IT COST THE CRITERION ABOVE ONE OF ITS TWO WITNESSES, WHICH IS NAMED RATHER THAN LEFT TO BE
DISCOVERED.** "Offered whether or not a provider is allowlisted" needs the routes rendered in both
allowlist states, and rendering them now needs an owner. `anInstanceAllowlistedAndEmpty` gained one,
so the half CNCORE-131 built the fixture for still fails a page gated on `!providers.any`. The other
half — an owner, an empty catalogue, NOTHING allowlisted — has no instance: the only empty
unallowlisted instance here is the fresh install, whose whole fixture is that nobody can log in to
it. A TWELFTH server would recover it — the suite starts ELEVEN since CNCORE-178 — and the
refusal this paragraph rested on has expired. It read that ADR-0104 refuses an eleventh, because
under "What sharing one container costs, and the ceiling nobody had counted" it measured on
2026-09-13 that a single run peaks at about a hundred client connections, the whole of the default
budget CI's own `postgres:18` service gets. **A HUNDRED WAS THE UNBOUNDED FIGURE, AND CNCORE-137
SUPERSEDED IT IN THAT SAME RECORD** by bounding each server's pool to four: 55 to 60 bounded against
91 to 103 before. Re-measured 2026-09-19 with the eleventh standing, same sampler: **67**. So the
budget was never what kept this gap open after CNCORE-137, and saying so is the point — the gap is
open because no ticket has wanted that instance, which is a different and much weaker reason than
the one written here for two revisions.

**WHAT `accepted` DOES NOT ASSERT, BECAUSE THE TITLE IS TWO REFUSALS AND ONLY ONE HAS MET AN
INSTANCE.** "Never shipped" is the half above, walked. "Never demoed" is not: there IS no public
demo, it sequences LAST behind playback and the clients (`docs/demo.md`,
[[0055-web-now-phone-next-tv-last]]), so that half is a refusal held in advance rather than one
anything has yet had the chance to break. It binds whoever builds that surface exactly as it did
while this record read `proposed`; it is named here only so `accepted` cannot be read as both
halves having been tested.

**AND WHAT A FRESH INSTALL DOES CARRY WAS COUNTED UNDER CNCORE-105, BECAUSE "EMPTY" HAS BEEN
OVERSTATED HERE TWICE.** The path was walked once more on 2026-09-12, against
`ghcr.io/jacobdrees-canoncore/canoncore:latest` pulled with no credentials at revision `5c16778`,
and this time the database was counted rather than only the page read. `items`, `placements`,
`statements`, `aliases`, `merges` and `placement_sources` each held zero rows. What is not zero is
the schema's own furniture, written by the migration ladder at first boot rather than shipped from
anywhere: migration 1 seeds the vocabulary (`item_kinds` 7, `ranks` 3, `source_kinds` 4, the three
`property_*` enumerations, and ELEVEN properties — migration 3's `external_id` makes the twelfth),
ONE `owners` row labelled "Owner" whose id is generated per install (ADR-0044), and its `owner`
Source sitting first in the global source order (ADR-0025). **So the opening sentence is exact as
written and has to stay that way** — "nothing in the catalogue", never "nothing in the database". A
third run at "no content of any kind" would be refuted by a row count that takes half a minute.

The first evidence for it was CNCORE-65's suite. `apps/web/e2e/front-page.test.ts` stands up the
same build a second time against a database built from empty, reaching nothing, and asks it for
`/`. (It was `PROVIDER_ALLOWLIST` unset when this was written; since CNCORE-99 the allowlist is a
Settings row and the fixture writes an empty one, which is the same state arrived at through the
store the surface writes.) Until then "a fresh install starts empty" was a property nothing exercised: every
suite in the repo ran against a seeded database, which is the one state this record does not
govern.

**And the half this record explicitly does not licence is now closed.** The section above ends "an
install that starts empty WITHOUT SAYING WHAT TO DO NEXT is a separate failure", and points at
[[0115-the-public-release-comes-before-the-playback-half]]. CNCORE-65 is where that was done and
CNCORE-131 is where it was finished and CNCORE-133 is where it found its reader: the empty
catalogue names the ROUTES that fill it — by hand, and from a provider — to the owner who can take
them, tells everyone else the emptiness is on purpose, and says of an instance with nothing
allowlisted that nothing is allowlisted rather than leaving an empty result to read as breakage.
Nothing in the refusal softened — the fix is words on a page, and no seed data travels anywhere.

**The third state the page reports was not in this record and is worth naming**: an allowlist that
names nothing is not the same fact as a catalogue that holds nothing, and an owner can be in either
without the other — which CNCORE-131 turned from a claim into a fixture, having found that no
instance in the suite was in one without the other. The page reads them as two conditions off two
facts rather than as one "unconfigured" state, because an owner with items and no allowlist is
stuck in a way an empty catalogue does not describe.
