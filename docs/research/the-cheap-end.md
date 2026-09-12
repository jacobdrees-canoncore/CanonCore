# The cheap end

**Researched 2026-09-10.** `where-it-runs.md` recommended a GBP 86.60/month box with a GBP 40.21
setup fee. That was rejected on price. This file reprices the question from the bottom, and finds
that the number came from a requirement version one does not have.

It proposes. It decides nothing.

**The short answer: GBP 11 a month buys everything, and GBP 0 buys everything version one needs.**
Neither figure required finding a cheaper vendor. Both were already reachable and were excluded by a
sizing premise nobody checked.

## How to read this

Section 1 attacks the sizing premise, because that is where GBP 86.60 came from. Section 2 is the
ranked table. Section 3 is the split nobody priced. Section 4 is the one capability question that
could still sink the cheap answer. Section 5 says what to do.

Every price is dated 2026-09-10 and marked **vendor-verified** or **second-hand**. That distinction
is load-bearing here: two vendors render prices client-side and could not be read directly, and
saying so beats quoting a review site as though it were the vendor.

---

## 1. The sizing premise, which is where the money went

`where-it-runs.md` priced **32 TB usable**. Nothing in this project asks for 32 TB, and the records
say so in three places.

**ADR-0097: CanonCore never holds the bytes.** "A file row REFERENCES bytes that stay where the owner
put them." The catalogue and the media need not share a disk, and on the product's own design they
do not.

**ADR-0094: a fresh install starts empty.** There is no seeded library to host.

**CNCORE-2 has no playback in it.** Its four stop conditions are two working providers, a rendered
page showing one item in more than one ordering, a multi-placement test and a contract test. Not one
of them puts a byte of media anywhere.

### What version one actually stores, in megabytes

Measured against the records rather than estimated:

| Thing | Size | Source |
|---|---|---|
| Postgres catalogue | tens of MB | The whole archive is 11,285 stories and 518,768 property triples (ADR-0057). Statements, placements and aliases over that are a small relational database, not a large one. |
| Artwork cache | **~372 MB for the entire archive** | 11,285 stories × the median ~33 KB `w500` poster measured in ADR-0033. Backdrops roughly double it. |
| The DuckDB fixture | small enough to read | ADR-0057: "The extract is a FIXTURE, not the archive", and it lives in `provider-wiki`, not here. |
| Media | **zero** | ADR-0097 |

**Under a gigabyte, for the entire archive, before any of it is even in version one.** The 32 TB was
priced for media that ADR-0097 says this product never holds, and the demo — the only public
surface — streams "only legally distributable media", which `access-layer.md` sized at a handful of
gigabytes.

So the requirement is not "32 TB". It is **two independent axes**:

- **Compute plus a small database**, needed from the first deployed slice.
- **Bulk bytes for Jacob's own library**, needed only when playback lands, and only at whatever size
  that library actually is — a figure this repo has asked for three times and does not have.

Pricing them as one box is what produced GBP 86.60. Section 3 prices them apart.

### What the shape actually requires

ADR-0109 already fixed it, and it is a short list: **one registrable domain with a publicly-routable
IPv4, a POSIX path for media, an injected Postgres URL, and a process that needs no root and that
something starts again when the machine comes back.** That last clause was added to ADR-0109 on
2026-09-10, when CNCORE-18 measured a shared host and found it was the only clause that failed. §4
is where that lands on this file's recommendation.

Nothing in that list mentions terabytes, and nothing in it needs a dedicated machine.

---

## 2. The ranked table

Cost inc UK VAT where VAT applies. **Lead row first, because it is the honest answer for today.**

| # | Option | Cost/month | What it cannot do | Stops being enough at |
|---|---|---|---|---|
| 0 | **Local machine + GitHub Actions** | **GBP 0** | No public URL, no always-on instance, nothing anyone else can reach | **The first slice that must be reachable from another device** — the playback spec. Not version one. |
| 1 | **Whatbox HDD 3.90 TB** | **GBP 11** vendor-verified | No root; non-redundant disk; no systemd, so a restart is a cron watchdog rather than a unit, and no reboot has been observed to confirm it (§4) | Only if the library exceeds 3.9 TB, or an unwitnessed reboot has to be provably survived |
| 2 | Contabo VPS S (4 vCPU, 8 GB, 100 GB NVMe) | ~EUR 4.50 ≈ **GBP 4** second-hand | 100 GB total — holds the catalogue, holds no library | The day media needs to live somewhere. Pairs with §3's split. |
| 3 | netcup entry (2 vCPU, 2 GB, 64 GB SSD) | ~EUR 3.35 ≈ **GBP 3** second-hand | 2 GB RAM is thin for Postgres plus a Next build; 64 GB total | Same as above, sooner |
| 4 | Hetzner CX23 (2 vCPU, 4 GB, 40 GB) | EUR 5.49 ≈ **GBP 5** second-hand | **Currently unbuyable** — see below | n/a today |
| 5 | Oracle Always Free (2 OCPU Arm, 12 GB, 200 GB) | **GBP 0** | Vendor halved it without announcing; 200 GB total | Immediately, on trust grounds — see below |
| 6 | Whatbox HDD 21.70 TB | GBP 47 vendor-verified | Same as row 1 | Only above 21.7 TB |
| — | ~~Hetzner SX65-2, 32 TB~~ | ~~GBP 86.60 + GBP 40.21 setup~~ | **Rejected on price** | — |

### Row 1 in full, because it is the recommendation

From **Whatbox's own plans page**, read 2026-09-10 with British pounds selected:

| Plan | Price/month | Storage | Upload allowance |
|---|---|---|---|
| HDD | **GBP 11** | **3.90 TB** | 10 TB |
| HDD | GBP 16 | 5.90 TB | 15 TB |
| HDD | GBP 27 | 9.90 TB | 20 TB |
| HDD | GBP 37 | 15.80 TB | 30 TB |
| HDD | GBP 47 | 21.70 TB | 40 TB |

Shared 40 Gbps, unlimited download. **No setup fee anywhere on the page**, and the VAT footnote is
the good kind: **"[1] Plus sales tax for Canadian residents."** A UK customer pays the number shown.
No overage either — **"[3] No charge for exceeding the limit, 100 Mbps unmetered thereafter"**, and
the page states the policy plainly: "We don't charge overage fees, or ever charge you more than it
says on your plan."

**GBP 11 against GBP 86.60 is not a discount, it is a different question being answered.** At
21.70 TB it is GBP 47 against GBP 86.60 for 32 TB — GBP 2.17 per TB against GBP 2.71 — so the shared
tier is cheaper per terabyte too, not merely cheaper in total.

**The caveat that matters is footnote [2]: "Non-redundant storage space."** No RAID. `where-it-runs.md`
priced RAID10 and RAID5 boxes; this is a single disk's worth of durability. That does not disqualify
it — ADR-0048 makes restore the only way back from a bad upgrade anyway, so a backup exists in the
design regardless — but it moves ADR-0048 from "eventually" to "before this holds anything you mind
losing", and that is a real cost to book against the saving.

### Two rows that look cheap and are not

**Hetzner is stocked out at both ends, which retires the incumbent recommendation twice over.**
`where-it-runs.md` §3.4 already found "Hetzner's entire Cost-Optimized CX/CAX line rendered `not
available`" on 2026-09-10, and the shared-vCPU line is reported marked "not available" as of
2026-09-04. So **ADR-0109's "the personal instance starts on Hetzner's entry Cloud plan" is not
buyable today either** — that record says as much itself, noting the Cost-Optimized line "was stocked
out on 2026-09-10 and would roughly halve the entry cost when it returns". `where-it-runs.md`'s own
rule applies to its successor: **a price you cannot buy is not a price.**

**Oracle Always Free is free and should not be trusted with this.** On 2026-06-15 Oracle halved the
Always Free Ampere allowance from 4 OCPU / 24 GB to 2 OCPU / 12 GB **with no public announcement**,
and instances above the new limit were told they would be terminated from 2026-08-18. The AMD micro
instances, 200 GB storage and 10 TB egress were untouched. A vendor that silently halves an
entitlement and then terminates what exceeds it is not a vendor to put the only always-on instance
on. It is a fine place to run something disposable.

---

## 3. The split nobody priced

`where-it-runs.md` compared whole boxes. It never priced **cheap compute for the catalogue plus cheap
bulk for the bytes**, which is the shape §1 says the requirement actually has.

Two ways to buy it:

| Shape | Compute | Bytes | Total at ~4 TB | Total at ~20 TB |
|---|---|---|---|---|
| **One box** | Whatbox HDD | same box | **GBP 11** | **GBP 47** |
| **Split** | Contabo VPS S ~GBP 4 | Hetzner Storage Box at **GBP 2.09/TB** | ~GBP 12 | ~GBP 46 |

The Storage Box figure is **ADR-0109's, verified against Hetzner's own pricing page with UK VAT
selected on 2026-09-10** — 20 TB tier, unlimited traffic, mounts over CIFS at an ordinary POSIX path,
scales up *and down* "without losing data or having to migrate it manually". That record also records
the trap beside it: a Cloud Volume is **GBP 45.36 per TB**, twenty-two times the Storage Box, caps at
10 TB, cannot be shrunk, and is refused on dedicated hardware.

**The split is not cheaper, and that is the finding.** At both sizes it lands within a pound or two of
one Whatbox slot. What it buys for the same money is different, and the difference decides it:

- **The split has root**, so `packages/db/docker-compose.yml` runs unmodified and §4's whole question
  disappears.
- **The split's storage survives a move.** ADR-0109: "What does not survive a move from Cloud to
  dedicated: the IPv4, and any Cloud snapshot. What does: the Storage Box, and the domain."
- **One box is one bill, one hostname, one thing to keep alive**, and Whatbox's disk is local to the
  process rather than over CIFS.
- **Postgres over CIFS is refused by the vendor**: Hetzner marks every network storage product "not
  recom." for a database, "Due to latency and inadequate file system and caching guarantees". So in
  the split, Postgres lives on the VPS's local NVMe and only media goes on the Storage Box. That works
  — it is what ADR-0109 already specifies — but it means the 100 GB VPS disk is the real ceiling on
  catalogue growth.

---

## 4. The one thing that could sink row 1 — tested 2026-09-10, and it was the wrong thing

**ANSWERED, AND NOT AS THIS SECTION EXPECTED. Postgres was never the risk.** CNCORE-18 bought the
slot and ran the test. It ships **PostgreSQL 18.6** already installed — the exact
version `packages/db/docker-compose.yml` pins — and BOTH routes work as an unprivileged user: a
cluster `initdb`'d into `$HOME` on a high port, and the repo's own compose file unmodified under
rootless `podman-compose`. Nothing needed compiling.

**What failed instead was that nothing restarted a process after a reboot — and on 2026-09-12 that
stopped being true.** On 2026-09-10 `crontab` was refused by PAM on this host, so the `@reboot` line
Whatbox's own Cron wiki documents could not be installed; the host had rebooted two days before the
test. **CNCORE-85 re-measured it after Whatbox replied to the support ticket, and cron now runs**: a
crontab installs, and the daemon fired a `* * * * *` line at 13:59:01, 14:00:01 and 14:01:01 UTC, on
schedule and with nobody running it. There is still no systemd user session, so the compose file's
`restart: unless-stopped` and its `healthcheck:` remain inert and the restart has to be a cron
watchdog rather than a unit — but a minutely watchdog is enough for the clause, which asks only that
something start the process when the machine comes back. **ADR-0109 carries both measurements, the
vendor's reply, and the inferred cause that turned out to be wrong**; the rest of this section is the
reasoning that led to the original test, kept because it dates the doubt.

**Can a shared seedbox run Postgres?** ~~This is the piece most likely to fail, and it is genuinely
unresolved rather than merely unchecked.~~ **It was neither: resolved 2026-09-10, and it was not the
piece that failed.** The reasoning below is why it looked like the risk.

`where-it-runs.md` §1.2 already did this work per provider, from each provider's own documentation,
and the conclusion was narrower than "seedboxes are out":

- **Whatbox documents rootless `podman-compose`** running an arbitrary OCI image against an unmodified
  `docker-compose.yml` with a published port mapping — the same mechanism `packages/db/docker-compose.yml`
  needs. It documents Bring Your Own Domain at a hostname root, so no `basePath`. It documents public
  TCP ports 10000-32767.
- **But Postgres is never named**, and the containers page carries Whatbox's own warning: *"At this
  time, Whatbox servers have limited support for Audiobookshelf and containers. It may stop working at
  any time."*

**Re-checked directly on 2026-09-10**, and the gap is still there: `whatbox.ca/wiki/PostgreSQL`,
`/wiki/postgres` and `/wiki/Databases` all return **404**, while `/wiki/Node.js` returns 200. What the
wiki does publish is the same shape of thing for Redis — compile from source into `$HOME`, bind a port
in the 10000-32767 range — which is a **user-compiled, port-binding data-store daemon blessed by the
provider**. Strong analogy. Not a yes.

**So the honest position on row 1 is: everything the shape needs is documented except the database,
and the database has a documented near-neighbour.** That is a thing to test for an hour, not a thing
to reason about further. It was tested, in about that: see the answer at the head of this section.
It costs GBP 11 to find out, cancellable monthly, and Whatbox's own page says "We don't encourage
people to pay many months in advance ... you [are] always free to leave".

Two rejections from that sweep that should not be revisited, because they are contractual rather than
technical: **Seedboxes.cc** forbids shell access "To compile or run any custom application that does
not already come installed on our server", and **Bytesized Hosting** — technically the cleanest fit,
its own Immich guide runs a `postgres` container — requires "express authorization of a staff member".
And **Pulsed Media** has rootless Docker, Postgres, Compose and a reverse proxy, and cannot give you
your own hostname, which is what ADR-0109's shape requires first.

---

## 5. What to do

**Nothing, this month.** Version one is row 0. It has no playback, stores no media, needs no public
URL, and CI runs the provider as a service container on GitHub's runners. **Buying anything now buys
capacity for a spec that has not started.**

**The recommendation for when it does start is ROW 1, the Whatbox slot at GBP 11 — and this section
said so conditionally before it could say so outright.** It recommended the split "unless Whatbox
fixes cron", on the one thing the slot failed: nothing restarted a process after a reboot, and an
always-on instance that needs a human to log in after every host reboot is not always-on. **Cron
works as of 2026-09-12**, measured on the slot under CNCORE-85 rather than taken from the vendor's
reply, so the condition this file set has been met and row 1 is the recommendation on the file's own
terms.

**The question this section left open was asked and has been answered.** Whatbox support ticket
267784, filed 2026-09-11 under CNCORE-81, put both halves to the vendor. The reply came 2026-09-12,
six days inside the deadline ADR-0109 set, and it is worth reading precisely: it says Whatbox can no
longer reproduce the refusal and asks whether we still see it, which is neither a yes nor a no. **The
measurement is what settles it, not the reply** — the refusal is gone and cron fires an unattended
job. ADR-0109 carries the ticket, the reply, the re-measurement, and the one inference that turned out
to be false.

**What the split still buys, so the flip is not read as wider than it is.** Row 1 wins on the clause
that was blocking it and on price, and the split's other advantages are unchanged and unbought: root,
a systemd that restarts things without a watchdog, redundancy the slot's non-redundant disk does not
have, and storage that survives a later move to dedicated hardware. None of those was the thing
holding row 1 back, and none of them is worth GBP 1/month here on its own — but the day one of them
IS the binding constraint, the split is still what answers it, and §3 prices it.

When the playback spec starts, the order of operations is cheap and reversible:

1. ~~**Spend GBP 11 on one Whatbox HDD slot and answer §4 in an evening.**~~ **Done, 2026-09-10, and
   the one test it failed was re-run and passed on 2026-09-12.** Postgres runs by both routes and
   needed no compiling. What it did not do was come back by itself after a reboot, which is the "if
   it survives a restart" test this step set; the support ticket that was the next move was filed
   2026-09-11, answered 2026-09-12, and the re-measurement is in ADR-0109. **The slot is already
   bought, so row 1 costs nothing further to take.**
2. ~~**Take the split**~~ — **not needed for the restart clause any more.** A ~GBP 4 VPS with root
   plus a Storage Box at GBP 2.09/TB was what step 1 was going to buy a systemd from. It stays priced
   in §3 and stays the answer if root, redundancy or storage that survives a move to dedicated
   hardware becomes the binding constraint. None of them is today.
3. **Re-check Hetzner when the Cost-Optimized line returns**, which ADR-0109 says "would roughly halve
   the entry cost".

**How the restart is actually written is the playback spec's to decide, not this file's.** What §4
settles is that the slot has a mechanism at all; ADR-0109 records what it is, what was measured, and
the one step still inferred.

**Do not buy for 32 TB until the library size is known.** It has been asked for three times. Every row
above scales on that axis alone, and no row below GBP 10 changes with it, because none of them holds
media at all.

### What this reopens in the records

- **`where-it-runs.md` entry 2** picked rung (a), dedicated with root, on the finding that "paying more
  does not buy eligibility here". That finding stands per terabyte and is beside the point at this
  scale: the cheapest eligible thing is GBP 11, not GBP 86.60, because the eligibility test was run
  against a 32 TB requirement that ADR-0097 forecloses.
- **`where-it-runs.md` entry 6** ("rent now") is not wrong, it is early. Renting is the thing that
  keeps the hardware purchase deferred — but nothing needs renting until the playback spec, so the
  deferral costs GBP 0 rather than GBP 86.60.
- **ADR-0109 is unaffected in substance and out of date in one detail.** Its shape is exactly right and
  this file is priced against it. Its closing note — "the personal instance starts on Hetzner's entry
  Cloud plan" — names a plan that is not currently orderable, and that record already flags the
  stock-out itself.

Nothing here needs a new record. It is a price correction to research, and the decision it feeds
belongs to the playback spec.

---

## Sources

**Vendor-verified, read directly 2026-09-10:** Whatbox's own `/plans` page with British pounds
selected — every plan price, storage figure, upload allowance and all five fine-print footnotes quoted
above; and `whatbox.ca/wiki/` reachability for `PostgreSQL`, `postgres`, `Databases` and `Node.js`,
checked by HTTP status.

**Asked of the vendor, 2026-09-11 under CNCORE-81, and answered 2026-09-12:** Whatbox support ticket
267784, on whether cron can be enabled on this slot and what else could start a process after a
reboot. The reply neither enabled nor refused it: Whatbox reported being unable to reproduce the
refusal and asked whether it was still happening. **What §4 and §5 now rest on is the re-measurement
CNCORE-85 took on the slot the same day** — a crontab installing and the daemon firing it three
minutes running — rather than the reply. ADR-0109 carries the ticket, the reply quoted, the
re-measurement, and the inference about `/etc/security/access.conf` that the re-measurement falsified.

**Repo-internal, and dated by the record that carries it:** ADR-0109 for the Hetzner Storage Box at
GBP 2.09/TB and the Cloud Volume at GBP 45.36/TB, both verified there against Hetzner's own pricing
pages with UK VAT selected on 2026-09-10, plus its Postgres-on-network-storage refusal and its
what-survives-a-move list. `where-it-runs.md` §1.2 and §1.3 for the per-provider eligibility table and
the Whatbox, Seedboxes.cc, Bytesized and Pulsed Media quotations, and §3.4 for the Hetzner stock-out.
ADR-0033 for the ~33 KB median poster, ADR-0057 for the archive's row counts, ADR-0097 and ADR-0094 for
what the product stores, ADR-0048 for why non-redundant disk is a cost rather than a disqualification.

**Second-hand and marked as such**, because both vendors render prices client-side and returned no
readable figures to a direct fetch: Contabo's and netcup's entry plans, and Hetzner's CX23 price and
availability. Every figure from those three carries a `second-hand` tag in the table and **none of them
is load-bearing** — the recommendation is row 0 today and row 1 when playback starts, and both are
vendor-verified. Confirm any second-hand row at the vendor before spending on it.

**The gap, stated rather than filled in:** the size and growth rate of the library. Asked three times,
still unknown. Every row is written so that the answer picks a row rather than changing the analysis.
