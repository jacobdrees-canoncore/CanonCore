---
status: proposed
---

# Deployment targets a shape, never a vendor list

CanonCore commits to running in a SHAPE: one registrable domain with a publicly-routable IPv4, a
POSIX path for media, an injected Postgres URL, and a process that needs no root **and that
something starts again when the machine comes back**. A vendor compatibility list rots, because its
contents are not ours to keep true.

That last clause was implicit until CNCORE-18 measured a shared host and found it was the only one
that failed; it is spelled out here rather than left to be rediscovered. **That host stopped failing
it on 2026-09-12, and the clause stays in the shape regardless** — it earns its place by being the
half of "no root" that nobody says out loud, not by any vendor's score against it. "The shape
measured against a shared host" below carries both measurements.

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
bought. **Four clauses held outright and the fifth failed. The fifth stopped failing on 2026-09-12:
cron works on the slot, measured, though what changed is not known and nobody has claimed it.**
Noticing why the fifth one failed is still worth more than the vendor
verdict, because the clause it exposed outlives this vendor: it is the first thing to test on the
next host, and it was invisible until a slot without root made it visible.

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

### What restarts it: nothing did on 2026-09-10, and cron does on 2026-09-12

**A process that needs no root still needs something to start it, and that is the clause this shape
did not say out loud.** With root, `systemd` supplies it for free and nobody writes it down. On this
slot there was nothing on 2026-09-10. There is cron on 2026-09-12, and CNCORE-85 measured it after
the vendor replied. Both measurements are kept, in the order they happened, because the second only
means anything against the first:

- **`crontab` was refused outright on 2026-09-10, and is not refused on 2026-09-12** — "You (<slot
  username, elided>) are not allowed to access to (crontab) because of pam configuration" — for read
  and for write, with a TTY and without, while the account *is* in the `cron` group. **Measured on
  2026-09-10**: the refusal, the group membership, and that `/etc/pam.d/crond` carries
  `account required pam_access.so` while `/etc/security/access.conf` does not exist. Whatbox's own
  Cron wiki documents the mechanism that would have answered this — "`@reboot` command will run the
  specified command if your server is restarted" — and on that day it was exactly what did not work.
- **THE CAUSE THIS RECORD INFERRED FOR THAT REFUSAL IS FALSIFIED, AND THE MARKING IS WHAT MADE THAT
  CHEAP.** The inference was that the absent `/etc/security/access.conf` is what makes `pam_access`
  deny, written as inference because `pam_access` documentation does not state its behaviour for a
  missing config file. **Measured on 2026-09-12: that file is STILL absent, `/etc/pam.d/crond` is
  unchanged, and cron permits anyway.** So the missing file was never what made the module deny.
  **What did, and what changed between the two dates, is unknown and was Whatbox's to change** — and
  this record does not swap one guess for another, because the guess it already made is the reason
  this paragraph exists. Marking the sentence as inference rather than finding is what turns being
  wrong into a correction instead of a retraction, and it is what let CNCORE-81's ticket put the same
  claim to the vendor as a guess rather than an accusation.
- **Cron now runs an unattended job, which is the measurement the clause actually needs.** On
  2026-09-12 a crontab installed from stdin and read back, and the daemon fired it: installed at
  13:58:51 UTC, and `* * * * *` logged **13:59:01, 14:00:01 and 14:01:01 UTC**, three consecutive
  minutes, on schedule, with nobody running them. `cronie 1.7.0`. **Installing a crontab and having
  one run are different things, and it is the second that was measured.**
- **No `systemd` user session, then or now**: no `systemctl`, no `loginctl`, no `~/.config/systemd`,
  re-checked 2026-09-12. **So the fifth clause is satisfied by cron and not by systemd**, and
  everything below that depends on systemd is still as true as it was.
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

**No reboot was performed on either date, and the clause is satisfied anyway — but for a different
reason than in 2026-09-10's version of this paragraph.** A shared host carrying other customers is
not ours to reboot, so a boot has never been observable here. In 2026-09-10's state that did not
matter: if no mechanism exists that could restart the process, the reboot's timing changes nothing,
and the ABSENCE of every such mechanism was what had been measured. **That argument is spent, because
a mechanism now exists**, so what replaces it is this: **a `* * * * *` line that starts the process
if it is not running needs no boot-time semantics at all.** The daemon comes back with the host, the
minute ticks, and the process starts — which the three consecutive firings above show happening
unattended. The clause asks that "something starts again when the machine comes back", and a minutely
watchdog is that something. **The worst case of one minute down after a boot is INFERRED, not
measured**, and it rests on the step below: that `crond` is running again by then.

**`@reboot` would close that minute, and whether it fires at boot is the one thing still unobserved.**
It installs and reads back in the same crontab, and Whatbox's wiki documents it, but installing it is
not seeing it run. **CNCORE-85 left the `@reboot` probe in place on the slot** — a single `date` into
`~/cncore85-reboot-probe.log` — so the next host reboot answers it at no cost to anybody. **CNCORE-107
is the ticket that reads it**, because this record has already learned once what a deadline living
only in a sentence is worth. **Nothing waits on it**: the clause holds on the watchdog either way, and
what the probe settles is whether the worst case is one minute or zero.

**That the cron DAEMON survives a boot is not this account's to observe either, and is a weaker
worry**: `crond` runs as root, outside the slot,
and the slot user can neither start nor stop it, so it is a system service Whatbox operates rather
than something of ours to supervise. The host had been up 4 days when these jobs ran. **`uptime`
reported "0 users" throughout, including while this account held an open SSH session, so the user
count on this host is not evidence of anything and is not used as any here.**

The reboot is merely certain to come — the host reported an uptime of 2 days 5 hours on 2026-09-10,
so it had rebooted two days before. Whatbox supervises its own processes as the slot user — a
`whatbox-apphost` master holding the slot's TLS certificate and key, and a `php-fpm` master — and
nothing of yours. **Whether its own processes come back at boot was NOT observed**: both started at
18:22 on 2026-09-10, which is when the slot was provisioned, and the host had last booted two days
earlier, so this measurement cannot see a boot. What it does show is that the supervision which
exists is theirs to use and not yours.

**Everything short of a reboot survives.** The server outlived the SSH session that started it and
answered a fresh login 7m10s and at least six sessions later. Killed with `SIGKILL`, the way a
reboot kills it, nothing brought it back; restarted by hand it logged "database system was not
properly shut down; automatic recovery in progress", redid its WAL and returned both rows. **The
data is durable. The daemon is not resident** — and that is still true of the daemon itself, which is
exactly why the fifth clause asks for something outside it. What changed on 2026-09-12 is that there
is now something to be that: the `SIGKILL` above is what a minutely watchdog notices within a minute,
and the recovery it logged is what makes restarting it safe rather than merely possible.

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

**It was answered on 2026-09-12.** Devon, signing
"Whatbox Staff", replied: "Sorry for the hassle. Unfortunately at the moment I am not showing this
error anymore, for @reboot crons or otherwise. Were you still seeing it?", and asked which commands
and which cron tasks were involved. **That is neither a yes nor a no, and reading it as either would
be the mistake**: it says the vendor cannot reproduce the refusal, not that cron was enabled for this
account, and it puts the question back. **So the answer above is ours rather than theirs** — the
refusal is gone and cron runs, measured on the slot the same day, and the vendor's reply is what
prompted the re-measurement rather than what settles it. The reply names no change, no date and no
cause, which is why the cause stays unknown two bullets above.

**That ticket and that notice history are visible only from inside the account**, so the paragraph
above is a report of them rather than something a reader can open — the same standing as the mail
search earlier in this record, and worth saying because the rest of this section is measurement
anybody with the slot could repeat.

**The deadline this record set never had to fire, and that is worth keeping rather than deleting.**
It was unanswered as of 2026-09-11, and this record named 2026-09-18 as the date after which silence
would itself be the answer, because the vendor publishes no response time: Whatbox's SLA at
<https://whatbox.ca/policies/sla> covers downtime only — "If your system is offline for a period
exceeding 6 hours" — and neither it nor the FAQ states one, both checked that day. **A reply arrived
on 2026-09-12, six days inside the window**, so the fifth clause is settled by measurement rather
than by silence, and `the-cheap-end.md` §5 moves off the split onto row 1. **The deadline is recorded
as kept rather than removed** — CNCORE-85 is the ticket that returned to it, which is the half that
was missing when a deadline lived only in a sentence.

### The limits, and which of them the vendor actually documents

The ticket asked for these from the provider's documentation. One of them is there. The rest are
marked as what they are, because an undocumented limit is one the vendor may move without telling
anyone:

| Limit | Value | Where it comes from |
|---|---|---|
| Disk | **3632 GiB** for the plan, 0.04 GiB used | The slot's own `quota --raw`. Matches the advertised 3.90 TB, decimal against binary. |
| Upload traffic | **10 TB/month** | **Documented in the panel rather than the wiki**, read 2026-09-12 under CNCORE-106: the Manage page reports usage against it and offers "Increase Traffic Allocation", and it resets monthly. It is the only limit here that a media path would meet before disk. |
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
TLS with a certificate installed at provisioning **and rotated, which an earlier version of this
sentence missed. CNCORE-106 took this paragraph apart on 2026-09-12 and found the public port range is
not on the serving path at all**; the section below carries how a name actually reaches the slot, and
supersedes this paragraph wherever the two differ.

### How `canoncore.com` reaches the slot: the vendor's own front end, and nothing in front of it

CNCORE-106 asked this because the paragraph above reasons only about binding `:443`, while the owner
holds `canoncore.com` rather than a name under the vendor's domain. **The answer is the vendor's own
managed links plus Bring Your Own Domain. No proxy, no tunnel, and no second process.** Measured
first-hand on the slot and read at source on 2026-09-12.

**The ticket filed this as unconsidered ground and it was half-considered already, which is worth
recording because the half that existed is the half that saved the work.** `docs/research/access-layer.md`
§1.3 weighs port forwarding, Caddy, Tailscale, Tailscale Funnel and Cloudflare Tunnel, and rules
**Cloudflare Tunnel out on terms** — for a different problem, a home machine behind CGNAT, which is
why it reads as unrelated to a rented slot. And `docs/research/where-it-runs.md` §1.3 already quoted
Bring Your Own Domain from the vendor's wiki, while `docs/research/the-cheap-end.md` §4 already drew
the conclusion: "It documents Bring Your Own Domain at a hostname root, so no `basePath`." What was
missing was never the mechanism's name. It was whether TLS exists for a name the slot has no
certificate for, and that is what got measured.

**`whatbox-apphost` is nginx, renamed.** `/usr/bin/apphost -h` answers `nginx version: nginx/1.30.3`.
Its configuration is the slot's own, under `~/.config/box/`, and every file in it opens "Do not make
manual edits to this file. It is managed by Whatbox and changes will be overwritten automatically" —
the customer's to read, the vendor's to write.

**It does not bind `:443` either, and that is what turns the shared address from a caveat into a
non-problem.** Every `server` block listens on `unix:~/.config/box/nginx-ssl.sock ssl http2
proxy_protocol`, and the plain-HTTP one on `nginx.sock`. The vendor's edge owns the TCP port and hands
the connection over a UNIX socket with PROXY protocol, which is why each block recovers the client
address with `set_real_ip_from unix:` and `real_ip_header proxy_protocol`. So ":80 and :443 are not
yours to bind" is true and beside the point: they are bound by something whose job is to proxy to you.

**TLS is terminated inside the slot, with a certificate the slot user holds — and it is rotated, not
merely installed.** `~/.config/box/apps.crt` is `CN=*.<slot>.box.ca` with that single SAN, issued by
`C=US, O=Google Trust Services, CN=WR1`, valid `Sep 10 17:22:41 2026 GMT` to `Dec 9 17:22:40 2026 GMT`.
`notBefore` is the provisioning minute. **Ninety days on a wildcard is an ACME certificate**, so
"already installed at provisioning" was half the story: something renews it inside the quarter, and
that something is the vendor's, not ours.

**A brought domain gets its own certificate, and the machinery is wired before any domain is brought.**
The vendor-managed `nginx.conf` carries, in the plain-HTTP server,
`location /.well-known/acme-challenge/ { alias ~/.config/box/custom/challenges/; }`. **`custom/` does
not exist on this slot**, which has no custom domain configured, so that alias is the template waiting
for one: an ACME HTTP-01 webroot for a name the slot does not yet answer for. The panel corroborates it
from the other side, warning that "Your domain name will be public knowledge" over a link to
Wikipedia's **Certificate Transparency** article — a vendor does not cite CT about a name it is not
getting a certificate for. **That the vendor drives the issuance rather than the customer is inference**
from the directory being vendor-managed and the wiki asking the customer for nothing but DNS records.

### What a managed link is, measured by making one

The wiki, read at source 2026-09-12, <https://whatbox.ca/wiki/Managed_Links>: "Your slot has a box.ca
managed link by default, giving you app-specific WebUI links that include signed HTTPS access to all
HTTP-only apps", and "Click 'Add a custom app' on the Manage Links page to add your own custom app".
The form asks for an app name, an app subdomain and a port; its advanced options "allow you to add your
app as a Unix domain socket on your slot instead of a port number" and to "enable WebSockets on the
managed link". It also carries its own disclaimer, which matches the one this record already quotes for
containers: "I understand that custom apps will not receive support from Whatbox."

**The vendor probes the port before it will accept the app.** With nothing listening, the form refuses:
"We were unable to detect an app being run by you on that port. Please start your custom app and try
again." So a managed link cannot be registered speculatively.

**A custom app was added, read, dialled and removed on 2026-09-12, and the generated vhost is the
answer.** With a throwaway listener on 31341, Whatbox wrote one file, `apps/<name>_custom.conf`, and
reloaded nginx. It is a single catch-all:

```
location / {
    ...
    proxy_read_timeout 10m;
    client_max_body_size 100G;
    proxy_pass http://127.0.0.1:31341;
    proxy_buffering off;
    include includes/.<name>_custom_location;
}
```

Four things fall out of that, and the last one is the one this record most needed:

- **The proxy hop is loopback plain HTTP, so the public 10000-32767 range is NOT on the path.** The app
  need only listen on `127.0.0.1`. **That retires the caveat above rather than testing it**: the
  22,767 untested ports do not matter for serving the catalogue, because nothing outside the host ever
  dials one. CNCORE-106 expected a tunnel would be what retired it; the vendor's own front end does.
- **`client_max_body_size 100G` and `proxy_buffering off`**, so neither an upload nor a range-request
  read path meets a ceiling here. The `8m` at the `http` level applies only to the redirect server and
  is overridden in every app block.
- **Two documented extension points**, named in the file's own header: `includes/.<name>_custom_location`
  is spliced inside `location /`, and `includes/<name>_custom_*.include` inside the `server`. So
  per-app configuration is possible without editing a vendor-managed file.
- **A custom app is served publicly, with no Whatbox login.** `https://<name>.<slot>.box.ca/` answered
  `HTTP/2 200` with the listener's own bytes to an unauthenticated request from a UK machine, carrying
  `strict-transport-security: max-age=63072000`.

**"Signed HTTPS access" gates the vendor's own apps and not yours, and reading it the other way would
have been the expensive mistake.** The slot's index link answers `303` to `/login` unauthenticated,
setting `_UserID` and `_SessionID` and reporting `x-powered-by: PHP/8.4.25`. That is the vendor's panel
authenticating the vendor's dashboard. It says nothing about a custom app, which the paragraph above
measured as public — and had it been otherwise, ADR-0044's one password would have been sitting behind
a second one that no CanonCore client could speak to.

### The reserved paths are real, and they are not a custom app's problem

**This was nearly recorded as a blocker on an inference, and measuring it cost one throwaway app.**
Each of the three apps the slot ships — the index page, rtorrent and the file browser — includes an
`<app>_whatbox.include`, and all three are identical: `location /login`, `/logout`, `/labs`, `/api`,
`/static` and `/private`, each `proxy_pass`ed to the vendor's own web application on `127.0.0.1`.
**`/api` is a longer prefix than `/`, so nginx prefers it**, and this app's only route handler is
`apps/web/src/app/api/rpc/[[...rest]]/route.ts` — every call the read surface makes. On a vhost
carrying that include, CanonCore's API would go to the vendor.

**A custom app's vhost does not carry it.** The generated file includes only
`includes/<name>_custom_*.include`, a glob matching nothing, and the catch-all `location /` above. So
`/api/rpc` is CanonCore's on a managed link, measured rather than hoped. **The inference that the
template was universal was wrong**, and it is recorded because the wiki names no reserved path and no
conflict, so the next reader who sees those six locations in the slot's config will reach for the same
wrong conclusion.

### The name is a subdomain, and the apex is not served

**`canoncore.com` itself does not reach the slot; a subdomain of it does.** A custom app's
`server_name` is `<alias>.<domain>`, and the Bring Your Own Domain form at
`/manage/custom_domain/<slot>` takes a bare `domain-name.tld` behind a fixed literal `app.` prefix. So
Bring Your Own Domain replaces the slot's `<slot>.box.ca` with `canoncore.com` and the app links become
`<alias>.canoncore.com`. **One registrable domain is still what the shape at the top of this record
asks for**, and a subdomain of it satisfies that; what changes is only which host the canonical origin
names.

**Which is why the apex CNAME problem the wiki's wording invites never arises.** The page says to "set
up your domain's name server with new CNAME entries", and a CNAME is illegal at a zone apex — Namecheap,
which holds this domain, says an ALIAS record "can also be used if you wish to alias the root domain to
another service (which you cannot do with a CNAME record)". Since every managed link is a subdomain, the
records are ordinary CNAMEs and no ALIAS is needed. **Serving the bare `canoncore.com` at all is a
separate want**, answered at the registrar with a redirect rather than by the slot.

`canoncore.com` is registered and unpointed as of 2026-09-12: `dig` returns no A and no CNAME, and
`dns1.registrar-servers.com` / `dns2.registrar-servers.com` for NS, which is Namecheap's BasicDNS.

**Bring Your Own Domain was NOT exercised, and that is deliberate.** It repoints a real domain, and the
slot-domain control warns "Be sure of your choice - there is a 60 day restriction" — reversible in
direction, since the form offers "You can always return to a Whatbox provided domain", but not a free
experiment. **So the DNS half is the one step in this chain still unmeasured**, and what is measured is
everything it depends on: a public HTTPS link to a slot-local process, and a vendor-managed ACME webroot
waiting for a custom domain.

### What the policies permit, answered separately for the catalogue and for media

**Whatbox's AUP reaches neither case for a single-owner instance, and this changes nothing in it.** Read
at source 2026-09-12, <https://whatbox.ca/policies/acceptable_use>: it forbids using the Services "for
IPTV hosting, IPTV sharing, IPTV resale, VOD hosting, VOD sharing, public media streaming, public video
libraries, and commercial media access services", and separately "to run a public directory service with
no authentication", "to run 20 or more concurrent Plex streams, or violate the Plex EULA", "to run a Tor
node of any type" and "to run a Proof of work cryptocurrency miner". **Re-read for this question, it says
nothing about proxies, tunnels, VPNs, reverse proxies, or serving a domain you own** — so Bring Your Own
Domain is not a fact the AUP addresses, and the position recorded above stands unchanged. **The page
carries no effective date and no version**, so it is quotable and not datable, which is a reason to
re-read it rather than to cite this paragraph.

**Cloudflare's terms decide nothing here, because Cloudflare is not on the path.** They are recorded
because CNCORE-106 expected the answer to split on them, and because putting a CDN in front later would
engage them. Read at source 2026-09-12: the
[Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-application-services/), last
updated **June 02 2026**, reserve the right "to disable or limit your access to or use of the CDN [...]
if you use or are suspected of using the CDN without such Paid Services to serve video or a
disproportionate percentage of pictures, audio files, or other large files". Cloudflare's own
[Delivering Videos with Cloudflare](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/)
page, last updated **August 25 2026**, applies that to tunnels by name: "Cloudflare Tunnel public
hostname routes proxy traffic through Cloudflare" and "On Free, Pro, and Business plans, this traffic is
subject to the terms described on this page", while "The restriction does not apply to private network
routes". It names **Stream and Stream Delivery** as the paid services and **does not mention R2 at all**,
which is the same disagreement `where-it-runs.md` §3.6 records between those two documents.

**So the split CNCORE-106 predicted is real and belongs to a route not taken.** Had Cloudflare been the
answer, the catalogue — HTML and JSON — would be the ordinary use of a CDN and fine, while media through
ADR-0097's opaque-id route is exactly "video or [...] other large files" and would be a live question.
It is not the answer. **The media case is therefore governed by Whatbox's AUP alone**, where the
single-owner instance is permitted and the public demo is the forbidden case, named twice — and the demo
carries no media anyway, because this product never ingests any.

### What was rejected, and why the vendor's own front end beats each

- **Cloudflare Tunnel.** Root is not the obstacle: Cloudflare's own docs say "A remotely-managed tunnel
  only requires a token to run", so a token-run binary in `$HOME` is available to an unprivileged slot.
  The obstacles are that it adds a second process the cron watchdog would have to keep alive, for a
  hostname the vendor already gives; and that it drags the non-HTML clause onto a path that otherwise
  never touches Cloudflare. **It buys nothing here and costs the one thing this shape is short of.**
- **Cloudflare proxying to a port in 10000-32767.** Needs a publicly reachable port, which is the thing
  tested at one point of 22,768, and engages the same clause for the same nothing.
- **The customer's own certificate plus a userland nginx.** The vendor documents it and it looks like the
  obvious answer: <https://whatbox.ca/wiki/Certbot_(Lets_Encrypt)_SSL_Certificates> obtains a certificate
  for "any website you own" over DNS-01 with `certbot certonly --manual --preferred-challenges dns`,
  needs no root (it documents an alias around Certbot defaulting "to using directories only the root user
  can access"), and ends "configure your nginx instance to use the certificate". **It cannot reach a
  hostname root**: a userland nginx binds a port in the high range, so it serves `https://canoncore.com:31340`
  and not `https://canoncore.com`. Ruled out on the port rather than the certificate — and its renewal is
  manual besides, the page's only guidance being to run the same command "before the expiration date".
- **Tailscale and Tailscale Funnel.** `access-layer.md` §1.3 covers both. Funnel serves a MagicDNS name
  rather than a domain you own, and both answer the CGNAT problem that a rented slot does not have.
- **`basePath`.** Not needed. Every managed link is a hostname root.

### What this costs the code, which is nothing

**The criterion CNCORE-106 wrote for itself was that if the answer is `basePath`, the cost to
`next.config.ts` and `typedRoutes` is stated. The answer is not `basePath`, and the cost is zero.**
`apps/web/next.config.ts` keeps `typedRoutes: true` and no `basePath`, and the coding rule further up
this record — that a URL the framework does not rewrite is never hand-built — is unaffected, as is
ADR-0066's relative self-referential canonical and its unset `metadataBase`. The two live members of the
exposed class stay exactly as that section describes them.

**And the daemon criterion is retired rather than satisfied.** CNCORE-106 asked what a tunnel daemon
would need to stay up and required that it ride CNCORE-85's cron watchdog rather than inventing a second
mechanism. **There is no daemon.** The only process to keep alive is CanonCore itself, which is what the
watchdog was for. What the app must do is bind a port in 10000-32767 on loopback, which `PORT` already
covers for a `standalone` Next server; the unix-socket option the panel offers is not reachable that way
and is not needed.

### What this changes

**Nothing about the vendor question, and one clause of the shape — which is edited at the top of
this record rather than announced down here.** It is still a shape and still not a vendor list. What
the measurement added is that "a process that needs no root" was never the whole test: something has
to start that process when the machine comes back. That is free with root, invisible because it is
free, and absent on every shared slot. It is a sharper test than "no root" ever was, and it belongs
first on the next host's list rather than last.

**For the vendor actually measured: it satisfied the shape only while a human logged in after each
reboot, and since 2026-09-12 the thing that forced that is gone.** Cron runs, so the mechanism the
fifth clause asks for exists and works; **that it is still there after a reboot is inference rather
than measurement**, marked as such two sections up and left for the probe to settle. The support
ticket about the missing
`access.conf` was the cheap thing to try before concluding otherwise, because `@reboot` is documented
and was merely broken — and trying it is what produced the answer: filed 2026-09-11, replied to
2026-09-12, re-measured the same day, all recorded above.
`docs/research/the-cheap-end.md` §4 is answered there, and its §5 now recommends row 1 on this
measurement rather than the split.

**And one thing the vendor question never reached: how the owner's own domain gets there.** CNCORE-106
answered it on 2026-09-12 with the vendor's own managed links and Bring Your Own Domain, no proxy and no
tunnel, and the sections above carry it. Two of this record's caveats are retired by that rather than
worked around — the public port range is not on the serving path, and `:443` not being ours to bind is
beside the point when the thing that binds it exists to proxy inward. **The one step still unmeasured is
the DNS change itself**, which repoints a real domain and is the owner's to make.

**The clause stays in the shape at the top of this record, and the fix does not soften it.** What
made it worth writing was never this vendor's verdict but that "a process that needs no root" was
silently two requirements; a host that happens to pass it today is not a reason to stop testing it,
and the thing that changed here changed without notice, in the vendor's own account of it.

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

CNCORE-85 added the answer and the re-measurement, both dated 2026-09-12, and they are first-hand
over SSH to the same slot: `crontab -l` returning clean, `crontab -` installing from stdin and
reading back, `/etc/pam.d/crond` and `/etc/security/access.conf` re-checked unchanged, `cronnext`,
`crond -V` for `cronie 1.7.0`, `which systemctl loginctl` and `~/.config/systemd` re-checked absent,
and `uptime` for the host's 4 days, whose user count is noted above as unusable. The three firings
are the contents of
`~/cncore85-cron-probe.log`, written by the probe itself. The vendor's reply is Whatbox's mail on
ticket 267784, received 2026-09-12 04:00:31 BST from `site@whatbox.ca`, quoted above in full where it
is load-bearing; **like the ticket itself it is visible only to the account holder**, so it carries
the same standing as the rest of this paragraph's account-only evidence.

CNCORE-106 added the domain-reach section, dated 2026-09-12, and it is first-hand over SSH to the same
slot plus one round trip through the vendor's panel: `/usr/bin/apphost -h` for `nginx/1.30.3`,
`/proc/<pid>/cmdline` and `ps` for the master and its workers, `~/.config/box/nginx.conf` and
`apps/*.conf` and `includes/*` read directly, `openssl x509` on `apps.crt` for the subject, SAN, issuer
and dates, and `ls` for the absence of `custom/`. The custom app was added through
<https://whatbox.ca/manage/domain/> with a throwaway `python3 -m http.server` on 31341, its generated
`apps/<name>_custom.conf` read, its link dialled from a UK machine with `curl` for the `HTTP/2 200`, and
**both the app and the listener were removed afterwards; the config directory was diffed back to its
prior three files and CNCORE-85's `@reboot` crontab was re-checked intact**. The `303` to `/login` is
`curl -I` against the slot's index link unauthenticated. `dig` supplied `canoncore.com`'s NS, A and
CNAME. **Bring Your Own Domain itself was not exercised**, for the reason the section gives. Quoted from
the vendor the same day: its `Managed_Links` and `Certbot_(Lets_Encrypt)_SSL_Certificates` wiki pages and
its Acceptable Use Policy, the last carrying no date. Quoted from Cloudflare the same day: the
Service-Specific Terms (last updated 2026-06-02), the `delivering-videos-with-cloudflare` docs page (last
updated 2026-08-25) and the tunnel-tokens page. Namecheap's own knowledge base supplied the ALIAS-versus-
CNAME rule at a zone apex. **The slot's hostname and username are deliberately absent from this record**,
as they are from the rest of the repository.

CNCORE-81 added the policy reading and the support question, both dated 2026-09-11: Whatbox's
Acceptable Use Policy at <https://whatbox.ca/policies/acceptable_use> and its Terms of Service at
<https://whatbox.ca/policies/terms>, sections 13.2 and 13.13, read at source; its SLA and FAQ checked
for a support response time and carrying none; the account's own support history, holding one ticket;
and the mail search described above. **The allowance itself has no source to cite, and that is the
finding rather than a gap in the search.**
