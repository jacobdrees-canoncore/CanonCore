# Post-spec retrospective practice — what an audit of finished work is owed, and what it must not become

Checked 2026-09-20 for the design of a `/retro` skill, against the sources that own each claim: the
November 2020 Scrum Guide (`scrumguides.org`), Google's SRE book chapter 15 and the 2018 SRE
Workbook chapter on postmortem culture (`sre.google`), Atlassian's own Sprint Retrospective play
(`atlassian.com/team-playbook`), the Agile Manifesto's twelve principles
(`agilemanifesto.org/principles.html`), the Agile Alliance glossary, Michael Nygard's 2011-11-15
post, `adr.github.io` and its MADR 4.0.0 template, AWS Prescriptive Guidance on the ADR process,
`npryce/adr-tools`, Joel Parker Henderson's `architecture-decision-record` README (v3.2.0, updated
2025-05-29), the ThoughtWorks Technology Radar entry, `mattpocock/skills` at commit `c55ee46`, and
Anthropic's Agent Skills overview. Read alongside this repository's own state, measured the same
day: 139 records in `docs/adr/`, and their citation graph.

Two things were checked and could NOT be reached, and are marked Unfounded rather than filled in
from a write-up: Norm Kerth's Retrospective Prime Directive (`retrospectives.com` no longer
resolves) and Atlassian's blameless-postmortem pages (`/incident-management/postmortem`,
`/postmortem/blameless` and `/handbook/postmortems` all return navigation chrome or 404 to
WebFetch). Where a claim rests on a publisher's excerpt or on journalism rather than the owner, it
says so.

**The brief's ADR figures do not match the tree.** It gave 152 records, 70 accepted, 67 proposed.
Measured today: **139 records, 72 accepted, 67 proposed, 0 superseded, 0 rejected, 0 deprecated.**
The proposed count is right; the other two are not, and 70 + 67 does not reach 152 either. The
conclusions below hold under the corrected figures, but the discrepancy is itself a small instance
of the thing the skill exists to catch.

---

## Lead: the seven things that should shape the skill

1. **Every first-party source converges on the same single mechanism, and it is not the discussion.
   It is an owned, tracked item in the queue the work already uses.** Google states the failure mode
   as cause and effect; Scrum puts improvements in the Sprint Backlog; Atlassian assigns owners and
   deadlines. A retro whose output is a document is the failure mode all three name. See §1.
2. **ADR-0132 already forbids the obvious shape of this skill.** Under "What it costs, and what it
   does not require": "The output of the gate is tickets when something is wrong and nothing when
   nothing is. A gate whose output is a document is a document phase, which `CLAUDE.md` refuses on
   sight." That is the same conclusion §1's sources reach independently. The skill's output is
   tickets, or nothing.
3. **`proposed` does not mean in the wider world what this repo means by it, and the gap is a live
   hazard.** AWS states flatly that "ADRs in the **Proposed** state are ready for review". CanonCore
   uses `proposed` for DECIDED BUT NOT YET IMPLEMENTED. No first-party ADR source defines any status
   for that condition — see §2c, marked Unfounded. Consequence for the skill: it cannot audit status
   against an external standard, only against this repo's own written meaning, and it should say so
   rather than import a foreign lifecycle.
4. **0 superseded across 139 records is a real signal, because supersession is first-class machinery
   everywhere it is documented.** `adr-tools` ships `adr new -s 9` which mutates BOTH records; AWS
   makes it the only legal way to change an accepted decision; Nygard's original post introduces it
   in the same breath as `accepted`. See §2b.
5. **Two mechanical checks over this repo already produce candidates, and they cost one shell
   command each.** 38 of the 67 `proposed` records are cited from source, config, agent docs or the
   glossary — ADR-0066 from 54 places, ADR-0046 and ADR-0077 from 29 each. And 28 of 139 records are
   cited nowhere outside `docs/adr/` and `docs/research/`, of which exactly one is `accepted`
   (ADR-0101). See §2d. Neither is proof; both are triggers to read.
6. **Joel Parker Henderson's repo is the only ADR source that names a post-hoc review at all, and it
   names the mechanism this skill needs.** Under "Suggestions for writing good ADRs": "Include any
   after-action review processes. It's typical for teams to review each ADR one month later, to
   compare the ADR information with what's happened in actual practice." And under "Fitness
   functions for decisions as code": "A decision record documents the decision, while a fitness
   function assures the decision." That is the argument for the skill proposing a test rather than a
   paragraph.
7. **A `retro` skill already exists in `mattpocock/skills` and it is a DIFFERENT retro.** It
   retrospects the agent's *environment* after a session — steering files, checks, tool economy — and
   is marked "STUB: design notes only, not functional yet". It is not a post-spec audit of a body of
   work. Nothing in it needs reinventing, and nothing in it covers this. See §4.

---

## 1. Retrospective practice: four mechanisms, named by their owners

Every first-party source reached names the same small set. None of them treats the conversation as
the deliverable.

| Mechanism | Owner | What it says |
|---|---|---|
| An owner and a tracking number on every item | Google SRE Workbook, "Postmortem Culture: Learning from Failure" | "All action items have both an owner and a tracking number." |
| Items go into the queue the work already uses | Scrum Guide 2020, "Sprint Retrospective" | "The most impactful improvements are addressed as soon as possible. They may even be added to the Sprint Backlog for the next Sprint." |
| Owners AND deadlines, assigned in the session | Atlassian, Sprint Retrospective play, step 4 "Create action items" | "As you document changes and action items, be sure to assign owners and deadlines to kickstart progress." |
| A verifiable end state, not an adjective | Google SRE Workbook | Action items using "Improve" or "Make better" are faulted because "these terms are vague and open to interpretation"; a good one has "a verifiable end state". |

Sources: <https://sre.google/workbook/postmortem-culture/> (2018),
<https://scrumguides.org/scrum-guide.html> (November 2020, Schwaber and Sutherland),
<https://www.atlassian.com/team-playbook/plays/retrospective>.

### The failure mode, stated by the owners rather than inferred

This is the part worth quoting into the skill, because each source states it as cause and effect
rather than as advice.

- **Google, SRE Workbook:** "Without a formal tracking process, action items from postmortems are
  often forgotten, resulting in outages." And on closing the loop: "we can monitor the closure of
  action items from each postmortem…we can ensure that action items don't slip through the cracks."
  <https://sre.google/workbook/postmortem-culture/>
- **Google, SRE book chapter 15, Best Practice "No Postmortem Left Unreviewed":** "An unreviewed
  postmortem might as well never have existed." <https://sre.google/sre-book/postmortem-culture/>
- **Atlassian, Sprint Retrospective play, Variations:** "Don't let your retros become stale,
  check-the-box" exercises. <https://www.atlassian.com/team-playbook/plays/retrospective>
- **Joel Parker Henderson, "Teamwork advice for ADRs":** "decision records are not valuable if
  they're just an after-the-fact forced paperwork requirement."
  <https://github.com/joelparkerhenderson/architecture-decision-record>

**Read together, they say the same thing about output medium.** Google's remedy is a tracking
number, Scrum's is the Sprint Backlog, Atlassian's is an owner and a date. None of the three names a
report as the artefact. ADR-0132 reaches this independently, from this repository's own history, and
in stronger terms.

### Blamelessness — what is reachable and what is not

- **Google, SRE book chapter 15, reachable and unambiguous:** "For a postmortem to be truly
  blameless, it must focus on identifying the contributing causes of the incident without indicting
  any individual or team for bad or inappropriate behavior." The Best Practice heading is "Avoid
  Blame and Keep It Constructive". <https://sre.google/sre-book/postmortem-culture/>
- **Atlassian's framing is psychological safety rather than a formal directive:** "Focus on
  improvement instead of blame", plus an explicit recommendation to adopt the "Chatham House Rule".
  <https://www.atlassian.com/team-playbook/plays/retrospective>
- **Norm Kerth's Retrospective Prime Directive — UNFOUNDED against its owner.**
  `retrospectives.com`, which hosted Kerth's own statement of it, no longer resolves
  (`getaddrinfo ENOTFOUND`), and `web.archive.org` is not fetchable from here. The wording
  "Regardless of what we discover, we understand and truly believe that everyone did the best job
  they could, given what they knew at the time, their skills and abilities, the resources available,
  and the situation at hand" is reproduced identically by Pearson/InformIT publishing an excerpt of
  Marc Loeffler's *Improving Agile Retrospectives* (2018-06-26), which attributes it to Kerth's
  *Project Retrospectives: A Handbook for Team Reviews*
  (<https://www.informit.com/articles/article.aspx?p=2916288&seqNum=5>). A publisher quoting the
  book is one step from the owner and the book itself is offline; treat the wording as
  well-attested, the citation as second-hand.

**Relevance to a single-owner repo, stated plainly:** blamelessness is a mechanism for groups, and
its stated purpose in Google's own words is that blame makes people hide incidents. CanonCore has
one human. The transferable half is not the etiquette, it is the object of study: the SRE chapter
directs attention at "contributing causes" and away from actors, and here the actors are agents and
the causes are the substrate they ran on. That is exactly what `mattpocock/skills`' `retro`
retrospects (§4) and exactly what a post-spec audit of the WORK does not.

### Timeboxing, and the one place the sources disagree

- **Scrum Guide:** "It is timeboxed to a maximum of three hours for a one-month Sprint." Also "The
  Sprint Retrospective concludes the Sprint."
- **Atlassian:** prep 15 minutes, run 60 minutes, split into five steps with stated durations —
  "Set the tone" 5 min, "Gather feedback" 15 min, "Turn feedback into insights" 20 min, "Create
  action items" 15 min, "Conclusion" 5 min.
- **Google:** does not timebox the postmortem. It timeboxes PUBLICATION instead: its exemplar was
  "published less than a week after the incident was closed", because "information is fresh in the
  contributors' minds".

**The disagreement is about what the clock is on.** Scrum and Atlassian bound the meeting; Google
bounds the latency between the event and the written record. For an agent skill, Google's clock is
the one that transfers: an agent session has no meeting to overrun, but a spec whose retro happens
three waves later is auditing a tree that has moved. **The Agile Manifesto's twelfth principle is
the weakest of the three and should not be leaned on** — "At regular intervals, the team reflects on
how to become more effective, then tunes and adjusts its behavior accordingly"
(<https://agilemanifesto.org/principles.html>) names a cadence and an intent and no mechanism at
all.

### What the sources say to inspect, which is narrower than "how did it go"

Both process sources name the specific objects, and both include the team's own standard of done:

- **Scrum Guide:** "The Scrum Team inspects how the last Sprint went with regards to individuals,
  interactions, processes, tools, and their Definition of Done." And, load-bearing for a skill whose
  job is auditing claims: "Assumptions that led them astray are identified and their origins
  explored."
- **Google, SRE book, review criteria for a postmortem:** "Was key incident data collected for
  posterity? Are the impact assessments complete? Was the root cause sufficiently deep? Is the
  action plan appropriate?"
- **Google, SRE Workbook, review criteria:** "Perform a complete assessment of incident impact",
  "Conduct sufficiently detailed root-cause analysis to drive action item planning", "Share the
  postmortem with the wider organization".

"Their Definition of Done" being an explicit object of the retrospective is the hinge between §1 and
§3: Scrum expects the retro to audit the standard, not only the work measured against it.

---

## 2. ADR hygiene at scale

### 2a. Is a `proposed` / `accepted` lifecycle standard? Yes. Does `proposed` mean what CanonCore means? No.

**Standard, and traceable to one source.** Nygard's original post introduces exactly this pair:
"A decision may be 'proposed' if the project stakeholders haven't agreed with it yet, or 'accepted'
once it is agreed" (<https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions>,
2011-11-15). MADR 4.0.0 carries it forward as an optional field —
`# status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123"` —
(<https://adr.github.io/madr/>, released 2024-09-17). AWS Prescriptive Guidance names the same four
states as a process with a diagram
(<https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html>).
The ThoughtWorks Technology Radar has had the technique at **Adopt** since November 2017, entering
at Trial in November 2016, and says "For most projects, we see no reason why you wouldn't want to
use this technique"
(<https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records>, most
recent entry May 2018).

**But `adr.github.io` itself does not define statuses at all.** Its front page gives definitions of
AD, ADR and ASR and no lifecycle; its `/adr-templates/` page compares templates without enumerating
status values. So the lifecycle's authority is Nygard plus the templates and tooling that
implemented him, not the ADR organisation's own reference page.

**And the meaning diverges.** In AWS's process, which is the most explicit first-party statement
found:

> "the ADR owner provides the ADR in the **Proposed** state at the beginning of the process. ADRs in
> the **Proposed** state are ready for review."

`Proposed` there is a REVIEW state: the decision is not yet made. Rework keeps it Proposed; rejection
moves it to Rejected; approval moves it to Accepted, at which point "When the team accepts an ADR, it
becomes immutable."

CanonCore's `CLAUDE.md`, under "Reading the decisions", assigns it the opposite sense: "`status:
proposed` means DECIDED BUT NOT YET IMPLEMENTED", and "A proposed record binds, reopened only by a
superseding record." That is coherent and it is written down, which is what matters here. The
hazard is narrow and specific: **an agent that has read Nygard, MADR or AWS and not read
`CLAUDE.md` will read 67 `proposed` records as 67 undecided questions.** A skill auditing status
should quote this repo's definition at the point of use rather than assume it.

### 2b. What is `superseded` for, and is it expected routinely? Yes — it is first-class machinery.

Three independent owners make supersession the ONLY sanctioned way to change a decided record, which
means a healthy corpus that has changed its mind accumulates them.

- **Nygard, 2011:** "If a decision is reversed, we will keep the old one around, but mark it as
  superseded. (It's still relevant to know that it _was_ the decision, but is _no longer_ the
  decision.)"
- **AWS:** "The team should treat ADRs as immutable documents after the team accepts or rejects
  them. Changes to an existing ADR requires creating a new ADR… If the team approves the new ADR, the
  owner should change the state of the old ADR to **Superseded**."
- **`npryce/adr-tools`:** ships a flag for it. `adr new -s 9 Use Rust for performance-critical
  functionality` "will create a new ADR file that is flagged as superceding ADR 9, and changes the
  status of ADR 9 to indicate that it is superceded by the new ADR"
  (<https://github.com/npryce/adr-tools/blob/master/README.md>). A tool with a one-character flag
  for an operation is a tool whose author expected it often.

**So 0 superseded across 139 records is a signal, but read the right way.** It is NOT evidence that
no decision was reversed: this repository's convention, per `CLAUDE.md` under "Implementing", is to
CORRECT a record in the sentence it corrects, and `docs/research/` records reversals having been
folded back into records that kept their number. Under Nygard's and AWS's rules, several of those
corrections would have been supersessions. Under this repo's rules they are edits. **The two
conventions genuinely conflict**, and the conflict is the finding: a corpus that corrects in place
cannot use `superseded` as a change log, so a retro cannot use the absence of supersessions as
evidence of stability either. What it CAN check is the thing the repo's own rule already requires —
"A correction propagates, or it has not landed" — which is a grep, not a status count.

**One first-party source disagrees with the immutability rule outright**, and it is worth knowing
before designing a check that enforces it. Joel Parker Henderson lists "Immutable: Don't alter
existing information in an ADR" among the characteristics of a good ADR, and then, under "Teamwork
advice for ADRs", contradicts it from experience: "In theory, immutability is ideal. In practice,
mutability has worked better for our teams. We insert the new info the existing ADR, with a date
stamp, and a note that the info arrived after the decision." That is CanonCore's practice, described
by someone else, with the same reason attached.

### 2c. Guidance on records that stay decided-but-unbuilt — UNFOUNDED

**No source reached defines a status, a check or a review for a record whose decision is agreed and
whose mechanism does not exist.** Checked: Nygard's post, MADR 4.0.0, `adr.github.io` and its
templates page, AWS Prescriptive Guidance, `adr-tools`, Red Hat's "Why you should use ADRs" (Heiko W.
Rupp, 2021-12-16, which addresses status only to say ADRs "can be superseded later by newer ADRs"),
and Joel Parker Henderson's README. The nearest thing to it is an EXAMPLE rather than a standard:
Henderson's "Teamwork questions" section asks "What is the lifecycle of an ADR?" and offers, as an
example answer only, "We want an ADR to have five lifecycle stages: Initiating → Researching →
Evaluating → Implementing → Maintaining → Sunsetting." That is the only place `Implementing` appears
as a state of a record anywhere in the sources read. It is presented as a question a team should
answer for itself, not as a convention.

The implied model in AWS and Nygard is that implementation is tracked OUTSIDE the record, in issues
and pull requests, while the record tracks only whether the decision stands. **CanonCore has
deliberately gone the other way** — `CLAUDE.md`: "A ticket is not done until the ADRs it implements
read `accepted`", and "`accepted` means its MECHANISM is whole, never merely that its own gate was
met" — and in doing so it made the status field carry build state that the wider practice puts in the
tracker. That is a defensible choice and it has a consequence the skill must live with: **there is no
external authority to audit the 67 against.** The audit is this repo's own sentence, applied record
by record.

### 2d. What the corpus actually looks like, measured 2026-09-20

```
139 records in docs/adr/    72 accepted    67 proposed    0 superseded    0 rejected    0 deprecated
```

Two mechanical checks over the citation graph. Both are cheap, both produce candidates rather than
verdicts, and both would go stale the moment they were written into prose instead of a script —
which is Henderson's fitness-function argument exactly.

**Check one: a `proposed` record the code already leans on.** Counting files outside `docs/` that
cite each `proposed` record by `ADR-NNNN` or `[[slug]]`, across `packages/`, `apps/`, `.github/`,
`.claude/`, `CLAUDE.md`, `CONTEXT.md` and `docs/agents/`:

> **38 of the 67 `proposed` records are cited from source, config, agent docs or the glossary.**

The heaviest: `0066-path-is-identity-query-is-the-route` (54 places),
`0046-delete-previews-its-consequences` and `0077-work-browsing-excludes-entities-by-kind` (29 each),
`0047-migrations-are-a-forward-only-ladder` (28), `0010-groups-scope-never-partition` (27),
`0033-search-lookup-required-browse-optional` (26), `0043-sessions-carry-capabilities` (22),
`0036-tmdb-licence-constraints` and `0109-deployment-is-a-shape-not-a-vendor` (20 each),
`0072-no-visibility-system` (18).

**This is a trigger, not a verdict, and the caveat is load-bearing.** A citation can say why the code
does NOT do something, so a high count is consistent with a record correctly left `proposed`. But a
record 54 places call on is not plausibly untouched, and `CLAUDE.md` already names the failure this
would be: "a record whose mechanism you built only half of is not one you implemented: leave it
`proposed` and write into it which half landed and which did not." A `proposed` record with 54
citations and no such note is a candidate; the check is "does the record say which half landed",
and the answer is in the record, not in the count.

**Check two: a record nothing cites.** Counting citations anywhere in the repository outside
`docs/adr/` and `docs/research/`:

> **28 of 139 records are cited nowhere. 27 are `proposed`. Exactly one is `accepted`.**

The `accepted` one is `0101-the-catalogue-is-the-only-place-a-version-is-written`, and it is the more
interesting row of the two: `accepted` asserts a whole mechanism, and the only two citations of it in
the tree are `docs/adr/0110-a-provider-repo-is-a-small-typescript-service.md` ("ADR-0101's PRINCIPLE
carries over; its MECHANISM does not") and a line in `docs/research/multi-repo.md`. Nothing in
`packages/`, `apps/` or `.github/` names it. Whether that is a defect or simply a rule that needs no
comment is a judgement a reader makes in about a minute; the point is that the check found the one
row worth that minute out of 139.

The 27 uncited `proposed` records cluster in the unbuilt half of the product — files, artwork,
editions, progress, the player, the scanner — which is what a record that is genuinely decided and
genuinely not yet built should look like. **That is the reassuring half of the measurement and it
should be reported as such**: the distribution is not uniformly suspicious, and a skill that reports
all 67 as equally stale would be wrong 27 times over.

Commands, so the numbers are reproducible rather than asserted:

```sh
# status census
for f in docs/adr/*.md; do grep -m1 '^status:' "$f"; done | sort | uniq -c

# proposed records cited from outside docs/
for f in $(grep -l '^status: proposed' docs/adr/[0-9]*.md); do
  n=$(basename "$f" | cut -c1-4); slug=$(basename "$f" .md)
  h=$(grep -rl --exclude-dir=node_modules -e "ADR-$n" -e "\[\[$slug\]\]" \
        packages apps .github .claude CLAUDE.md CONTEXT.md docs/agents 2>/dev/null | wc -l)
  [ "$h" != "0" ] && echo "$h $slug"
done | sort -rn
```

**There is already a precedent in this repo for turning a check like this into a test rather than a
habit.** `packages/config/src/adr-numbering.test.ts` exists because two agents took number 0120 on
2026-09-11 and git merged both clean; its own comment states the principle — "IT ASKS THE TREE rather
than a list somebody maintains, so a record added without touching this file is still covered." A
status check of the same shape would sit beside it. Henderson names the category: "A decision record
documents the decision, while a fitness function assures the decision", and "Objective measurements:
Fitness functions pass or fail, so work is visible and clear."

---

## 3. Definition of done: verifying a spec is done rather than marked done

### What the primary sources actually give you

**The Scrum Guide is stronger here than its reputation suggests, and one sentence does most of the
work.** Under "Commitment: Definition of Done": "The Definition of Done is a formal description of
the state of the Increment when it meets the quality measures required for the product", "The moment
a Product Backlog item meets the Definition of Done, an Increment is born", and the operative rule —
"If a Product Backlog item does not meet the Definition of Done, it cannot be released or even
presented at the Sprint Review." Note also what Scrum does NOT make a gate: "The Sprint Review
should never be considered a gate to releasing value."
<https://scrumguides.org/scrum-guide.html>

**The Agile Alliance glossary supplies the failure mode.** Under "Common pitfalls": "If the
definition of done is merely a shared understanding, rather than spelled out and displayed on a wall,
it may lose much of its effectiveness." And under "Signs of use": "The team actually uses the
Definition of Done at the end of a sprint to justify the decision to count work towards velocity or
not." <https://www.agilealliance.org/glossary/definition-of-done/>

**The Agile Manifesto supplies the one-line principle.** Principle 7: "Working software is the
primary measure of progress." <https://agilemanifesto.org/principles.html> That is the shortest
first-party statement of CanonCore's own "The first version ends in a rendered page, not a report",
and it is worth quoting in the skill for exactly that reason.

**Note what is missing.** The Scrum Guide does not use the term "acceptance criteria" at all, and
neither does the Agile Alliance glossary entry above. No authoritative first-party source was found
that prescribes how acceptance criteria should be VERIFIED as distinct from asserted. The nearest
usable substitute is Google's postmortem review criteria (§1) and Henderson's fitness functions
(§2d), neither of which is about acceptance criteria per se. **If the skill wants a rule for
verifying a criterion, it is inventing one, and should say so.**

### Does ADR-0132's principle have an established name and lineage?

**Partly, and ADR-0132 has already done this work better than a fresh search can.** The record's
own section "The category does this, and calls it a deployment ring" identifies Microsoft's safe
deployment guidance as "the closest first-party precedent, and it is a gate rather than a habit",
quotes Defender for Endpoint shipping externally "ONLY AFTER all the certification and validation
tests are completed across multiple iterations of internal devices", and explicitly rejects the
weaker citation: "GOOGLE IS THE WEAKER CITATION AND IS NOT USED HERE… It supports the value and not
the teeth." That reasoning stands and was not reproduced from scratch here.

Two things to add from today's checking:

- **The established name is "deployment ring" / "ring-based deployment", and Microsoft's own term
  for the family is "progressive exposure".** Live first-party pages carry both: the Defender
  gradual-rollout and ring-deployment guides, the Azure Well-Architected Framework's "Architecture
  strategies for safe deployment practices", the Windows "Create a deployment plan" ring guidance,
  and Azure Pipelines' "phase rollout with rings"
  (all on <https://learn.microsoft.com>). The Windows guidance describes the Preview ring in the same
  terms ADR-0132 uses for the Owner's instance: it exists "to evaluate the new features of the
  update" and is "limited to the people who are responsible for knowing what is coming next".
- **The COLLOQUIAL name is "dogfooding", and its origin is UNFOUNDED against a primary source.** The
  documented origin is a 1988 internal Microsoft email from Paul Maritz to Brian Valentine titled
  "Eating our own Dogfood". **That email has not been published**; every account of it is journalism
  or encyclopaedia, including GeekWire's 2025 piece which quotes Maritz recalling it directly. There
  is no owner to reach. So "dogfooding" is a widely understood label with no citable source of truth,
  which is a second, independent reason beyond ADR-0132's to prefer "deployment ring" in writing.

**The important asymmetry for the skill**: a deployment ring and ADR-0132 are the same SHAPE (an
internal population validates before the change is called done) but not the same SCOPE. Microsoft's
rings gate a RELEASE. ADR-0132 gates a PROJECT — "A project ends when the Owner has pulled it onto
their own running CanonCore and looked at it." No source found gates a unit of PLANNED WORK on having
been used. That extension is this repository's, argued from its own three falsified sentences, and
the skill should present it as local doctrine with an external precedent rather than as industry
practice.

### The one design constraint ADR-0132 imposes on this skill

Quoted in full because it is the single most consequential line for the design, and because it is
easy to breach by accident:

> **It does not require a written report.** The output of the gate is tickets when something is wrong
> and nothing when nothing is. A gate whose output is a document is a document phase, which
> `CLAUDE.md` refuses on sight.

Note the second-order trap. ADR-0132 is itself `status: proposed`, and its own subject matter is
projects that closed green while their sentences were false. **A `/retro` skill that files no ticket
and produces a `docs/retro-<spec>.md` would be an instance of the thing ADR-0132 was written about.**
It would also be a record of a gate rather than a gate.

---

## 4. Existing skills: one exists, it is a stub, and it is a different retro

### `mattpocock/skills`, read at commit `c55ee46`

**There is a `retro` skill**, at `skills/in-progress/retro/SKILL.md`. The `in-progress` README
describes it as: "Suggest improvements to the coding agent's environment (steering files, coding
standards, automated checks, tooling) after a session. **STUB: design notes only, not functional
yet.** User-invoked." The bucket's own README says these are "Beta… excluded from the plugin and the
top-level README until they graduate", and "can change or disappear without warning".

Its shape, since the brief asks so we do not reinvent it:

- **Frontmatter:** `name: retro`, `description: "Conduct a retrospective on a coding session."`,
  `disable-model-invocation: true` — user-invoked only.
- **Stated object:** "You are suggesting improvements to the coding agent's **environment** to
  improve future runs."
- **Four steps:** invoke `writing-for-agents` for style; read the primary sources for the session
  (defaulting to the current one, possibly searching session logs); look for candidates in seven
  named categories; "Present these candidates to the user, in order of severity."
- **The seven categories,** each with a `_Use when_` trigger: Navigation, Automated checks, Coding
  standards, Global AGENTS.md, Tool economy, No-ops, Information access.
- **Its sharpest rule, and the one most worth borrowing:** under Coding standards — "Classify the
  violation first: a **mechanical** one… gets a deterministic check, full stop… **Default to building
  the check over writing the rule.** Reserve `CODING_STANDARDS.md` for genuine **judgement calls**."
  Under Automated checks it adds that an existing-but-unwired check "is the finding, not a
  reinvention".
- **Output:** a list of candidates ordered by severity, presented in conversation. No file, no
  tickets.

**It does not overlap the job in the brief.** It audits the HARNESS after a session; a post-spec
retro audits the WORK after a spec. The two share one design principle worth lifting verbatim —
prefer a deterministic check to a written rule — and one worth rejecting: presenting a severity-ranked
list to the user is precisely the "unread list" outcome §1's sources and ADR-0132 both rule out.

Also in that repo and adjacent: **`code-review`** ("Two-axis review of the diff since a fixed point:
**Standards**… and **Spec**… run as parallel sub-agents") and **`improve-codebase-architecture`**
("It is a survey, not a rescue"). CanonCore already carries both as local skills. Neither audits a
completed spec against what it claimed. Full list read at
<https://github.com/mattpocock/skills/blob/main/README.md> and
<https://github.com/mattpocock/skills/tree/main/skills/in-progress>.

### Anthropic's Agent Skills documentation

No retrospective or audit skill is named. The pre-built Agent Skills are `pptx`, `xlsx`, `docx`,
`pdf`; the only open-source Skill named is the Claude API skill. What the page contributes is
structural, and two points bear on this design:

- **Progressive disclosure and the cost table.** Level 1 metadata is "~100 tokens per Skill" and
  always loaded; Level 2 `SKILL.md` body should be "Under 5k tokens"; Level 3 resources cost nothing
  until read. Scripts are the cheap tier: "When Claude runs `validate_form.py`, the script's code
  never loads into the context window. Only its output… consumes tokens."
- **The `description` is the trigger.** "The `description` is what Claude matches your request
  against when determining whether to trigger the Skill, so it must say both what the Skill does and
  when to use it."

<https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>

**The cost table argues for the §2d checks being bundled scripts rather than prose in `SKILL.md`**:
their code never enters context, only the candidate list does, and a script cannot go stale against
the tree the way a quoted count does.

### Joel Parker Henderson ships two ADR skills, and neither is an auditor

Under "Claude Code skills for ADRs": `architecture-decision-record-skill` ("general purpose, for
anyone writing an ADR in any project… Helps decide whether a decision needs an ADR, sets up an `adr/`
or `decisions/` directory, names the file, picks a template… and writes solid Context/Decision/
Consequences sections") and `architecture-decision-record-maintainer-skill`, which is about
maintaining that repository itself. Both are authoring aids. **No skill anywhere in the sources read
audits an existing ADR corpus.**

The same README lists three tools in the adjacent space, worth knowing but none of them a retro:
`Decision Guardian` and `ADR Guard` (both surface or gate on decision records at pull-request time —
"ADR Guard… fails a pull request when watched code paths change without an architecture decision
record being added or updated"), and `keep-the-why`, described as "a repo-native convention and agent
skill that continuously captures, or retrospectively recovers, the reasoning behind a codebase". The
gating pair are the closest existing implementations of Henderson's fitness-function idea, and they
gate the DIFF rather than audit the CORPUS.

---

## Where the sources disagree

| Question | One side | The other | Which applies here |
|---|---|---|---|
| Is an accepted record immutable? | Nygard 2011 and AWS: yes, changes require a new record and the old goes `Superseded` | Joel Parker Henderson, from practice: "In theory, immutability is ideal. In practice, mutability has worked better for our teams" | CanonCore already chose mutability with a correction in the sentence it corrects. The skill should check that corrections PROPAGATED, not that records are pristine |
| What does `proposed` mean? | AWS: "ready for review" — the decision is not made | CanonCore `CLAUDE.md`: "DECIDED BUT NOT YET IMPLEMENTED" — the decision binds | This repo's, quoted at the point of use. There is no external standard for the state CanonCore is tracking (§2c, Unfounded) |
| What is timeboxed? | Scrum (3h max) and Atlassian (60m, five steps) bound the meeting | Google bounds publication latency: "less than a week after the incident was closed" | Google's. An agent session has no meeting to overrun; a stale tree is the real cost |
| Where does the output go? | Unanimous in effect: an owned, tracked, dated item in the existing queue | Nobody argues for a report | Tickets. ADR-0132 says the same thing and makes it a rule |

---

## Summary: what the skill should check, and what each check is grounded in

| # | Check | Grounded in |
|---|---|---|
| 1 | Every finding leaves as a ticket with an owner, a state and a verifiable end state. Nothing leaves as prose. | Google ("owner and a tracking number"; "a verifiable end state"); Scrum ("added to the Sprint Backlog"); Atlassian ("owners and deadlines"); ADR-0132 ("a gate whose output is a document is a document phase") |
| 2 | The spec's own headline sentence, read against a running instance rather than against its tickets. | ADR-0132 in full; Agile Manifesto principle 7; Scrum's "cannot be released or even presented" |
| 3 | Every `proposed` record the spec claims to implement: does it read `accepted`, or does it say which half landed? | `CLAUDE.md` "Implementing"; measured trigger in §2d check one (38 of 67 cited from source) |
| 4 | Every record nothing outside `docs/` cites — one `accepted` record is in that set today. | §2d check two (28 of 139); `adr-numbering.test.ts`'s "ask the tree" principle |
| 5 | Every correction made during the spec: did it propagate to what cites it? | `CLAUDE.md` "A correction propagates, or it has not landed"; the immutability disagreement above |
| 6 | Every figure the spec's tickets and records assert: still true? | The `verify` skill; `docs/research/verify-adr-*.md`, where 35 of 246 ADR claims were contradicted |
| 7 | The standard itself, not only the work: did the Definition of Done hold? | Scrum ("inspects… their Definition of Done"; "Assumptions that led them astray are identified"); Agile Alliance ("the team actually uses the Definition of Done") |
| 8 | Mechanical checks ship as scripts beside `adr-numbering.test.ts`, not as counts quoted in prose. | Henderson ("a fitness function assures the decision"); Anthropic's cost table (script output only enters context); `mattpocock` retro ("Default to building the check over writing the rule") |

**Two things not to do**, both supported above. Do not present a severity-ranked list of candidates
and stop, which is what the one existing `retro` skill does and what every source in §1 names as the
failure. And do not import an external ADR lifecycle to judge the 67 `proposed` records: no such
standard exists for the state this repo is tracking, and the two lifecycles that do exist mean
something else by the same word.
