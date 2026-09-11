# The access layer

**Researched 2026-09-10.** Who you are, how you get in, from what device, over what network, on what
hardware.

CanonCore's 92 decision records cover the model, the providers and the schema thoroughly. They say
very little about how a human REACHES the thing. This file is the reading behind that gap: what the
records already close, what is genuinely open, and what the evidence says about each open question.

It proposes. It decides nothing — the ADRs are Jacob's to write, and nothing here is one.

## How to read this

Section 0 is what the records already close. Sections 1-6 are the research, each claim carried back to
the source that owns it and dated. Section 7 is the decision list, ranked by when each question blocks
something rather than by how interesting it is; anything version one does not need is marked for a
later spec and gets no ADR now. Section 8 answers which spec comes next.

---

## 0. What is already closed

Nine records bear directly on the access layer, and each is CLOSED. They are listed here so that
nothing below re-argues one.

| Question | Record | What it settles |
|---|---|---|
| Is there a login at all? | ADR-0044 | Yes. "Single user, one password, no signup, no multi-tenancy." A password EXISTS. Its mechanism does not. |
| Does the demo log anyone in? | ADR-0044 | No: "The public demo is read-only with no login." |
| What is a logged-in device? | ADR-0043 | One row per device — client name, device name, stable device id, client version, capabilities, created_at, last_seen_at — arriving WHOLE, because "the row is the expensive part rather than any column on it". |
| Who can see what? | ADR-0072 | Nobody asks. No visibility column, no propagation, no resolution rule. The owner sees everything; demo visitors see everything on the demo. |
| What does the demo emit? | ADR-0045 | An enumerated field list, never the owner payload minus a strip-list. No internal ids, no owner id, no notes. |
| Does the server adapt a file to a weak client? | ADR-0041 | No. Direct play only, no ffmpeg. The refusal NAMES THE PROPERTY THAT FAILED. |
| What plays bytes on Apple hardware? | ADR-0054 | Native Swift. The web client shares no code with the native ones. |
| In what order do clients arrive? | ADR-0055 | Web now, phone next, TV last. |
| How is a file reached for playback? | ADR-0097 | An app-owned opaque-id route, never a path and never a public URL, "so access control and progress work". |

Two further records constrain the access layer without being about it:

- **ADR-0034** splits outbound URLs by who supplied them. A provider base URL the owner typed gets an
  ALLOWLIST of exact hosts and CIDRs. Anything arriving inside a provider response or a redirect gets
  denied by IANA range classification — anything not `unicast` is refused, with no exception ever.
  This decides whether a provider can live on a private overlay network, and section 5 returns to it.
- **ADR-0056** refuses a standard read protocol, because OPDS and Subsonic are typed by medium. The
  clients therefore have no third-party protocol to adopt and must speak CanonCore's own API. There is
  no route where the phone app is somebody else's client.

### One consequence worth stating before anything else

ADR-0097 puts playback behind an opaque-id route so that ACCESS CONTROL works. ADR-0043's session row
"arrives with the slice that first logs something in". ADR-0053 scaffolded the repo with `auth none`,
so there is no login today at all.

Those three compose into a sequencing fact rather than a new decision: **the first playback slice is
the slice that first logs something in.** Login is not a spec of its own competing with playback. It
is a prerequisite inside it.

---

### What is therefore genuinely unspecified

1. The password's MECHANISM: what hashes it, what carries the session, whether a passkey is an option.
2. Whether CanonCore SHIPS anything for remote access, or documents it as ADR-0050 documents rclone.
3. How a phone and a TV get a session, given that no hosted account service exists and none is wanted.
4. What the demo costs to run, and where.
5. What the hardware floor actually is, where the DuckDB archive sits, where backups go, and where the
   two provider repos deploy.
6. What files playback is tested against.

Sections 1-6 take these in turn.

---

## 1. The front door

### 1.1 What the incumbents actually built

**Plex** runs a directory. `plex.tv` accounts, a claim token that binds a server to one, and
`clients.plex.tv/api/v2/resources` returning per-server tokens and a list of connection URLs.

The load-bearing trick is TLS. A publicly trusted certificate cannot be issued for an IP address, so a
browser at an HTTPS origin cannot talk to `192.168.1.20` without a certificate error. Plex solved it
with wildcard DNS: each claimed server gets a 32-hex id and a wildcard certificate for
`*.<id>.plex.direct`, and Plex's own nameservers resolve `<dashed-ip>.<id>.plex.direct` back to the
literal IP — private ranges included.

Measured rather than recalled, 2026-09-10, with an invented hash:

```
$ dig +short A 100-64-7-9.a1b2c3d4e5f60718293a4b5c6d7e8f90.plex.direct @1.1.1.1
100.64.7.9
```

Plex's own prose only says "we've worked some DNS magic"
([blog, 2015-06-04](https://www.plex.tv/blog/its-not-easy-being-green-secure-communication-arrives/)),
and confirms the mechanism obliquely by telling users to whitelist `rebind-domain-ok=/plex.direct/`
([support 206225077](https://support.plex.tv/articles/206225077-how-to-use-secure-server-connections/)).
A public name resolving to a private IP is DNS rebinding; Plex does it deliberately.

**Plex has since priced the front door.** Remote playback of personal video became paid on
2025-04-29, extended to Fire TV, smart TVs and consoles on 2026-04-29. Music and photos stay free.

**Jellyfin** has no directory at all. You type a server URL. Its discovery is one UDP listener on port
7359 answering the literal string `who is JellyfinServer?`, IPv4-only by construction. Its documented
answer to remote access is "run a reverse proxy".

**Emby Connect** is a directory without the TLS machinery: it locates your server, it does not secure
the hop.

### 1.2 The finding that closes this section

**ADR-0041 forecloses the relay pattern entirely, and this was not obvious before the lookup.**

Plex Relay's own limitations page
([support 216766168](https://support.plex.tv/articles/216766168-accessing-a-server-through-relay/),
last modified 2025-07-14) reads:

> Connections are limited to 2 Mbps maximum for streams (this applies to both Plex Pass and Remote
> Watch Pass subscribers)
>
> If the content you're trying to stream has a higher bitrate, then the Plex Media Server will need to
> transcode the content down to fit the limitation.

Two facts compose. A relay is bandwidth-capped, and the incumbent's relay stays usable **only because
it can transcode down into the cap**. CanonCore has no transcoder and, under ADR-0041, never will. A
relay CanonCore cannot downgrade through is a relay that must carry full remux bitrate.

So the entire Plex-shaped fallback — a rendezvous service plus a relay for the hard cases — is
structurally unavailable to this product. That is a consequence of a record already taken, not a new
preference. What remains is a direct path, or an overlay that carries full bitrate peer-to-peer.

### 1.3 The candidates, and what each actually costs

**Port forwarding** is free and increasingly broken. CGNAT is the reason: the ISP hands the customer a
`100.64.0.0/10` address and there is no inbound path to forward. *Stated as a gap rather than
guessed:* no current (2024-2026) prevalence measurement was found. The available figures are Richter
et al. (IMC 2016, ≥17% of non-cellular and 94% of cellular ASes) and CAIDA (2018, 4.1K of 17.4K ASes),
both on 2014-16 data. Starlink's own documentation is the clean first-party example of an ISP that
does it.

**A reverse proxy (Caddy)** buys automatic HTTPS and nothing else — it still needs an inbound path, so
it does not solve CGNAT. It is the right thing to have once you have one.

**Tailscale** is the strongest fit, and it is free for this shape. WireGuard mesh with real NAT
traversal, so it beats CGNAT without a port. Confirmed from Tailscale's own docs
([Tailscale IP addresses](https://tailscale.com/docs/concepts/tailscale-ip-addresses), last validated
2026-01-12): tailnet addresses come from **RFC 6598 `100.64.0.0/10`** — the same range CGNAT ISPs use,
a collision Tailscale itself flags.

Today's free plan (tailscale.com/pricing, fetched 2026-09-10) is **unlimited user devices, up to 6
users** — a household front door, not a way to share a library with thirty friends. Older "100 devices
/ 3 users" figures are stale.

And `tailscale cert` issues a real Let's Encrypt certificate for a MagicDNS name via DNS-01. That is
the only way to get publicly trusted TLS to a private address without building Plex's wildcard-DNS
machinery. Two footguns from Tailscale's own page: machine names land in Certificate Transparency
logs, and certificates created with `tailscale cert` are **yours to renew** every 90 days unless a
integration (Caddy's) handles it.

**Cloudflare Tunnel is out, on terms.** The clause everyone cites as ToS §2.8 no longer exists — the
Self-Serve Subscription Agreement (last updated 2025-09-12) has zero hits for "non-HTML". The live
clause moved to the
[Service-Specific Terms](https://www.cloudflare.com/service-specific-terms-application-services/)
(last updated 2026-06-02):

> Unless you are an Enterprise customer, Cloudflare offers specific Paid Services (e.g., the Developer
> Platform, Images, and Stream) that you must use in order to serve video and other large files via
> the CDN. Cloudflare reserves the right to disable or limit your access to or use of the CDN [...] if
> you use or are suspected of using the CDN without such Paid Services to serve video or a
> disproportionate percentage of pictures, audio files, or other large files.

And Cloudflare's own guidance page (last updated 2026-08-25) now names Tunnel explicitly:

> Cloudflare Tunnel public hostname routes proxy traffic through Cloudflare. On Free, Pro, and
> Business plans, this traffic is subject to the terms described on this page.
>
> The restriction does not apply to private network routes.

The carve-out requires the viewer to run Cloudflare's WARP client, which makes it a VPN — the
Tailscale shape with extra steps. Two agents reached this clause independently, from the front-door
and the demo directions.

*Gap:* no published Cloudflare Tunnel bandwidth cap was found; the binding constraint is the
content-type clause, not a metered figure. Separately, Cloudflare's 100 MB free-plan limit is a
**request-body** limit, so it does not cap streaming out, but it would kill any upload-a-file feature
behind a proxied hostname.

**Tailscale Funnel** is public-facing and free, but it is beta, limited to ports 443/8443/10000, and
carries "non-configurable bandwidth limits" with **no published number**. Checked the Funnel doc, the
CLI reference and `/funnel-aup` (which redirects to the general AUP, containing no video clause). Do
not quote a Funnel throughput figure; there isn't one. Note also that every Funnel byte crosses a
Tailscale relay by design — Funnel is Tailscale's relay, not its mesh, so §1.2 applies to it.

---

## 2. Login for one person

### 2.1 better-auth has the whole shape in core

Version, measured today rather than recalled: `latest` is **1.7.4**, published 2026-09-10 11:36 UTC.
The dist-tag anomaly noted in ADR-0053 is resolved and explained: `1.6.31` was published at 09:22 UTC
*after* `1.7.3`, so `latest` read backwards for about two hours. There is no `release-1.6` tag for a
backport to land on. **Pin an exact version.**

Three things it gives that matter here:

1. **An RFC 8628 device-authorization plugin, in core** — `deviceAuthorization()` from
   `better-auth/plugins`. One `deviceCode` table. Defaults verified in source, not just docs:
   `expiresIn` 30m, `interval` 5s, `deviceCodeLength` 40, `userCodeLength` 8. It mints an ordinary
   better-auth session. **Corrected 2026-09-10:** an earlier version of this line called it
   "Jellyfin's Quick Connect, standardised". It is not Quick Connect at all. Quick Connect is a
   DIFFERENT ARRANGEMENT — the user types a six-character code into an ALREADY-AUTHENTICATED
   Jellyfin client, not into a browser at an authorization server — and its field names are
   `Secret`, `Code` and `Authenticated`, none of them the RFC's. Plex's pin API is bespoke too:
   across its own PMS specification, `OAuth` 0, `8628` 0, `device_code` 0, `grant_type` 0. So
   RFC 8628 is the standardised version of what BOTH incumbents invented separately, which is a
   better argument for it than the one this line originally made.
2. **`session.additionalFields` fits ADR-0043's capability declaration on one code path.**
   `internalAdapter.createSession` routes through `createWithHooks`, so
   `databaseHooks.session.create.before` fires for password, passkey **and device-code** sessions
   alike. One hook populates the declaration for every session type with no per-plugin special-casing.
   `listSessions()` gives the devices screen for free. Caveat: `ipAddress` and `userAgent` are
   immutable, so ADR-0043's `last_seen_at` has to be your own field.
3. A passkey plugin, subject to §2.2.

One correction worth carrying: better-auth's default scrypt is N=2^14, **r=16, p=1**. That is OWASP's
32 MiB tier, which specifies p=3; by `N·r·p` it is roughly 40% of OWASP's *weakest* listed
configuration. Node **v24.7.0+ ships `crypto.argon2` natively**, so overriding the hasher is a few
lines rather than a dependency.

### 2.2 Passkeys are a deployment decision before they are a code decision

WebAuthn Level 3 became a **W3C Recommendation on 2026-08-25**. Its §5.1.3 and §5.1.4 are decisive:

> Let `effectiveDomain` be the `callerOrigin`'s effective domain. If effective domain is not a valid
> domain, then throw a "SecurityError" DOMException.
>
> Note: An effective domain may resolve to a host, which can be represented in various manners, such
> as domain, ipv4 address, ipv6 address, opaque host, or empty host. **Only the domain format of host
> is allowed here.**

So `http://192.168.1.20:3000` fails twice: its host is an IP literal, so `[[Create]]`/`[[Get]]` throw
before any RP ID comparison; and plain `http` on a non-`localhost` host is not a secure context, so
`navigator.credentials` is not exposed at all. Related Origin Requests (L3 §5.11) cannot rescue it —
it needs an `https:` well-known fetch.

**Passkeys therefore require one stable HTTPS hostname that works at home and away.** That is not an
argument against them. It is the same requirement `tailscale cert` satisfies in §1.3, which is why the
front-door choice and the login choice are one decision rather than two.

### 2.3 The LAN exception is not available here

Home Assistant has **not** deprecated `trusted_networks`; it made the docs friendlier on 2026-06-10.
The signal against it comes from elsewhere: four High/Critical CVEs since 2024, and **Emby and
Jellyfin both deleted their LAN PIN by name**. Every survivor keeps it off by default and never lets
it reach admin functions.

That last clause is what closes it for CanonCore: under ADR-0044 the one user **is** the admin, so
"never let it reach admin functions" has nothing left to protect. The escape hatch does not exist
here.

Jellyfin's own single-admin case offers no precedent either: no blank passwords for a single-admin
server, no LAN-skips-login mode, and its password hashing is PBKDF2 at 210,000 iterations where OWASP
currently specifies 220,000 for SHA512.

### 2.4 The sleeper finding, which is not about login pages

Jellyfin leaves video, audio, HLS and **16 image endpoints** unauthenticated, and knows it.
(**Corrected 2026-09-10.** An earlier version said 17. Counted at the v12.0 tag, released
2026-09-08: 16 unauthenticated GET methods in `ImageController.cs`. Two of the three controllers
#13988 names have since moved — `ImageByNameController` no longer exists and `RemoteImageController`
is now `[Authorize]` — so the issue's own scope has partly rotted while the finding stands.) There is
no fallback authorisation policy — a repo-wide grep for `FallbackPolicy` and `RequireAuthenticatedUser`
returns zero hits, and `BaseJellyfinApiController` carries no `[Authorize]`, so any action without an
explicit attribute is anonymous. Jellyfin's own org members split this into six open `bug, security`
issues on 2025-04-23 (#13983-#13988), all still open on 2026-09-10.

The cause is structural rather than careless: browsers attach no custom headers to `<img>` and
`<video>`, so a header-token design cannot authenticate the media path.

**Cookie sessions do not have this problem — but only while media stays on the same origin as the
app.** ADR-0097's app-owned opaque-id route already puts it there. This finding says why that record
matters more than it looks, and it is a constraint on any later decision to move bytes to a CDN or a
separate media host.

---

## 3. Clients

### 3.1 What is true about typing on a TV remote, and what is not

"You cannot autofill a password on tvOS" is **false**. `ASAuthorizationPasswordProvider` is tvOS 15+,
and platform passkeys (`ASAuthorizationPlatformPublicKeyCredentialProvider`) are tvOS 16+.

But both are scoped by an **Associated Domain**, and since iOS 14 Apple fetches
`apple-app-site-association` through **Apple's own CDN**, not from your server
([Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)):

> Apps no longer send requests for `apple-app-site-association` files directly to your web server.
> Instead, they send these requests to an Apple-managed content delivery network (CDN) dedicated to
> associated domains.

So the domain must be publicly reachable over HTTPS with a valid certificate and no redirects. For a
server at an address only the owner knows, **an App Store build cannot use either mechanism**.
`?mode=developer` works only for development-signed builds on opted-in devices — fine for Jacob's own
sideloaded build, useless for anything shipped.

That is what turns device-code flow from "preferable" into "the answer".

### 3.2 Device code, and the one thing the RFC insists on

RFC 8628 §3.3.1 is normative and frequently ignored:

> Clients MUST still display the "user_code", as the authorization server will require the user to
> confirm it to disambiguate devices or as remote phishing mitigation.

A QR code does not remove the code from the TV screen; it removes the *typing of the URL*.

What the incumbents actually run, measured 2026-09-10:

| | Code | Lifetime | Rate limited? |
|---|---|---|---|
| **Plex** (`POST /api/v2/pins`) | 4 chars, no vowels, no `0`/`1` | 900 s | Yes — 429 on creation |
| **Plex** (`?strong=true`) | 25 chars | 1800 s | Yes |
| **Jellyfin** Quick Connect | 6 **digits** (100000-999999, ~19.8 bits) | 10 min | **No, none in `QuickConnectManager`** |
| **better-auth** default | 8 chars | 30 min | — |

Jellyfin's missing rate limit is survivable only because approval requires an already-authenticated
user. The same is true for CanonCore under ADR-0044, which changes what the entropy is protecting
against: with exactly one account, RFC 8628 §5.1's threat (guess the code, bind the TV to the
*attacker's* account) has no analogue. What stays live is §5.4 remote phishing. That argues for
spending entropy on the `device_code` and design effort on an approval screen that names the device
asking — not on a longer user code.

### 3.3 Two Apple constraints that decide the shape

**tvOS has no Local Network permission at all.** From Apple's
[TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
platform table: iOS yes (14), iPadOS yes (14), macOS yes (15), **tvOS no**, watchOS no. But on iOS,
"Making an outgoing TCP connection" to a local address **does** require it — so a plain `URLSession`
GET to `http://192.168.1.20:8096` raises the prompt on iPhone and not on Apple TV. The two platforms
are not symmetric and cannot share one networking story.

**Discovery should be mDNS, not UDP broadcast.** Jellyfin's broadcast approach is IPv4-only by
construction (RFC 4291 §2.1: "There are no broadcast addresses in IPv6"), and Apple requires the
*approval-gated* `com.apple.developer.networking.multicast` entitlement to send broadcast on iOS —
which Swiftfin's shipped iOS entitlements do not contain. `NWBrowser` with a declared
`NSBonjourServices` type costs no entitlement, works on IPv6, and needs no Apple approval.

Neither survives a VPN: TN3179 excludes VPN interfaces from being local networks, and Tailscale's own
docs say broadcast and multicast may not behave. Over a tailnet the answer is MagicDNS — a name, not
discovery. **Tailscale ships a tvOS app** (tvOS 17+), so this is a real path rather than a hypothetical
one, and it hands the client a real HTTPS name, which disposes of App Transport Security as well.

**DeviceDiscoveryUI is not the answer** and is worth ruling out by name, since it looks like it should
be. Apple's own restrictions: Apple TV 4K only, one device at a time, connects **only to other copies
of your own app**, requires universal purchase and a signed-in iCloud account. It hands you an
`NWEndpoint` for the phone, never for a server.

**The App Store constraint is guideline 2.1, not ATS.** Review needs a live demo account or a
pre-approved demo mode. Guideline 4.8 does not apply (own sign-in system is explicitly exempt); 3.1.1
does not apply (nothing is sold). Free personal-team signing expires every 7 days with a 3-device
limit; £/$99 a year removes that and is the only route to TestFlight.

---

## 4. The public demo

ADR-0044 and ADR-0072 settle the question the brief asked: **it needs no authentication.** Read-only,
no login, everything visible. Nothing below reopens that.

What the research adds is the operational half.

### 4.1 It is not free on the obvious host, for a reason that is not price

Vercel Hobby **permits** this use — the fair-use page's five examples (payment, advertising, paid
work, affiliate linking, ad networks) are all absent, and donations are explicitly carved out. The
problem is the overage behaviour:

> As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your
> usage limits on the Hobby plan, **you will have to wait until 30 days have passed** before you can
> use the feature again.

Spend Management is Pro-only. So on Hobby a determined scraper converts denial-of-wallet into **a
30-day outage**, which for the one surface that is supposed to demonstrate the product is the wrong
failure mode.

**Supabase's free tier is disqualified outright**: "Free projects are paused after 1 week of
inactivity." **Neon Free is viable** (0.5 GB, 100 CU-hours, 5 GB transfer, sub-second resume, no idle
project pausing), with one caveat that is load-bearing rather than a nicety: 100 CU-hours is about
four days of continuously-awake compute, so an uncached read path plus a persistent crawler suspends
the database. Caching is a requirement, not an optimisation.

**Hetzner + R2 is the combination where the worst case is cheap.** Hetzner includes 20 TB then charges
€1/TB; R2 charges nothing for egress at all and its 10 GB free tier is two orders of magnitude above
what the demo's artwork needs. One correction to a common assumption, measured from Hetzner's own
price API: **ARM is not cheaper there** — CAX11 is €6.49/mo against CX23 at €5.99, and the gap widens
up the ladder.

### 4.2 Three things that constrain the render

- **The TMDB logo and disclaimer are a required, visible UI element**, not a footnote. ADR-0036 already
  carries the wording; this says where it lands.
- **TMDB's six-month cache ceiling has an operational consequence for a permanent demo.** ADR-0037
  already makes expiry a read-time check against `max_cache_age`, so the mechanism exists — but it
  only works if the demo instance can reach TMDB to re-fetch. A demo with no outbound TMDB credential
  is a cache that can never refresh.
- **Cloudflare's non-HTML clause (§1.3) reaches the demo too.** Artwork served from a VPS behind the
  free CDN tests the clause; artwork served from R2 through a custom domain sits inside the carve-out.

### 4.3 Read-only is a GRANT, not a setting

PostgreSQL's own documentation settles which mechanism is the guarantee.
`default_transaction_read_only` is a session default, and the docs say session defaults "can be
overridden by `SET TRANSACTION` for an individual transaction" — and that READ ONLY is "a high-level
notion of read-only that does not prevent all writes to disk". `GRANT SELECT` (or the built-in
`pg_read_all_data` role) is enforced by the privilege system and cannot be self-escalated.

Worth noting for ADR-0045: column-level grants are the database analogue of a field strip-list, and
they **cannot** express this model's requirement, because the private thing is a *row* (a statement
whose property is `note`), not a column. That is independent support for the enumerated read path
being at the right layer. The two compose: `GRANT` prevents writes, the enumerated path chooses fields.

### 4.4 What can actually be stopped

Only two of the eight mechanisms surveyed stop a request. `robots.txt` is RFC 9309 and says of itself
"These rules are not a form of access authorization". `llms.txt` and `ai.txt` are absent from both the
W3C `/TR` index and the IETF; the IETF's own `aipref` working group puts "technical enforcement"
explicitly **out of scope**. `noai` does not appear in Google's directive list.

And **Cloudflare's default AI blocking does not apply here.** The current policy (blog 2026-07-01,
effective 2026-09-15) is that Training and Agent are blocked by default "on the pages that display
ads". An ad-free non-commercial demo gets nothing by default and must opt in — and on the free plan,
AI Crawl Control "identifies AI crawlers based on their user agent strings", which is trivially
spoofed.

---

## 5. Hardware

### 5.1 The floor, and why the buying guides do not apply

Plex publishes the no-transcode floor explicitly, and it is the most useful sentence in this area
([support 201774043](https://support.plex.tv/articles/201774043-what-kind-of-cpu-do-i-need-for-my-server/)):

> No transcoding: Intel "Atom" 1.2GHz (NAS devices based on ARM processors should also be capable of
> at least one stream with no transcoding)

against an i7 3.2 GHz for the same content transcoded at 4K.

Jellyfin never answers the question, and the shape of its answer is the tell. Its hardware guide
disqualifies the Raspberry Pi 5, prebuilt NAS appliances and Atom-class CPUs — and in **every case the
stated reason is a transcoding reason**: "Not having a GPU is NOT recommended for Jellyfin, as video
transcoding on the CPU is very performance demanding"; SBCs "often lack proper support for hardware
acceleration". Remove transcoding and every one of those disqualifications evaporates. The two projects
do not disagree; Jellyfin simply never answers the no-transcode case.

**So the honest floor is: any 64-bit machine with a gigabit NIC and a disk faster than the media
bitrate.** Direct play over HTTP is RFC 9110 range requests against a file. The CPU question is not
about playback at all — it is about Postgres, the Next.js build and the DuckDB query.

### 5.2 The DuckDB archive, measured rather than assumed

The heaviest realistic query — a `GROUP BY` over 47.8M rows — peaked at **145 MB RSS** and completed on
one thread inside a 128 MB limit. A point lookup cost 21 MB. **The 1.8 GB file does not need gigabytes.**

What does is DuckDB's documented default memory limit of **80% of RAM**, which is the actual trap. One
`SET memory_limit` fixes it for nothing.

Two operational findings that are not in DuckDB's docs:

- **A writer locks out read-only readers entirely** — measured: `IO Error: Could not set lock`. So the
  build pipeline must never hold the archive open while a provider runs, and everything should open
  `access_mode = 'READ_ONLY'`. Build-then-rename is the pattern.
- Keep it on **local disk**, not a NAS, per DuckDB's own caution about network attached storage.

### 5.3 The correction this section forces, and it touches version one

**ADR-0034 and CNCORE-6 both say content URLs are denied "by IANA range classification — anything not
`unicast`". IANA has no `unicast` classification at all.**

The [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry-1.csv)
(fetched 2026-09-10) classifies by five columns — Source, Destination, Forwardable, Globally Reachable,
Reserved-by-Protocol. The word "unicast" does not appear in it. Its row for the range in question:

```
100.64.0.0/10,Shared Address Space,[RFC6598],2012-04,N/A,True,True,True,False,False
```

`unicast` is **ipaddr.js's** vocabulary, not IANA's — it is that library's catch-all, returned only when
no named range matched. Measured against ipaddr.js 2.5.0 on Node v24.19.0:

```
100.64.0.1      -> carrierGradeNat
192.168.1.10    -> private
8.8.8.8         -> unicast
```

Two consequences:

1. **The record is factually wrong about its own authority** — but the obvious repair is worse than
   the error, and this was only established by testing it. "Refuse any block whose **Globally
   Reachable** value is False" ships three holes, each measured against the registry itself:
   `224.0.0.0/4` is not in that registry at all (multicast is a separate one); `192.88.99.0/24`
   carries an **empty** value rather than `False`; and `127.0.0.0/8` carries the literal string
   **`False [1]`**, a footnote marker inside the field, so a naive `=== "False"` **lets loopback
   through**. It is looser in the other direction too — `192.0.0.9/32`, `192.0.0.10/32` and the AS112
   blocks are Globally Reachable `True` while ipaddr.js refuses them. **Keep the mechanism, fix only
   the attribution, and record the rejection** so nobody makes the change later as an improvement.
2. **A tailnet-hosted provider is refused today, silently.** Tailscale addresses are
   `100.64.0.0/10` → `carrierGradeNat` → not `unicast` → denied, at the moment a provider response
   carries a 100.x address. It will look like a bug rather than a policy decision.

The fix costs nothing and needs no new mechanism: a provider base URL is a **config URL** the owner
typed, so it belongs on the allowlist path where a specific host or CIDR is added deliberately. The
deny-by-classification rule should keep refusing CGNAT in response content, which is what it is for.
Worth checking loopback too — ipaddr.js classifies `127.0.0.0/8` as `loopback`, also not `unicast`, so
localhost is not exempt either.

### 5.4 Buy nothing before November

Four reasons, each documented above, and all pointing the same way:

- The workload does not justify hardware. Plex's own floor is a 1.2 GHz Atom; the archive's heaviest
  measured query peaks at 145 MB.
- The container runtime is free — colima and Podman unconditionally, under MIT and Apache-2.0.
- **The Pi's price case has collapsed for a reason its own vendor calls temporary.** Raspberry Pi cite
  "a seven-fold increase over the last year in the price of the LPDDR4 DRAM" and say they "look forward
  to unwinding these price increases once it abates". A 16GB Pi 5 all-in is ≈£316 today. Buying into a
  vendor-acknowledged price spike is the worst possible timing.
- ADR-0048 makes restore instance-specific, so "which machine is the instance" is a decision with a
  cost. Making it twice — once now on stopgap hardware, once in November — pays that cost twice.

If a machine is still wanted in November, a used 6-core Dell OptiPlex 5070 Micro (16GB, NVMe) at ≈£279
beats every new N100 box, and the usual objection to it — weak transcoding — does not apply to this
product at all. Re-check every price then; half of them are moving fast.

**A seedbox has no role.** Owning a disk beats renting at 17.1 months, vendors disclaim durability in
writing, and the product never ingests media (ADR-0097) so the one thing a seedbox is for is the one
thing this does not do.

Backups: **restic, not Borg** — Borg 1.x cannot reach object storage and Borg 2 says "DO NOT USE" in its
own documentation. Against Cloudflare R2 that is £0 at 10 GB.

---

## 6. Test media

### 6.1 The finding that belongs in an ADR

**MediaInfo never fails.** Measured against v26.05 on 2026-09-10:

| Input | Bytes | `Format` | `Duration` reported | Exit code |
|---|---|---|---|---|
| zero-length `.mkv` | 0 | `None` | absent | **0** |
| 64 KB of `/dev/urandom` | 65,536 | `None` | absent | **0** |
| first 300 bytes of a valid MKV | 300 | **`Matroska`** | **37.043** | **0** |
| first 500 KB of a valid MKV | 500,000 | **`Matroska`** | **37.043** | **0** |

Three consequences, and each contradicts a natural assumption:

1. **The failure signal is `Format: None` plus zero tracks — not an exception and not an exit
   code.** An analysis pass written to catch a throw will silently record a corrupt file as fine.
   ADR-0042 chose MediaInfo and says what the pass writes; it does not say how the pass fails, and
   the obvious reading is wrong.
2. **MediaInfo's duration is a claim the container makes, not a measurement of what is present.** A
   300-byte fragment confidently reports the full 37 seconds, because Duration is read from the
   SegmentInfo header near the start of the file. This bears directly on ADR-0085: that record makes
   an *unknown* duration never complete, which is right, but a truncated file does not report unknown.
   It reports a confident wrong number, and every completion rule downstream believes it.
3. **The obvious cross-check does not work.** `FileSize` against `Duration × OverallBitRate` gives a
   ratio of 1.00 for the intact *and* the truncated file, because MediaInfo recomputes
   `OverallBitRate` from actual size (4,718,520 b/s intact, 107,983 b/s truncated). `StreamSize` is
   absent for Matroska tracks, so that discriminator is unavailable too. There is no `IsTruncated`
   field, with or without `--ParseSpeed=1`.

Detecting truncation needs something outside MediaInfo — comparing the last Cluster timecode against
the declared Duration, or attempting a demux.

The useful inverse: because duration and the track table live near the front of the file, **a 3 MB
range read of the 1.18 GB Sintel MKV yielded the complete track table, all 10 subtitle languages, all
8 chapters and the correct duration.** And ADR-0023's content-hash identity is computable over HTTP in
128 KB — one `HEAD` plus two range requests, demonstrated against a 372 MB file. Fixtures can be
catalogued before they are fetched.

### 6.2 Licences are not uniform, and checking individually paid off

- Blender films are CC BY **3.0** on the old film sites but CC BY **4.0** in the Studio terms.
- The *Tears of Steel* soundtrack is CC BY-**ND** 3.0, and one file in the same tree is BY-**NC-ND**.
- Netflix Open Content is **CC BY 4.0**, but `AV1/Chimera/license.txt` overrides it to BY-NC-ND 4.0 —
  which is a fine fit for a non-commercial server that never makes a derivative (ADR-0100).
- Wikimedia Commons is the only anonymous source for the modern Blender films (Studio's pages are
  JS-rendered with no downloads, and its `/api/` returns 401), but Commons tags are uploader-applied
  and **disagree with the films' own sites**: two Elephants Dream copies carry different licences.

### 6.3 Three fixtures nobody expected to find free

- **A byte-identical redundant-file pair with different declared languages.** `TOS-PT-BR.srt` and
  `TOS-PT-PT.srt` share SHA1 `7de664d7c311d8ea3f3ca1263bc6649ef00dceaf`. That is ADR-0023's redundant
  file and ADR-0091's language axis in one 4,686-byte pair.
- **A real three-part public-domain film** — Prelinger's *Doctor in Industry*, Parts I/II/III, which
  is the multi-part edition ADR-0022 needs and which Blender cannot supply.
- **A real-world cataloguing error that content-hashing catches and filenames hide.** Internet Archive
  serves byte-identical AVI and MPEG derivatives as both Part II and Part III of that film
  (md5 `550f7a3b7e6ee0fc3dd4505dbfb4fe10` for both `.avi` files) while the OGVs genuinely differ. So
  Parts II and III are different content and the Part III derivatives are simply wrong. That is the
  entire argument for ADR-0023 hashing content rather than trusting paths, available as a free fixture.

### 6.4 Size, and the gaps

**3.55 GB in total, but Tier A alone is 170 MB** and already covers no-duration, broken, redundant
file, external subtitle plus language, audio multi-part ordering, text, image, multichannel and
container refusal. Only chapters, external audio, the VARIANT pair and multi-part video need the
3.38 GB Tier B, and 65% of that is two Sintel 1080p files.

Gaps, stated rather than papered over:

| Needed | Status |
|---|---|
| One file covering **two works** (a double episode) | **Not found free.** Nearest is concatenating two public-domain LibriVox fables, which is one command and legal. |
| **PGS** subtitles | **No free legal sample found.** Produce one from a CC BY SRT, or use Netflix's CC BY 4.0 EBU-STL as the binary-subtitle stand-in. |
| **TrueHD / DTS** | **No legal free sample found**, and Dolby's terms were not retrievable to quote. **AC-3 exercises the same Apple refusal path** and is CC BY 3.0 in the Sintel and Tears of Steel trees. |
| **HEVC/H.265** | No free, clearly-licensed, container-wrapped sample found. |

---

## 7. The decision list

Ranked by when each blocks something, not by how interesting it is. Seven entries. Six of them belong
to a later spec and **get no ADR now**; exactly one touches version one.

Jacob writes the records. These are proposals.

---

### 1. Does login land inside the playback spec, or before it as a spec of its own?

**Forces:** the playback spec. Blocks its first slice.

**Options:** (a) login is a prerequisite slice inside the playback spec; (b) a separate access spec
runs first; (c) defer login until the clients spec.

**The evidence favours (a), and it is close to already decided.** ADR-0097 routes playback through an
opaque-id route *"so access control and progress work"* — which presupposes an access control that
ADR-0053 did not scaffold. ADR-0043's session row *"arrives with the slice that first logs something
in"*. Playback is that slice. Option (b) spends a whole spec on a prerequisite; option (c) ships a
playback route with nothing behind it.

Supporting evidence from outside: Jellyfin left video, audio, HLS and 16 image endpoints
unauthenticated because browsers attach no custom headers to `<img>` and `<video>`, and its own org
members have six `bug, security` issues open on it since 2025-04-23. Cookie sessions on a same-origin
media route do not have that problem. ADR-0097 already puts the route there — this says the record
matters more than it looks, and constrains any later move of bytes to a CDN.

---

### 2. What mints the session?

**Forces:** the same slice as (1). **Later spec — no ADR now.**

**Options:** better-auth pinned to an exact version; Auth.js; hand-rolled password plus signed cookie.

**The evidence favours better-auth, pinned**, on two specifics rather than on general preference:

- It ships an **RFC 8628 device-authorization plugin in core** (`deviceAuthorization()` from
  `better-auth/plugins`, one `deviceCode` table, defaults verified in source). That is the entire TV
  problem, already written and standardised.
- `internalAdapter.createSession` routes through `createWithHooks`, so
  `databaseHooks.session.create.before` fires for password, passkey **and device-code** sessions
  alike. ADR-0043's capability declaration is populated on **one code path for every session type**.

Pin an exact version: `latest` read backwards for two hours on 2026-09-10 (`1.6.31` published after
`1.7.3`), which is the same instability ADR-0053 already recorded. Current stable is 1.7.4. Override
the default scrypt — it is r=16 p=1 against OWASP's p=3, and Node v24.7.0+ ships `crypto.argon2`.

---

### 3. Is there one canonical HTTPS origin, and is it a Tailscale MagicDNS name?

**Forces:** the playback spec (same-origin media). **Hard-blocks the clients spec.** **Later spec.**

**Options:** Tailscale MagicDNS plus `tailscale cert`; own domain plus Caddy plus a forwarded port;
Plex-style wildcard-DNS machinery.

**The evidence favours Tailscale, and it answers four questions with one move.** A public CA will not
issue for an IP address. WebAuthn L3 throws `SecurityError` when the origin's host is an IP literal
("Only the domain format of host is allowed here"), so passkeys need a domain. App Transport Security
wants HTTPS on iOS. And Apple's Associated Domains — needed for tvOS passkeys or AutoFill — are fetched
through **Apple's own CDN**, so they need a publicly reachable name. One MagicDNS name with a real
Let's Encrypt certificate satisfies all four, at £0, on a free plan that is unlimited devices and up to
six users.

The alternative dies on CGNAT, and the third option is largely moot: **ADR-0041 forecloses the relay
half of the Plex pattern outright**, because Plex Relay is 2 Mbps and stays usable only by transcoding
down into the cap.

Costs to state rather than discover: machine names land in Certificate Transparency logs; `tailscale
cert` certificates are yours to renew every 90 days unless Caddy's integration handles it; and
Tailscale is a household front door, not a way to share with thirty friends.

---

### 4. Correct ADR-0034's attribution of `unicast`.

**Forces:** CNCORE-6, which is **in version one** and carries the wrong phrase in its own acceptance
criteria. **This is the only entry here that touches version one.**

**Status: actioned since this file was written** — CNCORE-11, PR #9. Recorded here because the entry
is the reasoning, not the ticket, and because the change that landed is NARROWER than this entry
first proposed. An earlier draft said to restate the rule in IANA's own terms; testing that against
the registry before writing it showed it ships three holes, so only the attribution moved. The
paragraphs below are the corrected version.

**Options:** leave it and let the implementer discover it; name the library whose vocabulary it is;
restate in the registry's own terms.

**The evidence favours fixing the attribution and nothing else.** IANA's registry has no `unicast`
value — it classifies by Source, Destination, Forwardable, Globally Reachable and Reserved-by-Protocol.
`unicast` is ipaddr.js's catch-all.

**Do not restate the rule in IANA's terms.** That repair was tested and ships three holes:
`224.0.0.0/4` is absent from that registry, `192.88.99.0/24` has an empty value, and `127.0.0.0/8`
reads `False [1]` — a footnote marker that makes a naive equality test **let loopback through**. Keep
ipaddr.js's mechanism, name it honestly, and record the rejection.

Second-order: it decides whether a tailnet-hosted private provider works at all, and today it
silently does not.

Cheap, and cheaper now than after CNCORE-6 ships an implementation built on the wrong sentence.

---

### 5. How does the analysis pass fail?

**Forces:** the playback spec. **Later spec — no ADR now.**

**Options:** catch a throw; detect `Format: None` plus zero tracks; add a check outside MediaInfo.

**The evidence forces the second, and warns that it is not enough.** MediaInfo returns **exit 0** on a
zero-byte file, on 64 KB of random bytes, and on a 300-byte truncation. There is no `IsTruncated` field
and no exception. Worse, **a 300-byte fragment confidently reports the full 37-second duration**,
because Duration is read from the container header — and the obvious `FileSize` against
`Duration × OverallBitRate` cross-check gives 1.00 for intact and truncated alike.

This bears on ADR-0085, which makes an *unknown* duration never complete. A truncated file does not
report unknown; it reports a confident wrong number, and every completion rule downstream believes it.

---

### 6. Where does the demo run?

**Forces:** the demo spec. **Later spec — no ADR now.**

**Options:** Vercel Hobby; Hetzner plus R2; Cloudflare Workers.

**The evidence favours Hetzner plus R2.** Vercel Hobby *permits* the use (all five commercial examples
are absent, donations carved out) but hard-stops rather than billing — *"you will have to wait until 30
days have passed"* — so a scraper turns denial-of-wallet into a **30-day outage** on the one surface
meant to demonstrate the product. Supabase is disqualified outright (*"Free projects are paused after 1
week of inactivity"*). Neon Free works but makes caching load-bearing, not optional. Cloudflare Workers
means running a beta third-party re-implementation of Next.js.

Two constraints for whoever writes that spec: Cloudflare's non-HTML clause reaches artwork served from
a VPS behind the free CDN, but not artwork served from R2 through a custom domain; and read-only means
`GRANT SELECT`, since Postgres documents `default_transaction_read_only` as a session default that
*"can be overridden by `SET TRANSACTION`"*.

---

### 7. Which test-media tier?

**Forces:** the playback spec. **Later spec — no ADR now.**

**Options:** Tier A (170 MB); Tier A plus B (3.55 GB).

**The evidence favours Tier A first.** 170 MB already covers no-duration, broken, redundant file,
external subtitle plus language, audio multi-part ordering, text, image, multichannel and container
refusal. Only chapters, external audio, the VARIANT pair and multi-part video need Tier B, and 65% of
that 3.38 GB is two Sintel files.

Three fixtures are better than anything that could have been constructed: a byte-identical `.srt` pair
with **different declared languages** (ADR-0023 and ADR-0091 in 4,686 bytes); a genuine three-part
public-domain film for ADR-0022; and a real Internet Archive cataloguing error where Parts II and III
serve identical MD5s while the OGVs differ — which is the argument for ADR-0023 hashing content rather
than trusting paths, free and in the wild.

Gaps to plan around: no free legal PGS, TrueHD, DTS or container-wrapped HEVC sample exists. **AC-3
exercises the same Apple refusal path** and is CC BY 3.0.

---

## 8. So what is the next spec?

Nothing here changes version one. CNCORE-2's four conditions need no login, no remote access, no
client and no playback, and the one item above that touches it is a wording correction to a record.

**The repo already answers the ordering, in two places that agree.** CNCORE-2's Out of Scope section
names the playback half and says *"That is the first work after the cap."* `CLAUDE.md` lists the
successors as *"the playback half, the clients and the demo"*. This research does not overturn that.

What it does is change what the playback spec **contains**, and rule one thing out of the clients spec:

- **The playback spec absorbs login.** Entries 1, 2 and 5 all land inside it. It is not "files, scanner,
  progress, playback" — it is "authentication, files, scanner, progress, playback", because ADR-0097's
  route has nothing behind it otherwise.
- **The clients spec is hard-blocked on entry 3** and cannot start until there is one canonical HTTPS
  origin. That is a reason to settle the origin question during the playback spec rather than at the
  start of the clients one.
- **The demo spec is genuinely independent** and is the cheapest of the three. Nothing in it waits on
  entries 1-3. If a demoable surface is wanted sooner than the playback half can deliver one, the demo
  is the only successor that can jump the queue without borrowing work from another spec.

The ranking that follows is playback, then clients, then demo — unchanged — with the single caveat that
the demo could be pulled forward on its own merits, and the clients spec cannot be started early under
any circumstances.

---

## Sources

Every claim above is dated 2026-09-10 and carried back to the source that owns it. The full working,
with verbatim quotes, measurements and the queries that produced them, is in six files kept out of the
repo deliberately (they run to ~6,000 lines): front door, login, clients, demo, hardware, test media.
Anything marked as a gap here was checked and could not be established — those are stated rather than
filled in.

**Corroboration worth noting:** the Cloudflare non-HTML clause was reached independently by two agents
working from different directions (the front door and the demo), which is why §1.3 states it as
settled rather than as a single reading.
