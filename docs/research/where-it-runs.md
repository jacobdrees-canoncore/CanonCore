# Where it runs

**Researched 2026-09-10.** If a CanonCore instance lives on rented hardware rather than a box at
home, what does it rent, what may it run there, what does the disk cost, and what breaks.

This is the sequel to `access-layer.md`. That file settled the front door, the login shape and the
hardware floor on the assumption that the machine sits in the owner's home. It said so in one
sentence, and this file is the test of that sentence.

It proposes. It decides nothing — the ADRs are Jacob's to write, and nothing here is one.

## How to read this

Section 0 is what the records already close, and the one conclusion of `access-layer.md` that this
file reopens. Sections 1-6 are the research, each claim carried back to the source that owns it and
dated. Section 7 answers whether three roles fit on one machine. Section 8 says which of
`access-layer.md`'s conclusions a public HTTPS origin makes unnecessary. Section 9 is the decision
list, ranked by when each question blocks something.

Prices are quoted in the currency the vendor displayed. Where a sterling figure is given it uses the
European Central Bank euro reference rates for **2026-09-10**: EUR 1 = GBP 0.85915, EUR 1 = USD
1.1616, so USD 1 = GBP 0.7396.

---

## 0. What is already closed

| Question | Record | What it settles |
|---|---|---|
| Does the server adapt a file to the connection? | ADR-0041 | No. "No transcoding, no quality ladders, no ffmpeg." |
| Does CanonCore fetch or store media for you? | ADR-0097 | No. "a file row REFERENCES bytes that stay where the owner put them." |
| What does the scanner read? | ADR-0050 | A filesystem path. rclone is documented, never integrated. |
| How many public instances exist? | ADR-0097 | Exactly one public read-only demo. |
| Is the archive on the demo? | ADR-0094 | No, and a fresh install starts empty. |
| Is any of this commercial? | ADR-0100 | No. |
| Is there a login? | ADR-0044 | One user, one password. The demo has none. |
| Can a bad migration be rolled back? | ADR-0047 | No. Forward-only, and a released rung is frozen. |
| What is the way back, then? | ADR-0048 | Restore. "a forward-only ladder makes restore the only way back from a bad upgrade". |

**A rented box's disk is a filesystem path, so ADR-0050 is satisfied by this shape rather than
violated by it.** That record's target is a cloud provider's file-scoped permission API, and
`/mnt/data` on a rented machine is an ordinary POSIX path indistinguishable from `/mnt/data` at home.
The half of ADR-0050 that does survive into this file is its second paragraph — change notifications
may not fire — and §6.1 returns to it with the provider-side evidence.

**A password-protected instance at a public URL is not a "public instance" under ADR-0097.** That
record counts surfaces anyone can READ without logging in. Routability is not publication.

### The one conclusion this file reopens

`access-layer.md` §5.4 says flatly: **"A seedbox has no role."** Three reasons are given, and the
third is load-bearing: "the product never ingests media (ADR-0097) so the one thing a seedbox is for
is the one thing this does not do."

That sentence answered a different question. It asked whether a seedbox is a way to ACQUIRE media,
and on that it is still right and this file does not disturb it. The question here is whether a
rented box is where the SERVER RUNS, which ADR-0097 does not reach: the record governs what CanonCore
does with bytes, not which machine the process runs on. The other two reasons — "owning a disk beats
renting at 17.1 months" and "vendors disclaim durability in writing" — are about BUYING versus
RENTING, and §3.7 recomputes the first against today's prices rather than carrying the number
forward.

---

## 1. Eligibility: what a shared seedbox will actually let you run

### 1.1 The test, and why Postgres is the part that fails

The workload is not "a web app". It is this repo, and the repo already fixes the shape:
`packages/db/docker-compose.yml` pulls `postgres:18` and publishes 5432, and
`packages/db/package.json` defines `"db:start": "docker compose up -d"`. So eligibility splits into
five independently-failable parts, and the Node service is the easy one:

1. Run a self-written Node HTTP process.
2. **(a)** Run *any* Postgres server at all — provider-installed, self-compiled into `$HOME`, or a
   managed database the provider sells.
3. **(b)** Run it **the way this repo already does**, `docker compose up -d`.
4. Bind a TCP port reachable from the public internet.
5. Serve it over TLS — and at a **hostname root** rather than a **path**. `apps/web/next.config.ts`
   sets `typedRoutes: true` and no `basePath`; serving at `https://box.provider.net/username/app/`
   would require adding one, which is a code change and not a deployment detail.

### 1.2 The answers, per provider, from each provider's own documentation

| Provider | Root | Docker | Own binary in `$HOME` | Public TCP port | Postgres (a) any | Postgres (b) compose | Own domain + TLS | URL shape |
|---|---|---|---|---|---|---|---|---|
| **Pulsed Media** | No | **Yes — rootless, supported, watchdogged** | Yes | Yes, you pick ≥1024; reachability not guaranteed | **Yes** | **Yes** | **No** | **Path** |
| **Whatbox** | No | **Rootless `podman-compose`, documented — best-effort** | **Yes, documented** | **Yes, 10000-32767; port 31340 dialled from the UK and answered** | **Never named, and installed anyway: 18.6, measured 2026-09-10** | **Yes, via `podman-compose`** | **Yes, hostname root** | **Root** |
| **Bytesized Hosting** | No | **Rootless, documented — their own Immich guide runs a `postgres` container** | Not published | Yes | **Yes** | **Yes** | Not published (Cloudflare-fronted only) | Root (Traefik `Host()`) |
| **Ultra.cc** | No | No, refused by name | Yes | Yes, assigned range + CLI | **Yes, one-click PostgreSQL** | No | **Not published** | **Path** |
| **Feral Hosting** | No | Silent; ships its own `slotns` namespace | **Yes, three routes** | Yes, ≤10 forwarded | Not published (MySQL is offered) | No | Yes, but **you supply the cert** | Path on theirs, root on yours |
| **Seedhost.eu** | No | Not published | Yes, broad `$HOME` permission | Not published | Not published | No | Not published | **Path** |
| **Seedboxes.cc** | No | Silent | **Contractually forbidden** | Not published | No | No | Catalogue media servers only, via Cloudflare, staff-configured | Root (per-app subdomain) |
| **RapidSeedbox** (Lean tier) | No | n/a | n/a — no SSH at all | **No**: "Inbound port opening is not supported for these plans" | No | No | No | n/a |

**Jacob's premise was half right, and the half that is wrong matters.** It is true that these plans
sell from a fixed catalogue and that CanonCore will never be in one. It is not true that arbitrary
Docker is generally refused. **Pulsed Media documents rootless Docker as a first-class platform
feature**, from its own provider-controlled wiki (verified not community-editable: an edit attempt
on 2026-09-10 returns "You do not have permission to edit this page"):

> Pulsed Media provides rootless Docker on all seedboxes as part of PMSS. Containers run entirely as
> your user — no sudo, no elevated privileges. A platform watchdog starts the Docker daemon
> automatically, so there is nothing to install or enable.
> — <https://wiki.pulsedmedia.com/index.php/Rootless_DOCKER> (last edited 26 March 2026)

**It is the only provider in the sweep where `docker compose up -d` with a `postgres` image is
documented by the provider itself.** And it is disqualified anyway, on the other axis:

> **No custom domains** — content is served under the server's hostname, not a domain you own.
> — <https://wiki.pulsedmedia.com/index.php/Web_Hosting_on_PMSS> (last edited 15 July 2026)

At the other end, Seedboxes.cc fails contractually rather than technically:

> Shell access cannot be used: **To compile or run any custom application that does not already come
> installed on our server**
> — <https://docs.seedboxes.cc/presale/terms-of-service> (last updated Feb 14, 2025)

And the general rule, stated by the two providers who state it plainly:

> You cannot install software that requires root privileges. — <https://whatbox.ca/wiki/Installing_Software>

> Users do not have root access and will not be able to run apt-get, su or sudo.
> — <https://www.feralhosting.com/wiki/slots/generic-install-guide>

### 1.3 One provider plausibly clears all five, and it publishes the caveat itself

The expected answer was that no shared plan passes. It is nearly right, and the exception is the
useful part.

**Whatbox clears all five on the evidence, conditional on support.** Its Node guide gives a worked
example on a public port — "A random port number between 10000 and 32767 is needed [...] If you
navigate your browser to `http://server.whatbox.ca:15664/`, you should see 'Hello World!'". Its
Managed Links page gives your own domain at a hostname root — "Bring Your Own Domain [...] This will
allow you to use any domain name you own as your slot's managed links", so no `basePath`. **Measured
end to end under CNCORE-106 on 2026-09-12, and the "root" is a SUBDOMAIN root rather than the apex**:
each managed link is `<alias>.<your domain>`, the vendor's front end terminates TLS inside the slot and
proxies to `127.0.0.1:<port>`, and an unauthenticated request from a UK machine answered `HTTP/2 200`.
ADR-0109 carries the measurement; the apex serves nothing, so the bare domain needs a registrar
redirect if it is wanted at all. And the
container half is documented, though it lives under an application name rather than a container
heading, which is why it is easy to miss:

> Create a compose file. `touch ~/audiobookshelf/docker-compose.yml`
>
> Start the compose file: `podman-compose -f ~/audiobookshelf/docker-compose.yml up -d`
> — <https://whatbox.ca/wiki/audiobookshelf>

That is **rootless Podman running an arbitrary OCI image from a registry, against an unmodified
`docker-compose.yml`, with a published port mapping** — the same mechanism `packages/db/docker-compose.yml`
needs. So "no root" does not mean "no containers", and the rootless-Podman question was worth asking
separately from the Docker one.

**Two things keep it out of a clean yes, and both are Whatbox's own words or silence.** The support
caveat is on the same page: "At this time, Whatbox servers have limited support for Audiobookshelf and
containers. **It may stop working at any time.**" And **Postgres is never named anywhere on the wiki**
— `/wiki/PostgreSQL`, `/wiki/postgres`, `/wiki/MySQL`, `/wiki/Databases` all return 404, and the
installed-software list is behind a login on a hostname that does not resolve publicly. What is
published is the same shape of thing for Redis: "Compile the source [...] `make PREFIX=~/.config/redis/
install` [...] A random port number between 10000 and 32767 is needed and will be used by the Redis
server to bind to." **A user-compiled, port-binding data-store daemon, blessed by the provider.** That
is strong analogy, not a yes.

**The analogy was not needed, and CNCORE-18 replaced it with a measurement on 2026-09-10.** The wiki
is still silent and the box still has PostgreSQL 18.6 installed, five slots deep; both the native and
the `podman-compose` routes round-trip a row as an unprivileged user. The real constraint sat
elsewhere: on 2026-09-10 nothing on the slot restarted a process after a reboot, because `crontab`
was PAM-refused and there is no systemd user session. **CNCORE-85 re-measured that on 2026-09-12 and
cron now works** — the PAM refusal is gone and the daemon fires an unattended job — so the restart is
a cron watchdog rather than a systemd unit. **The blocker is gone; that cron is still there after a
reboot is inference**, and ADR-0109 carries both measurements and says which parts are which.

**Bytesized Hosting is the same story with the sign flipped**: technically the cleanest fit found —
its own Immich guide runs a `postgres` container through Compose — and contractually refused: "You are
not allowed to run applications not installed by default. Exceptions can be made with express
authorization of a staff member." That would need to be in writing before anything else.

**Everyone else fails on one of two axes, and the failures are not interchangeable.** Pulsed Media has
Docker, Postgres, Compose and a user-configurable reverse proxy, and cannot give you your own hostname
— "**No custom domains** — content is served under the server's hostname, not a domain you own."
Ultra.cc solves Postgres without containers at all (a one-click PostgreSQL) and bans Docker by name.
Feral gives you your own domain but only if "you supply your own certificates", with no ACME. Seedhost
publishes almost nothing either way. Seedboxes.cc and RapidSeedbox's shared tier are out.

**So the practical reading is: `basePath` is what splits the field.** Feral, Ultra.cc, Seedhost and
Pulsed Media all serve you at a **path** under a shared hostname; only Whatbox's managed links and
Bytesized's Traefik `Host()` routing give a hostname root. Choosing any of the first four is choosing
to add `basePath` to `apps/web/next.config.ts` — which today sets `typedRoutes: true` and no
`basePath` — and that is a code decision made by a hosting choice.

### 1.4 `systemd --user` is the portable-looking answer, and it is not portable

Three providers implement "yes, run your own daemon" through three incompatible mechanisms — Pulsed
Media's rootless Docker under a `TasksMax: 4096` slice with a five-minute watchdog; Ultra.cc's
`systemd --user` units under `~/.config/systemd/user` with a published ceiling of 2000 userland
processes; and Feral's `slotns` namespace, whose own documentation says to "avoid forking or daemon
mode". A fourth, Seedboxes.cc, forbids them outright: "Customers are not permitted to run programs
in the background on shared servers."

**Nothing written for one runs unmodified on another**, so "supports a shared seedbox" is not a
single deployment target. It is one per provider, plus a supervision shim.

---

## 2. The market, honestly split

Because §1 shows only one shared plan even plausibly passes all five tests, and that one on a caveat
its provider wrote itself, the real category is not "seedbox versus everything else". It is **rented
box with disk**, and it has five rungs.

| Rung | What you get | Root | Own domain at a hostname root | Runs this repo unmodified | Smallest viable monthly spend |
|---|---|---|---|---|---|
| **1. Shared seedbox slot** | A user account on a machine with a fixed app catalogue | No | Only Whatbox, Bytesized | **Only on Whatbox**, via rootless `podman-compose`, best-effort | €3-5 |
| **2. "Dedicated" seedbox tier** | Whole machine from a seedbox company | **Only 2 of 6 vendors sell it** | Yes where root exists | Yes | ~€96 with bulk disk |
| **3. Storage VPS** | KVM guest with attached bulk disk | Yes | Yes | Yes | ~€5, but see the capacity cap in §3.3 |
| **4. Dedicated / bare metal** | A whole physical machine | Yes | Yes | Yes | ~£15 for a small one; ~£80 with bulk disk in stock |
| **5. Small VM + object storage** | Compute rented separately from bytes | Yes | Yes | Yes, with rclone at a path | ~£6 + per-TB |

Rung 5 is in scope because it is the shape ADR-0050 already anticipates: that record says to build
against a filesystem path and DOCUMENT rclone rather than integrate cloud storage, and an
`rclone mount` is a filesystem path. §3.6 prices it and §6.2 says what it costs.

**Rung 2 is mostly a mirage, and that is measured rather than suspected. Four of the six named
seedbox vendors do not sell root at all**, and each says so in writing: Feral ("No, Feral does not
provide any dedicated servers or a VPS type service"), Ultra.cc ("Users do not have sudo or root
access"), Whatbox ("No, root access is not available"), Seedboxes.cc ("No you do not have root access
I am afraid since this is a shared server"). **Only Seedhost.eu and Pulsed Media sell a whole machine
with root** — and Seedhost's is the cheapest in-stock eligible box found anywhere in this sweep
(§3.1). Separately, **no vendor selling real root mentions Docker anywhere**: Seedhost,
Hostingby.Design, Xirvik, DediSeedbox, RapidSeedbox and GigaRapid are all silent on it. Root makes
Docker your problem rather than theirs, which is the point.

**So "dedicated" is a word to check rather than assume.** "Dedicated" from a seedbox company sometimes means
a whole machine with root and sometimes means a dedicated SLOT on a managed machine running the same
fixed catalogue. Seedhost states the distinction plainly, and it is the reason the word cannot be
taken at face value:

> It is impossible because we want to keep integration of our shared servers. Only customers with
> Dedicated App Hosting packages can request it but you are welcome to install anything locally via
> SSH in your HOME path.
> — <https://www.seedhost.eu/shared-app-hosting/>

---

## 3. Price per usable terabyte per month

Every figure below was read off the vendor's own live page or price feed on **2026-09-10**, in the
currency the vendor displayed, **excluding VAT**, and converted to sterling once at the ECB reference
rates for that date. The `basis` column is load-bearing: vendors do not mean the same thing by
"storage", and comparing a raw figure against a vendor-usable one flatters the raw one by about 2x.

| GBP/TB/mo | Plan, as named by the vendor | As shown | TB | Basis | GBP/mo | Rung |
|---:|---|---|---:|---|---:|---|
| **1.10** | Hetzner **SX65-2** (4x16 TB) | EUR 82.30 | 64 | raw | 70.71 | 4 |
| 1.29 | OVH Eco **KS-STOR 6x12TB** | GBP 92.63 | 72 | raw | 92.63 | 4 — *availability `unknown` in all 7 DCs* |
| **1.34** | OVH Eco **KS-STOR 4x4TB** | GBP 21.39 | 16 | raw | 21.39 | 4 — ***out of stock in all 7 DCs*** |
| 1.54 | OVH Eco KS-STOR 6x12TB | GBP 92.63 | 60 | RAID5 | 92.63 | 4 — *stock unknown* |
| 2.00 | Seedhost.eu **SG 64TRC** | EUR 96.00 | 48 | RAID5 | 82.48 | 2 — **in stock, no setup fee** |
| 2.18 | OVH Eco **RISE-STOR 8x14TB** | GBP 213.73 | 98 | RAID5 | 213.73 | 4 — **in stock LONDON** |
| 1.74 | Hetzner **Storage Box BX41** | EUR 40.60 | 20 | vendor-usable | 34.88 | *no compute* |
| 1.79 | Scaleway **Store-2-L-144TB** | EUR 299.99 | 144 | raw | 257.74 | 4 |
| 1.85 | Servarica **Chimera-4** | USD 40.00 | 16 | raw | 29.59 | 3 |
| 1.92 | Hetzner Server Auction, best of 167 | EUR 143.00 | 64 | raw | 122.86 | 4 |
| 1.93 | Hetzner SX135-2 (8x16 TB) | EUR 287.30 | 128 | raw | 246.83 | 4 |
| 1.95 | Scaleway Store-2-L-144TB | EUR 299.99 | 132 | RAID5 | 257.74 | 4 |
| 1.97 | Seedhost **HD 24** | EUR 55.00 | 24 | non-redundant | 47.25 | 1 |
| 2.15 | Pulsed Media **M10G L** | EUR 19.99 | 8 | RAID5 | 17.17 | 1 |
| 2.17 | Whatbox top HDD plan | GBP 47.00 | 21.7 | non-redundant | 47.00 | 1 |
| 2.21 | Hetzner SX65-2 | EUR 82.30 | 32 | RAID10 | 70.71 | 4 |
| 2.25 | Ultra.cc **BRONZE** | EUR 41.95 | 16 | non-redundant | 36.04 | 1 |
| 4.04 | IONOS **AR8-64 HDD ST48** | GBP 194.00 | 48 | vendor-usable RAID5 | 194.00 | 4, **UK** |
| 4.32 | IONOS **IP4-20h ST** | GBP 605.00 | 140 | vendor-usable RAID6 | 605.00 | 4, **UK** |
| 5.14 | Backblaze B2 | USD 6.95 | per TB | n/a | 5.14 | 5 |
| 5.18 | BuyVM 10 TB slab + 4 GB slice | USD 70.00 | 10 | raw | 51.77 | 3 |
| 5.80 | Seedboxes.cc Red Dragon Box | EUR 80.95 | 12 | non-redundant | 69.55 | 1 |
| 5.91 | Wasabi Pay as You Go | USD 7.99 | per TB | n/a | 5.91 | 5 |
| 7.50 | Feral **Radon** | GBP 60.00 | 8 | non-redundant | 60.00 | 1 |
| 9.62 | Contabo Storage VPS 30, 24-month price | EUR 11.20 | per TB | n/a | 9.62 | 3 |
| 11.09 | Cloudflare R2 Standard | USD 15.00 | per TB | n/a | 11.09 | 5 |

### 3.1 The headline, with the stock caveat that has to come with it

**The rung that passes every test in §1 is not the expensive rung.** Root boxes with bulk disk sit at
£1.10-£2.21 per usable TB, and shared seedbox slots sit at £1.97-£7.50 with none of the
capabilities. Paying more does not buy eligibility here; it is the other way round.

But **a price you cannot buy is not a price**, and §3.4 is the reason that sentence is in this
document. Measured against each vendor's own availability data on 2026-09-10, the shortlist that was
actually orderable is shorter than the shortlist that is cheapest:

| Plan | Per usable TB | Disk | Stock at fetch time | Setup |
|---|---|---|---|---|
| **Seedhost.eu SG 64TRC** | EUR 2.00 (RAID5) | 4x16 TB, 48 TB RAID5 | **"1 Available"** | **none** |
| **OVH RISE-STOR 8x14TB** | GBP 2.18 (RAID5) | 8x14 TB SAS, 98 TB RAID5 | **in stock, LONDON** (`lon: 72H`, 14:59 UTC) | £213.73, waived on 12 months |
| Scaleway Store-2-L-144TB | EUR 2.27 (RAID5) | 12x12 TB, 132 TB RAID5 | in stock Paris DC3/DC5 | EUR 299.99 |
| Hetzner SX65-2 | EUR 2.57 (RAID10) | 4x16 TB, 32 TB mirrored | **stock-dependent** | EUR 39.00 |
| IONOS AR8-64 HDD ST48 | GBP 4.04 (vendor-usable) | 48 TB RAID5, **UK** | listed | ambiguous, see §3.5 |

**OVH's KS-STOR line, which produces the two cheapest per-TB figures in the whole table, was
`unavailable` in all seven datacentres — London included — at 14:55-14:59 UTC on 2026-09-10**, and
OVH reported no availability data at all for its two largest configurations. Do not build a plan on
it without re-checking. Note also that OVH's setup fee equals one month's rent on every Eco plan
("Installation fees: £21.39 ex. VAT" on a £21.39 plan), waived only on a 12-month commitment.

Hetzner's cheapest two SKUs are stock-dependent too, and this is measured rather than assumed: the
configurator feed flags `SX65-2 → CheckAvailability: true` and `SX135-2 → true`, and those are exactly
the two SKUs absent from the instant-delivery feed (`live_data_upfront.json` listed 1738, 1739, 1742,
1744 and not 1737 or 1741). The four always-available SX SKUs start at EUR 272.30.

**And the auction is not the cheap route today.** Across all 167 listings on 2026-09-10 the best was
EUR 143 for 4x16 TB (EUR 2.23/raw TB), which SX65-2 beats outright — the 15 June 2026 price adjustment
cut the new-order price below where the Dutch auction had walked down to. The auction also moves: two
fetches twenty minutes apart showed 10 listings gone and 9 new, about 6% turnover, with reduction
timers a median 11.1 hours apart.

**One more UK option worth naming:** OneProvider London had 4x4 TB at EUR 59.99 and 4x14 TB at
EUR 209.99 available at fetch time — the only cheap bulk-HDD bare metal found physically in London
besides OVH's RISE-STOR.

### 3.2 Where the money actually goes, which is not per-TB

Per-TB, rungs 1 and 4 are within a factor of two of each other. **The difference that matters is the
minimum viable spend**: a 2 TB Seedhost slot is EUR 5 a month, and the cheapest root box with real
disk that was actually in stock is Seedhost's own SG 64TRC at EUR 96. So for a small library the
shared slot is genuinely cheaper in absolute terms and buys an ineligible platform; the root box wins
on capability at every size and on price per TB above roughly 8 TB, but it asks for an order of
magnitude more per month at the bottom of the range.

**The setup fee is the part that is easy to miss**, because it is not uniform: none at Seedhost and on
every Hetzner auction listing, EUR 39 on Hetzner's SX65-2, and a full month's rent at OVH and
Scaleway (waived on a 12-month commitment at OVH). On a plan you might cancel in three months that is
a 33% surcharge, and it is the only part of a rental that is not reversible.

### 3.3 The storage VPS is not what it used to be, and three things kill it

**Contabo's Storage VPS line — the product that named this category — now caps at 1.4 TB of SSD**
(Storage VPS 50), confirmed on the German page too ("bis zu 1,4 TB"). Its best per-TB rung is Storage
VPS 30 at EUR 11.20/TB/month on a 24-month subscription, and the line gets *more* expensive per TB
above 1 TB. The headline price is the 24-month price: "The price displayed is the effective monthly
rate for a 24-month subscription including applicable taxes." A 1.4 TB ceiling does not hold a media
library, so the category that sounds like the obvious answer is out on capacity before price or terms
are reached.

**Second, cheap storage tiers and Postgres do not mix, and the vendors who publish numbers say so.**
Time4VPS Storage publishes **200 IOPS** and states Docker is not supported. Layer7's HDD storage
publishes 200 IOPS. IONOS's Essential block tier publishes **1,100 IOPS per instance** and is sold for
"backups and archives". AlphaVPS's own ToS bans "CPU and I/O intensive operations" on its shared-core
VPS, and its own copy says take the NVMe line for a database. This is the rung where a storage product
is a BACKUP product wearing a server's clothes, and the brief asked for exactly that clause — it
exists, and it is published.

**Hetzner Cloud Volumes is the only network storage in the sweep that both publishes an IOPS figure
(5,000 sustained) and endorses databases on it** — and its EUR 44.00/TB/month net makes it three
times the price of a raw spindle, with each TB triply replicated ("Each data block is stored on three
different physical servers"). Hetzner's Storage Box is cheaper than anything else buyable in the EU at
**EUR 2.03/TB/month net** for the 20 TB BX41 with "Traffic | Unlimited" and no minimum term — and it
has **no root and no compute**, so it cannot run Postgres at all. It is attached disk behind a small
server, not a rung of its own.

What survives on this rung are the vendors who sell bulk HDD behind a KVM guest: Servarica's
Chimera-4 at USD 40 for 16 TB (USD 2.50/TB), BuyVM's block-storage slabs at a flat USD 5/TB
("Storage slabs cost $5 per TB and are running on enterprise 7200RPM hard drives with an NVME cache
and a 40Gbit+ InfiniBand to give you near local storage performance"), and **HostHatch at
$3.80-5.00/TB with a London location** — though HostHatch never states its hypervisor and is silent on
Docker, so it fails §1's test on evidence rather than on capability.

**The shape that survives all three of these constraints is two products rather than one**: a small
NVMe VPS carrying Node and Postgres, plus bulk capacity bought separately and mounted. That is rung 5
in §2's table arrived at from the opposite direction — not "object storage is cheap" but "no single
cheap storage product will hold a database". It is worth noting that the constraint pushing toward it
is IOPS and vendor policy, not price.

### 3.4 Availability is the binding constraint, not price

This is the finding that most changes how the table should be read. **The four cheapest per-TB options
in the storage sweep were all unbuyable on 2026-09-10**: Layer7 sold out site-wide, Advin's four
storage plans all out of stock and marked Beta, Servarica showing 65 of 71 plans out of stock, and
BuyVM's slabs at zero or negative stock in every location. Hetzner's entire Cost-Optimized CX/CAX line
rendered `not available`, and its two cheapest SX SKUs are stock-dependent (§3.1).

**A price you cannot buy is not a price.** Any shortlist drawn from §3 has to be re-checked for stock
on the day, and a plan should be chosen partly on whether its vendor keeps stock at all.

### 3.5 One UK-located option, priced

IONOS is the only bulk-disk dedicated line found with a **UK data centre**, and it is the only vendor
that publishes RAID-usable capacity as its headline rather than raw ("Get up to 140 TB of RAID
storage"; "we use hard disk mirroring (RAID) for both the data and operating system storage"). It is
roughly **three times Hetzner's price per usable TB** — £4.04 against £2.21 — which is what UK
jurisdiction and ~20 ms less latency cost. Its setup fee is reported as found and is ambiguous: each
card renders `<span class="setup-strike">Setup £194</span>`, struck through but never printed as £0,
so check it in the basket.

### 3.6 Object storage, and where ADR-0050's rclone sentence lands

| Service | Storage, as displayed | Per TB/month | Egress |
|---|---|---|---|
| Backblaze B2 | "Starts at $6.95 / TB / mo" | $6.95 | "Free egress up to 3x storage", then "$0.01/GB" |
| Wasabi PAYG | "Starting at $7.99 TB/month" | $7.99 | "No fees for egress or API requests", subject to the ratio in §5 |
| Cloudflare R2 Standard | "$0.015 / GB-month" | $15.00 | "Free" |
| Hetzner Storage Box BX41 | EUR 40.60 for 20 TB | EUR 2.03 | "Traffic \| Unlimited" — but **no root and no compute** |

**Three to five times a rented spindle**, so this rung competes on flexibility rather than price. It
does work technically for direct play, from rclone's own documentation: with no `--vfs-cache-mode` a
mount "can only write files sequentially, **it can only seek when reading**" — and read-seeking is
exactly and only what ADR-0097's range-request route needs, so the limitation that disqualifies "many
applications" does not disqualify this one. Reads are chunked at a `--vfs-read-chunk-size` default of
128 MiB, doubling per read, which means an untuned seek costs a 128 MiB fetch.

rclone's own caveat, which is the honest one: "File systems expect things to be 100% reliable, whereas
cloud storage systems are a long way from 100% reliable [...] rclone mount can't use retries in the
same way without making local copies". Worth recording because it is a common assumption: **rclone's
mount page carries no warning that the feature is experimental or unfit for production**; that was
checked.

**Cloudflare R2 as a media origin is UNESTABLISHED, not available.** `access-layer.md` §4.2 concluded
that artwork served from R2 through a custom domain sits inside the carve-out of Cloudflare's non-HTML
clause, and for artwork that reading holds. It does not extend to media, because Cloudflare's two
documents do not agree: the Service-Specific Terms name the permitted paid services as "e.g., the
Developer Platform, Images, and Stream" (R2 is part of the Developer Platform), while the docs page
that elaborates the policy — last updated **2026-08-25**, fetched 2026-09-10 — names only **Stream**
and **Stream Delivery** and **does not mention R2 at all**. The more recent and more specific document
omits it. Whether S3-API or `r2.dev` egress (which R2's own pricing page says is free) falls inside
the CDN policy is also not stated on either page.

### 3.7 Buy versus rent, recomputed rather than carried forward

**The machine access-layer §5.4 priced is not a machine that holds a media library.** It recommends
a used OptiPlex 5070 **Micro** at ≈£279 — a 1-litre chassis with one 2.5-inch bay and an M.2 slot.
That is the right machine for the workload §5.1 measured (Postgres, a Next.js build, a DuckDB query
peaking at 145 MB). It is not a machine with room for terabytes, so "buy hardware" for THIS question
is a different and much larger purchase than the one that record priced.

Measured today rather than recalled:

- **Disk.** Seagate IronWolf Pro 16 TB (ST16000NT001) at Scan.co.uk: **£649.99 inc VAT**, stock
  status "Low stock", fetched 2026-09-10. That is £40.62 per raw TB, or **£81.25 per usable TB
  mirrored** (£1,299.98 for two). Box.co.uk listed the same drive between £627.99 and £634.99 in the
  same search. *Limitation, stated:* this is ONE capacity point at two retailers on one day, not a
  market survey, and one of the two listings was low stock. Do not treat £40/TB as a stable figure —
  re-check it in November, as access-layer §5.4 already says of the Pi.
- **Electricity.** Ofgem's cap for 1 October to 31 December 2026 is **26.32 pence per kWh** on
  direct debit, with "no VAT on electricity from 1 October 2026 to 31 March 2027". The standing
  charge (54.83p/day) is paid whether the box runs or not, so only the unit rate is marginal:

| Draw | kWh/month | Marginal £/month | £/year |
|---|---|---|---|
| 30 W (micro PC, SSD only) | 21.6 | £5.69 | £68.22 |
| 60 W (multi-bay, spinning disks) | 43.2 | £11.37 | £136.44 |

**The 17.1-month break-even in `access-layer.md` §5.4 is not reproducible from anything in this
repo** — that file says its working lives in six files "kept out of the repo deliberately". Under
`CLAUDE.md`'s own rule ("A number copied forward is a number nobody has checked") it is recomputed
here from today's prices rather than repeated.

Like for like at **32 TB usable**, against Hetzner's SX65-2 (§3.1), the cheapest per-TB plan measured
anywhere in this sweep:

- **Rent:** EUR 82.30 + EUR 1.70 for the IPv4 = EUR 84.00/month net = **GBP 86.60/month including UK
  VAT at 20%** (Hetzner's own VAT feed carries `{"short": "GB", ... "tax": 20}`), plus a one-off
  EUR 39.00 setup = GBP 40.21. That is **GBP 2.71 per usable TB per month**, RAID10.
- **Buy:** four 16 TB drives at the measured GBP 649.99 = GBP 2,599.96, plus a chassis with four
  3.5-inch bays (GBP 300-500, not priced here), plus GBP 104-138 a year of electricity.

| Retail price per raw TB | Cost of 4 x 16 TB | Capital incl. GBP 400 chassis | Break-even vs renting |
|---|---|---|---|
| **GBP 40.62** (measured today) | GBP 2,600 | GBP 3,000 | **40 months** |
| GBP 30 | GBP 1,920 | GBP 2,320 | 31 months |
| GBP 20 | GBP 1,280 | GBP 1,680 | 22 months |
| GBP 15 | GBP 960 | GBP 1,360 | 18 months |

**At today's disk prices the break-even is over three years, and access-layer's 17.1 months
corresponds to a disk price of roughly GBP 15 per raw TB.** The figure was not wrong; the disk market
moved, in the same direction and for the same reason that `access-layer.md` §5.4 already recorded
for the Pi's DRAM. Re-check it in November, as that record already says.

**Where this meets the deferral.** Buying for THIS shape means about GBP 3,000 of capital, against
GBP 86.60 a month with, in Hetzner's own words, "Cancellation period: immediately / No minimum
contract term". A monthly rental is therefore not a small version of the hardware purchase that is
deferred to after the London move — it is the thing that lets the purchase stay deferred while the
product still has somewhere to run, and it can be cancelled the month a bought machine arrives. The
only irreversible part is the setup fee, at GBP 40.21.

---

## 4. Bandwidth for streaming out

### 4.1 The rule, and the reason it cannot be tuned

Plex's own bandwidth article names the problem a rented box exists to solve
(support 227715247, fetched 2026-09-10):

> For the vast majority of people, their internet connection can download content much faster than
> it can upload, so the bottleneck is typically related to the upload speed available on your
> internet connection for your Plex Media Server.

And its Playback Quality Suggestions article (support/articles/quality-suggestions, fetched
2026-09-10) shows what the incumbent does when the connection is not fast enough. Every branch ends
in the same place:

> If the media requires a higher playback speed than the monitored bandwidth or Maximum Remote
> Quality it will ask if you would like to lower the playback quality for that session. The Plex
> Media server will need to transcode the media to do that.
>
> If you choose to switch to a lower quality this will ask the server to transcode.

**Under ADR-0041 CanonCore has no such branch.** access-layer §1.2 established this for RELAYS —
Plex Relay is 2 Mbps and survives only by transcoding down into the cap. The quality-suggestion path
generalises it: the incumbent's entire answer to a constrained link is a transcode, so the whole
mechanism is unavailable here. The consequence for this file is precise: **the bandwidth budget is
not a setting. It is whatever the file's own bitrate is**, and the only lever left is which file the
owner stores.

### 4.2 The arithmetic, computed 2026-09-10

1 Mbit/s sustained = 0.450 GB per hour = 0.324 TB per 30-day month if run continuously.

Anchored on Apple's own HLS Authoring Specification tiers (fetched 2026-09-10 from Apple's
documentation JSON; the document's own revision history ends 2025-06-26). Its top tiers are
1920x1080 H.264 at **7800 kbit/s**, 3840x2160 HEVC SDR at **16800 kbit/s** and 3840x2160 HDR at
**20000 kbit/s**.

| Bitrate | GB/hour | GB per 2h film | TB/month at 2h/day | TB/month at 4h/day |
|---|---|---|---|---|
| 7.8 Mbit/s (Apple top 1080p tier) | 3.51 | 7.02 | 0.211 | 0.421 |
| 16.8 Mbit/s (Apple top 2160p SDR tier) | 7.56 | 15.12 | 0.454 | 0.907 |
| 20 Mbit/s (Apple top 2160p HDR tier) | 9.00 | 18.00 | 0.540 | 1.080 |
| 40 Mbit/s | 18.00 | 36.00 | 1.080 | 2.160 |
| 80 Mbit/s | 36.00 | 72.00 | 2.160 | 4.320 |

*Gap, stated rather than filled:* the Blu-ray Disc Association's technical white papers were not
retrievable on 2026-09-10 — `blu-raydisc.com` refused the connection over both HTTPS and HTTP — so
no spec-body maximum bitrate for BD-ROM or Ultra HD Blu-ray is quoted here. The 40 and 80 Mbit/s rows
are illustrative arithmetic, not sourced figures. Apple's tiers ARE sourced, and they are streaming
ladder tiers rather than disc remuxes, so they are a floor for what a direct-play file costs, not a
ceiling.

**The headline: a single viewer, watching four hours a day of the highest tier Apple publishes,
spends about 1 TB a month.** That is inside every included-traffic allowance in §3 by a wide margin,
which means egress volume is not the thing that decides this. The clauses are (§5).

### 4.3 The direction nobody costs: getting the bytes there

ADR-0097 says CanonCore never ingests media, so the owner puts the bytes on the box themselves.
On a rented box that is an upload from wherever the library lives today.

Ofcom's last published median for UK residential upload is **18.4 Mbit/s**, March 2023 — and the
series has ended, which is itself the finding. Ofcom confirmed cessation on 10 August 2023: "the
report covering March 2023 measurements, which is due for publication in September 2023, will be the
final report." From that report: "The median average upload speed of UK residential home broadband
services increased by 7.8 Mbit/s (73%) to 18.4 Mbit/s in the 12 months to March 2023."

Two brighter figures from the same report, both measured: London 1.13 Gbit/s cable recorded a
**52.1 Mbit/s** peak-time upload, and Gigaclear's symmetric 300 Mbit/s full-fibre service recorded a
median **336.5 Mbit/s** upload. Ofcom's Connected Nations Update Spring 2026 (published 13 May 2026)
puts full fibre at "24.9 million UK residential premises (82% of the UK's 30.5 million homes)", so a
symmetric line is a purchasable option in London rather than a hypothetical.

| Upload speed | Hours per TB | Days per TB | Days for 4 TB |
|---|---|---|---|
| 18.4 Mbit/s (Ofcom median, Mar 2023) | 120.8 | 5.03 | 20.1 |
| 52.1 Mbit/s (London cable, peak, Mar 2023) | 42.7 | 1.78 | 7.1 |
| 336.5 Mbit/s (Gigaclear symmetric, Mar 2023) | 6.6 | 0.28 | 1.1 |
| 1000 Mbit/s | 2.2 | 0.09 | 0.4 |

**This is the real asymmetry between the two shapes**, and it cuts both ways. A box at home needs a
fast UPLOAD to be watchable from outside and no transfer at all to be filled. A rented box needs no
upload to be watchable and a slow one to be filled. Which is cheaper depends entirely on where the
bytes are today and how often the library grows — and the same arithmetic is the EXIT cost, because
ADR-0048 makes restore instance-specific and leaving a provider means pulling every terabyte back.

### 4.4 Latency, measured from the owner's own machine

| Target | RTT min/avg |
|---|---|
| `nbg1-speed.hetzner.com` (Nuremberg) | 33.1 / 35.1 ms |
| `fsn1-speed.hetzner.com` (Falkenstein) | 35.7 / 45.9 ms |
| `hel1-speed.hetzner.com` (Helsinki) | 52.9 / 63.6 ms |

Direct play is HTTP range requests over TCP, so RTT costs start-up and seek responsiveness, not
throughput: at 50 ms RTT a 4 MB window still carries 640 Mbit/s. `www.contabo.com` (21.4 ms) and
`www.netcup.de` (41.0 ms) were also measured but are marketing hostnames that may sit behind a CDN,
so they are NOT evidence of datacentre latency and are excluded from the table.

---

## 5. Terms

Every clause below was read from a page fetched on 2026-09-10. Where a document says nothing on a
point it is recorded as **silent**, never as permission.

### 5.1 The finding that splits the market in half, and it is not about media

**Nothing anywhere disqualifies the PRIVATE single-user half.** Not one of the thirteen providers'
terms forbids one person running their own catalogue software and streaming their own files to their
own authenticated devices, and one permits it in as many words:

> 5.8 You may use private streaming for lawful personal use only when access is limited,
> authenticated, non-commercial, and not run as a public, paid, IPTV, VOD, or redistribution service.
> — Ultra.cc, <https://docs.ultra.cc/terms-of-service> ("Effective date: 1st August 2026")

**What is forbidden, repeatedly and by name, is the PUBLIC demo.** Three of the six shared seedbox
providers disqualify it outright:

> Customer agrees not to use the Services [...] to run a public directory service with no
> authentication; [...] for IPTV hosting, IPTV sharing, IPTV resale, VOD hosting, VOD sharing,
> **public media streaming, public video libraries**, and commercial media access services.
> — Whatbox AUP, <https://whatbox.ca/policies/acceptable_use> (no date stated)

> 5.6 Open directories are not allowed. They must be accessible by you only.
> 5.7 Public file hosting, public streaming, public download services, **public media libraries,
> public dashboards, public indexes**, and other public services are not allowed unless we agree in
> writing. — Ultra.cc

> Customers may not use the public HTTP part of their account, to distribute any kind of content or
> share any kind of files (media, audio, etc) with the public. The public http part of each client's
> account, is intended for private usage only and the client is responsible to make sure that all
> access to it, is password protected and not open to the public. Violations in this policy will
> result in immediate suspension of the account for security reasons.
> — Seedboxes.cc, <https://docs.seedboxes.cc/presale/terms-of-service> ("Last updated on Feb 14, 2025")

ADR-0044 makes the demo read-only **with no login**, and ADR-0072 makes everything on it visible. So
the demo is a public unauthenticated media library by construction, and it is the exact thing these
three clauses name. **A shared seedbox cannot host the demo. That is a contractual finding, not a
capacity one**, and it lands directly on §7.

Seedboxes.cc disqualifies more than the demo, on two further clauses that reach the private half too:

> Shell access cannot be used: To compile or run any custom application that does not already come
> installed on our server
>
> Customers are not permitted to run programs in the background on shared servers.

### 5.2 The catalogue and the terms contradict each other, and the catalogue is not the promise

`access-layer.md`'s method says a provider's own app catalogue is evidence of what it permits. It is,
and here it is evidence that runs out at exactly the point that matters.

- **Whatbox** installs Plex, Jellyfin and Emby, and zero-rates them: "none of the following will count
  towards your monthly limit: [...] Plex [...] Jellyfin". Its AUP forbids public video libraries.
- **Ultra.cc** lists Plex, Jellyfin, Emby, Kodi and Navidrome, and clause 5.7 forbids public media
  libraries.
- **Seedboxes.cc** sells "Media Streaming Apps — A selection of the most popular media streaming
  servers like Plex, Emby, Jellyfin" and sizes its plans by their transcoding load, while its ToS
  forbids running any custom application not already installed.

**The catalogue is a permission for THOSE applications, not for this class of application.** That
distinction has a price attached, in §5.3.

### 5.3 The traffic exemption is by application name, and CanonCore will never be in the list

This is the clause this brief asked for — the equivalent of Cloudflare's non-HTML clause — and it is
sharper than Cloudflare's because it is not a judgement call.

> **What counts towards my upload traffic limit?**
> All upload traffic counts except for the following applications:
> FTP (on port 21) and SSH/SFTP (on port 22) · HTTPS from pre-provided directories · OpenVPN ·
> **Plex** · **Jellyfin**
> — Whatbox FAQ, <https://whatbox.ca/faq>

Ultra.cc runs the same exemption, with the same shape: "Media Server Applications (Plex Media Server,
Emby, and JellyFin) on the port as visible in your User Control Panel."

**A self-written media server on a custom port is not exempt.** So the identical viewing session, of
the identical file, costs metered quota when CanonCore serves it and costs nothing when Plex serves
it. CanonCore is penalised precisely for not being one of the named apps, and no amount of good
behaviour changes that — the exemption is a list, and CanonCore cannot get on it.

**And the throttle is a hard playback failure here, not a slowdown**, because §4 established the
bandwidth budget is not adjustable: under ADR-0041 there is no transcode to fall back into. The
published throttles:

| Provider | Throttle on exceeding the quota |
|---|---|
| Seedboxes.cc | **10 Mbit/s** |
| Seedhost.eu | **30 Mbps** — and its quota counts "Downloads from your service via HTTP or HTTPS", with no exemption at all |
| Whatbox, Ultra.cc (non-Essential) | 100 Mbit/s |
| Pulsed Media | 100 Mbps to 2x cap, then linear down to a 5 Mbps floor |

At 10 Mbit/s nothing above Apple's mid 1080p tier plays at all. Where Plex would degrade, CanonCore
stops.

**"Unmetered" almost always means a throttle rather than a bill, and this is general rather than a
seedbox quirk.** netcup publishes two numbers by product line — VPS: "If the average network traffic
of the last 24 hours exceeds 2 TB, a temporary throttling to 200 Mbit/s is applied"; Root Server:
"If traffic exceeds 3 TB within the last 24 hours, a temporary throttling to 300 Mbit/s will be
applied." Time4VPS divides your port speed by ten. HostHatch rate-limits to 5 Mbps. Hostwinds to
3 Mbps. OVHcloud reserves 1 Mbps in the contract though not on the marketing page. Servarica to
about 10 Mbps.

**Hetzner is the sole outlier in the whole sweep: it bills EUR 1.00/TB in 100 MB blocks and never
throttles** — and on a 1 Gbit dedicated uplink there is nothing to bill, because "All root servers
have a dedicated 1 GBit uplink by default and with it unlimited traffic."

**The useful way to read a throttle figure is against §4's arithmetic, not against the quota.** One
viewer needs somewhere between 8 and 40 Mbit/s while a file is playing. A throttle to 200 or 300
Mbit/s is therefore invisible to a single household; a throttle to 30 Mbps costs the top tiers; a
throttle to 10 Mbit/s or 5 Mbps ends playback outright. The number that matters is the floor, and the
floor is published in every case above.

### 5.4 On the root-box rungs the picture inverts

| Provider | Streaming clause | Disproportionate-traffic clause | Abuse deadline, as published |
|---|---|---|---|
| **Hetzner** | Silent | **None** for dedicated or cloud — its fair-use wording is scoped to shared web hosting | "a reasonable deadline"; automated reminder; IP lock after it expires plus a manual check |
| **netcup** | Restricts heavy-compute services and **expressly carves out the product you would buy** | A published number, not a judgement: 3 TB in 24 h → 300 Mbit/s | Notice in the control panel; 2-hour abuse-desk response, Mon-Fri 10:00-18:00 CET |
| **OVHcloud** | Silent except a Black Hat SEO video clause | **Yes** — "In the event of excessive bandwidth use by the Client, OVHcloud reserves the right to limit the volume of bandwidth" | Forwarded to the customer; **no deadline published**; suspension may be immediate |
| **Scaleway** | Silent on lawful streaming | No explicit clause; a duty to warn in advance of "a significant increase in its consumption of resources" | Trusted-source reports "processed automatically and can therefore result in services being suspended automatically" |
| **Contabo** | Silent | **Yes** — bans "scripts and programs that could potentially extensively wear and/or tear Provider's hardware or bandwidth"; "Outgoing Traffic: Unlimited - fair usage policy applies" | GTC says "a reasonable deadline"; help-desk article says **24 hours** or the server is suspended |
| **BuyVM** | Silent | **Yes** — "Resource Abuse [...] consumes sufficient system resources to negatively affect other clients" | Suspended **first**, then 24 hours after reactivation |
| **Servarica** | **Markets it** | Silent | Warning email first; second violation immediate suspension |

**Almost nobody forbids serving media on these rungs.** The one flat prohibition found in the whole
sweep is GreenCloud's, which lists "Streaming/Live Streaming" as a terminable offence. In the other
direction, RackNerd permits it in writing and points storage-locker and video-streaming use *at* the
VPS, Servarica and AlphaVPS market Plex, Layer7 names seedboxes, and Contabo's FAQ names file hosting
as an intended use. Hetzner's Storage Box service agreement is one sentence about crypto mining, so
it is not a backup-only product either.

**Hetzner is the cleanest of the lot on this axis**, and the reason is specific rather than
reputational: its traffic terms are a product specification rather than a fair-use clause. Its own
docs say "All root servers have a dedicated 1 GBit uplink by default and with it unlimited traffic",
and metering applies only to the optional 10 Gbit uplink (20 TB, then EUR 1/TB). There is no clause
under which streaming becomes disproportionate.

Hetzner also expressly permits the demo, which most terms reach only by silence:

> 7.1. The Customer is entitled to grant third parties a contractual term of use to any services the
> Customer orders from Hetzner. In this case, the Customer nevertheless remains the sole contractual
> partner.

And **netcup's is the single most useful clause found**, because it is the one that could have bitten
and does not:

> Betreiben von Serverdiensten, die eine besonders starke Rechnerlast verursachen; **dies gilt nicht
> bei dedizierten und virtuellen Servern**

(Agent's translation: "operating server services that cause a particularly heavy computing load — this
does not apply to dedicated and virtual servers.")

The only general host that markets the use case is **Servarica**: "Run Plex or Jellyfin on a server
that doesn't throttle your CPU or bandwidth" (<https://servarica.com/use-cases/plex-media-server/>,
ToS "Last updated 2025-05-03", Quebec law).

### 5.5 Copyright and abuse, factually

Every provider that publishes a copyright clause reaches infringement generically rather than by
naming media. Hetzner's is representative, and it is a **DSA notice-and-action** procedure rather than
a DMCA one, because Hetzner is a German company:

> 8.2. The Customer is obligated not to publish any content that infringes on the rights of third
> parties or otherwise violates applicable law. [...] (copyrights, name rights, trademark rights and
> data protection rights).

> If we receive a report of illegal content [...] we inform our customer about it and we request that
> the customer immediately remove the content [...] We will set a reasonable deadline for the response
> [...] We reserve the right to lock the customer's IP address via which the relevant content is
> accessible after the deadline has expired and after a member of the Abuse Team has performed a
> manual check.

**Shortest published deadlines, for planning rather than for alarm:** Contabo, Whatbox, Ultra.cc and
BuyVM all publish **24 hours** to respond or be suspended, and BuyVM suspends first and asks after.
Hetzner and Contabo's GTC say "a reasonable deadline". OVHcloud and Scaleway publish no customer
deadline at all.

**The operational consequence belongs in §7's backup answer, not here.** A provider that can lock an
IP within 24 hours of a notice, or suspend automatically on a trusted-source report, is a provider
whose account can go dark faster than a disk can fail. That is what makes the backup destination a
different-vendor question rather than a different-disk question.

### 5.6 Two gaps, stated

- **Feral Hosting publishes no Terms of Service or Acceptable Use Policy at all.** Twenty-one
  candidate paths returned 404, and the homepage sits behind a Cloudflare challenge that did not clear
  in curl, WebFetch or a browser. The only published policy reachable is a privacy policy. Its wiki
  documents plex, jellyfin, emby, madsonic, tautulli and ombi, and that is the entire available
  evidence of what Feral permits. **A provider with no published AUP is not a permissive provider; it
  is an unknown one.**
- **Seedhost.eu's ToS has no governing law, no date, no copyright clause and no abuse procedure** —
  only "Failure to follow any term or condition will be regarded as grounds for immediate account
  deactivation." It is the least restrictive document in the sweep and also the least informative.
  BuyVM likewise has no DMCA page and no governing-law clause in either its ToS or its AUP.

---

## 6. What breaks in this shape

The Plex-on-a-seedbox pattern is well documented, so the question was what its users and providers
actually hit. Six things, and the first is not a performance finding at all.

### 6.1 The pattern is outside the incumbent's own licence

Plex's Terms of Service, fetched 2026-09-10 (no effective-date line was present in the fetched text):

> You may only use the PMS Software: (i) on a device or hardware that you own; (ii) to add Content
> (defined below) to that PMS Software; and (iii) and as a part of your use of the Plex Solution or
> other Plex service.

> You are expressly prohibited from engaging in or facilitating the unauthorized sharing or
> distribution of Content. For that reason, **Content available on your PMS Software must be on
> storage that you own.**

And its own requirements page ([support 200375666](https://support.plex.tv/articles/200375666-plex-media-server-requirements/)):

> Note: Plex is licensed for personal use and it's intended and expected that Plex Media Server
> systems are run from home. If you instead choose to try running your Plex Media Server from a
> virtual or dedicated system running at an online hosting company, Plex may not work with all
> providers.

**A rented box is hardware you do not own and storage you do not own.** So the pattern Jacob is
modelling on is one the incumbent's own terms do not license, which explains why it is simultaneously
popular and badly supported.

**And since 2025-04-29 a seedbox Plex is a paid Plex, for a reason that is structural rather than
incidental.** `access-layer.md` §1.1 recorded the paywall; the seedbox-specific consequence is in
Plex's own definition of "remote":

> "remote" playback would be any time that the player app cannot make a connection to the Plex Media
> Server on the same subnet of the same local network
> — [Requirements for remote playback of personal media](https://support.plex.tv/articles/requirements-for-remote-playback-of-personal-media/)

**A rented box is never on the viewer's subnet**, so every session from one is remote by definition,
and the requirement applies to Direct Play as much as to a transcode. CanonCore has no such gate,
and cannot acquire one, because there is no vendor to impose it.

**This does not bind CanonCore, and the reason is worth stating as a product fact.** CanonCore is
software the owner runs, with no vendor between the owner and the machine. Jellyfin is the comparable
case: GPL-2.0 (verified against `repos/jellyfin/jellyfin` on 2026-09-10), which carries no
field-of-use restriction and therefore says nothing about where it may run. Plex is the outlier, not
the rule. **Where CanonCore runs is a decision no licence takes away from Jacob** — which is exactly
what makes it a decision worth taking deliberately.

### 6.2 The disk is local. The network filesystem is something you add

This was the assumption most worth testing, and it came back the other way round. **The words NFS,
iSCSI, Ceph, GlusterFS and SAN appear in no provider's documentation about a slot's own disk.**
Pulsed Media states it outright — "Drives: 7200rpm HDDs in RAID arrays (RAID0, RAID5, or RAID10
depending on the product)" (`wiki.pulsedmedia.com/wiki/Seedbox`, edited 4 August 2026) — Feral
publishes paths of the form `/media/sda1/user/...`, and Whatbox says "Your slot's hard drive may have
up to 4 users." A seedbox slot's own storage is local to the machine; the network filesystem appears when the user bolts cloud storage
onto it with rclone, and that is where the documented breakage lives. Ultra.cc's own docs name both
failures:

> Usual causes of this are Plex updates, or the server cannot read or write to the library, which is
> a common occurrence with Rclone mounts. In these cases, the RAM usage of Plex would go up, and the
> system will kill your Plex instance.
> — <https://docs.ultra.cc/applications/plex>

> Directly pointing any cloud storage directory using Rclone will create extreme strain on your
> slot's disk and WILL cause a 24-hour ban on accessing your cloud storage repeatedly.
> — <https://docs.ultra.cc/applications/deluge>

So the network-storage warnings are real, and they attach to the object-storage option in §3.6 rather
than to a rented box's own disk.

**Which of those warnings reach CanonCore, and which do not.** Both incumbents are SQLite
applications, and SQLite publishes three separate cautions about network filesystems — the sharpest
being that "**WAL does not work over a network filesystem**" because WAL "requires all processes to
share a small amount of memory" ([sqlite.org/wal.html](https://www.sqlite.org/wal.html), fetched
2026-09-10). **None of that transfers.** CanonCore's database is PostgreSQL, running as a server
process rather than as a library over a file handle (`packages/db/docker-compose.yml`, `postgres:18`),
so the whole SQLite-on-NFS family of failures is not this product's.

**One does transfer, and it is already on the record.** ADR-0057's archive is DuckDB, and DuckDB's own
documentation says:

> Network-attached storage can serve DuckDB for read-only workloads. However, it is recommended to
> avoid using DuckDB's native database format in read-write mode on network-attached storage (NAS).
> These setups include NFS, network drives such as SMB and Samba.

`access-layer.md` §5.2 already concluded "Keep it on **local disk**, not a NAS". This is the vendor
text behind it, and it says the archive must sit on the rented box's own disk rather than on any
attached-storage tier.

**And ADR-0050's second paragraph is confirmed rather than merely cited.** Plex says it twice in its
own words:

> Note: In most cases, this should work for content on local filesystems. It will generally not work
> for network shares mounted via SMB, NFS, AFP, or similar.
> — [Scanning vs Refreshing a Library](https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/)

> Some operating systems don't provide this trigger and content mounted via a network will also
> typically not work. If your library doesn't automatically scan, you may have to set a periodical
> scan or do it manually.
> — [Library](https://support.plex.tv/articles/200289526-library/)

On a rented box's own local disk, change notifications DO fire, so this is a cost of the object
storage option and not of the rented box.

### 6.3 The published limits, where anyone publishes them at all

| Provider | Memory cap | Process cap | IO cap | Root |
|---|---|---|---|---|
| Pulsed Media | `MemoryHigh` ≥ 250 MiB floor, `MemoryMax = min(1.5x MemoryHigh, 95% RAM)` | `TasksMax: 4096` | HDD profile **5 MB/s read, 10 MB/s write, 100/100 IOPS** | No |
| Ultra.cc | NOT ESTABLISHED | 2000 userland processes | NOT ESTABLISHED | No |
| Feral Hosting | NOT ESTABLISHED | NOT ESTABLISHED | NOT ESTABLISHED; per-app thread caps of 1 instead | No |
| Seedboxes.cc | NOT ESTABLISHED | NOT ESTABLISHED | NOT ESTABLISHED | No |

**Only one provider publishes a memory number and only one publishes a process count, and they are
not the same provider.** Everywhere else the envelope is discretionary. Pulsed Media's published
**100/100 IOPS** on the HDD profile is the sharpest constraint a Postgres index scan would meet, and
it is published precisely because Pulsed Media is the most transparent provider in the sweep — the
silence elsewhere is not evidence of a looser limit.

### 6.4 IPv6-only is not a viable origin in the UK, and the numbers are not close

No provider in the sweep was found selling an IPv6-only seedbox plan; the shared providers instead
give you a SHARED IPv4 and mostly no documented IPv6 at all (Ultra.cc: "No, all of our plans have
shared IPs"; the string "IPv6" appears nowhere in Feral's wiki). On the dedicated side the question
is live, because Hetzner's IPv4 is `"Required": false` in its own configurator feed and costs
EUR 1.70/month.

The measurement settles it. Google's own adoption data file
(`google.com/intl/en_ALL/ipv6/statistics/data/adoption.js`, fetched 2026-09-10) gives
**45.89% on 2026-09-08**, and its per-country file gives **UK native IPv6 53.42%** on the same date.
APNIC's independent GB series agrees (53.82% capable). But the per-network breakdown is what decides
it, from APNIC's GB page on a 30-day window:

| Network | IPv6 capable | Samples |
|---|---:|---:|
| BT (AS2856) | 89.80% | 5,018,622 |
| Sky (AS5607) | 93.46% | 3,952,675 |
| **Virgin Media (AS5089)** | **0.21%** | 3,570,900 |
| **TalkTalk (AS13285)** | **0.25%** | 1,124,245 |
| **Plusnet (AS6871)** | **0.33%** | 515,488 |
| **O2 (AS35228)** | **0.63%** | 321,007 |

And NAT64 does not rescue it in this direction. RFC 6146 §1.2:

> The result is that, in the general case, NAT64 only supports communications initiated by the
> IPv6-only node towards an IPv4-only node.

**So an IPv6-only origin is not degraded for a Virgin Media, TalkTalk, Plusnet or O2 customer — it is
unreachable.** Pay the EUR 1.70.

### 6.5 No hardware transcode, and the projects themselves say it does not matter here

`ADR-0041` forecloses transcoding, so every GPU, QuickSync, tone-mapping and SSD-scratch requirement
in both incumbents' hardware documentation drops out. That is not an inference. Jellyfin grades the
four playback types by server load and puts the no-transcode case at the bottom in its own words:

> There are four types of playback; three of which involve transcoding. [...] They are ordered below
> from lowest to highest load on the server:
> **Direct Play: Delivers the file without transcoding. There is no modification to the file and
> almost no additional load on the server.**

The providers say it too, in their own words: Pulsed Media — "The seedbox streams the raw bytes
directly to the client. CPU usage on the seedbox is near zero"; Bytesized — "When using a direct
stream the CPU remains untouched."

Jellyfin's "Not having a GPU is NOT recommended for Jellyfin" and its "you may end up in situations
where a Ryzen 9 5950X cannot handle even a single video stream" are both stated about transcoding,
and Plex's QuickSync requirement is stated about its transcoder. Plex states **no** hardware
requirement of any kind for delivering a file unmodified. This corroborates `access-layer.md` §5.1
from the projects' own text: the hardware question here is storage, IO and network, never compute.

### 6.6 One failure mode that is a data-loss risk rather than a slowdown

Jellyfin's storage page carries a caution sharp enough to restate on its own:

> caution
> There are scheduled maintenance tasks which remove items from your library if triggered while your
> media storage is unavailable.

That is an incumbent deleting library rows because a mount was briefly gone. It is a warning about
the object-storage rung rather than about a rented box's own disk, and it is the strongest single
argument for keeping media on local disk rather than behind rclone. **Whether CanonCore's own scanner
would do the equivalent is not settled by any record** — ADR-0039 says the scanner reads sidecars and
ADR-0046 makes a delete preview its consequences, but neither says what a scan does when the path is
simply absent. That is a question for the playback spec, and this is where it comes from.

---

## 7. Three roles, one machine or three

### 7.1 Why there are three, and only one of them is a preference

**The personal instance** is the thing being asked about. It holds the library.

**The test environment is forced by a record, not chosen.** ADR-0047 makes the ladder forward-only
and freezes a rung once released: "Once a released version has run migration N on someone's data,
migration N is frozen". ADR-0048 states the consequence in its opening line: "a forward-only ladder
makes restore the only way back from a bad upgrade". So the only recovery from a bad migration
against the real catalogue is a restore.

And ADR-0047 already names the gap that a test environment fills, in its own words:

> CI RUNS EMPTY-TO-HEAD EVERY RELEASE, as a gate — and know what it does NOT catch. Building from
> empty applies every migration regardless of the high-water mark, so it goes green on exactly the
> spliced-migration divergence described above. **It proves the ladder composes from nothing; it says
> nothing about what an existing database will do.**

That last sentence is the whole requirement. The gate the repo already has cannot test a migration
against a populated database, and the record says so. Somewhere to run one first is therefore forced
by ADR-0047 and ADR-0048 together.

**The public demo** is allowed by ADR-0097 ("ONE public read-only demo instance") and is not part of
version one (docs/demo.md: "Not a decision, and not part of version one").

### 7.2 What each role actually needs, which is where the cost stops being symmetrical

| Role | Disk | Postgres | Media bytes | Always on? | Public? |
|---|---|---|---|---|---|
| Personal instance | The library, in TB | Yes | Yes | Yes | Behind ADR-0044's password |
| Test environment | **A database, not terabytes** | Yes | **No** | **No — only while a migration is being tested** | No |
| Public demo | Artwork only | Yes | **No** (docs/demo.md's four groups are metadata and artwork) | Yes | Yes, no login (ADR-0044) |

**Two of the three roles need no media at all.** A migration touches the catalogue, not the bytes;
the demo shows the model's range, not files. So the terabyte question in §3 belongs to exactly one of
the three, and the other two are small-VM-sized. That asymmetry is the single most important input to
the one-box-versus-three comparison, and it was not visible before the roles were separated.

### 7.3 Can they share a machine? What the records say, and where they stop

Nothing in ADR-0097, ADR-0094, ADR-0045 or ADR-0072 mentions hardware. Read literally:

- **ADR-0097's "one public demo"** counts INSTANCES, not machines. Two instances on one machine is
  still two instances; one instance on two machines would still be one. The record does not reach
  the question.
- **ADR-0094's "the archive is never on the demo"** is a statement about DATA, satisfied by separate
  databases. It is not satisfied by separate machines with one shared database, and it IS satisfied
  by one machine with two databases. So the separation it demands is at the database, not the box.
- **ADR-0045's enumerated read path** is a code-level guarantee, and access-layer §4.3 established
  that read-only must be a `GRANT`, not `default_transaction_read_only`, because Postgres documents
  the latter as a session default that "can be overridden by `SET TRANSACTION`". A `GRANT` is per
  role, per database — again, not per machine.

**So the records permit one box, and none of them requires it.** What decides it is risk, and the
risks are not the ones a hardware question usually has:

1. **The demo is the only crawlable surface** (docs/demo.md: "the only surface where CanonCore is a
   publisher"), and access-layer §4.4 found that almost nothing stops a crawler — `robots.txt` "is
   not a form of access authorization" (RFC 9309), and Cloudflare's default AI blocking applies only
   "on the pages that display ads". On one box, a crawled demo competes for the same CPU, disk IO and
   uplink as the owner's playback.
2. **The test environment's whole purpose is to run the dangerous thing.** On one box the guard
   between "migrate the test database" and "migrate the real one" is a `DATABASE_URL`. The repo
   already shows how thin that is: `packages/db/docker-compose.yml` hardcodes one database name
   (`canoncore`) and the app reads `DATABASE_URL` from the environment, and CNCORE-3's own eighth
   defect was a `DATABASE_URL` that reached one Turborepo task and not another. An env var is the
   entire separation.
3. **Blast radius.** One kernel, one provider account, one abuse notice (§5) between all three.

### 7.4 A tension in ADR-0048 that the test environment exposes, and that nobody has had to answer yet

ADR-0048 scopes backup deliberately so it cannot become interchange:

> Scoped as Jellyfin scoped 10.11: a backup "can only restore systems on which the backup was
> originally made". That is what stops it becoming cross-instance interchange by the back door.

A test environment seeded from the real catalogue is a restore onto a system the backup was NOT made
on. Under the sentence as written, that restore is refused — which would mean the test environment
cannot be populated with real data by the mechanism the product ships, and the thing ADR-0047 needs
tested cannot be tested against anything resembling the real database.

Three ways out, none of them taken yet, all of them Jacob's to choose:
(a) the test instance is declared the SAME system, on some identity the record has to name;
(b) the record gains an explicit carve-out for a restore into a test instance;
(c) the test environment is seeded some other way — re-imported from the archive per ADR-0057, or
from a synthetic dataset — and never sees the real catalogue, which weakens what the test proves.

**This is a record-level gap, not a hosting question**, and it surfaced only because the roles were
priced separately. It is on the decision list for that reason.

### 7.5 The contractual answer arrives before the cost one

§5.1 removes a whole rung from this question. **The public demo cannot go on a shared seedbox at
all**, because Whatbox, Ultra.cc and Seedboxes.cc each forbid a public unauthenticated media library
by name, and ADR-0044 plus ADR-0072 make the demo exactly that. So on rung 1 the answer is forced:
the demo is somewhere else, whatever Jacob decides about the other two.

On rungs 3 to 5 the question is open, and Hetzner's terms reach it directly rather than by silence:
"7.1. The Customer is entitled to grant third parties a contractual term of use to any services the
Customer orders from Hetzner."

### 7.6 Both arrangements, priced

The two roles that could move are the two that need no media, so the split costs a small VM and not a
second bulk-disk box. Hetzner is used for both sides so the comparison is like-for-like; figures are
its own feed prices plus UK VAT at 20%. SX65-2 stands in for "the bulk-disk box" and was
stock-dependent at fetch time (§3.1) — substitute whichever plan is actually orderable and the
*difference* between the two arrangements barely moves, because the difference is a small VM.

| Arrangement | Components | GBP/month inc VAT |
|---|---|---|
| **One box, all three roles** | SX65-2 + IPv4, three databases, three hostnames behind one Caddy | **86.60** |
| **Split, realistic** | SX65-2 + IPv4, plus a CX23 + IPv4 for the demo, plus a test box billed by the hour | **~92.78** |
| **Split, worst case** | as above with the test box left running all month | **98.95** |

**The split costs about GBP 6 a month, or 7% on top.** That is the whole cost difference, and it is
small enough that cost should not be what decides this.

The test box is nearly free because Hetzner bills cloud servers by the hour, in its own words:

> Mathematically speaking, we will bill you for the minimum amount, whether that is the monthly price
> cap OR the hourly price multiplied by the number of hours you used the server.
> — <https://docs.hetzner.com/cloud/billing/faq/>

A test environment is needed while a migration is being tested and at no other moment, so on an
hourly-billed provider its cost rounds to nothing and on a monthly-only provider a third box is a
third box whether it is switched on or not. **Billing granularity, not machine size, is what decides
whether three roles cost three boxes** — and it is a reason to prefer a provider that bills hourly for
the two small roles even if the big one is billed monthly.

### 7.7 The backup destination, and why §5 chooses it rather than §3

ADR-0047 names the backup's SCOPE, and that is why this is cheap:

> A migration declares WHAT to back up, not merely that it should be backed up. For us that is **the
> database and the artwork cache**.

Not the media. Under ADR-0097 the bytes are the owner's, sitting where the owner put them, so they are
not CanonCore's to back up. **The backup is measured in gigabytes, not terabytes**, and every per-TB
price in §3 is the wrong order of magnitude for it.

*Sizing gap, stated:* the artwork cache's size is established nowhere in the repo. ADR-0037 puts
artwork bytes in a store and ADR-0038 makes it a table; neither gives a per-item figure. At the
archive's 11,285 stories with two images each, the cache crosses 10 GB somewhere around 450 KB per
image — so whether it fits Cloudflare R2's 10 GB free tier is a real question rather than a rounding
error. `access-layer.md` §5.4's "£0 at 10 GB" against R2 holds for the database and is untested for
the artwork.

**The failure domain that matters is not the disk.** On a rented box the disk is the provider's
problem and is usually mirrored or parity-protected. The realistic loss is an ACCOUNT: §5.5 records
four providers that publish a 24-hour window to respond to an abuse notice before suspension, one that
suspends first and asks after, and one whose trusted-source reports are "processed automatically and
can therefore result in services being suspended automatically". **An account can go dark faster than
a disk can fail.**

So the requirement is stronger than "not the same disk": **the backup must be at a different vendor
from the box**, which disqualifies a provider's own included backup space exactly when it is most
needed. Priced destinations, from §3.6: Cloudflare R2, free egress and a 10 GB free tier; Backblaze B2
at $6.95/TB/month with "Free egress up to 3x storage"; Wasabi at $7.99/TB/month, but with a **1 TB
minimum monthly charge** that makes it the wrong shape for a sub-TB backup. The tool choice needs no
re-argument: `access-layer.md` §5.4 already settled on restic rather than Borg, "because Borg 1.x
cannot reach object storage and Borg 2 says 'DO NOT USE' in its own documentation".

---

## 8. What a public HTTPS origin makes unnecessary

If the instance is a rented box with a public static address and the owner's own domain, then:

**Retired: the Tailscale MagicDNS route as the ORIGIN mechanism** (access-layer entry 3). Its four
jobs were: a publicly-trusted certificate for a private address; a domain-format host for WebAuthn
L3; HTTPS for App Transport Security; and a publicly reachable name for Apple's Associated Domains
CDN. An A record plus HTTP-01 does all four with no overlay. What goes away with it: the 90-day
`tailscale cert` renewal the owner has to run, machine names in Certificate Transparency logs, the
six-user cap on the free plan, and the entire CGNAT question — the ISP is no longer in the path,
so the unmeasured CGNAT-prevalence gap in access-layer §1.3 stops being load-bearing.

**Retired: the discovery work.** access-layer §3.3 spent its length on mDNS versus UDP broadcast,
the `com.apple.developer.networking.multicast` entitlement, `NWBrowser`, and ruling out
DeviceDiscoveryUI by name. Its own conclusion was already "Over a tailnet the answer is MagicDNS —
a name, not discovery." A public domain is the same answer without the tailnet. Discovery is not
deferred; it is unnecessary, because the client is configured with a URL and there is nothing to
discover. This also disposes of tvOS having no Local Network permission at all (TN3179) and of the
iOS/tvOS asymmetry, because neither platform makes a local-address connection.

**Retired: mixed content and ATS as problems.** Both are artefacts of an `http://` origin at a
private address. A public HTTPS origin has neither.

**NOT retired: the device-code flow.** access-layer §3.1 rules out Associated Domains for a shipped
App Store build because the domain must be publicly reachable through Apple's CDN. A public origin
satisfies THAT, but not the reason the conclusion held: the domain is per-owner, and an app shipped
to anyone else points at a domain that is not in its entitlement. So RFC 8628 remains the answer for
the TV, and entries 1 and 2 of access-layer's decision list are untouched.

**NOT retired: same-origin media.** ADR-0097's opaque-id route and access-layer §2.4's finding about
`<img>` and `<video>` carrying no custom headers are unchanged by where the box is.

**NEW, and it is the honest cost.** A tailnet is an authentication perimeter: an attacker must be on
the tailnet before ADR-0044's password is even reachable. A public origin has no perimeter, so that
single password becomes the only thing between the internet and the library, and rate limiting,
lockout and log review become real work rather than theoretical. This is a trade, not a free win,
and it belongs in whichever record settles the origin.

---

## 9. The decision list

Ranked by when each blocks something, not by how interesting it is. Seven entries, each tagged to the
spec that forces it.

**No entry needs an ADR before version one ships.** CNCORE-2's four conditions need no remote access,
no client and no playback, and this file changes nothing about them. One entry does bear on version
one — entry 7 touches CNCORE-6 and CNCORE-8 — but as a check on a record already taken, not as a new
decision. Two entries are cheaper to answer now than later, and they are marked.

Jacob writes the records. These are proposals.

---

### 1. Is the canonical HTTPS origin a rented box with Jacob's own domain, rather than a Tailscale MagicDNS name?

**Forces:** the playback spec's same-origin media route. **Hard-blocks the clients spec**, which
`access-layer.md` §8 says "cannot be started early under any circumstances".

**Options:** (a) rented box, own domain, Let's Encrypt over HTTP-01; (b) Tailscale MagicDNS plus
`tailscale cert`, as `access-layer.md` entry 3 proposed; (c) both, with the tailnet as an admin path.

**The evidence favours (a), and it retires more work than it creates.** A rented box has a public
static address, so an A record and HTTP-01 satisfy in one move all four things `access-layer.md`
entry 3 needed Tailscale for: a publicly-trusted certificate, a domain-format host for WebAuthn L3, an
HTTPS origin for App Transport Security, and a publicly reachable name for Apple's Associated Domains
CDN. §8 lists what falls away with it — the 90-day `tailscale cert` renewal, machine names in
Certificate Transparency logs, the six-user cap, the whole CGNAT question and its unmeasured
prevalence gap, and the entire tvOS discovery section.

**Two costs to state rather than discover.** A tailnet is an authentication perimeter, and a public
origin has none, so ADR-0044's single password becomes the only thing between the internet and the
library — rate limiting and lockout become real work. And **pay for the IPv4**: an IPv6-only origin is
not degraded for a Virgin Media, TalkTalk, Plusnet or O2 customer, it is unreachable (0.21%, 0.25%,
0.33%, 0.63% IPv6-capable on APNIC's 30-day GB window), and NAT64 does not help in this direction
(RFC 6146 §1.2). Hetzner's IPv4 is EUR 1.70/month and its configurator marks it `"Required": false`,
so this is a live mistake to make.

---

### 2. Which rung, and does the answer change the code?

**Forces:** the playback spec, alongside entry 1, since that is the first spec needing an instance a
device can reach. But the CODE half lands earlier than that: whichever slice first builds the web app
for deployment inherits `basePath` or does not. **Cheaper to answer now than later.**

**Options:** (a) dedicated / bare metal with root; (b) a shared seedbox slot; (c) a small VM plus
object storage over rclone.

**The evidence favours (a), and the reason is capability rather than price.** §1 finds exactly one
shared plan that plausibly passes all five tests — Whatbox, via rootless `podman-compose` against an
unmodified `docker-compose.yml` and Bring Your Own Domain at a hostname root — and it passes under
Whatbox's own caveat that container support "may stop working at any time", with Postgres never named
on any of its pages. Every other shared provider costs either a `basePath` in
`apps/web/next.config.ts` (Feral, Ultra.cc, Seedhost, Pulsed Media all serve at a path) or the
abandonment of `packages/db/docker-compose.yml` and its `db:start` script, and usually both.

And rung (a) is not the expensive rung. The per-TB figures across rungs sit within a factor of two of
each other (§3); what differs by an order of magnitude is what you may run. The cheapest **in-stock**
eligible box found was Seedhost.eu's own SG 64TRC at EUR 96 for 48 TB RAID5 with no setup fee, and
OVH's RISE-STOR 8x14TB was in stock **in London** at £213.73 for 98 TB RAID5. Do not plan on OVH's
KS-STOR line, whose two cheapest configurations were `unavailable` in all seven datacentres at fetch
time — §3.4 is in this document because that is the normal state of this market, not an unlucky day.

**Rung (c) is viable and three to five times the price of a spindle.** rclone's own docs say a mount
"can only seek when reading", which is exactly and only what ADR-0097's range-request route needs.
Keep it on the list for a library that outgrows one box, not as the first answer.

**Reopened 2026-09-10, on price. See `docs/research/the-cheap-end.md`.** The GBP 86.60/month figure
this entry leads to was rejected, and the repricing found the fault upstream of the vendor comparison:
**this entry's eligibility test was run against a 32 TB requirement that ADR-0097 forecloses.** That
record says "a file row REFERENCES bytes that stay where the owner put them", ADR-0094 starts a fresh
install empty, and CNCORE-2 contains no playback — so version one's whole footprint is a Postgres
catalogue plus an artwork cache measured at roughly 372 MB for the *entire* archive.

The finding "paying more does not buy eligibility here" survives per terabyte and is beside the
point at this scale. **The cheapest thing that satisfies ADR-0109's shape is a GBP 11/month Whatbox
HDD slot at 3.90 TB, vendor-verified** — and the open question here (Postgres, §1.3's gap, a 404 on
their wiki) was settled on 2026-09-10 by buying the slot and testing it. Postgres was never the
problem: the box ships 18.6 and both routes work. **What the test found instead was that nothing on
a shared slot restarted a process after a reboot**, which is now a clause of ADR-0109's shape in its
own right — and the clause stays there even though this vendor stopped failing it. **On 2026-09-12,
after the support ticket was answered, CNCORE-85 measured cron working on the slot**, so "satisfies
the shape" above no longer depends on a human restarting things by hand, subject to the one step
ADR-0109 marks as inference rather than measurement: that cron is still there after a boot. Also
worth carrying forward: Hetzner is now stocked out at both ends, so ADR-0109's entry Cloud plan is
no more orderable than this entry's SX65-2.

---

### 3. Does a test environment exist, and what is allowed to seed it?

**Forces:** the playback spec — the first spec that puts anything in the catalogue the owner would
mind losing, since it lands the scanner and the owner's own library seed. Version one is safe by
construction: ADR-0094 starts a fresh install empty, and CNCORE-2 holds one hand-seeded item and one
imported one. **The record-level half of this entry is answerable now, and gets expensive once
ADR-0048 ships.**

**Options:** (a) a test instance restored from the owner's own backup; (b) a test instance seeded from
the archive per ADR-0057, never seeing the real catalogue; (c) no test instance, relying on ADR-0047's
empty-to-head CI gate.

**(c) is refuted by the record that created the gate.** ADR-0047 says of its own CI gate: "It proves
the ladder composes from nothing; it says nothing about what an existing database will do." A
forward-only ladder with a frozen released rung means restore is the only way back (ADR-0048), so
somewhere to run a migration first is forced rather than chosen.

**But (a) collides with ADR-0048 as written.** That record scopes backup so "a backup 'can only restore
systems on which the backup was originally made'", deliberately, to stop it becoming cross-instance
interchange. A test instance is not the system the backup was made on. So either the record names an
identity under which a test instance counts as the same system, or it gains an explicit carve-out for
a test restore, or the test environment falls back to (b) and proves less. **Nobody has had to answer
this yet because nobody has had two instances.** It is the cheapest possible moment to answer it.

Sizing, which makes this easier than it sounds: a migration touches the catalogue, not the bytes, so
the test environment needs **a database, not terabytes** — and it needs to exist only while a
migration is being tested.

---

### 4. Where does the backup go?

**Forces:** whichever slice implements ADR-0048. **Later spec.**

**Options:** (a) object storage at a different vendor from the box; (b) the provider's own included
backup space; (c) pull it home.

**The evidence favours (a), and §5 rather than §3 is what chooses it.** ADR-0047 scopes the backup to
"the database and the artwork cache" — not the media, which under ADR-0097 is not CanonCore's to back
up — so this is gigabytes and every per-TB price is the wrong order of magnitude. The disk is not the
risk: on a rented box it is mirrored and it is the provider's problem. The account is the risk.
Contabo, Whatbox, Ultra.cc and BuyVM each publish a **24-hour** window to respond to an abuse notice
before suspension, BuyVM suspends first and asks after, and Scaleway's trusted-source reports are
"processed automatically and can therefore result in services being suspended automatically". **An
account can go dark faster than a disk can fail**, which rules out (b) exactly when it is needed.

One unresolved figure to settle while writing it: the artwork cache's size is established nowhere in
the repo, and it decides whether R2's 10 GB free tier is the answer or whether B2 at $6.95/TB is.

---

### 5. One box for all three roles, or a split?

**Forces:** the demo spec, and the test environment from entry 3. **Later spec.**

**Options:** (a) one box, three databases, three hostnames; (b) a bulk-disk box plus a small always-on
demo VM plus an hourly test box; (c) three separate machines of comparable size.

**The evidence does not favour either (a) or (b) on cost, and that is the finding.** The two roles that
could move are the two that need no media, so the split is a small VM rather than a second bulk-disk
box: **about £6 a month, 7% on top** of the Hetzner plan, with the test box nearly free because
Hetzner bills "the minimum amount, whether that is the monthly price cap OR the hourly price
multiplied by the number of hours you used the server". Cost should not decide this; blast radius
should.

**One thing IS decided, contractually**, and re-read at source on 2026-09-11 under CNCORE-81. On a
shared seedbox the demo cannot be co-located at all — Whatbox's Acceptable Use Policy forbids using
the Services "for IPTV hosting, IPTV sharing, IPTV resale, VOD hosting, VOD sharing, public media
streaming, public video libraries, and commercial media access services", Ultra.cc's 5.7 forbids
"public media libraries [...] unless we agree in writing", and Seedboxes.cc requires the public HTTP
part to be "password protected and not open to the public". ADR-0044 and ADR-0072 make the demo
exactly the thing those clauses name. On rungs 3-5 there is no such clause, and Hetzner's 7.1 permits
it expressly.

**Two things were wrong with that sentence as it stood, and both make it bind harder rather than
softer.**

**The media clause is not what catches the demo first.** The same Whatbox policy separately forbids
running "a public directory service with no authentication", and ADR-0072 says the demo "shows
visitors everything on it", there being no visibility system for it to hide behind. That clause bites
on a catalogue holding no bytes at all — which is precisely what version one is, playback being
"entirely a playback-spec concern" and no part of CNCORE-60
(`docs/research/does-cncore-60-need-a-host.md`) — so a demo co-located there would be forbidden
before the first file row exists.
Quoting only the media clause invited the opposite reading, that a demo without media slips past.

**The written-agreement escape hatch is Ultra.cc's alone.** The Whatbox text carries no equivalent:
no "unless we agree in writing", and no exceptions clause of any kind. Setting the two quotes side by
side, as this paragraph does, invited a reader to carry Ultra.cc's qualifier across to the vendor that
does not have it.

**The owner holds a spoken allowance from this vendor, and it moves nothing in this entry.** He
recalls Whatbox telling him the account may run what he likes; asked directly on 2026-09-11 he
confirmed nothing was written down. **ADR-0109 is where that sits** — the search, the result, and
what Whatbox's own Terms say it would take to make such a grant evidence. This file does not re-argue
it, because a claim argued in two places is one that drifts. **The AUP text above is unchanged — for
this account and for everyone else.** An allowance no reader can open is not one this file can argue
from, and the clause that decides the demo is the authentication clause, which no version of the
recollection is specific about.

No record requires a split: ADR-0097 counts instances rather than machines, ADR-0094's separation is
between databases, and ADR-0045's is in the read path.

---

### 6. Rent now, or wait until after the London move?

**Forces:** nothing technical. It is the money question the constraint asked about. **Later spec.**

**Options:** (a) rent monthly now; (b) wait and buy hardware after the move; (c) both, sequentially.

**The evidence favours (a) as the thing that lets (b) stay deferred, and the break-even has moved a
long way since it was last computed.** `access-layer.md` §5.4's 17.1 months is not reproducible from
anything in this repo — that file says its working lives outside it — so it is recomputed here rather
than carried forward. Like for like at 32 TB usable: renting is **£86.60/month including UK VAT**,
against roughly **£3,000 of capital** to buy (four 16 TB drives at the measured £649.99 each, plus a
four-bay chassis), giving a **break-even of about 40 months**. At £15 per raw TB it would be 18
months, which is close to the old figure — so the number was not wrong, the disk market moved, in the
same direction and for the same reason `access-layer.md` already recorded for the Pi's DRAM.

**And the machine that record priced is not a machine for this.** A used OptiPlex 5070 **Micro** at
≈£279 is right for the workload §5.1 measured; it is a one-litre chassis and holds no media library.
Buying for THIS shape is a materially larger purchase than the one that was costed.

Renting is opex, cancellable — Hetzner's own terms say "Cancellation period: immediately / No minimum
contract term" — and the only irreversible part is a £40.21 setup fee. It sidesteps the deferral
rather than triggering it, and it can be stopped the month a bought machine arrives. Re-check every
price in November; half of them are moving fast.

**Reopened 2026-09-10. This entry is not wrong, it is early.** Renting is indeed what keeps the
hardware purchase deferred — but nothing needs renting until the playback spec, so the deferral costs
**GBP 0** rather than GBP 86.60 a month. Version one runs on a laptop and GitHub Actions, and the
provider reaches CI as a service container on GitHub's runners. See
`docs/research/the-cheap-end.md` §5 for the order of operations, which is: buy nothing this month.

---

### 7. Where do the two provider repos deploy?

**Forces:** CNCORE-6 and CNCORE-8. **Not a new decision — a note that an existing one becomes
load-bearing.** `access-layer.md` listed this as unspecified and did not answer it.

ADR-0031 gives each provider its own repo with a "separate deploy", and a rented box is the obvious
place to put them. When they sit on the same machine as CanonCore their base URLs are loopback or a
private container address — and ADR-0034 already states the consequence: "`127.0.0.0/8` is `loopback`
and equally not `unicast`, so localhost is not exempt either", with the fix being that a provider base
URL is a **config URL** and belongs on the allowlist path.

So co-locating the providers on the rented box is precisely the deployment that makes CNCORE-11's
correction load-bearing rather than academic. Whoever implements CNCORE-6 should check that the
allowlist path, not the deny-list, is what a localhost provider base URL travels down.

---

## 10. So what does this change?

**No new record before version one ships.** As with `access-layer.md`, CNCORE-2's stop condition needs
no remote access, no login, no client and no playback. The one entry that reaches a version-one ticket
is entry 7, and it asks CNCORE-6's implementer to check an existing record rather than to take a new
one.

Every entry above names the spec that forces it, and they fall unevenly:

| Entry | Forced by |
|---|---|
| 1. The canonical HTTPS origin | **The playback spec.** Hard-blocks the clients spec. |
| 2. Which rung, and does it change the code | **The playback spec**, with the `basePath` half landing in whichever slice first deploys the web app |
| 3. A test environment, and what seeds it | **The playback spec** — the first to hold data worth not losing |
| 4. Where the backup goes | **A later spec, not yet named**: whichever slice implements ADR-0048 |
| 5. One box or a split | **The demo spec**, plus the test environment from entry 3 |
| 6. Rent now or wait | **No spec.** A money decision, not a technical one |
| 7. Where the provider repos deploy | **Version one**, CNCORE-6 and CNCORE-8 — a check, not a new decision |

**Three of the seven land on the playback spec**, and that concentration is the finding. It was
already absorbing login under `access-layer.md` §8; it absorbs the hosting question too.

What it changes is the shape of the two specs that follow:

- **The playback spec inherits a simpler origin.** Entry 1 replaces `access-layer.md` entry 3's
  Tailscale answer with a rented box and a domain, and §8 lists the work that disappears with it. The
  playback spec still absorbs login (`access-layer.md` entries 1 and 2 are untouched) and still needs
  ADR-0097's same-origin media route.
- **The clients spec loses its discovery half entirely.** It was hard-blocked on one canonical HTTPS
  origin; a rented box with a domain is one, and there is then nothing to discover. mDNS,
  `NWBrowser`, the multicast entitlement and tvOS's missing Local Network permission all stop being
  questions. The device-code flow survives, because the domain is per-owner and a shipped app cannot
  bake it into an entitlement.
- **A test environment appears that was not on anyone's list**, forced by ADR-0047 and ADR-0048
  together, and it carries a record-level gap (entry 3) that is cheapest to close before ADR-0048 is
  implemented rather than after.

The ranking of specs is unchanged: playback, then clients, then demo.

---

## Sources

Every claim above is dated 2026-09-10 and carried back to the source that owns it: each provider's own
pricing pages, price feeds, docs, wikis and legal documents; Apple's HLS Authoring Specification;
Ofcom's last Home Broadband Performance report and its Connected Nations Update Spring 2026; Ofgem's
published price cap; Google's and APNIC's IPv6 measurements; RFC 6146; rclone's own documentation;
Plex's and Jellyfin's own support and developer documentation; and the European Central Bank's euro
reference rates. Latency figures were measured from the owner's own machine.

Anything that could not be established is marked as a gap rather than filled in. The gaps are: the
Blu-ray Disc Association's white papers (`blu-raydisc.com` refused the connection over both HTTPS and
HTTP), Feral Hosting's Terms of Service and Acceptable Use Policy (not published), Hetzner's Volume
and Object Storage per-unit prices (rendered client-side from a feed that returns `null`; the API
needs a token), Cloudflare's position on R2 as a media origin (its two documents do not agree), and
the size of the artwork cache (established nowhere in this repo).
