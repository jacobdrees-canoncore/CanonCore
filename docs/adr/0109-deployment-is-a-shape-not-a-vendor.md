---
status: proposed
---

# Deployment targets a shape, never a vendor list

CanonCore commits to running in a SHAPE: one registrable domain with a publicly-routable IPv4, a
POSIX path for media, an injected Postgres URL, and a process that needs no root **and that
something starts again when the machine comes back**. A vendor compatibility list rots, because its
contents are not ours to keep true.

That last clause was implicit until CNCORE-18 measured a shared host and found it was the only one
that failed; it is spelled out here rather than left to be rediscovered. "The shape measured against
a shared host" below carries the measurement.

**A rented box satisfies ADR-0050 rather than violating it.** That record's target is a cloud
provider's file-scoped permission API; `/mnt/data` on a rented machine is an ordinary POSIX path,
indistinguishable from `/mnt/data` at home. The half of ADR-0050 that survives into this shape is its
second paragraph — change notifications may not fire — and over a network mount it applies more
rather than less.

## The IPv4 is not optional, and the national figure understates it

GB IPv6 capability is 54.52% (APNIC, sample dated 2026-09-07), so an IPv6-only origin is not
degraded for nearly half the country, it is unreachable. **The per-ISP picture is far worse than the
national one and is the number that should be quoted**: AS5089, Virgin Media, carries 18.70% of GB
users at 0.19% IPv6 capable. Roughly a fifth of the country sits behind one provider with
effectively no IPv6 at all.

Hetzner Cloud charges EUR 0.50/month excluding VAT for a primary IPv4 and folds it into its listed
plan price; on its dedicated line it is EUR 1.70. Buy it, and note that a Primary IP is an
independent resource that survives rebuilding the server under it.

## The only half that lands before a host is chosen, and it is not a config option

**`basePath` is NOT added.** Nothing serves this app from a path today, `CLAUDE.md` forbids a
configuration option before something in the repo reads it, and the one shared host that plausibly
runs this at all serves at a hostname root.

What IS adopted now is a coding rule, which is a different kind of thing: **a URL that the framework
does not rewrite is never hand-built.** Next.js prefixes `<Link>`, `<Form>` and `router.push()` and
nothing else. Raw `fetch()`, raw `<a href>` and `<img src>` are untouched, and so is metadata: the
documented lever there is `metadataBase`, which Next.js says "can include subdomains or base paths".
Route them through one place and a later `basePath` is one line; scatter them and it is a sweep
through every file, discovered on the day a host is chosen.

**AN EARLIER VERSION OF THIS RECORD GOT THE CANONICAL WRONG, AND THE CORRECTION STRENGTHENS THE
RULE RATHER THAN WEAKENING IT.** It said absolute URLs in metadata "are governed separately by
`metadataBase`, which is exactly what ADR-0066's canonical link relation emits". ADR-0066 as built
under CNCORE-5 does the opposite, deliberately: the canonical is RELATIVE and self-referential, and
`metadataBase` is left UNSET because "an origin setting would be a value nothing else in the repo
reads" — which is the same `CLAUDE.md` rule this record invokes two paragraphs above, reached
independently.

So the canonical is not governed elsewhere. It is a hand-built path string, and it is therefore the
FIRST LIVE MEMBER of the class this rule names — the `alternates.canonical` template literal in
`apps/web/src/app/items/[id]/page.tsx`, which interpolates the item id into a root-absolute path.
It is correct today only because no `basePath` exists. Under one it would advertise `/items/<id>`
while the page sits at `/canoncore/items/<id>`, and a wrong canonical is worse than none, because
RFC 6596 exists precisely to be believed by crawlers and caches.

**The two records compose, and the handoff is concrete.** Neither wants a config value nothing reads,
so neither `basePath` nor `metadataBase` is set today. They arrive TOGETHER, with the host that needs
them, and the canonical is the specific thing to re-check that day.

Every other constraint a host imposes — a data directory, somebody else's TLS terminator, a path
prefix — arrives with the host that reads it, and not before.

## The list of what Next rewrites is MEASURED now, and `redirect()` is not on it — under CNCORE-68

The rule above names `<Link>`, `<Form>` and `router.push()`, taken from Next's documentation. That
documentation says nothing either way about `redirect()` from `next/navigation`, which is the lever a
mutation reaches for: do the write, send the reader to what it wrote. **It does NOT get the
`basePath`.** Measured on Next 16.3.4 by setting `basePath: "/canoncore"` and asking the running
build: `<Link href="/items/abc">` emitted `href="/canoncore/items/abc"`, and a Server Action calling
`redirect("/items/abc")` answered `303` with `Location: /items/abc`. So `redirect()` belongs in the
exposed class with `fetch()`, `<a href>` and `<img src>`, and it is the most dangerous member of it:
the other three are visibly strings in markup, while this one looks like navigation.

**WHICH CHANGED A PAGE'S DESIGN RATHER THAN ADDING A LINE TO A LIST, and that is why it is here.**
CNCORE-68's import surface has to report what an import did. The obvious shape is to redirect to the
new Item, and that is the one thing it may not do — so the page reports by READING the catalogue
instead: every candidate carries the Item it is already held as, so the row that offered a button
before the POST names its Item after it. The field `provider.search` answers exists because of this
measurement.

**AND THE OTHER HALF OF THAT IS WHAT A SERVER ACTION BUYS.** A mutation must be a POST, and the only
two ways to get one are a form whose target Next writes itself or a URL written by hand. So
`<form action={serverAction}>` is not a framework fashion here, it is this rule's answer for every
write surface after it: Next renders the target, there is no string for a later `basePath` to get
wrong, and the form needs no JavaScript — which is what keeps the surface assertable at
[[0103-tests-bite-at-package-exports-and-the-router]]'s fourth seam with no browser.

**`useActionState` IS RULED OUT BY THE SAME REASONING, and it is worth saying because it is the
documented way to get a value back from an action.** It is a client hook: with no script loaded it has
nothing to give, so a surface reporting through it would answer differently depending on JavaScript.
React offers `permalink` for exactly that case and a permalink is a hand-built URL, which is where
this rule came in.

## The growth path, so a later move is not a cancellation

Priced 2026-09-10 from Hetzner's own pages with UK VAT selected. Two axes grow independently and
neither requires cancelling the other.

**Media goes on a Storage Box, never on a Cloud Volume.** A Storage Box is GBP 2.09 per TB per month
at the 20 TB tier, scales up AND DOWN "without losing data or having to migrate it manually", carries
unlimited traffic, mounts over CIFS at an ordinary POSIX path, and is free to read from a Cloud
server in the same location — "We calculate monthly traffic only using outgoing traffic. We do not
count incoming and internal traffic." It has been a standalone product since 2025-07-29, so it
survives a move to dedicated hardware untouched.

A Cloud Volume is GBP 45.36 per TB per month, **22 times the Storage Box**, caps at 10 TB, cannot be
shrunk ("you can only enlarge your Volume, not reduce it") and is refused on dedicated hardware
outright ("Volumes only work with cloud servers"). Its one good use is a Postgres data directory that
outgrows the plan's local NVMe.

**Postgres stays on local NVMe.** Hetzner marks every network storage product "not recom." for a
database, footnoted "Due to latency and inadequate file system and caching guarantees".

**Compute grows by rescale in place**, keeping the IP and the disk, and it is reversible in both
directions provided the disk enlargement is declined: "When scaling up, you can choose to keep your
current disk size. This allows you to later downgrade to a server plan with the same disk size."
Architecture cannot change during a rescale, so x86 to Arm is a rebuild.

**What does not survive a move from Cloud to dedicated: the IPv4, and any Cloud snapshot. What does:
the Storage Box, and the domain.** That is the concrete reason the DOMAIN rather than the address is
this product's identity, and it is why the move is a repointed A record rather than a migration.

**Concurrency binds before volume does.** Hetzner include 20 TB per month in the EU at EUR 1 per TB
after, which is not a constraint at this scale, but state plainly that "We do not offer bandwidth
guarantees for our Cloud servers, but you can expect about 300-500 Mbits", shared with neighbours on
the host. A dedicated server gets a guaranteed 1 Gbit uplink. **That, and not disk, is what
eventually makes dedicated an upgrade** — which matters because ADR-0041 forbids adapting a stream to
the connection.

## Deliberately not decided

Which rung beyond the entry plan, and when. That belongs to the playback spec, which is the first
spec that puts bytes anywhere. `docs/research/where-it-runs.md` holds the priced comparison and its
own caveat that availability rather than price is the binding constraint in that market.

## The owner's own instance

Recorded because it dates the choice, not because it constrains the product: the personal instance
starts on Hetzner's entry Cloud plan with an IPv4, and a Storage Box is added on the day media
arrives. Re-check prices at order time — the Cost-Optimized line was stocked out on 2026-09-10 and
would roughly halve the entry cost when it returns.

## The shape measured against a shared host, and the clause that was hiding inside it

CNCORE-18 bought the cheapest thing that could plausibly satisfy this shape — a Whatbox HDD slot at
GBP 11/month, plan H3-4, Netherlands — and ran the shape against it on 2026-09-10, the day it was
bought. **Four clauses hold outright. The fifth holds only while somebody is watching, and noticing
why is worth more than the vendor verdict.**

**The database was never the risk, and the research that said it was had the right doubt about the
wrong object.** `docs/research/the-cheap-end.md` §4 called Postgres "the one thing that could sink
row 1", because Whatbox's wiki never names it. The wiki still does not. The box has it anyway:
`postgres`, `initdb` and `psql` sit in `/usr/bin`, and `eselect postgresql list` reports five slots —
14, 15, 16, 17 and **18**, answering `18.6`. `packages/db/docker-compose.yml` pins the floating major
tag `postgres:18`, which resolved to 18.6 on the day of the test — the same string ADR-0104 records
that container answering, and the same string the container on this box answered. **So the gap was
zero on 2026-09-10 and nothing needed compiling.** It is a major-version match that holds and a
minor-version match that will drift, because a native install tracks Gentoo's slot rather than the
tag. A wiki's silence measured the wiki, not the machine.

Both routes work, as the ordinary unprivileged slot user:

- **Native.** `initdb18` into `$HOME` with data page checksums enabled, `port = 15432`, started with
  `pg_ctl18`, then `createdb`, `CREATE TABLE`, `INSERT` and `SELECT` over `psql18`. What came back:

  ```
   id |       item        |     container     | rank
  ----+-------------------+-------------------+------
    1 | Philosopher Stone | Publication order |    1
    2 | Philosopher Stone | Chronological     |    3
  ```

  One item, two placements, two orderings, which is the product's central case rather than a
  `SELECT 1`.
- **Container.** `packages/db/docker-compose.yml` copied up **unmodified** — SHA-256 identical at
  both ends — and brought up by the box's own rootless `podman-compose` 6.1.0, crun, cgroup v2. It
  pulled `postgres:18` in under four seconds and answered `PostgreSQL 18.6 (Debian)`.

**The provider permits this in its own words, which is a better thing than not forbidding it.**
Whatbox's FAQ, <https://whatbox.ca/faq>: "Can I run my own apps? Yes, however, this is advanced
functionality that you must do via SSH, and our support will be limited." The prohibitions beside
it are a short closed list — root, mining, peer-to-peer load balancing, Tor, LLM models, and
anything that "negatively impacts other users by burdening the server". A catalogue database is
none of them, so it is allowed by explicit permission carrying a support disclaimer, rather than by
silence.

**That permission is about running software, and a SECOND policy governs what the software may
serve.** Read at source on 2026-09-11 under CNCORE-81, Whatbox's Acceptable Use Policy forbids using
the Services "for IPTV hosting, IPTV sharing, IPTV resale, VOD hosting, VOD sharing, public media
streaming, public video libraries, and commercial media access services", and separately forbids
running "a public directory service with no authentication". **Neither clause reaches the personal
instance this record is about** — one owner, one password, ADR-0044 — and both name ADR-0097's
public demo exactly, the second of them before any playback exists.
`docs/research/where-it-runs.md` carries that finding and the corrections CNCORE-81 made to it.

**The same policy forbids running "20 or more concurrent Plex streams" rather than forbidding Plex
outright, so the ceiling it sets is nineteen.**
**Measured**: that clause and the media clause sit in one list, and the vendor's FAQ says "Plex is
available as a managed app on all plans. We provide one-click installation and updates".
**Inferred, and not confirmed with the vendor**: that "public media streaming"
therefore reaches the public, unauthenticated, library-shaped case rather than any streaming at all,
since a Plex server serving authenticated people is streaming media inside the same document that
caps it at twenty. The inference narrows the prohibition; it does not move the demo out of it, which
is why nothing below rests on it.

### The allowance the owner holds is spoken, and this record does not rest on it

The owner recalls Whatbox granting this account a specific allowance covering whatever he wants to
run. **CNCORE-81 went looking for the artefact, found none, and then asked him directly on
2026-09-11: he confirmed the grant was spoken and that nothing was written down.** That confirmation
is what makes this a closed question rather than a search that gave up. The account's support history
holds a single ticket, the cron one filed 2026-09-11 and recorded below. A search of the owner's mail
for everything `whatbox.ca` has sent returns subscription, traffic and slot notices and one 2023
support reply about a Plex update, and no grant of any kind; a full-text search of that mailbox timed
out rather than completing, so the mail result is a strong negative and not an exhaustive one.

**So there is no verbatim text to quote here, no date, and nobody named.** That absence is what this
section says instead of a quotation, because a record presenting recollection as evidence would be
worse than one presenting it as recollection — and the next reader would have no way to tell which
they were holding.

**What would make it evidence is cheap and specific.** Whatbox's own Terms say at 13.2 that "The
parties may use emails to satisfy written approval and consent requirements under the Agreement", so
ONE EMAIL from Whatbox naming what this account may run would be quotable here and would carry
contractual weight. It would still not be an amendment: 13.13 requires that "Except as stated in
Section 1.3(b) (Modifications: To the Agreement), any amendment must be in writing, signed by both
parties, and expressly state that it is amending this Agreement". **The carve-out is the half worth
keeping**, because 1.3(b) is the clause letting Whatbox change the Agreement and its URL Terms
unilaterally on 30 days' notice. So the ceiling on the best available version of this allowance is a
consent a support agent gave, sitting under a policy the vendor may rewrite without asking — never a
change to the AUP.

**Nothing above depends on it.** The shape this record commits to is a personal single-owner
instance, which the AUP does not reach in the first place. The allowance would only matter for the
demo, and the demo is the one thing the AUP names twice.

### What fails is that nothing restarts it

**A process that needs no root still needs something to start it, and that is the clause this shape
did not say out loud.** With root, `systemd` supplies it for free and nobody writes it down. On this
slot there is nothing:

- **`crontab` is refused outright** — "You (<slot username, elided>) are not allowed to access to
  (crontab) because of pam configuration" — for read and for write, with a TTY and without, while
  the account *is* in the `cron` group. **Measured**: the refusal, the group membership, and that
  `/etc/pam.d/crond` carries `account required pam_access.so` while `/etc/security/access.conf` does
  not exist. **Inferred, and not confirmed against `pam_access` documentation, which does not state
  its behaviour for a missing config file**: that the absent file is what makes the module deny.
  Whatbox's own Cron wiki documents the mechanism that would have answered this — "`@reboot` command
  will run the specified command if your server is restarted" — and it is exactly what does not work
  here. The refusal is measured on this account only; the missing file is host-wide, so it probably
  breaks cron for every account on the host, and that step too is inference.
- **No `systemd` user session at all**: no `systemctl`, no `loginctl`, no `~/.config/systemd`.
- **So the compose file's own `restart: unless-stopped` and `healthcheck:` are both inert here.** The
  healthcheck is the measurable one: after four minutes at a ten-second interval the container's
  health log held **zero** entries and its status was still `starting`. Nine minutes in it held
  exactly **one**, where roughly fifty were due, and that one was a `podman healthcheck run` typed
  by hand, which returned `healthy` immediately. The interval is read back from the container as
  `10s`, so the schedule is configured and simply never fires. Podman schedules healthchecks with
  transient systemd timers — "Podman uses systemd timers to schedule healthcheck runs", Brent Baude,
  a Podman maintainer, writing on Red Hat Developer, 2019-04-18 — and restarts containers after a
  reboot with `podman-restart.service`, itself a systemd unit. Neither exists here. The count is our
  measurement; the mechanism is theirs, and that article is old enough to re-check before it carries
  any weight on its own.

**No reboot was performed, and the conclusion does not need one.** A shared host carrying other
customers is not ours to reboot, so this was never observable. It is also not the load-bearing
step: if no mechanism exists that could restart the process, the reboot's timing changes nothing,
and the ABSENCE of every such mechanism is what was measured directly above. The reboot is merely
certain to come — the host reported an uptime of 2 days 5 hours on 2026-09-10, so it had rebooted two
days before. Whatbox supervises its own processes as the slot user — a
`whatbox-apphost` master holding the slot's TLS certificate and key, and a `php-fpm` master — and
nothing of yours. **Whether its own processes come back at boot was NOT observed**: both started at
18:22 on 2026-09-10, which is when the slot was provisioned, and the host had last booted two days
earlier, so this measurement cannot see a boot. What it does show is that the supervision which
exists is theirs to use and not yours.

**Everything short of a reboot survives.** The server outlived the SSH session that started it and
answered a fresh login 7m10s and at least six sessions later. Killed with `SIGKILL`, the way a
reboot kills it, nothing brought it back; restarted by hand it logged "database system was not
properly shut down; automatic recovery in progress", redid its WAL and returned both rows. **The
data is durable. The daemon is not resident.**

**The question was put to the vendor on 2026-09-11: Whatbox support ticket 267784**, filed from the
slot's own account under CNCORE-81, after `docs/research/the-cheap-end.md` §5 named it and nobody had
done it for a day. It reports the `crontab` refusal verbatim, states the account's `cron` group
membership, and names `/etc/pam.d/crond` and the missing `/etc/security/access.conf` as what is
visible from the customer side **while marking the cause as a guess rather than a finding**. It gives
the healthcheck measurement above as the reason a container restart policy is not a workaround, and
notes that the support page showed Security Reboot notices 13 days and a month before, so a reboot is
not a rare event. It asks two things: whether cron is meant to be available on this plan and whether
the missing file can be looked at, and failing that, whether there is any supported way to have a
process start after a reboot.

**That ticket and that notice history are visible only from inside the account**, so the paragraph
above is a report of them rather than something a reader can open — the same standing as the mail
search earlier in this record, and worth saying because the rest of this section is measurement
anybody with the slot could repeat.

**Unanswered as of 2026-09-11, and this record names its own deadline because the vendor publishes
none.** Whatbox's SLA at <https://whatbox.ca/policies/sla> covers downtime only — "If your system is
offline for a period exceeding 6 hours" — and neither it nor the FAQ states a support response time,
both checked the same day. So **if nothing has arrived by 2026-09-18, the silence is the answer**,
the fifth clause stays failed
for this vendor, and the split in `the-cheap-end.md` §5 stands on it. An answer of either kind is
edited INTO this section rather than appended below it, so that a later reader meets one account of
what restarts a process here and not two. **CNCORE-85 is what returns to it**, because a deadline
living only in a sentence is one nobody keeps.

### The limits, and which of them the vendor actually documents

The ticket asked for these from the provider's documentation. One of them is there. The rest are
marked as what they are, because an undocumented limit is one the vendor may move without telling
anyone:

| Limit | Value | Where it comes from |
|---|---|---|
| Disk | **3632 GiB** for the plan, 0.04 GiB used | The slot's own `quota --raw`. Matches the advertised 3.90 TB, decimal against binary. |
| Memory | **64 GiB** | **Measured, not documented**: `memory.max` on the slot's cgroup. The FAQ's "320 GB of RAM" is a floor across a varying fleet — "hardware specifications vary depending on the chosen plan, location, and availability" — and the host exceeds it at 755 GiB. Neither figure is the slot's; the cgroup is. |
| Processes | **2000** | **Measured, not documented**: `pids.max` and `ulimit -u` agree. |
| Open files | 65536 | **Measured**: `ulimit -n`. |
| CPU | No quota, weight 100 | **Measured**: `cpu.max` reads `max 100000`, so no ceiling and an ordinary share. The 64-core EPYC 9355 and the load average of 14 come from `uname -a` and `uptime`, not from the cgroup. |

### The IPv4 clause survives contact, narrowly

This record argues at length that the IPv4 is not optional. A shared host gives one, but never one
of yours: **"Due to the extreme scarcity of IPv4 addresses, we cannot offer users dedicated IPv4
addresses. All servers have static IPv4 and IPv6 addresses shared with all users on that server"**
— Whatbox FAQ, <https://whatbox.ca/faq>. Routable, so the argument above is satisfied; shared, so
:80 and :443 are not yours to bind. What you get instead is the documented 10000-32767 public TCP
range, **verified rather than trusted at one point in it**: a listener on 31340 answered a
connection from a UK machine first try, which tests that port and not the other 22,767. A hostname
root without owning :443 comes from the `whatbox-apphost` process the slot ships, which terminates
TLS with a certificate already installed at provisioning.

### What this changes

**Nothing about the vendor question, and one clause of the shape — which is edited at the top of
this record rather than announced down here.** It is still a shape and still not a vendor list. What
the measurement added is that "a process that needs no root" was never the whole test: something has
to start that process when the machine comes back. That is free with root, invisible because it is
free, and absent on every shared slot. It is a sharper test than "no root" ever was, and it belongs
first on the next host's list rather than last.

For the vendor actually measured: it satisfies the shape as long as a human logs in after each
reboot. A support ticket about the missing `access.conf` was the cheap thing to try before concluding
otherwise, because `@reboot` is documented and merely broken — and it HAS been tried, filed
2026-09-11 and recorded above with the date on which its silence becomes an answer.
`docs/research/the-cheap-end.md` §4 is answered there, and its §5 no longer waits on anybody.

## Evidence

Verified against source on 2026-09-10: Hetzner's own cloud, block-storage and storage-box pricing
pages with UK VAT selected, plus `docs.hetzner.com` for volumes, server rescale, primary IPs, traffic
and the storage-selection matrix; APNIC's GB IPv6 time series and its per-AS population measurement;
Next.js's `basePath`, `generateMetadata` and `add-base-path` documentation and source. Background
reading and the wider priced comparison in `docs/research/where-it-runs.md`.

The shared-host section is first-hand, run over SSH against the slot on 2026-09-10 under
CNCORE-18: `eselect postgresql list`, `initdb18`, `pg_ctl18`, `psql18`, `podman-compose up -d`
against an unmodified `packages/db/docker-compose.yml`, `podman inspect`, `quota --raw`, the slot's
cgroup files under `/sys/fs/cgroup`, `ulimit -a`, `crontab` against `/etc/pam.d/crond`, `ps`
against the slot's own supervised processes, and a listener on public port 31340 dialled from a UK
machine. Also `uname -a` and `uptime` for the host and its load, `ps` with `lstart` for process
ages, `sha256sum` against `shasum -a 256` for the compose file, `podman --version`, and
`pg_postmaster_start_time()` for the survival figures. Every figure in that section came from one
of these commands, and where a figure is inferred rather than read off one, the sentence carrying
it says so. Quoted from the vendor the same day: Whatbox's FAQ on running your own apps, on shared
IPv4 addresses and on server hardware; its `Installing_Software`, `Cron`, `Redis`, `Userland_Nginx`
and `manage_page` wiki pages. The podman healthcheck mechanism is Brent Baude's on Red Hat
Developer, 2019-04-18, and is corroboration for a count we took ourselves rather than the basis of
the finding.

CNCORE-81 added the policy reading and the support question, both dated 2026-09-11: Whatbox's
Acceptable Use Policy at <https://whatbox.ca/policies/acceptable_use> and its Terms of Service at
<https://whatbox.ca/policies/terms>, sections 13.2 and 13.13, read at source; its SLA and FAQ checked
for a support response time and carrying none; the account's own support history, holding one ticket;
and the mail search described above. **The allowance itself has no source to cite, and that is the
finding rather than a gap in the search.**
