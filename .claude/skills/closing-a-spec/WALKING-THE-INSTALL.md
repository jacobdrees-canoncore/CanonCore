# Walking the install

Step 1 of `closing-a-spec`. The gate's own evidence for why each line is here is the run of
2026-09-20, which found two defects, cleared six false alarms and explained both of the Owner's
complaints as empty stores behind correct features.

### Walk it, logged in

**LOGGED OUT YOU ARE WALKING A DIFFERENT PRODUCT.** Five of eleven routes render a refusal and
nothing else until a session exists; every write surface, the provider list and the account are
invisible. On 2026-09-20 a whole pass read as "the owner surface is thin" before the login.

**ENUMERATE THE SURFACES FROM THE FILESYSTEM.** Memory gives you the ones you have opened before.

```sh
find apps/web/src/app -name page.tsx -o -name route.ts   # 11 routes, 2026-09-20
```

Each one is a row you owe a verdict, and a route linked from nowhere is a finding of its own:
CNCORE-243 is three owner pages whose only link is on a page the owner is redirected away from.

### Think the case space before you open anything

**CALL THE `sequentialthinking` TOOL AND ENUMERATE THE CASES, AGAINST THIS TAXONOMY.** Clicking
around finds what a page volunteers. The taxonomy finds what it hides, and it is the difference
between fifteen cases and five:

| Class | The cases |
| --- | --- |
| Cardinality | zero, one, many, exactly the cap, one past it, the whole corpus |
| Boundary | first and last page, first and last letter, before the first, after the last |
| Absence | deleted, never existed, the relation empty |
| Malformed | unknown parameter value, markup in a value, wrong type, absurd length |
| Authority | logged out, logged in, a second device, an expired session |
| Combination | two filters at once, a filter with an order, a scope with a filter |
| Identity | the same thing twice, two things one name, a thing renamed |
| Scale | the largest container, the most-placed item, the longest title |

The Boundary row is what found CNCORE-242 -- `?letter=A` lands at item 38, so 37 Items sort ahead
of A and no letter on the bar reaches them. Nothing in fifteen minutes of clicking had gone near it.

**DERIVE THE EXPECTED ANSWER FROM THE STORE, THEN OPEN THE PAGE.** Ask the database what the page
must say and hold that number before you look. Read first and you grade the page against itself:
`?letter=Z` was confirmed as 8,030-8,052 because `X+Y+Z = 45` was known first.

**A FULL ACCESSIBILITY SNAPSHOT IS UNUSABLE AT SIZE** -- 418 links and 194 KB on the front page.
Extract the count label, the nav blocks and the first row, and click only where the interaction is
the thing under test.

### Use it, do not read it

**AN EMPTY FEATURE AND A BROKEN ONE ARE IDENTICAL FROM THE OUTSIDE.** The only thing that tells them
apart is putting one row in.

On 2026-09-20 the Owner reported two defects: the kind filter "does not work", and no Groups data.
Both features were correct. Creating ONE Character by hand made `?kind=character` read "1 item";
drawing ONE Group made the narrow control appear on both listings, correctly absent while there were
none. Reading the code would have confirmed both complaints as real. **Exercising each feature once,
end to end, is the step -- create, place, narrow, reorder, undo -- and a feature nothing has ever
been put into is not one this gate may call built.**

**CONFIRM A WRITE IN THE STORE, NEVER FROM THE TOOL.** `orca click` answered `Clicked e239` and
wrote no row; `form.requestSubmit()` wrote it first time. The browser tool reports that it clicked,
which is not that the product did anything.

**AND SAY WHICH ROWS YOU LEFT BEHIND.** Exercising a live install writes to it. Name them.

### Two instances, and never one reset

**THE OWNER'S INSTALL IS NOT A TEST FIXTURE.** It holds the real catalogue and it is what makes the
scale findings possible, so it is walked and never reset. Every finding on 2026-09-20 needed the real
corpus: a 2,907-member ordering, T holding 931 of 8,052, the 37 Items sorting before A, a picker
capped at 100 of 8,052.

**AND A BLANK INSTANCE BESIDE IT, BECAUSE THE FIRST-RUN JOURNEY IS THE LEAST WALKED ONE.** An empty
catalogue, no Provider configured, the first import, the ladder applied from zero -- none of it is
reachable from a filled install, and a spec whose feature only works on a catalogue that grew into it
is not closed. **An import is the case that REQUIRES blank**: a second import into 8,052 Items cannot
show what a first one produces.

**A PROJECT NAME OF ITS OWN IS NOT ENOUGH, AND BELIEVING IT IS COSTS THE CATALOGUE.** This is the
trap, measured 2026-09-20 while writing this file, and it is the reverse of what it looks like.

The Owner's `compose.yaml` pins its volume with an explicit name, so that the catalogue survives the
directory being renamed:

```yaml
volumes:
  canoncore_data:
    name: canoncore_data      # NOT prefixed with the project. That is the point of it.
```

A pinned volume is project-INDEPENDENT. So `docker compose -p canoncore-gate up` against that file
mounts **the Owner's live catalogue** into the throwaway, and puts a second Postgres on one data
directory. `canoncore_providers` is pinned the same way. `docker compose config --format json` prints
both resolved names and is how you check rather than assume.

So a throwaway is **self-contained, deriving from nothing**: the published image, its own volume under
its own project, its own port, and fresh secrets rather than the live ones. Joining the Provider
network read-only is safe, because that is the one name it is right to share.

```sh
docker compose -p canoncore-gate config --format json   # volumes MUST resolve to canoncore-gate_*
```

Tear it down with `down -v`, then read `docker volume ls` back: `canoncore_data` is still there, or
something was wrong with the file.

**AND THE DEFAULT PROJECT NAME IS TAKEN BY THE LIVE INSTALL.** `canoncore-canoncore-1` and
`canoncore-database-1` (working dir `~/canoncore`) carry `com.docker.compose.project=canoncore`, so
a throwaway given no `-p` of its own joins the Owner's instance. Name the project.

`canoncore-postgres` carried that same label until CNCORE-250 and now carries `canoncore-dev`, which
is what a throwaway must also stay clear of. Two projects on one name was why the orphans were the
live install and why Compose printed `--remove-orphans` as the remedy; that pair is disjoint now.
Still check `docker ps` before any compose command in `packages/db`, and still never `db:down` while
other worktrees are testing -- it stops the container every one of them is using.
