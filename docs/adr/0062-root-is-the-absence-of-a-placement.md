---
status: accepted
---

# Root is the absence of a placement, not a parentless one

An item is at the root of a container tree when it has no placement row, rather than having a
placement whose parent is null.

Nothing can distinguish a parentless placement from a real one, so the null form makes root
undetectable. Pre-deleting parent edges on delete exists for the same reason: `ON DELETE SET NULL`
would otherwise turn survivors into phantom roots.
