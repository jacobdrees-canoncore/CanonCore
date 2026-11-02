# untitled.stream and Apple Music are both design references, picked per block and per screen

CanonCore's design draws on two references, and neither leads: untitled.stream, through its web replica and its app replica (`~/canoncore/untitled-replica` and CC-36), and Apple Music, through the Owner's recreation AppleMusic27 (`jacobrees-applemusic/AppleMusic27`, at `~/orca/projects/AppleMusic27`, in its own private organisation and Linear workspace). Arc's look (ADR 0023) stays a third contender. The web prototype (CC-38) picks per block and per screen at the end of its phase 2, and picks combine freely: one block may take untitled's structure, Apple Music's motion and Arc's type. Every block's grill asks the Owner about Apple Music, and Apple Music, Plexamp, Spotify, Feishin and Finamp join every block's competitor study. The frosted folder (`docs/design/folder.md`) is one take among the others, not a signature component: a folder stays a presentation any grouping may use, never a domain term. This supersedes ADR 0020 whole (the Owner, 2 Nov 2026), because a fixed lead left every block where Apple Music or Arc does better to an exception, while a pick per block and per screen settles each conflict where it arises.

AppleMusic27's code may be ported into the design prototype as takes, rewritten for its stack, and its SwiftUI half into the Apple prototype (CC-39) on the same rule; whether any of it reaches CanonCore is decided by the picks. Apple has given the Owner its permission, bundling SF fonts included (the Owner, 2 Nov 2026), so Apple-measured values are free in both prototypes, and in CanonCore each pick decides whether a value is Apple's or Arc's.

## Considered Options

- untitled leads, the folder as its signature component (ADR 0020, 30 Sep 2026): superseded, as above.
- Both as equal foundations, split by job: rejected on 30 Sep 2026 (ADR 0020), because a fixed split leaves every conflict between them open; a pick per block and per screen does not.
- A fixed rule per block for how Apple Music enters: rejected, so each block's grill asks.

## Consequences

- Ship rules: Apple's logos, artwork and code copied from Apple's own apps never ship in CanonCore, whatever the permission covers in the prototypes; Apple's sample code under MIT or AML stays as ADR 0019 accepts it. App Review guideline 5.2.5 is checked at the Apple prototype (CC-39). The brand at public release (CC-8) gives CanonCore its own colour and mark.
- Third-party code inside AppleMusic27 (GPL MeloX meshes, and the code its ADR 0003 lists as unlicensed) is free in the private prototypes and reaches CanonCore only through ADR 0019's licence rule.
- CanonCore is adapted from untitled, never a copy of it. untitled's terms forbid derivative works and the Owner's permission is verbal, so anything drawn by untitled (artwork, icons) and its licensed fonts (Klim's Untitled Sans) stay out. On the web the type is Arc's, Geist and Inter at weights 400 and 500, until the web prototype's type verdict (ADR 0023).
- AppleMusic27 lives outside `~/canoncore/`, an exception ADR 0022 records.
- If the folder is picked: its code reaches the public repo only once its source carries a licence (ADR 0019); the web runs Motion's duration-based springs and the Apple app a port of Motion's spring (`folder.md`); on Apple TV the folder's own fan is its focus signal, with no system lift (CC-60's verdict in `folder.md`), and the first real-remote judgement is the Apple prototype's (CC-39).
