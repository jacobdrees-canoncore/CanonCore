---
status: accepted
---

# Two outbound boundaries, split by who supplied the URL

A CONFIG URL is one the owner typed into settings — a provider base URL. That is OWASP's Case 1, an
identified and trusted destination, so it is checked against an ALLOWLIST of exact hosts and CIDRs
with no wildcards. A CONTENT URL arrives inside a provider's response or a redirect, and gets the
deny-list with NO EXCEPTION EVER.

DENY BY RANGE CLASSIFICATION, NOT BY AN ENUMERATED CIDR LIST — refuse any address whose `ipaddr.js`
`range()` is not the `unicast` catch-all. Implementing OWASP's own published table literally ships a
hole: it lists only `::1/128` and `ff00::/8` for IPv6, while AWS publishes `[fd00:ec2::254]` and GCP
publishes `[fd20:ce::254]` as live metadata endpoints. Both are ULA in `fd00::/8`, which that table does not
cover, and it also omits `fc00::/7`, `169.254.0.0/16` as a range, and `100.64.0.0/10`. Classification
catches all of them and the next one too.

`unicast` IS NOT IANA'S WORD, and an earlier version of this record said it was. IANA's IPv4
Special-Purpose Address Registry classifies by Source, Destination, Forwardable, Globally Reachable
and Reserved-by-Protocol, and `unicast` appears nowhere in it. The word is `ipaddr.js`'s: the
catch-all its `range()` returns when no named special range matched. Measured against ipaddr.js 2.5.0
on 2026-09-10 — `100.64.0.1` → `carrierGradeNat`, `192.168.1.10` → `private`, `8.8.8.8` → `unicast`.
The mechanism is unchanged and still correct; only the authority cited for it was wrong. Name the
vocabulary you are actually using, because the next reader will go looking for it in the registry.

DO NOT "FIX" THIS BY RESTATING THE RULE IN IANA'S TERMS. "Refuse any block whose Globally Reachable
value is False" is the obvious repair, it reads as more rigorous than naming a library, and it SHIPS
THREE HOLES — each read straight off `iana-ipv4-special-registry-1.csv` on 2026-09-10:

- `224.0.0.0/4` IS NOT IN THAT REGISTRY AT ALL. Multicast lives in the separate IPv4 Multicast Address
  Space Registry, so the rule never sees it.
- `192.88.99.0/24` carries an EMPTY Globally Reachable value rather than `False`, so an equality test
  misses it.
- `127.0.0.0/8` carries the literal string `False [1]` — a footnote marker inside the field — so a
  naive `=== "False"` LETS LOOPBACK THROUGH.

A fourth case fails the same way for a different reason: `192.0.0.9/32`, `192.0.0.10/32`,
`192.31.196.0/24` and `192.175.48.0/24` are Globally Reachable `True`, so that rule would ADMIT them
while the library refuses them. Every one of these four is the IANA rule being LOOSER — three by not
seeing the block at all, one by affirmatively marking it reachable — and for an SSRF deny-list
stricter is what you want. This is the same trap the OWASP paragraph above describes, arriving
through a different door, which is why the rejection is recorded here rather than left for someone to
rediscover as an improvement.

A CONSEQUENCE WORTH STATING, because it otherwise reads as a bug: Tailscale's addresses are
`100.64.0.0/10`, so they classify as `carrierGradeNat` and are REFUSED in content. That is correct —
response content is untrusted whatever network it names. A provider reached over a private network is
a CONFIG URL, so it goes on the allowlist above, deliberately and by name. `127.0.0.0/8` is `loopback`
and equally not `unicast`, so localhost is not exempt either. This matters most for the wiki provider,
which ADR-0089 pins to one person and which can never be distributed.

The single boundary denied the very provider the stop condition requires, and it picked the wrong
control: OWASP files the deny-list under "Deny-list (Last Resort)" and opens it "Deny-lists are
bypass-prone. Prefer allow-lists." GitLab ships almost exactly the allowlist shape.

The no-exception half is load-bearing: an allowlisted private provider that is compromised or
merely buggy must not redirect the fetcher onto 169.254.169.254.

Both boundaries resolve the hostname once and PIN THE CONNECTION to the resolved address, because
re-validating at each redirect hop does not stop a host that resolves differently on the second
lookup. OWASP names the attack "DNS pinning" and never uses the phrase "DNS rebinding"; its own
remedies are internal-DNS-first and allowlist monitoring, so connection pinning is our design rather
than a quotation from it. Check EVERY A and AAAA record rather than the first, which matters because
Node's `autoSelectFamily` now defaults to true.

WE ALSO DEPART FROM OWASP ON REDIRECTS, deliberately. It says twice to disable redirect following
entirely; we follow and re-validate each hop, because a provider that redirects is ordinary and
refusing it would break real sources. Written down as a departure rather than left as an omission.

Cite the cheat sheet by commit and date, not by version: it carries no version number, and the
deny-list section quoted here was only added on 2026-01-05.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-standards.md`, `docs/research/verify-adr-products.md`.

The `unicast` attribution was corrected on 2026-09-10 against
`https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry-1.csv` and
against ipaddr.js 2.5.0, both read directly rather than recalled.

WHERE THE DRIFT CAME FROM, since it is tempting to blame this record alone:
`docs/research/validate-cncore-6-7.md` carries it too, and carries it first — "deny everything whose
IANA range is not `unicast`, via `ipaddr.js`'s `range()`" (§2) and "deny by IANA range classification
— everything whose `ipaddr.js` `range()` is not `unicast`" (C1). It named the right mechanism and the
wrong authority in the same sentence, and this record inherited the second half. That file is left
unedited on purpose — `docs/research/README.md` says its citations "are left as they were written",
because editing research to match a later correction falsifies the record of what was known when. So
do not read it as the clean source for this rule; read this record.

## As built, under CNCORE-6

Both boundaries are `@canoncore/providers`, and the split is two DISPATCHERS rather than one
switchable rule: a single agent's `lookup` hook cannot tell which hop it is on, so the config agent
and the content agent are separate objects and the client hands the second one to every hop after
the first.

THE CONFIG BOUNDARY CHECKS TWICE, and the second check is the one this record's prose does not spell
out. The host check asks whether the owner named this destination. The ADDRESS check, inside the
pinning hook, asks what the socket is about to connect to -- which is DNS's answer rather than the
owner's. Without it an allowlisted HOSTNAME resolving to `169.254.169.254` connects, and the host
check cannot see that by construction. An address passes when it is `unicast` OR sits in an
allowlisted CIDR, and it is the second half that makes `127.0.0.0/8` and `100.64.0.0/10` reachable
by name.

A WILDCARD ENTRY THROWS AT PARSE TIME rather than being read as a literal host. "No wildcards" was
already this record's phrasing; what implementation added is that silently keeping one leaves the
owner believing a whole domain is reachable when none of it is.

MEASURED AGAINST ipaddr.js 2.5.0 ON 2026-09-10, every case this record names: `169.254.169.254`
`linkLocal`, `fd00:ec2::254` and `fd20:ce::254` `uniqueLocal`, `100.64.0.1` `carrierGradeNat`,
`127.0.0.1` and `::1` `loopback`, `224.0.0.1` `multicast`, `192.88.99.1` and `192.0.0.9` `reserved`,
`8.8.8.8` and `2606:4700:4700::1111` `unicast`. Two the record does not name and the implementation
now relies on: `::ffff:127.0.0.1` is `ipv4Mapped` and `0.0.0.0` is `unspecified`.

AND ONE CONSEQUENCE WORTH STATING, because it reads as a bug otherwise: `::ffff:8.8.8.8` is also
`ipv4Mapped`, so a mapped IPv4 address is refused in content EVEN WHEN the address it embeds is
ordinary. That is the rule being stricter than strictly necessary, which for a deny-list is the
right direction, and it is deliberate rather than an oversight in the classification.

`net.getDefaultAutoSelectFamily()` was measured rather than recalled: `true` on Node v24.19.0, with
a 250ms attempt timeout. So the connector really does walk every address until one answers, and
checking only the first really would hand it an unchecked address.

ONE THING IS BUILT AND UNTESTED, and it is a limit of the test bench rather than of the code: NO
TEST EXERCISES A REDIRECT HOP THAT IS ALLOWED. Every address a test can reach is loopback, and
loopback is refused in content by this record's own rule, so the passing path is unreachable without
real egress. What the tests do prove is that the hop is READ AND JUDGED rather than merely
un-followed: each refusal names the target it refused, which a client that simply returned the 302
could not do.

A CONSEQUENCE OF THE NO-EXCEPTION RULE, discovered by building it: A PROVIDER ON LOOPBACK CANNOT
REDIRECT AT ALL. Its base URL is legal by allowlist and any hop it returns is content, so the hop is
refused. The wiki provider does not redirect and nothing here is blocked by it, but a later provider
reached over a private network will meet this, and it will look like a bug until it is read against
this paragraph.

THE "LATER PROVIDER REACHED OVER A PRIVATE NETWORK" ARRIVED, AND IT IS NOW THE ORDINARY CASE RATHER
THAN A LATER ONE. Under CNCORE-163 the install path creates a Docker network for Providers the Owner
runs beside their install ([[0122-a-provider-declares-the-credential-it-needs]]), so such a Provider
answers on a container address, which `ipaddr.js` classifies `private`. **NOTHING IN THIS RECORD
CHANGES**: the two-check design already covers it, and the address passes on the second check exactly
as `127.0.0.0/8` does, because the Owner allowlisted the CIDR. What is new is the FREQUENCY. The host
check and the address check take DIFFERENT ENTRIES for one Provider — the container hostname for the
first, the network's range for the second — so an allowlist holding only the name admits the Provider
and then refuses the socket, and that is now the commonest way to misconfigure one rather than a case
a reader has to imagine. The README's install section is where an Owner meets it.

**AND THE REFUSAL SENT THAT OWNER BACK TO DO THE ONE THING THAT CANNOT WORK -- under CNCORE-244.**
It ended "a provider on a private network goes on the allowlist by name (ADR-0034)", which is this
record's own phrasing and reads, to somebody setting this up for the first time, as "put the host's
name on the allowlist". They have already done that: it is why the host check passed and why the
ADDRESS check is the one refusing them. Measured on a blank instance on 2026-09-20 with
`provider-wiki` reachable on `canoncore_providers` -- an allowlist of `provider-wiki` was refused
with that sentence, and `provider-wiki, 172.19.0.0/16` imported 465 Containers. The Owner's own
install carries both entries, so only a first-run walk could reach it.

**THE SENTENCE CAN NAME BOTH HALVES BECAUSE THE FIRST HAS ALWAYS PASSED BY THE TIME IT THROWS, and
that is a fact about the two-check design rather than a guess about the reader.** `assertConfigUrl`
refuses an unallowlisted host before any socket opens, and a base URL whose host is a literal ADDRESS
is matched against the ranges there and never reaches the lookup hook at all. So every refusal
`assertConfigAddress` raises is one where the Owner allowlisted the NAME and not a CIDR. It now says
that half is done and quotes the half that is missing.

**IT QUOTES A SINGLE ADDRESS, AND BOTH OBVIOUS WIDENINGS SHIP A HOLE** -- the same trap as restating
the deny rule in IANA's terms, arriving through the remedy instead of through the check. Zeroing the
low bits to offer `172.19.0.0/16` is the more useful-looking suggestion, and it turns `::1` into
`::/64`, which covers every IPv4-MAPPED address: the refusal would be telling the Owner to allowlist
`::ffff:169.254.169.254`. Reading the enclosing block out of ipaddr.js's own `SpecialRanges` fails
identically, because `ipv4Mapped` is `::ffff:0:0/96`. Measured against ipaddr.js 2.5.0. An allowlist
is narrowed by preference -- this record already quotes OWASP's "Deny-lists are bypass-prone. Prefer
allow-lists." -- so the refusal offers `::1/128` and `172.19.0.3/32`. The README's install section is
where the Owner is told to read the network's own range off `docker network inspect` instead, which
is the entry that survives the network being recreated.

**THE SAME CLAUSE SAT ON `assertConfigUrl`'S BARE-ADDRESS REFUSAL AND MOVED WITH IT.** CNCORE-244
names only the address check, and correcting that one alone would have left the identical sentence
standing in the function next door -- where it is wronger still, because a base URL that IS an
address never consults the hostname set, so there is no name half to name and a CIDR is the whole
remedy rather than the missing half of one.


## A THIRD PLACE A URL IS JUDGED, and it is not a third boundary -- under CNCORE-79

This record splits URLs by WHO SUPPLIED THEM and judges both in front of a socket. CNCORE-79 found a
URL that is judged before either boundary sees it and that no socket is ever opened for: a CMPP
record's `url`, which is read out of a provider's response and rendered to the Owner as a link.

**IT IS A CONTENT URL BY THIS RECORD'S OWN DEFINITION -- it arrives inside a provider's response --
AND `assertContentUrl` IS THE WRONG RULE FOR IT.** That function carries the address deny-list with
it, so it refuses `http://127.0.0.1:8080/1`. That is an ordinary self-link from a provider the owner
runs on their own machine, and the paragraph above makes such a provider legal BY NAME. Applying the
content rule at the parse would refuse a legal deployment's own links, and it would do it while
looking like the more rigorous choice.

**THE TWO RULES ANSWER DIFFERENT QUESTIONS ABOUT ONE URL, and the split is which process acts on
it.** The address rule asks what THIS SERVER may open a socket to, and it is about SSRF: reaching a
metadata endpoint the owner never named. Nothing fetches a record's `url` -- so the address question
is not that field's to ask, and it stays where it is, in front of the fetch. What the field does
decide is what the READER'S BROWSER is handed, and that is settled by the SCHEME alone: a
`javascript:` or `vbscript:` URL executes, a `data:` URL is a document with its own origin, a `file:`
URL reads the reader's disk. So the schema states the scheme rule and the boundaries go on stating
the address rule. **THIS IS THE SAME SHAPE AS THE `attribution.logo` DECISION under ADR-0036**, where
the bytes travel inline precisely because the fetcher is the reader's browser and not this app: the
question is always which process acts, never what the value looks like.

**AND DO NOT "FIX" THIS WITH `z.httpUrl()`, which is the obvious repair and ships a hole of the
opposite kind.** zod's own helper checks the scheme AND requires the hostname to be a dotted name,
so it refuses an ADDRESS LITERAL and a SINGLE-LABEL HOST -- the very deployments the allowlist above
exists to make legal. Measured against zod 4.5.4 rather than reasoned about: `z.httpUrl()` refuses
`http://127.0.0.1:8080/1`, `http://192.168.1.5/1`, `http://[::1]/1` and `http://localhost/1`, and
ADMITS `http://nas.local/1`. An earlier draft of this paragraph named `nas.local` among the
refusals and was wrong -- a dotted private name passes zod's host rule, and only the address-literal
and single-label halves are refused. The hole is real and is narrower than first written. It reads as stricter and is simply wrong here, in the same way
that restating the address rule in IANA's terms reads as more rigorous and lets loopback through.
Both traps are a plausible tightening applied to the wrong question, which is why they are recorded
together. The rule CMPP's URL fields take is [[0033-search-lookup-required-browse-optional]]'s: the
scheme is HTTP or HTTPS, and the host is not this field's business.

**WHAT IS UNCHANGED.** Both boundaries, their split, the deny-by-classification rule, the pinning
hook. Nothing above moved; this section adds a place a URL is read that has no socket behind it, and
records why the boundary's own function is not what guards it.

**A FOURTH URL, AND THE TRAP IT SETS FOR A LATER SURFACE -- under CNCORE-99.** A provider's BASE URL
is now a Setting the Owner types into a page and this catalogue stores
([[0121-an-instance-names-its-providers-beside-the-allowlist-that-admits-them]]). What validates it
on the way in is `parseProviderUrls`, and that record states plainly what it asks: only whether the
entry IS a URL, because its scheme and its host are `assertConfigUrl`'s questions, asked in front of
the request. **So `javascript:alert(1)` is a storable Setting.** It is not a hole today and the
reason is worth writing down rather than rediscovering: it is written by the OWNER through
`ownerProcedure`, who already holds the write path; nothing fetches it without `assertConfigUrl`,
which carries `assertHttpScheme`; and every surface renders it as TEXT -- `/settings` and `/import`
print it and put it in a `data-` attribute, both escaped by React.

**THE DAY ONE OF THEM RENDERS IT AS A LINK, IT IS STORED XSS**, and that surface owes it the SCHEME
RULE this section already states for a record's `url` -- HTTP or HTTPS, checked where the reader's
browser is what acts on the value. Do not repair it by tightening `parseProviderUrls` instead:
ADR-0121 refuses that in its own words, because the scheme asked in two places is two rules that
drift, and the fetch boundary is the one with a socket behind it. Raised by review on CNCORE-99 and
recorded here rather than fixed, because there is no `href` to fix.
