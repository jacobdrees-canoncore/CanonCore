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
