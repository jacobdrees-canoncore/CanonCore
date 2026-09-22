---
status: accepted
---

# An instance names its providers, beside the allowlist that admits them

An instance holds the base URLs of the providers it searches, separated by commas or whitespace.
They sit beside the allowlist and neither is derivable from the other: that one holds HOSTS AND
RANGES and says what MAY be reached, this one holds URLS and says what IS reached. A provider needs
to be in both.

**BOTH WERE ENVIRONMENT VARIABLES — `PROVIDER_URLS` and `PROVIDER_ALLOWLIST` — AND ARE SETTINGS THE
OWNER EDITS AT `/settings` SINCE CNCORE-99.** The decision above is untouched by that move: what
changed is where the string comes from, and the as-built section at the foot of this record is the
whole of it. The old names are kept in this record wherever the sentence is about what was decided
then, because two tickets and three other records cite them.

## The question nothing had asked before

Every operation before search addressed ONE provider the owner named in the request:
[[0031-a-provider-is-a-url]] makes a provider a URL and nothing more, so `import`, `browse` and
`purge` each take a `baseUrl` and there is no registry to consult. That held for as long as the owner
already knew which provider they wanted.

**Search is the first operation that reaches SEVERAL at once, and it is the one where the difference
bites: an owner who does not know an id does not know which source holds it either.** So the set of
providers had to come from somewhere, and nothing in the repository held one.

`PROVIDER_ALLOWLIST` cannot be read as that set, and the reason is not a matter of taste.
[[0034-two-outbound-boundaries]]'s allowlist holds exact hosts and CIDRs — `127.0.0.0/8` is a range
of sixteen million addresses with no scheme and no port — so no provider URL comes out of it. An
instance could no more search its allowlist than post a letter to a postcode.

## Why not the providers the catalogue has already imported from

Every import writes a provider's `sources` row keyed on its identity, so "the providers this
catalogue has heard from" is a real list already in the database and needs no new setting. It was
refused because of what it does on the run that matters most.

**A fresh install has imported from nothing, so that list is empty — and the only way to put a
provider in it is to import by id, which is the hand-POSTing the import surface exists to remove.**
The first five minutes would be the one case the product could not help with, which is
[[0094-a-fresh-install-starts-empty]]'s failure wearing a different shape.

A surface for CONNECTING a provider — paste a URL, read its manifest, write the source row — fixes
that and is a better long-term answer than either. It is not refused here. It is simply a surface
nobody has specified, and naming providers in configuration is what a self-hoster expects to do in
the file they are already editing.

## It was env for exactly as long as the allowlist was — and that day has come

The allowlist's own note said it "is env rather than a settings table because there is no settings
table yet. When there is one, this moves into it and the boundary does not change". The same sentence
governed this one, and the two moved together under CNCORE-99: `parseProviderUrls` takes a string
from wherever it comes, as `parseAllowlist` does, and what changed was the wherever. See the
as-built section at the foot of this record.

**THAT QUOTE WAS A CODE COMMENT, NOT AN ADR, and this record said otherwise.** It attributed the
sentence to "ADR-0034's own note". ADR-0034 contains no sentence about a settings table and
`git log -S` shows it never did; the words were in `packages/env/src/schema.ts`, beside
`PROVIDER_ALLOWLIST` itself, and two tickets cited them as something ADR-0034 "committed to".
**GO LOOKING FOR THEM NOW AND THERE IS NOTHING TO FIND**, which is the point rather than a loss:
CNCORE-99 honoured the commitment, so the variable and the comment promising its move both left the
file together. What they promised is the as-built section at the foot of this record, and this
paragraph is kept so that a reader who meets the quote in an older ticket learns where it lived and
what became of it.

**THE ENTRIES ARE TAKEN AS WRITTEN AND NEVER NORMALISED**, which looks like an omission and is the
load-bearing half. A provider's URL is its IDENTITY (ADR-0031), and the identity is what the source
row on every imported claim carries — so rewriting `http://host:8080` to `http://host:8080/` would
make one provider two, and the catalogue would hold a second Item for every record imported under
the other spelling. The configured spelling is therefore the only spelling, and it is the owner's.

**A malformed entry throws at module load rather than at the first search**, which is the lesson
`createContext` already carries about the allowlist: a typo caught where the value is parsed stops
the server from starting, and a typo caught where the value is USED turns a read path into 500s.
What is checked here is only whether the entry IS a URL; its scheme and its host are
`assertConfigUrl`'s questions, asked in front of the request, because one rule in two places is two
rules that drift.

## The cost, said out loud

**Two settings for one concept is a misconfiguration waiting to happen**, and the likely one is
naming a provider and forgetting to allowlist its host. That is accepted rather than designed
around, because the alternative — inferring the allowlist from the URLs — would silently admit
whatever an owner pasted and is the opposite of what ADR-0034 decided an allowlist is for.

**AND FOR A PROVIDER BESIDE THE INSTALL IT IS TWO ENTRIES IN THE ALLOWLIST, NOT ONE**, which this
record did not anticipate and CNCORE-163 found by walking it. Such a Provider answers on a container
address, and [[0034-two-outbound-boundaries]] checks a config URL TWICE: the host against the
allowlist's hosts, the resolved address against its ranges. A container address is `private` rather
than `unicast`, so it passes the second check only where a CIDR covers it — and the Owner who
allowlists the hostname alone gets the Provider ADMITTED by name and then REFUSED at the socket. The
misconfiguration this section names is therefore not only "forgot the allowlist" but "allowlisted
half of what one Provider needs", and the surface tells the two apart no better than it tells apart
the pair above. What it renders in that case is worse still, and CNCORE-192 has it.

So the cost is paid in the surface instead. The import page carries TWO notices, not one: one for no
provider allowlisted and one for no provider configured. An instance that reaches nothing says which
of the two settings to go and set, because one answer could not. **Each notice NAMED ITS VARIABLE
until CNCORE-99 and LINKS TO `/settings` now**, which is the same sentence doing the same job: what
an owner needs is the thing they have to go and change, and that used to be a name in a file and is
now a page. The end-to-end suite configures a provider whose host is not allowlisted for the same
reason — the commonest real mistake is the one the page has to render.

## As built, under CNCORE-68

`parseProviderUrls` in `@canoncore/providers`, parsed once in `createContext` beside the allowlist.
`provider.configured` answers which providers there are, so a surface can say "none" rather than show
an empty list; `provider.search` fans out over them. `.env.example`, `compose.yaml` and the README's
table all account for the variable, which CNCORE-64's install-path check enforced before any of it
was written down.

**TWO OF THOSE THREE SENTENCES ARE NOW HISTORY, and the section below is what replaced them.** The
parse is no longer "once in `createContext`" — it is per request and lazy — and the three install-path
documents no longer account for the variable, because there is no variable: CNCORE-99 deleted it
from all three along with the schema field they were checked against. `parseProviderUrls`,
`provider.configured` and `provider.search` are unchanged, which is the half this record's "the
boundary does not change" was betting on.


## As built, under CNCORE-99 — the Settings store, and what did NOT move with it

Migration 16 lands one `settings` row carrying `provider_urls` and `provider_allowlist`, with the
full ceremony [[0075-every-table-carries-a-change-sequence]] asks for; `/settings` is where the
Owner names a Provider, removes one, and edits the allowlist. **The section above is now history
rather than a plan, and the sentence it quotes has been fulfilled rather than withdrawn.**

**WHAT MOVED IS THE SOURCE AND NOTHING ELSE**, which is what "the boundary does not change" bought.
`parseProviderUrls` and `parseAllowlist` take the same string they always did; an entry is still
taken as written and never normalised; a malformed one still throws; an empty allowlist still
refuses every provider. The store holds strings for exactly that reason — a store that held parsed
shapes would have moved the boundary while claiming not to.

**TWO COLUMNS RATHER THAN A KEY AND A VALUE.** A settings row per key is a bag an instance can put
anything in, and what exists is two settings; a third arrives as a rung that names it, which is the
posture [[0029-only-the-product-adds-fields]] takes towards fields. One row, enforced the way
`owners` is, so "what is this instance configured to reach" cannot depend on which row was read
first.

**THE THROW MOVED, AND WHERE IT LANDED IS THE DECISION.** This record's own rule was that a
malformed entry throws AT MODULE LOAD, because a typo caught where the value is USED turns a read
path into 500s. There is no module load to throw at once the value is a row. What stands in its
place is that the WRITE parses before it stores: `settings.nameProvider` and `settings.editAllowlist`
refuse what the parsers refuse, so the surface that typed the entry is told, and no value that
cannot be read reaches a row. The store is validated at its only writer rather than at every reader,
which is the posture every configuration file in this class of product takes.

**A WRITE THAT CHANGES THE LIST HOLDS THE ROW FROM ITS READ TO ITS WRITE (CNCORE-391).** Naming and
removing a Provider compute the next list from the stored one, and did it as a read on the pool
and a second statement to write, so two at once each read the list before the other wrote and one
Provider went, with no error. `changeProviderUrls` reads the row `FOR UPDATE` inside the write's
transaction, and takes the change as a function because the rule for what a list becomes lives in
`@canoncore/providers`, which the store does not depend on. The one-statement alternative would
have put that rule in SQL, as a second copy of the parser. The wholesale edits, `editProviders` and
`editAllowlist`, read nothing and need nothing held. Two of them at once are ordinary
last-writer-wins.

**AND THE STATE THAT LEAVES IS WORTH NAMING RATHER THAN GLOSSING**: a value written AROUND the
product, by hand in SQL. It throws where it is read -- and `/settings` is one of the places that
reads it, so the surface an owner would repair it from is down too. That is accepted rather than
designed around, on the same ground the validation stands on: nothing in the product can create
that row, and somebody who can write SQL into `settings` can write SQL to fix it. What it must not
become is the cheap-looking repair -- a reader that splits the entries WITHOUT validating them --
because that is this record's "one rule in two places is two rules that drift", arriving as a
kindness.

**AND THE READ IS LAZY, WHICH IS NOT AN OPTIMISATION.** `createContext` reads the settings when
something asks what this instance reaches, rather than when a request arrives. Most requests never
ask — an item page, the catalogue, a health check, a refusal — and an eager read would have put a
query in front of all of them, including the catch-all route's own suite, whose config states that
it needs no database. Memoised per context, so a request that asks twice gets one answer: "what does
this instance reach" has to hold still inside one request.

**THE SURFACE PAYS THE COST THIS RECORD ACCEPTED.** "Two settings for one concept is a
misconfiguration waiting to happen" is above, and the likely one is naming a provider and forgetting
to allowlist its host. `settings.read` answers, per provider, WHICH OF THREE STANDINGS it is in —
refused by the allowlist, reached, or reached-and-unreadable — and the row says which setting to go
and change. It is computed by `assertConfigUrl`, which is the boundary itself rather than a second
implementation of it. The import page's two notices are unchanged in number for the same reason:
which of the two is refusing is still the thing an owner cannot work out alone.

**THAT FIELD WAS `admitted: boolean` UNTIL CNCORE-101, AND THE CORRECTION IS HERE RATHER THAN BESIDE
IT.** A boolean answered one of those three and left the page to infer the other two, so a provider
the allowlist admitted and that then failed to answer rendered as a working one. ADR-0122's settings
surface needs all three told apart — needs-unlocking, unreachable and not-allowlisted have three
different fixes — and two fields for one fact would have been two chances for them to disagree. The
question this record cares about is unchanged: the surface still says which of the two settings
refuses a provider.

**WHAT IS NOT BUILT.** Nothing carries an owner's old `PROVIDER_URLS` across: the environment of the
process running a migration is not the environment the server will run with, and a rung reading one
would be guessing at the other. There was no released version when this was written
([[0047-migrations-are-a-forward-only-ladder]]), so the only instances in that position were
developers' own, and the remedy is to name the providers again on a page. **`v0.1.0` AND `v0.2.0`
ARE BOTH TAGGED NOW** (CNCORE-252), and this sentence was committed nine hours after `v0.1.0` was
cut, so an owner upgrading across this rung can be in that position. The remedy is unchanged and
the reason for not building the carry-across is unchanged; what is no longer true is that nobody
but a developer can meet it.
