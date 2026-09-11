---
status: proposed
---

# CanonCore is non-commercial

**This record governs CONDUCT, and only conduct.** The software, the self-hosted instances and the
one public demo are all non-commercial: no sale, no subscription, no advertising, no selling
traffic. **It does not decide the licence CanonCore's own source is offered to others under, and
nothing upstream obliges one** — the sections below exist because this record was read as settling
that too, and the reading is wrong in a way that would cost something.

This is recorded as a decision rather than left as a fact about today, because it is what makes
several third-party sources usable at all and reversing it breaks them together rather than one at a
time.

The Cover Art Archive's metadata is CC BY-NC-SA 3.0, not CC0 as an earlier draft had it, and its
NonCommercial term is satisfied only by this — **satisfied by not charging, which is a constraint on
how CanonCore may use CAA'S DATA and not a term on the code CanonCore writes.** That licence asks
for two further things, attribution and share-alike (`docs/demo.md`), and all three sit on the same
side of the line: each governs the use of CAA's work, and none of them reaches an outbound licence.
An inbound NonCommercial condition and an outbound licence are separate instruments over separate
works. The archive's own text is CC BY-SA 3.0 Unported, and its images are permitted separately and
personally (ADR-0057). TMDB treats a "'destination' website ... or for driving traffic" as
commercial use requiring a separate written agreement, judged "in its sole discretion" (ADR-0036) —
so this record states our posture, and does not settle TMDB's question for it.

Going commercial later is therefore not a pricing decision. It is a re-licensing exercise across
every connected **inbound** source, never across CanonCore's own code, and at least one of them
(CAA) has no commercial path at all.

## The outbound licence is a separate question, and it is now ANSWERED for CanonCore

Under what licence CanonCore's own source is offered to others is not answered HERE, and for as
long as all three repositories were private it was not owed an answer at all, because there was
nobody to answer it to. **That held until 2026-09-11 and holds no longer for CanonCore**, which is
decided to go public: [[0113-the-source-licence-is-agpl]] answers it as `AGPL-3.0-or-later`. It
remains unanswered, and unowed, for the two provider repositories.

**No LICENSE file is needed while the repositories are private, and the reason is the opposite of
the usual worry.** GitHub: *"You're under no obligation to choose a license. However, without a
license, the default copyright laws apply, meaning that you retain all rights to your source code
and no one may reproduce, distribute, or create derivative works from your work."* The view-and-fork
right cited against that is conditioned on publishing, twice over in Terms of Service section D.5 —
*"By setting your repositories to be viewed publicly, you agree to allow others to view and 'fork'
your repositories"*, and *"By making a repository public, you grant other Users a nonexclusive,
worldwide license"*. `provider-wiki` and `provider-tmdb` are private and stay so
([[0089-provider-distribution-tiers]]); **CanonCore is private today and is decided to go public**,
which is what moved its half of this section. So the state for the two that remain private
is ALL RIGHTS RESERVED WITH NOBODY TO RESERVE THEM AGAINST — maximally restrictive and entirely
coherent — and adding a licence now would grant rights to an audience that cannot reach the code to
exercise them.

**The question becomes live at exactly one moment: the first time any of these repositories is made
public** — and CanonCore is decided to reach it. [[0113-the-source-licence-is-agpl]] answers it
ahead of the flip rather than at it, which is the right order: the licence has to be chosen before
the repository is published, not discovered afterwards. For `provider-wiki` and `provider-tmdb` the
question is still not live, and [[0089-provider-distribution-tiers]] is what keeps it that way.

**ADR-0089 does not decide it, and borrowing its answer is the error to avoid.** That record governs
DISTRIBUTION — bundling, the store, being pointed at by another instance, and the container image —
and its licence rule pins the wiki provider to tier 3 because permission was granted to one person.
Publishing that repository would hand over the very source the image rule protects, so the rule
plainly reaches it: but ADR-0089 states no rule about repository visibility, and that inference is
drawn HERE rather than quoted from there. Nor does `provider-tmdb` have a trigger to borrow. Its
named one — *"the named trigger to revisit it is tier 2's CMPP store becoming real"* — revisits its
IMAGE privacy, which ADR-0089 records as a choice rather than the licence rule operating. Reading it
as a trigger to publish a repository carries an instrument across works, which is the mistake the
top of this record exists to correct.

## SUPERSEDED: the instrument was recorded here as PolyForm Noncommercial, and is AGPL-3.0-or-later

**This section is superseded by [[0113-the-source-licence-is-agpl]] and is kept because the working
is sound and the reversal should be visible as a reversal.** What it did not weigh is the discovery
clock: awesome-selfhosted lists Free and Open-Source software only, so the not-open-source property
this section correctly identifies below would have cost the listing the release staging is argued
from. The paragraph beginning "AND IT IS NOT OPEN SOURCE" is why this was reversed, not an
objection someone raised against it.

Nothing in the reversal touches the top of this record. Non-commercial CONDUCT stands unchanged;
what changed is only which instrument the outbound licence uses, and this record already
established that no inbound term reaches that question.

The working as it stood, so the next reader inherits it rather than re-deriving it.
`PolyForm-Noncommercial-1.0.0` is drafted for software, short, plain-language, and SPDX-identified
so GitHub and tooling can name it. Its grant is *"The licensor grants you a copyright license for
the software to do everything you might do with the software that would otherwise infringe the
licensor's copyright in it for any permitted purpose"*, and its scope is *"Any noncommercial purpose
is a permitted purpose"* — spelled out to cover *"personal study, private entertainment, hobby
projects, amateur pursuits"* and any *"charitable organization, educational institution, public
research organization ... or government institution ... regardless of the source of funding"*.

**AND IT IS NOT OPEN SOURCE, which is a property to accept knowingly rather than discover.** The
Open Source Definition 1.9, clause 6: *"The license must not restrict anyone from making use of the
program in a specific field of endeavor. For example, it may not restrict the program from being
used in a business, or from being used for genetic research."* Any licence forbidding commercial use
fails that clause, and PolyForm Noncommercial does not appear on OSI's approved list. The project
would be source-available, readable and freely self-hostable, but it could not be called open source
and would not pass anywhere OSI approval is the gate.

**Not a Creative Commons licence, and that is Creative Commons' own instruction.** They *"recommend
against using Creative Commons licenses for software"*, the first of their three reasons being that
*"CC licenses do not contain specific terms about the distribution of source code, which is often
important to ensuring the free reuse and modifiability of software"*; the others are that software
licences address patent rights, and that CC licences are *"currently not compatible with the major
software licenses"*. Reaching for CC BY-NC because the upstream CAA data is CC BY-NC-SA would carry
an instrument across a boundary its own author says not to cross — the same conflation the top of
this record corrects, running in the other direction. CC0 is the documented exception, and CC0 is a
public-domain dedication: the opposite of a non-commercial term.

**Not BUSL 1.1 or Elastic 2.0 either.** Both are source-available and both exist to defend a
COMMERCIAL product. BUSL restricts production use until a Change Date on which it converts to an
open licence, and says of itself *"The Business Source License ... is not an Open Source license"*;
Elastic 2.0 forbids providing the software *"to third parties as a hosted or managed service"*.
Neither expresses "this will never be commercial". They express "this is commercial and is defending
itself", which is the opposite posture to the one at the top of this record.

## Evidence

The licensing sources were read on 2026-09-11: GitHub's "Licensing a repository" page and Terms of
Service section D.5, the Open Source Definition version 1.9, the PolyForm Noncommercial 1.0.0 text,
OSI's approved-licence list, Creative Commons' FAQ on software, the Business Source License 1.1 and
the Elastic License 2.0. The three repositories' private visibility was read from the forge the same
day with `gh repo list jacobdrees-canoncore --json name,visibility`. Wider working is in
`docs/research/ci-and-repo-standards.md` §7, which is evidence and decides nothing; the shape was
Jacob's on 2026-09-11. ADR-0089 was re-read on the same day, and the paragraph above says what it
does and does not settle because a first draft of this record had it deciding both halves.

One claim was deliberately left out for want of an owner. The working this came from also called
PolyForm Noncommercial "not listed as FSF Libre", and the FSF's own licence list was not read, so
that is unchecked rather than established and is not asserted here. Clause 6 is what the
not-open-source conclusion rests on, and that was read at the source.
