# Verification: CNCORE-6 and CNCORE-7

Every load-bearing technical claim in Linear issues CNCORE-6 ("The wiki provider, and one item
imported through it") and CNCORE-7 ("Browse imports a container and its ordering"), and in the ADRs
they rest on (0031, 0032, 0033, 0034, 0035, 0069), checked against the source that owns it.

All lookups performed 2026-09-10 unless a section says otherwise. Where a lookup and memory
disagreed, the lookup won.

Verdicts: **CONFIRMED** (URL, section, exact quote, date), **CONTRADICTED** (what is true now),
**UNFOUNDED** (no support located; what would settle it), **JUDGEMENT** (a defensible design choice
rather than a fact a source states).

---

## 1. OWASP SSRF Prevention Cheat Sheet

Source: *Server-Side Request Forgery Prevention Cheat Sheet*,
<https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>
and its source markdown
<https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.md>
(both fetched 2026-09-10).

### Version and date of the cheat sheet — ANSWERED

**The OWASP Cheat Sheet Series has no numbered version.** There is no GitHub release
(`/repos/OWASP/CheatSheetSeries/releases/latest` returns nothing) and no version string on the
page. The site is built continuously from `master`, so the only meaningful version is the git
revision. For this file:

| Fact | Value |
|---|---|
| Latest commit touching the file | `49b91f007e`, 2026-08-04 ("Normalize remaining US English spellings final sweep (part 4)", PR #2335) |
| Commit that added the deny-list section | `22e377e45e`, 2026-01-05 ("fix #1784: SSRF deny-list (last resort)", PR #1946) |
| Sitemap `<lastmod>` for the rendered page | 2026-09-08 |
| File length as fetched | 376 lines |

Anyone citing this cheat sheet should cite the commit or the fetch date, not a version number —
there isn't one. The deny-list section the ADR quotes is eight months old, which is why quoting it
from memory would have been a coin flip.

### The Case 1 / Case 2 split — ADR 0034, CNCORE-6 — CONFIRMED

ADR 0034 says a config URL "is OWASP's Case 1, an identified and trusted destination, so it is
checked against an ALLOWLIST", and a content URL "gets the deny-list".

Section *Cases*, verbatim:

> Depending on the application's functionality and requirements, there are two basic cases in which
> SSRF can happen:
>
> - Application can send request only to **identified and trusted applications**: Case when
>   [allowlist] approach is available.
> - Application can send requests to **ANY external IP address or domain name**: Case when
>   [allowlist] approach is unavailable.
>
> Because these two cases are very different, this cheat sheet will describe defenses against them
> separately.

The headings are exactly `### Case 1 - Application can send request only to identified and trusted
applications` and `### Case 2 - Application can send requests to ANY external IP address or domain
name`. Under Case 2, *Challenges in blocking URLs at application layer*:

> Based on the business requirements, the allowlist approach is not a valid solution. The block-list
> approach is the best solution in this scenario.

The ADR's mapping is faithful. Note the cheat sheet's own word under Case 2 is "block-list", while
the standalone section added in January 2026 says "Deny-list"; the document uses both.

### The heading "Deny-list (Last Resort)" — ADR 0034 — CONFIRMED

Line 319 of the source markdown is exactly:

> `## Deny-list (Last Resort)`

Capitalisation and parenthesis as the ADR has them.

### "Deny-lists are bypass-prone. Prefer allow-lists." — ADR 0034 — CONFIRMED

Line 321, the first line of that section, verbatim including the bold:

> `**Deny-lists are bypass-prone. Prefer allow-lists.**`

The ADR quotes it word for word, and correctly describes it as opening the section.

### OWASP names the attack "DNS pinning" and never "DNS rebinding" — ADR 0034 — CONFIRMED

`grep -i` over the current file: **three** occurrences of `DNS pinning` (lines 117, 166, 300), **zero**
of `rebinding`, **zero** of `TOCTOU`. All three point at the same reference, the SSRF Bible PDF,
section *Exploitation tricks > Bypassing restrictions > Input validation > DNS pinning*.

Worth recording for anyone who trips over it later: OWASP's "DNS pinning" is the industry's "DNS
rebinding". The cheat sheet is using the term for the *attack*; the rest of the field uses "DNS
pinning" for the *defence* (pinning a connection to a resolved address). ADR 0034 uses both senses
in one paragraph — it quotes OWASP's attack sense and then proposes "connection pinning" as the
remedy. That is not wrong, but the ADR is right to flag that the phrase is OWASP's, not ours.

### OWASP's own remedies are internal-DNS-first and allowlist monitoring — ADR 0034 — CONFIRMED, with one omission

Case 1, after the domain allowlist check, verbatim:

> Unfortunately here, the application is still vulnerable to the `DNS pinning` bypass mentioned in
> this document. Indeed, a DNS resolution will be made when the business code will be executed. To
> address that issue, the following action must be taken in addition of the validation on the domain
> name:
>
> 1. Ensure that the domains that are part of your organization are resolved by your internal DNS
>    server first in the chains of DNS resolvers.
> 2. Monitor the domains allowlist in order to detect when any of them resolves to a/an:
>    - Local IP address (V4 + V6).
>    - Internal IP of your organization (expected to be in private IP ranges) for the domain that are
>      not part of your organization.

That is exactly the two remedies ADR 0034 names, and neither is connection pinning. The ADR's
conclusion — "connection pinning is our design rather than a quotation from it" — is correct.

**The omission:** Case 2 carries a *third* remedy the ADR does not mention, step 2 of the validation
flow:

> 2. To prevent the `DNS pinning` attack described in this document, the application will retrieve
>    all the IP addresses behind the domain name provided (taking records *A* + *AAAA* for IPv4 +
>    IPv6) and it will apply the same verification described in the previous point about IP addresses.

Resolve every A and AAAA record and check each one. This still does not pin the connection — the
socket resolves again afterwards — so it does not change the ADR's conclusion, but "all A + AAAA
records, not just the first" is a concrete requirement the ticket's deny-list boundary should
inherit and currently does not state.

### What OWASP says about redirects, which neither ticket nor ADR mentions — GAP

Twice, in both cases, emphatically:

> **Note:** Disable the support for the following of the redirection in your web client in order to
> prevent the bypass of the input validation (line 66)

> 7. The application will build the HTTP POST request **using only validated information** and will
>    send it (*don't forget to disable the support for redirection in the web client used*). (line 305)

CNCORE-6 says "Anything arriving inside a response **or a redirect** gets the deny-list", which
presumes redirects are followed and re-validated. OWASP's advice is not to follow them at all.
Following-and-revalidating is a defensible choice for a metadata fetcher that needs CDN redirects
for artwork, but it is a deliberate departure from the cheat sheet and the ADR should say so rather
than reading as though it follows OWASP throughout. See §2 — this is the same TOCTOU hole the
pinning claim is about.

### Verdicts in this section

4 CONFIRMED, 1 CONFIRMED-with-omission, 2 findings (no version number exists; the redirect gap).

---

## 2. Connection pinning in Node.js

The claim under test, from CNCORE-6 and ADR 0034: *"Both resolve the hostname once and pin the
connection to the resolved address, because re-validating at each redirect hop does not stop a host
that resolves differently on the second lookup."*

Two separate questions: is the reasoning sound, and is there a current, maintained way to do it in
Node without breaking TLS.

### The mechanism claim — TOCTOU between validation and connection — CONFIRMED

Validate-then-connect is a time-of-check/time-of-use gap whenever the connect step performs its own
DNS resolution. OWASP describes the gap in its own words (Case 1, line 166):

> Indeed, a DNS resolution will be made when the business code will be executed.

That is the whole of the ticket's argument, stated by the source. The remedy OWASP reaches for is
different (see §1), but the ADR does not claim otherwise.

### A maintained way to do it in Node — CONFIRMED, and the mechanism matters

**Yes, and the correct mechanism preserves SNI and certificate validation by construction, because
it never touches the URL.**

There are two ways to "connect to the resolved IP", and only one of them is safe:

**The wrong one:** rewrite the URL to `https://93.184.216.34/`, set a `Host:` header, and set
`servername` manually. Node's docs are explicit that this is fighting the grain —
<https://nodejs.org/docs/latest/api/tls.html> on `servername`:

> Server name for the SNI (Server Name Indication) TLS extension. It is the name of the host being
> connected to, and **must be a host name, and not an IP address**.

And `checkServerIdentity(servername, cert)`:

> A callback function to be used (instead of the builtin `tls.checkServerIdentity()` function) when
> checking the server's host name (or the provided `servername` when explicitly set) against the
> certificate.

So URL rewriting works only if you correctly re-supply `servername` *and* keep the default identity
check pointed at the original hostname. Every mistake here is silent.

**The right one:** intercept DNS, not the URL. Node's `net.connect` options
(<https://nodejs.org/docs/latest/api/net.html>, fetched 2026-09-10):

> `lookup` <Function> Custom lookup function. **Default:** `dns.lookup()`.

A custom `lookup` resolves once, validates the address, and hands that address back. Node connects
to exactly that address; there is no second resolution. The URL, the `Host` header, the SNI
`servername` and the certificate identity check all still see the hostname, untouched. **Pinning via
`lookup` is TOCTOU-safe and TLS-transparent at the same time.**

Undici exposes the same hook. From `docs/docs/api/Client.md`
(<https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md>, via context7 2026-09-10):

```js
const client = new Client('https://example.com', {
  connect: {
    lookup (hostname, options, callback) { dns.lookup(hostname, { ...options, family: 4 }, callback) }
  }
})
```

This matters because Node's global `fetch` is undici, and undici does **not** accept an
`http.Agent`. Anything built on `http.Agent` therefore does not protect `fetch`.

### Libraries, with maintenance checked (npm registry + GitHub API, 2026-09-10)

| Package | Latest | Published | Downloads/wk | Covers | Verdict |
|---|---|---|---|---|---|
| `@atproto-labs/fetch-node` | 0.3.7 | 2026-08-03 | 35,269 | undici / global `fetch` | **Maintained, and the reference implementation** |
| `request-filtering-agent` | 3.2.1 | 2026-06-29 | 168,316 | `http.Agent` only, **not** `fetch` | Maintained, but wrong layer for undici |
| `ssrfcheck` | 1.4.0 | 2026-04-27 | 6,118 | string check only, no pinning | Not a pinning solution |
| `got-ssrf` | 3.0.0 | 2024-01-31 | 13,823 | `got` | Two years stale |
| `ssrf-guard` | 1.0.0 | 2026-08-23 | 863 | claims socket pinning | Too new and too little used to trust |
| `ssrf-req-filter` | 1.1.1 | 2024-05-11 | — | `http.Agent` | Stale |
| `ssrf-agent` | 1.0.5 | 2021-11-18 | — | `http.Agent` | Abandoned, five years |

`@atproto-labs/fetch-node` is Bluesky's, in the `bluesky-social/atproto` monorepo
(`packages/internal/fetch-node`), last touched 2026-08-04. Its `unicast.ts` is precisely the
mechanism above — an undici `Agent` constructed as `new Agent({ connect: { lookup: unicastLookup } })`,
where `unicastLookup` resolves and rejects anything whose `ipaddr.js` range is not `unicast`. It
carries three details worth stealing rather than rediscovering:

1. **It validates every address, not the first.** `Array.isArray(address) ? address.map(...) : [...]`
   then `ips.some(isNotUnicast)`. Node's `autoSelectFamily` (default `true` since Node 20) passes
   `all: true` to `lookup` and tries each returned address in turn (RFC 8305), so a pinning
   implementation that checks `address[0]` and returns the array is bypassable. This is the same
   requirement OWASP states for Case 2 — all A *and* AAAA records.
2. **It normalises IPv4-mapped IPv6.** `ip.isIPv4MappedAddress()` → `toIPv4Address()`. Without this,
   `::ffff:169.254.169.254` walks straight past an IPv4 deny-list.
3. **It refuses to run with an unrecognised undici.** It pins to undici major 6, 7 or 8 by inspecting
   `process.versions.undici` and throws rather than falling through, with the comment: *"Because this
   is a security feature, we don't want to fallback ... we don't want to assume that and risk a
   security issue."*

**Caution, and it is the point of doing this lookup at all:** `dssrf`, an npm package whose whole
description is "SSRF defense library for Node.js", carries **CVE-2026-54729**, an SSRF
vulnerability, disclosed July 2026. Picking a library off a search result by name is not a control.

### Verdict

**CONFIRMED.** The ticket's requirement is implementable today with maintained code, and the
implementation route is the custom `lookup` hook (`net.connect`, `undici` `connect.lookup`) rather
than URL rewriting. **JUDGEMENT** on the ticket text: it says *what* to do and not *how*, and the
"how" has one obviously right answer and several silently-wrong ones. The ticket would be better if
it named the `lookup` hook, since an implementer who reaches for URL rewriting will produce
something that passes tests and has no working certificate validation.

Two requirements the ticket omits and should carry: **validate all returned addresses, not the
first** (autoSelectFamily), and **normalise IPv4-mapped IPv6 before comparing**.

---
## 3. Cloud metadata addresses

The claim under test, from ADR 0034: *"an allowlisted private provider that is compromised or merely
buggy must not redirect the fetcher onto 169.254.169.254."*

### 169.254.169.254 is still the address for all three major providers — CONFIRMED

| Provider | Source (fetched 2026-09-10) | Address |
|---|---|---|
| AWS EC2 IMDS | <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html> | `http://169.254.169.254/latest/meta-data/` |
| GCP metadata server | <https://docs.cloud.google.com/compute/docs/metadata/overview> | `http://169.254.169.254/computeMetadata/v1`, `metadata.google.internal`, `metadata.goog` |
| Azure IMDS | <https://learn.microsoft.com/en-us/azure/virtual-machines/instance-metadata-service> | `http://169.254.169.254/metadata/instance?api-version=...` |

Azure's page states it plainly:

> IMDS is a REST API that's available at a well-known, non-routable IP address (`169.254.169.254`).

### There ARE others that must also be denied — CONTRADICTED (by omission)

The ticket, the ADR and OWASP's own deny-list table all stop at the IPv4 address. **Two providers now
publish IPv6 metadata endpoints, and neither is in OWASP's table.**

**AWS**, same page, section *IPv6 support*:

> To retrieve instance metadata using an IPv6 address, ensure that you enable and use the IPv6
> address of the IMDS `[fd00:ec2::254]` instead of the IPv4 address `169.254.169.254`.

**GCP**, `docs.cloud.google.com/compute/docs/metadata/overview`, for IPv6-only VMs:

> `http://[fd20:ce::254]/computeMetadata/v1`

Both are **ULA addresses in `fd00::/8`**, not link-local `fe80::/10`. So:

- A deny-list of `169.254.0.0/16` + `fe80::/10` misses both.
- OWASP's published table (§1) misses both too: it lists `::1/128` and `ff00::/8` for IPv6 and
  nothing else. It also omits `169.254.0.0/16` as a range, `100.64.0.0/10` (CGNAT) and `fc00::/7`.
  **The OWASP deny-list table is not a sufficient deny-list.** Citing it as authority for the
  ticket's deny-list would ship a hole.

The correct rule is the one `@atproto-labs/fetch-node` uses (§2): deny everything whose IANA range
is not `unicast`, via `ipaddr.js`'s `range()`, rather than enumerating CIDRs. That covers `fd00::/8`
and every future special-purpose block without a maintenance burden, and OWASP's own cited sources
are the IANA special registries.

### IMDSv2 — CONFIRMED, and it is not a substitute

AWS, same page:

> **(IMDSv2) Use /latest/api/token to retrieve the token** — Issuing `PUT` requests to any
> version-specific path ... results in the metadata service returning 403 Forbidden errors.

IMDSv2 requires a `PUT` to obtain a session token plus an `X-aws-ec2-metadata-token` header, which
defeats a plain `GET`-shaped SSRF. OWASP's framing is right:

> IMDSv2 is an additional defense-in-depth mechanism for AWS that mitigates **some of the instances**
> of SSRF.

AWS's own page still says "By default, you can use both versions of the Instance Metadata Service",
so IMDSv1 is not gone. Azure requires a `Metadata: true` header and states the request "Must **not**
contain an `X-Forwarded-For` header"; GCP requires `Metadata-Flavor: Google` and says "If you don't
provide this header, the metadata server denies your request". All three have a header-shaped
defence — and none of them is a reason to skip the deny-list, since an SSRF that can set headers
walks past all of them.

### Relevance to this project — JUDGEMENT

CanonCore is self-hosted on a user's own hardware (ADR 0050, filesystem path, no cloud
integration), so `169.254.169.254` is not the live threat here; the local network is. The metadata
address is the canonical example rather than the actual risk. This does not weaken the requirement —
a non-unicast deny is one check that covers both — but the ADR's rhetorical weight on
`169.254.169.254` is slightly misplaced for this deployment model.

### Verdicts in this section

2 CONFIRMED, 1 CONTRADICTED-by-omission (IPv6 metadata endpoints missing from the ticket, the ADR
and OWASP's own table), 1 JUDGEMENT.

---

## 4. The W3C Reconciliation Service API and the `versions` array

Sources, both fetched 2026-09-10:

- **v0.2**, the current published version: *Reconciliation Service API v0.2*, **Final Community
  Group Report, 10 April 2023**, `publishISODate: 2023-04-10`,
  <https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/>.
  `reconciliation-api.github.io/specs/latest/` redirects to it. Entity Reconciliation Community
  Group; editor Antonin Delpeuch.
- **v1.0-draft**, unpublished editor's draft (`specStatus: "CG-DRAFT"`),
  <https://reconciliation-api.github.io/specs/1.0-draft/>, last commit 2026-07-15.

### `versions` is an ARRAY, not a single value — ADR 0032, CNCORE-6 — CONFIRMED

v0.2, *Service Definition > Service Manifest*, verbatim:

> **versions** The array of API versions supported by the endpoint, such as `["0.1", "0.2"]`.

And the normative JSON schema, `0.2/schemas/manifest.json`:

```json
"versions": {
  "type": "array",
  "description": "The list of API versions supported by this service.",
  "items": { "type": "string" },
  "contains": { "enum": ["0.2"] }
}
```

An array of strings, with a `contains` constraint rather than a single enum — so a service genuinely
can declare `["0.1", "0.2"]` and straddle two versions, which is exactly the property ADR 0032 wants.

### Versioning was retrofitted at v0.2, and absence means v0.1 — ADR 0032, CNCORE-6 — CONFIRMED

Same paragraph, immediately after, verbatim:

> Since this field did not exist in version 0.1, services which do not declare a `versions` field are
> expected to only support version 0.1.

And the *Versions* section confirms the retrofit:

> **0.2 (This Version)** Initial improvements to the specifications made by our Community Group. ...
> Let manifests announce which versions of the protocol are supported by the service

"Let manifests announce which versions ... are supported" listed as a **0.2 change** is the retrofit,
stated by the spec.

### The manifest schema lists `versions` as required — ADR 0032 — CONFIRMED, and it is now worse

`0.2/schemas/manifest.json`:

```json
"required": ["versions", "name", "identifierSpace", "schemaSpace"]
```

`versions` is required in the schema while the prose infers 0.1 from its absence. ADR 0032's
description of the contradiction is exact.

**It has since got worse, not better.** In the 1.0-draft the contradiction has moved *into the
prose*:

> **versions** {{Array}} **(required)** a list of API versions supported by the endpoint, such as
> `["0.1", "0.2", "1.0-draft"]`. Since this field did not exist in version 0.1, services which do not
> declare a `versions` field are expected to only support version 0.1.

One sentence marks the field required; the next describes what to do when it is absent. The
1.0-draft schema keeps `"required": ["versions", "name", "view"]`.

There is also a live sign the group knows: a commit titled *"Section 3.7 Version Negotiation. closes
#78"* was landed and **reverted the same day**, 2026-07-15. Version negotiation in this spec is
unsettled.

ADR 0032's decision — "We take the prose rule and not the schema, because a required field breaks
every existing provider on the day it lands" — is therefore the right call, and better founded than
when it was written.

### One correction to make to ADR 0032 — CONTRADICTED (wording)

ADR 0032 says the W3C spec "retrofitted versioning at v0.2 with exactly it". Accurate. But the ADR's
title is *"CMPP declares a `versions` array, and absence means version 1"*, while the spec's absence
rule means **0.1**, its own first version. CMPP's own first version being called "1" is a local
choice, not something the W3C spec supports; the ADR should not imply the precedent extends to the
numbering. Cosmetic, but it is the sort of thing that gets quoted back later.

### Verdicts in this section

3 CONFIRMED, 1 CONTRADICTED (ADR wording, not mechanism).

---
## 5. Cloudflare bot protection on tardis.wiki

The claim under test, from CNCORE-6 and ADR 0069: *"EXPECT A 403 FROM THE LIVE WIKI AND DO NOT TREAT
IT AS A BUG. It sits behind bot protection that answers any non-browser client regardless of
permission."*

### The 403 — CONFIRMED, live, 2026-09-10

One unauthenticated `HEAD` and two `GET`s, no attempt to solve or evade anything:

```
$ curl -sI https://tardis.wiki/wiki/Doctor_Who
HTTP/2 403
cf-mitigated: challenge
server: cloudflare
content-security-policy: ... script-src 'nonce-...' https://challenges.cloudflare.com; ...
accept-ch: Sec-CH-UA-Bitness, Sec-CH-UA-Arch, Sec-CH-UA-Full-Version, ...
server-timing: chlray;desc="a38dbef85ad5b230"

$ curl -o /dev/null -w '%{http_code}' 'https://tardis.wiki/api.php?action=query&format=json&titles=Doctor%20Who'
403
```

Article path **and** `/api.php` both 403. The `cf-mitigated: challenge` header and the CSP pointing at
`challenges.cloudflare.com` say precisely what it is: a **JavaScript challenge, not a block**. The
403 is what an unsolved challenge looks like to a client that cannot run the JS. `accept-ch` asking
for a full set of `Sec-CH-UA-*` client hints is a browser-fingerprint demand a non-browser cannot
satisfy.

This is stronger evidence than "we got a 403": the response body is a challenge page, so the ADR's
reading — technical access and permission are different things — is exactly right, and an implementer
who sees this should not go looking for an auth header they forgot.

The wiki's `robots.txt` also serves Cloudflare-managed content signals
(`Content-Signal: search=yes,ai-train=no,use=reference`), confirming the operator is using
Cloudflare's managed bot tooling deliberately rather than having it switched on by accident.

### Is there a documented legitimate path? — CONFIRMED THAT THERE IS ONE, and the ticket should name it

The ticket says "Do not route around it", which is right. But "do not route around it" and "there is
no sanctioned route" are different claims, and the second is false. Cloudflare documents three, and
which one applies depends on the wiki's plan:

**1. IP Access Rules — works even on the Free plan.** Cloudflare's Bot Fight Mode page
(<https://developers.cloudflare.com/bots/get-started/bot-fight-mode/>, fetched 2026-09-10):

> You cannot bypass or skip Bot Fight Mode using WAF custom rules or Page Rules.

but

> Bot Fight Mode can still trigger if you have IP Access rules, but it will not trigger if an IP
> Access rule matches the request first.

So even on the cheapest tier the operator can allowlist a fixed source IP. This is the path that
actually fits: permission is already granted (2026-09-03), the blocker is a switch only the operator
can flip.

**2. WAF skip rules — on paid tiers.** <https://developers.cloudflare.com/waf/custom-rules/skip/>:

> Skip rules allow specific requests to bypass security features that would otherwise block or
> challenge them.

Action `Skip`, matched on IP, header or user agent.

**3. The Verified Bots programme — real, but not what people assume.**
<https://developers.cloudflare.com/bots/concepts/bot/verified-bots/>:

> A Verified bot is a bot or agent that Cloudflare has confirmed is transparent about who it is and
> what it does: it represents itself honestly and does not abuse the access that honesty earns.

Two bars to qualify:

> 1. **Honest self-identification** — it declares who it is deterministically, through a cryptographic
>    Web Bot Auth signature, a published IP list with a stable user-agent, or reverse DNS.
> 2. **Non-abusive behavior** — it obeys `robots.txt` and crawl directives, maintains reasonable
>    request rates, and has not been observed evading website owner preferences or attacking sites.

**Verification does not grant access.** Same page:

> Historically, Verified bots have been excluded in default bot configurations across all plans. Now,
> all customers have the option to configure AI bot policies to define their block vs. allow
> expectations.

It is a signal the site owner may act on. Web Bot Auth (Ed25519 HTTP Message Signatures, built on
IETF drafts, <https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/>) is
the modern way to satisfy bar 1, and is disproportionate for a single self-hosted media server.

### Verdict

**CONFIRMED** on the 403 and on "regardless of permission" — observed live 2026-09-10, and it is a
challenge rather than a block.

**JUDGEMENT, and the ticket needs one line changed.** "Do not route around it" is correct and should
stay. But the ticket reads as though the door is permanently shut, and it is not: the operator who
already granted permission can add an **IP Access Rule** (free tier) or a **WAF skip rule** (paid),
and separately a **MediaWiki bot flag**, which lifts `arvlimit` from 50 to 500 and is a tenfold
speedup on bulk export. Those are the sanctioned asks. An implementer reading only this ticket will
not know they exist, and the difference between "blocked forever" and "one email to the operator" is
worth a sentence.

Nothing here changes the design: CI still runs against the local archive, because a CI runner has no
stable IP to allowlist and a live wiki is not a test fixture.

---
## 6. TMDB rate limiting

Relevant because ADR 0069 and CNCORE-6 justify putting the wiki first on the grounds that it "needs
no key, no rate limit, no cache rule and no attribution string, so the contract gets defined against
a source we control rather than a rate-limited third party."

### What TMDB currently publishes — CONFIRMED

Source: *Rate Limiting*, <https://developer.themoviedb.org/docs/rate-limiting>, retrieved as
markdown from `https://developer.themoviedb.org/docs/rate-limiting.md` on 2026-09-10. The document's
own front matter: `updatedAt: 2025-10-20T14:41:49.000Z`. That is the **whole** of the page body:

> 📘 **Legacy Rate Limits**
>
> As of December 16, 2019, we have disabled the original API rate limiting (40 requests every 10
> seconds.) If you have any questions about this, please head over to our API support forum.
>
> While our legacy rate limits have been disabled for some time, we do still have some upper limits
> to help mitigate needlessly high bulk scraping. They sit somewhere in the 40 requests per second
> range. This limit could change at any time so be respectful of the service we have built and
> respect the `429` if you receive one.

So: **~40 requests per second, `429` when exceeded, and the limit is explicitly not a promise**
("could change at any time", "somewhere in the ... range").

Scope is not on the docs page. TMDB staff state it in the support forum
(<https://www.themoviedb.org/talk/5d34aec717792c0011bc9bd9>): Travis Bell (TMDB staff), 2019-07-21 —
*"rate limiting is only done by IP address. We don't take your API key into consideration"* — and
2024-09-24 — *"The only limit is a rough rate limit of ~40 requests per second by IP address."*

**Per IP, not per key.** For a self-hosted product that is the material fact: every instance behind
one NAT shares a budget, and the budget cannot be raised by issuing more keys.

The ticket's premise holds. A source we control has no such ceiling, and defining the contract
against it first is sound.

### What headers a 429 carries — UNFOUNDED

**No published header contract exists.** The rate-limiting page names no headers at all. The
pre-2019 `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` family went with the
legacy limit and is not documented anywhere current. Staff in the thread above confirm the 429 but
do not confirm `Retry-After`. Secondary sources assert both "50 requests per second / 20 connections
per IP" and "a `Retry-After` header"; neither is on a TMDB page, and the docs say 40, not 50.

An ordinary `api.themoviedb.org` response carries no rate-limit headers at all (observed 2026-09-10,
unauthenticated `HEAD /3/movie/550` → `HTTP/2 401`, `server: openresty`, `via: ... CloudFront`, no
`X-RateLimit-*`), so whatever appears on a 429 is emitted by the edge on that path only.

**What would settle it:** capture a real 429 with a valid key and record the response headers, then
write it down. Until then a client must treat `Retry-After` as *possibly absent* and carry its own
backoff. This is a concrete requirement for CNCORE-8, not for CNCORE-6.

---

## 7. Enforcing "CI never touches the network"

The claim under test, from CNCORE-6: *"CI runs against the local archive and never touches the
network."* Can that be enforced rather than asserted?

**Yes — at three independent layers, and the layers are not interchangeable.**

### Layer 1: the HTTP client's own mock — CONFIRMED

Node's global `fetch` is undici, and undici's `MockAgent` fails closed. From
`docs/docs/api/MockAgent.md` and `docs/docs/best-practices/mocking-request.md`
(<https://github.com/nodejs/undici>, via context7 2026-09-10):

> **`mockAgent.disableNetConnect()`** — Causes every request that is not matched by a mock
> interceptor to throw, disallowing real HTTP requests.

The error is specified and machine-checkable:

> **Class: `MockNotMatchedError`** ... `code` {string} Always `'UND_MOCK_ERR_MOCK_NOT_MATCHED'`.

with a message of the form `subsequent request to origin http://localhost:3000 was not allowed
(net.connect disabled)`. `enableNetConnect(matcher)` re-opens named hosts, so a local archive server
on `127.0.0.1` stays reachable while everything else throws. **This is the exact shape the ticket
asks for.**

**Trap worth stating in the ticket:** `nock` is the reflex choice and it is the wrong one here.
`nock.disableNetConnect()` patches `http`/`https` and therefore does **not** see `fetch`. nock's
undici support landed in v15 (`undici: basic support`, #2862), and v15 is still on the `beta`
dist-tag — `nock@latest` is **14.0.17** (2026-07-30), `nock@beta` is **15.0.0-beta.14** (2026-07-22),
checked on the npm registry 2026-09-10. A suite built on stable nock will silently make real network
calls from `fetch` while reporting that net connect is disabled.

MSW is the other credible option: `server.listen({ onUnhandledRequest: 'error' })` — documented as
*"Print an error and halt request execution"* (<https://mswjs.io/docs/api/setup-server/listen>);
`msw@2.15.0`, 2026-07-08.

### Layer 2: the Node runtime — CONFIRMED, but not on this project's Node

This is where memory would have been wrong. **Node's permission model now covers the network.**
<https://nodejs.org/docs/latest/api/permissions.html>, fetched 2026-09-10:

> When starting Node.js with `--permission`, the ability to access the file system through the `fs`
> module, **access the network**, spawn processes, use `node:worker_threads`, use native addons, use
> WASI, use FFI, and enable the runtime inspector will be restricted

and `--allow-net` (<https://nodejs.org/docs/latest/api/cli.html#--allow-net>):

> **Added in: v25.0.0** — Stability: 1.1 - Active development
>
> When using the Permission Model, the process will not be able to access network by default.
> Attempts to do so will throw an `ERR_ACCESS_DENIED` unless the user explicitly passes the
> `--allow-net` flag

with the documented failure:

> `Error: connect ERR_ACCESS_DENIED Access to this API has been restricted. Use --allow-net to
> manage permissions.`

`node --permission` with no `--allow-net` is a runtime-level "no network", below any library, and it
cannot be defeated by a test that reaches for a different HTTP client.

**The version catch, and it is decisive.** `--allow-net` was **added in v25.0.0** (PR
[nodejs/node#58517](https://github.com/nodejs/node/pull/58517), *"src,permission: add --allow-net
permission"*, merged 2025-06-17). It does not appear in `CHANGELOG_V24.md`. **Node 24 is the Active
LTS line and this machine runs v24.19.0** — so `--allow-net` is not available on the version this
project would ship on. It arrives on an LTS line with Node 27. Do not write it into CI today.

### Layer 3: the CI runner — CONFIRMED

`step-security/harden-runner` enforces egress at the runner, below the process.
<https://docs.stepsecurity.io/llms-full.txt>, fetched 2026-09-10:

> Your workflow has Harden-Runner configured with `egress-policy: block` and a list of
> `allowed-endpoints`. The workflow tried to reach an endpoint (domain + port) that isn't on the
> allowed list, so Harden-Runner blocked the connection to prevent potential data exfiltration.

and

> **When it triggers:** A workflow running with `egress-policy: block` attempts to reach a
> destination that is not on its allowlist, and Harden-Runner blocks the call.

The workflow **fails** — the remediation doc's own first step is "Open the failed workflow run in
GitHub". Latest release `v2.21.1`, 2026-08-30; GitHub-hosted Linux runners supported; free for
public repos. Note this repo is private, so check the tier before assuming it is free here.

`egress-policy: audit` records without blocking, which is the sensible first run: turn on audit,
read the baseline, then move to `block` with `allowed-endpoints`.

### Verdict and recommendation

**CONFIRMED.** The ticket's "never touches the network" is enforceable, not just assertable.

For this project today: **undici `MockAgent.disableNetConnect()` in the suite** (layer 1) plus
**`harden-runner` with `egress-policy: block`** in the workflow (layer 3). Skip `--allow-net` until
Node 27 LTS. Avoid `nock@latest` for anything that goes through `fetch`.

> **Superseded on the RECOMMENDATION, not the finding (CNCORE-50, 2026-09-11).** The dates
> and the version here were right and still are. "Skip it until the version arrives" was not:
> `--allow-net` is all-or-nothing -- it accepts an `=host` value and ignores it, measured in
> `node:26-alpine` -- so it can never express the gate's "closed, except loopback", on any
> major. It also requires `--permission`, which denies `worker_threads`, `child_process` and
> all filesystem access that Vitest needs. ADR-0103 now carries that reasoning and
> ADR-0112 the Node major.

---

## 8. Versions, dated

| Thing | Current value | As of |
|---|---|---|
| Node.js **Current** | **v26**, first released 2026-05-05, last updated 2026-09-09 | 2026-09-10 |
| Node.js **Active LTS** | **v24 "Krypton"**, first released 2025-05-06, last updated 2026-09-07 | 2026-09-10 |
| Node.js **Maintenance LTS** | **v22 "Jod"**, first released 2024-04-24, last updated 2026-07-28 | 2026-09-10 |
| Node.js on this machine | v24.19.0 | 2026-09-10 |
| OWASP SSRF Prevention Cheat Sheet | **No version number exists.** Latest commit `49b91f007e`, 2026-08-04; page `lastmod` 2026-09-08 | 2026-09-10 |
| Reconciliation Service API | **v0.2**, W3C CG Final Report, **2023-04-10**; v1.0 an unpublished CG-DRAFT, last commit 2026-07-15 | 2026-09-10 |
| undici | 8.10.2, 2026-09-04 | 2026-09-10 |
| `@atproto-labs/fetch-node` | 0.3.7, 2026-08-03 | 2026-09-10 |
| `nock` | latest 14.0.17 (2026-07-30); beta 15.0.0-beta.14 (2026-07-22) | 2026-09-10 |
| `msw` | 2.15.0, 2026-07-08 | 2026-09-10 |
| `step-security/harden-runner` | v2.21.1, 2026-08-30 | 2026-09-10 |
| TMDB rate-limiting doc | `updatedAt: 2025-10-20` | 2026-09-10 |

Node.js source: <https://nodejs.org/en/about/previous-releases>. Note its own statement:
*"Starting with Node.js 27, the release cycle will be annual and every major version will move to LTS
status after its six-month Current phase"*, and *"Production applications should only use Active LTS
or Maintenance LTS releases."*

---

## Summary

**21 claims checked: 15 CONFIRMED, 2 CONTRADICTED, 1 UNFOUNDED, 3 JUDGEMENT.** Two version questions
answered separately in §8.

### CONFIRMED (15)

1. OWASP's Case 1 (allowlist) / Case 2 (deny-list) split, and the ADR's mapping onto config vs
   content URLs — §1
2. The heading is exactly `## Deny-list (Last Resort)` — §1
3. The section opens *"Deny-lists are bypass-prone. Prefer allow-lists."* — §1
4. OWASP says "DNS pinning" three times and "DNS rebinding" never — §1
5. OWASP's own remedies are internal-DNS-first and allowlist monitoring, not connection pinning — §1
6. Re-validating at each hop does not close the gap; OWASP states the TOCTOU itself — §2
7. A current, maintained way to pin in Node exists and preserves SNI and cert validation, via the
   `lookup` hook (`@atproto-labs/fetch-node` 0.3.7) — §2
8. `169.254.169.254` is still the metadata address for AWS, GCP and Azure — §3
9. IMDSv2 requires a `PUT` and a token header, and mitigates *some* SSRF — §3
10. The Reconciliation spec's `versions` is an ARRAY of strings, not a single value — §4
11. Versioning was retrofitted at v0.2, and absence means v0.1, in the spec's own words — §4
12. The 0.2 manifest JSON schema does list `versions` under `required`, contradicting its prose — §4
13. tardis.wiki 403s any non-browser client regardless of permission — observed live — §5
14. TMDB publishes ~40 req/s, per IP, `429` on exceed — §6
15. A test runner can be made to fail on unexpected outbound network access — §7

### CONTRADICTED (2)

**C1. "Are there others that must also be denied?" — yes, and everyone involved missed them.** §3

AWS publishes `[fd00:ec2::254]` and GCP publishes `[fd20:ce::254]` as IMDS endpoints. Both are ULA
addresses in `fd00::/8`, not link-local. Neither the ticket, nor ADR 0034, nor **OWASP's own
published deny-list table** includes them; OWASP's IPv6 entries are only `::1/128` and `ff00::/8`. It
also omits `169.254.0.0/16` as a range, `fc00::/7` and `100.64.0.0/10`. Implementing OWASP's table
literally would ship an SSRF hole. **Fix: deny by IANA range classification — everything whose
`ipaddr.js` `range()` is not `unicast` — rather than by an enumerated CIDR list.**

**C2. ADR 0032's title says "absence means version 1"; the spec's rule is 0.1.** §4

Minor and cosmetic, but the ADR presents the W3C precedent as supporting the numbering as well as the
mechanism, and it does not. The mechanism claim is fully sound.

### UNFOUNDED (1)

**U1. What headers TMDB returns on a 429.** §6

TMDB's rate-limiting page names no headers. Staff confirm the `429` but not `Retry-After`. The
pre-2019 `X-RateLimit-*` family is undocumented now, and ordinary responses carry none. Secondary
sources assert `Retry-After` and "50 rps"; TMDB's own page says 40 and names nothing.
**What would settle it:** capture a real 429 with a valid key and record its headers. Until then a
client must not depend on `Retry-After` existing. This lands on CNCORE-8, not CNCORE-6.

### JUDGEMENT (3)

**J1. The ticket states the pinning requirement but not the mechanism.** §2 — There is one right way
(custom `lookup`) and several that pass tests with broken certificate validation (URL rewriting to an
IP). Naming the hook costs a clause.

**J2. `169.254.169.254` carries more rhetorical weight in ADR 0034 than the deployment warrants.** §3
— CanonCore is self-hosted on the owner's hardware; the live risk is the LAN, not a cloud metadata
service. Denying non-unicast covers both, so nothing changes in practice.

**J3. "Do not route around it" is right; "there is no sanctioned route" is not stated but is
implied, and is false.** §5 — Cloudflare documents IP Access Rules (which work even where Bot Fight
Mode cannot be skipped by WAF rules), WAF skip rules on paid tiers, and the Verified Bots programme
(a signal, not a bypass). Separately, a MediaWiki bot flag lifts `arvlimit` 50 → 500. The operator
who already granted permission can do all of these.

### Additional findings, not claims in either ticket

- **F1. OWASP twice says to disable redirect following entirely.** CNCORE-6 assumes redirects are
  followed and re-validated. That is a defensible departure, but it is a departure and should be
  written down as one. §1
- **F2. OWASP Case 2 requires checking *all* A and AAAA records, not the first.** With Node's
  `autoSelectFamily` defaulting to `true`, a pinning implementation that validates `address[0]` and
  returns the array is bypassable. §1, §2
- **F3. Normalise IPv4-mapped IPv6 before comparing**, or `::ffff:169.254.169.254` walks past an
  IPv4 deny-list. §2
- **F4. The Reconciliation spec's required/absent contradiction has moved into the 1.0-draft
  *prose*.** ADR 0032's decision is better founded than when it was written. A "Version Negotiation"
  section was landed and reverted on 2026-07-15. §4
- **F5. `nock@latest` does not intercept `fetch`.** Its undici support is on the `beta` tag only. A
  CI gate built on it would report "net connect disabled" while making real calls. §7
- **F6. `--allow-net` is Node 25+**, so it is unavailable on the Node 24 Active LTS line this project
  runs. ~~Do not write it into CI before Node 27.~~ **Do not write it into CI at all** -- the flag
  cannot express this gate on any major (CNCORE-50; see §7 and ADR-0103). §7

### Does either ticket need editing before it is worked?

**CNCORE-6 — yes, three small edits.**

1. **Add the IPv6 metadata endpoints, or better, change the rule.** Replace "deny-list" as an
   enumerated CIDR list with "deny anything that is not a unicast address by IANA classification".
   This is one line and it closes C1, F3 and the `fd00::/8` gap at once.
2. **Say how to pin.** Add: pin via the client's custom DNS `lookup` hook, validating every returned
   address; do not rewrite the URL to an IP.
3. **Say that a sanctioned route past Cloudflare exists and that we are choosing not to need it.**
   One sentence naming IP Access Rules / a bot flag as operator-side asks, so nobody re-derives this.

**CNCORE-7 — no.** Its `browse` and `versions` claims rest on ADR 0032 and 0033, both of which
verified clean. Its acceptance criteria are internal to the data model and were not in scope here.
The only ADR correction touching it is C2, which is a wording fix to ADR 0032's title and changes
nothing CNCORE-7 asks for.

**ADR 0034** should absorb C1, F1 and F2. **ADR 0032** should absorb C2 and F4.
