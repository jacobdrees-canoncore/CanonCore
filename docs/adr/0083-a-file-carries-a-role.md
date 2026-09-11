---
status: proposed
---

# A file carries a role, and a sidecar names the file it accompanies

Files carry a role: `media`, `subtitle` or `audio`. A sidecar references the file it accompanies
plus a language.

This keeps Edition meaning "a different version of the work" rather than "a different file": one
video plus two subtitle tracks is ONE thing to watch, whereas a second cut is a second edition. It
is the distinction ADR-0064 rests on, expressed
in the file table rather than argued at every scan.

The list is closed at three values. An earlier draft carried four; three is the resolution, and
reopening it is how a role column becomes a second edition axis.
