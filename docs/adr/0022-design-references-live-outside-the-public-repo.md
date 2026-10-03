# Recreations and the design prototype live outside the public repo

Every recreation (untitled.stream's web replica and its iPhone and Mac apps, the Mac app added on 3 Oct 2026 by CC-36, Brink; MD Vinyl, America.gov and the tvOS recreation were dropped on 3 Oct 2026, their specs CC-35, CC-40 and CC-34 canceled) and the design prototype live in their own repositories under `~/canoncore/`, each with a private GitHub remote as a backup, and never in CanonCore's repository. This is because CanonCore's repository is public (`gh repo view`, 2026-09-30), so anything pushed to it, a branch included, is published. These works reproduce other people's products, whose terms may forbid derivative works (untitled's do, and its permission is verbal). They may hold code not yet licensed for the AGPL (ADR 0019), and the prototype's data snapshot carries Providers' artwork fetched with the Owner's personal keys. Only what the prototype decides reaches CanonCore's main branch: DESIGN.md, the verdicts on each spec, and the picked variants described in words and tokens.

## Considered Options

- The prototype on a `prototype/design` branch of CanonCore (D-66 of the first grill): rejected, because on a public repository a pushed branch is a publication.
- Local repositories with no remote, as untitled's replica began: rejected, because a dead disk would lose weeks of work.
- One shared repository for every recreation: rejected in favour of one each, so each keeps its own tooling and none waits on another's.
