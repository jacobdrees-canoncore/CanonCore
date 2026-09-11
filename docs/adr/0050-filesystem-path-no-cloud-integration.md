---
status: proposed
---

# Build against a filesystem path; document rclone rather than integrating cloud storage

No self-hosted media app has a native cloud integration, and a cloud provider's file-scoped
permission grants no access to pre-existing children, so the obvious design is not implementable as
usually specified.

**A RENTED BOX SATISFIES THIS RECORD RATHER THAN VIOLATING IT.** The target above is a cloud
provider's file-scoped permission API, not a machine somebody else owns: `/mnt/data` on a rented
server is an ordinary POSIX path, indistinguishable from `/mnt/data` at home, and ADR-0109 makes that
the deployment shape. The half of this record that survives into that shape is the paragraph below,
and over a network mount it applies more rather than less.

Do not assume filesystem change notifications fire either: Plex's own documentation says content
mounted via a network "will also typically not work", and the same is reported for FUSE mounts.
Plex's remedy is the one we adopt — "you may have to set a periodical scan or do it manually".

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-plex.md`.
