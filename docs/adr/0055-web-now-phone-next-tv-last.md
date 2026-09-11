---
status: proposed
---

# Web now, phone next, TV last

Next.js ships first and nothing in the first version is gated on the apps. The phone app is the
cheaper of the two, because the TV app carries tvOS focus-engine work and a UIKit budget it does not.

This ORDERING is untouched by ADR-0108, which settles what web IS: the server's own face, served at
the server's origin, rather than a fourth client pointed at it. The phone and the TV take a server
URL; web does not, because it is the server. The asymmetry is deliberate and it is what lets one
cookie authenticate every surface.

Know what this is chosen against. Across ten comparable projects the highest-leverage client work by
a wide margin was implementing an EXISTING CLIENT PROTOCOL rather than writing an app: Komga shipped
OPDS at day 34 and has still not written a first-party app seven years on; Navidrome implemented
Subsonic from its second commit. Five of the ten never built an app at all, and two of those are the healthiest
projects in the set.

The apps are being built anyway, deliberately, because demonstrating them is a stated goal.
ADR-0107 names the audience that sentence left unstated, and makes it a requirement rather than a
preference.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-products.md`.
