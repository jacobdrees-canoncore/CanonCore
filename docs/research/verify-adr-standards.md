# Verification: standards claims in `docs/adr/`

Every claim about a published standard made in the 72 records under `docs/adr/`, checked against
that standard's own text. Fetched 2026-09-10 unless a section says otherwise.

The governing rule (ADR 0059) is that the schema comes from industry standards, so a wrong claim
here is not a detail: it is a load-bearing beam. Each verdict below therefore carries the URL, the
section, and the standard's own words rather than a summary of them.

Verdicts: **CONFIRMED** (URL, section, exact quote, date), **CONTRADICTED** (what the standard
actually says), **UNFOUNDED** (no support located; what would settle it), **JUDGEMENT** (a defensible
reading rather than a fact the standard states).

**46 claims checked: 36 CONFIRMED, 6 CONTRADICTED, 2 UNFOUNDED, 2 JUDGEMENT.** The tally, the
failures, and the corrections to otherwise-sound claims are collected in [Summary](#summary) at the
end.

---

## OAI-ORE

Source: *ORE Specification - Abstract Data Model*, <https://www.openarchives.org/ore/1.0/datamodel>
(fetched 2026-09-10).

### Sequencing is not a global fact — ADR 0018 — CONFIRMED

ADR 0018 quotes ORE as stating that sequencing "is only true in the context of the specific
Aggregation, and is not a 'global' fact".

Section 5.3.1, *Proxies: Relationships among Aggregated Resources*:

> It would not be legitimate for the Resource Map to express this sequencing by asserting a triple
> of the sort `<AR-1> <hasNext> <AR-2>`, since this fact is only true in the context of the specific
> Aggregation, and is not a "global" fact.

The quoted words are exact. The section goes on to say the relationship "must be expressed in terms
of Proxies that denote Aggregated Resources contextualized by a specific Aggregation" — which is
precisely ADR 0018's decision to hang ordering on the placement.

### The Proxy has its own URI — ADR 0009 — CONFIRMED

Section 5.3, *Proxies for Aggregated Resources*:

> This section describes the notion of a Proxy, which is a Resource that "stands for" an Aggregated
> Resource in a manner that is specific to one Aggregation. The URI-P of this Proxy is then
> available for use in triples where the intended semantics is a relationship specific to the
> Aggregated Resource in the context of the respective Aggregation.

and:

> The URI-P of the Proxy MUST be unique to the Aggregation.

Note the precise purpose: the URI exists so that *relationships specific to the aggregation context*
can be asserted, which is a narrower and sharper claim than "so it can be described". The
reification reading in ADR 0009 is right; the Proxy is the membership made addressable.

### Section 4.2 makes `dcterms:creator` and `dcterms:modified` mandatory — CONFIRMED

Section 4.2, *Metadata about the Resource Map and Aggregation*:

> A Resource Map MUST express minimal metadata properties about the Resource Map. Those metadata
> properties are: The identity of the authoring authority (human, organization, or agent) of the
> Resource Map, using the `dcterms:creator` predicate ... The last modification date-timestamp of
> the Resource Map, using the `dcterms:modified` term.

Section 6's constraints table confirms the cardinalities: `ReM-1 dcterms:creator Agent (1, *)` and
`ReM-1 dcterms:modified literal (1, 1)`, both labelled "Metadata about Resource Map (Required)
(4.2)".

One scoping point worth keeping straight: both are required on the **Resource Map**, not on the
Aggregation. Metadata about the Aggregation is `MAY` throughout 4.2.

### `ore:lineage` exists on the Proxy — CONFIRMED

Section 5.3.3, *Proxies: Lineage of an Aggregated Resource*:

> A Resource Map MAY assert triples with the predicate `ore:lineage` to express this notion. The
> subject of `ore:lineage` MUST be a Proxy specific to the Aggregation and the object MUST be a
> Proxy specific to another Aggregation. Both the subject and object Proxy Resource MUST be proxies
> for the same Aggregated Resource.

Its stated motivation is provenance: "there is a need for a stronger relationship indicating
lineage, which indicates that an Aggregated Resource originated or was sourced from another
Aggregation. Lineage or provenance is one basis of integrity in scholarly communication."

---

## IIIF Presentation API 3.0

Source: <https://iiif.io/api/presentation/3.0/>, version 3.0.0 (fetched 2026-09-10).

### A Range owns its item list — ADR 0061 — CONFIRMED

Section 5.4, *Range*, states it as a `must`:

> All of the Canvases or parts that should be considered as being part of a Range must be included
> within the Range's `items` property, or a descendant Range's `items`.

and, in the same section:

> A Range must have the `items` property with at least one item.

Section 5.4 also confirms that membership is not inherited from the Manifest's own order: "Ranges are
used to represent structure within an object **beyond** the default order of the Canvases in the
`items` property of the Manifest". ADR 0061's "adding an item to one ordering never adds it to
another" is exactly this shape.

### `behavior: "sequence"` gives multiple orderings — ADR 0009 — CONFIRMED

Section 3.2, *Technical Properties*, under Range Behaviors:

> **sequence** — Valid only on Ranges, where the Range is referenced in the `structures` property of
> a Manifest. Ranges that have this behavior represent different orderings of the Canvases listed in
> the `items` property of the Manifest, and user interfaces that interact with this order should use
> the order within the selected Range, rather than the default order of `items`.

Section 5.4 makes the *multiple* explicit, and even names the alternative-ordering use case:

> If there is more than one Range that has the behavior value `sequence`, for example a second Range
> to represent an alternative ordering of the pages of a manuscript, the first Range should be used
> as the default and the others should be able to be selected.

### Section 4.4 defines `none` as the unknown-language value — CONFIRMED

Section 4.4, *Language of Property Values*:

> The values of these properties must be JSON objects, with the keys being the BCP 47 language code
> for the language, or if the language is either not known or the string does not have a language,
> then the key must be the string `none`.

Two things the ADRs should not lose: `none` covers **two** cases, not one — language unknown *and*
the string having no language at all (a catalogue number, say) — and IIIF's key space is BCP 47,
which is the same tag space the BCP 47 claim below concerns.

---

## PROV-O

Sources: *PROV-O: The PROV Ontology*, W3C Recommendation 30 April 2013,
<https://www.w3.org/TR/prov-o/>, and the normative OWL file
<https://www.w3.org/ns/prov-o-20130430.ttl> (both fetched 2026-09-10).

### `prov:Agent` has exactly three subclasses — ADR 0071 — CONFIRMED

ADR 0071 leans on this to justify widening the source slot rather than adding a column. Section 3,
*Expanded terms*:

> Three subclasses of Agent (`prov:Person`, `prov:Organization`, and `prov:SoftwareAgent`) and three
> subclasses of Entity are provided (`prov:Collection`, `prov:Bundle`, and `prov:Plan`).

Checked against the ontology itself rather than the prose: `grep "rdfs:subClassOf :Agent"` over
`prov-o-20130430.ttl` returns exactly three hits, at `:Organization`, `:Person` and
`:SoftwareAgent`. Their definitions:

> `:Person` — "Person agents are people."
> `:Organization` — "An organization is a social or legal institution such as a company, society, etc."
> `:SoftwareAgent` — "A software agent is running software."

"A program fills the same slot an organisation does" is therefore not an analogy but the ontology's
own structure. Note all three are `:category "expanded"`: `prov:Agent` itself is the starting-point
term, and the three are the expansion of it.

### `prov:wasDerivedFrom`, `prov:hadPrimarySource`, `prov:qualifiedDerivation` all exist — CONFIRMED

All three are in the normative OWL file:

- `prov:wasDerivedFrom` — `rdfs:domain :Entity`, `rdfs:range :Entity`, category `starting-point`,
  component `derivations`. Its comment: "The more specific subproperties of `prov:wasDerivedFrom`
  (i.e., `prov:wasQuotedFrom`, `prov:wasRevisionOf`, `prov:hadPrimarySource`) should be used when
  applicable."
- `prov:hadPrimarySource` — `rdfs:subPropertyOf :wasDerivedFrom`, category `expanded`. Section 3
  defines it as citing "a preceding Entity produced by some agent with direct experience and
  knowledge about the topic (such as a reading from a sensor, or a journal written during an
  historical event)."
- `prov:qualifiedDerivation` — `rdfs:range :Derivation`, `rdfs:subPropertyOf :qualifiedInfluence`,
  category `qualified`, `:unqualifiedForm :wasDerivedFrom`. Its comment: "If this Entity
  `prov:wasDerivedFrom` Entity `:e`, then it can qualify how it was derived using
  `prov:qualifiedDerivation [ a prov:Derivation; prov:entity :e; :foo :bar ]`."

The qualified/unqualified pairing is worth noting for ADR 0067, which puts adaptation coverage as a
qualifier on the `based_on` statement: PROV-O's qualification pattern is exactly that shape, a plain
binary property plus a reified `prov:Derivation` node hanging extra description off it.

---

## Wikidata and Wikibase

### P248, P887, P3452 — ADR 0071 — CONFIRMED

Fetched live from the Wikidata API on 2026-09-10:
`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=P248|P887|P3452&languages=en&format=json`

| Property | Label | English description |
| --- | --- | --- |
| P248 | stated in | "to be used in the references field to refer to the information document or database in which a claim is made; for qualifiers use P805; for the type of document in which a claim is made use P3865" |
| P887 | based on heuristic | "indicates that the property value is determined based on some heuristic (Q201413); **to be used as source**" |
| P3452 | inferred from | "statement added based on related statement found within the item, not the entity described by the item **(to be used in a reference field)**" |

All three labels are exactly as ADR 0071 gives them, and the "to be used as source" / "to be used
in a reference field" wording is verbatim from the property descriptions. ADR 0071's inference —
that Wikidata "puts 'based on heuristic' and 'inferred from' in the same reference slot as 'stated
in'" — is what these descriptions say.

One nuance the ADR does not need but should not contradict: P248's own description scopes it to the
**references** field and points elsewhere for qualifier use (P805) and for document type (P3865).
The three are peers within the reference slot, not interchangeable everywhere.

### Wikibase rank values are preferred / normal / deprecated — CONFIRMED

Source: *Wikibase/DataModel*, <https://www.mediawiki.org/wiki/Wikibase/DataModel>, section *Ranks of
Statements* (fetched 2026-09-10).

> The ranks provide a simple selection/filtering criterion in cases where there are many Statements
> for some property. There are three possible ranks [...] **Preferred** statements refer to the most
> important and most up-to-date information that should be used per default in most contexts [...]
> **Normal** statements contain relevant information that is believed to be correct but that may be
> too extensive for showing it by default [...] **Deprecated** statements that may not be considered
> reliable or that are even known to contain errors.

Two points that bear directly on ADR 0012 and ADR 0017, which build a rank mechanism on this
precedent. First, the spec explicitly defends *three* against both finer and coarser designs: "More
fine-grained rankings do not seem to have such a clear interpretation and would thus increase the UI
complexity unnecessarily. Having only two ranks (or no ranks at all), on the other hand, would make
it harder to cope with Statements that are not trusted, known to contain wrong claims, or simply
unpatrolled." Second, *preferred* is explicitly not unique: "Note that there may be multiple
preferred statements." Any implementation here that assumes at most one preferred value per property
is departing from the precedent, not following it.

---

## MARC 21 field 883

Source: *MARC 21 Format for Bibliographic Data: 883 — Metadata Provenance*, Network Development and
MARC Standards Office, Library of Congress. `loc.gov` returns 403 to non-browser clients, so read
via the Internet Archive capture of 2025-02-02:
<https://web.archive.org/web/20250202204854/https://www.loc.gov/marc/bibliographic/bd883.html>
(fetched 2026-09-10). Page footer: "MARC 21 Bibliographic - full / May 2020 ... (05/27/2020)".

### Field name, and the NEW 2012 / RENAMED 2020 history — ADR 0071 — CONFIRMED

Field header: `883 - Metadata Provenance (R)`. Field definition and scope:

> Used to provide information about the provenance of metadata in data fields in the record. Field
> 883 contains a link to the field to which it pertains.

Content Designator History, verbatim:

> Field 883 - Machine-generated Metadata Provenance [NEW, 2012]
> Field 883 - Machine-generated Metadata Provenance [RENAMED, 2020] Field 883 was renamed to allow
> the recording of non-machine-generated content.

So the 2012 field was *Machine-generated* Metadata Provenance and the 2020 rename dropped that
qualifier, precisely so that a human-asserted value could use the same field. That is worth holding
onto: it is the standard doing, in 2020, the thing ADR 0071 does when it puts provider, owner,
sidecar and derived in one source enum rather than fencing the machine ones off.

### Indicators — PARTLY CONFIRMED (the blank value is missing from the claim)

First Indicator — Method of assignment has **four** values, not three:

> \# - No information provided/not applicable
> 0 - Fully machine-generated
> 1 - Partially machine-generated
> 2 - Not machine-generated

`2 - Not machine-generated` is itself marked `[NEW, 2020]`, and `Indicator 1 - Method of machine
assignment [RENAMED, 2020]`. The second indicator is undefined and "Contains a blank (#)".

Any restatement of this should say `#/0/1/2`. Stating `0/1/2` drops the "no information provided"
case, which for this project is the interesting one: it is the value for a claim whose method of
assignment is not recorded.

### Subfields — CONFIRMED

- `$a - Creation process (NR)` — "Identifies the process used to produce the data contained in the
  linked field. The subfield may contain a process name or some other description."
- `$c - Confidence value (NR)` — "The subfield contains a floating point value between 0 and 1.
  Either a comma or a point may be used as a decimal marker. 0 means no confidence and and 1 means
  full confidence." (The doubled "and and" is the standard's own typo.)
- `$d - Creation date (NR)` — "Date on which the linked field was created. This also serves as the
  beginning of the period of validity", format `yyyymmdd` per ISO 8601.
- `$x - Validity end date (NR)` — "Date representing expected end of period of validity for the data
  in the linked field", same format.
- `$q - Assigning or generating agency (NR)` — "MARC organization code of the institution using the
  process/activity to assign or generate the linked field."
- `$u - Uniform Resource Identifier (NR)` — "URI ... which identifies the process used to produce
  the data contained in the field to which 883 is linked."

The claim's short label "assigning agency" for `$q` is the standard's own first word; the full label
is "Assigning **or generating** agency".

### The worked example carries a version — ADR 0071 — CONFIRMED (with a caveat on the reason)

The `$c` example is exactly as claimed:

> `883  0# $8 1\p $a deweyclassifierv0.1 $d 20120101 $x 20141231 $q NO-OsNB $c 0,75 $0 (DE-101)040268942`

`deweyclassifierv0.1` is verbatim, and the version is inside the process name in `$a` — which is
precisely ADR 0071's `derived:palette-v2` shape, a versioned process identifier rather than a bare
flag.

**Caveat on "for exactly this reason".** MARC does not say why the example is versioned. And the
same example carries `$x 20141231`, a validity **end date** — so 883's own answer to "when does this
computed claim stop being good?" is a date, not a version bump. ADR 0071's inference is reasonable
and the example does support the shape; the *motive* attributed to it is ours, not MARC's. Reading
the ADR's sentence as "MARC's example is versioned, and versioning is what makes invalidation a
query" is safe. Reading it as "MARC versions it in order to invalidate" is not something the
standard states.

---

## OWASP Server Side Request Forgery Prevention Cheat Sheet

Source:
<https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html>
(fetched 2026-09-10).

### Case 1 allowlist / Case 2 deny-list — ADR 0034 — CONFIRMED

Section *Cases*:

> Depending on the application's functionality and requirements, there are two basic cases in which
> SSRF can happen:
> - **Application can send request only to identified and trusted applications**: Case when allowlist
>   approach is available.
> - **Application can send requests to ANY external IP address or domain name**: Case when allowlist
>   approach is unavailable.
>
> Because these two cases are very different, this cheat sheet will describe defenses against them
> separately.

ADR 0034's "OWASP's Case 1, an identified and trusted destination" is the cheat sheet's own phrase:
"identified and trusted applications". Case 1's *Available protections* confirm the exact-match
shape the ADR adopts: "An allowlist is created after determining all the IP addresses (v4 and v6 to
avoid bypasses) of the identified and trusted applications. The valid IP is cross-checked with that
list ... (string strict comparison with case sensitive)", and for hostnames "Verify that the domain
name received is part of this allowlist (string strict comparison with case sensitive)."

Case 2 states why the allowlist is unavailable there: "Allow lists cannot be used here because the
list of IPs/domains is often unknown upfront and is dynamically changing", and concedes the choice
plainly: "Despite knowing that the block-list approach is not an impenetrable wall, it is the best
solution in this scenario."

### The deny-list heading and its opening line — ADR 0034 — CONFIRMED, verbatim

The section heading is exactly `Deny-list (Last Resort)`, and its first line is exactly:

> Deny-lists are bypass-prone. Prefer allow-lists.

followed by "When unavoidable, block these minimum ranges:" and a table naming AWS IMDS
(`169.254.169.254`, `metadata.amazonaws.com`), GCP Metadata, Azure IMDS, Localhost
(`127.0.0.0/8`, `0.0.0.0/8`, `::1/128`), RFC1918 Private and Multicast. ADR 0034's
`169.254.169.254` example is the first row of that table.

### DNS rebinding / DNS pinning — PARTLY CONTRADICTED on terminology, and the remedy is ours

The attack is in the cheat sheet, but **the phrase "DNS rebinding" is not**: `grep -i rebind`
over the whole page returns nothing. The cheat sheet names the attack `DNS pinning` — the reverse
of the usual industry convention, where *rebinding* is the attack and *pinning* is the defence.
Its description of the attack:

> It can be used by an attacker to bind a legit domain name to an internal IP address. See the
> section `Exploitation tricks > Bypassing restrictions > Input validation > DNS pinning` of this
> [document]

— where "this document" links to `../assets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet_SSRF_Bible.pdf`,
not to a section of the cheat sheet itself.

More important for ADR 0034: **the cheat sheet does not prescribe "resolve once and pin the
connection to the resolved address."** Its stated remedies are different ones:

> Ensure that the domains that are part of your organization are resolved by your internal DNS
> server first in the chains of DNS resolvers.
> Monitor the domains allowlist in order to detect when any of them resolves to a/an: Local IP
> address (V4 + V6). Internal IP of your organization ...

and, for Case 2:

> To prevent the `DNS pinning` attack described in this document, the application will retrieve all
> the IP addresses behind the domain name provided (taking records A + AAAA for IPv4 + IPv6) and it
> will apply the same verification described in the previous point about IP addresses.

ADR 0034 does not actually attribute the pin-the-resolved-address remedy to OWASP, so the record is
not wrong. But it should not be *read* as an OWASP recommendation either: connection pinning is our
own design, and it is a stronger control than the cheat sheet's, since retrieving and checking all A
and AAAA records still leaves the TOCTOU window that pinning closes.

**One OWASP instruction ADR 0034 does not mention and probably should.** Case 2's validation flow
ends:

> The application will build the HTTP POST request using only validated information and will send it
> (**don't forget to disable the support for redirection in the web client used**).

ADR 0034 handles redirects by re-checking the hop against the deny-list and pinning. OWASP's own
answer for the Case 2 shape is blunter: turn redirect following off. That is worth recording as a
considered-and-rejected option rather than leaving the impression that redirect-following with
per-hop checks is what the cheat sheet asks for.

---

## RFC 3986 — the query component

Source: RFC 3986, *Uniform Resource Identifier (URI): Generic Syntax*, January 2005,
<https://www.rfc-editor.org/rfc/rfc3986.txt> (fetched 2026-09-10).

### Section 3.4 says the query identifies the resource alongside the path — CONFIRMED, and it cuts against ADR 0066's framing

Section 3.4, *Query*, in full:

> The query component contains non-hierarchical data that, along with data in the path component
> (Section 3.3), serves to identify a resource within the scope of the URI's scheme and naming
> authority (if any). The query component is indicated by the first question mark ("?") character
> and terminated by a number sign ("#") character or by the end of the URI.

The quoted phrase is exact. What matters for ADR 0066 is the *direction* of the finding.

ADR 0066 is titled "The path is identity; the query is the route" and declares `?via=<placement-id>`
"NON-IDENTIFYING". **RFC 3986 says the opposite**: under the generic syntax, the query is part of
what identifies the resource, on equal footing with the path, and `/items/7` and `/items/7?via=3`
are two different URIs denoting two different resources. The section even notes that "query
components are often used to carry identifying information in the form of `key=value` pairs".

This is a deviation, not a derivation, and ADR 0066 does not name it as one. The deviation is
entirely ordinary — it is what `rel="canonical"` (RFC 6596) exists for, and what every faceted
catalogue on the web does — but the record should say so, because "non-identifying" is a property
this project *asserts about its own URLs* rather than one the URI syntax grants. Concretely: nothing
in RFC 3986 stops a cache, a crawler, or a link shortener from treating `?via=3` as a distinct
resource, so the canonical-link header or tag is the mechanism that has to carry the claim.

---

## BCP 47

Source: RFC 5646, *Tags for Identifying Languages*, September 2009,
<https://www.rfc-editor.org/rfc/rfc5646.txt>, plus the IANA Language Subtag Registry,
<https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry> (both fetched
2026-09-10).

### Script is subsumed into the tag — CONFIRMED (but `ar-latn` is not the recommended spelling)

Section 2.2.3, *Script Subtag*:

> Script subtags are used to indicate the script or writing system variations that distinguish the
> written forms of a language or its dialects. [...] Script subtags MUST follow any primary and
> extended language subtags and MUST precede any other type of subtag. [...] There MUST be at most
> one script subtag in a language tag [...]
> For example: "sr-Latn" represents Serbian written using the Latin script.

So yes: script is a subtag position inside the single tag, not a separate field. There is exactly
one of it. `ar-Latn` is a well-formed tag — the registry has `Type: language / Subtag: ar` and
`Type: script / Subtag: Latn` — and it is *meaningful* rather than redundant, because `ar` carries
`Suppress-Script: Arab`, so the script subtag is omitted for Arabic script and used precisely for
cases like Latin transliteration.

**Correction to the spelling.** Section 2.1.1 is explicit that case carries no meaning ("the tag
`mn-Cyrl-MN` is not distinct from `MN-cYRL-mn`"), so `ar-latn` is valid. But it also says the
registry format "is RECOMMENDED as the form to use in language tags", and "[ISO15924] recommends
that script codes use lowercase with the initial letter capitalized ('Cyrl' Cyrillic)". Write
`ar-Latn`. Anywhere the codebase compares tags, compare case-insensitively; anywhere it emits or
stores them, emit the recommended casing.

### `en-GB` vs `en-US` — CONFIRMED

Both are valid region subtags in the registry (`Type: region / Subtag: GB / Description: United
Kingdom`; `Subtag: US / Description: United States`), and RFC 5646 uses tags of exactly this shape
throughout, e.g. Appendix A: "en-US (English as used in the United States)".

RFC 5646 attaches a warning to this pattern that is worth carrying into any matching code, section
4.1:

> not all subtags specify an actual distinction in language. For example, the tags "en-US" and
> "en-CA" mean, roughly, English with features generally thought to be characteristic of the United
> States and Canada, respectively. They do not imply that a significant dialectical boundary
> exists...

A region subtag is a *flavour* claim, not a mutual-unintelligibility claim, so falling back from
`en-GB` to `en-US` is a reasonable default and falling back from `zh-Hant` to `zh-Hans` is not.

---

## W3C Reconciliation Service API

Source: *Reconciliation Service API v0.2*, Final Community Group Report, 10 April 2023, W3C Entity
Reconciliation Community Group,
<https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/> (fetched
2026-09-10).

### It retrofitted versioning at v0.2, with absence meaning the earlier version — ADR 0032 — CONFIRMED

Section 3.1, *Service Manifest*, first field:

> **versions** — The array of API versions supported by the endpoint, such as `["0.1", "0.2"]`.
> Since this field did not exist in version 0.1, services which do not declare a `versions` field
> are expected to only support version 0.1.

Section 1.4.2, *0.2 (This Version)*, lists it as one of the changes introduced by 0.2: "Let
manifests announce which versions of the protocol are supported by the service". So it is genuinely
a retrofit, and 1.4.2 also confirms the reason ADR 0032 gives for keeping the field optional: "Most
of them are backwards-compatible, except for the requirement to support CORS for cross-origin
access." Making `versions` required would have broken every 0.1 service; the spec did not.

ADR 0032 renders the rule as "absence means version 1" against its own numbering. The precedent's
own numbers are 0.1 and 0.2. The *shape* — an array, not a scalar; optional, not required; absence
means the pre-versioning version — is exactly as ADR 0032 describes it.

### The reconcile/extend split — ADRs 0026 and 0032 — CONFIRMED as operations, CONTRADICTED as URL paths

The **separation of the two operations is real and normative**, and it is stronger than ADR 0026
claims. Reconciliation is section 4 and data extension is section 7; they have distinct request
schemas (A.2/A.3 vs A.8/A.9); and data extension is an *optional capability the service must
declare*:

> The fact that a reconciliation service offers data extension MUST be announced by including a data
> extension metadata in the `extend` field of the service manifest. (§7.3)

That is a better precedent for ADR 0026 than "two endpoints": the spec makes matching mandatory and
applying optional-and-declared, which is the shape ADR 0033 independently adopts for
`search`/`lookup` vs `browse`.

**But there are no `/reconcile` and `/extend` paths.** Both operations go to the *same* endpoint URL
and are distinguished by parameter name:

> §4.3: A reconciliation service MUST support HTTP POST requests ... containing a reconciliation
> query batch (serialized in JSON) in a form element named `queries`.
> `POST /  queries=<URL-encoded reconciliation query batch>`
> `GET /?queries=<URL-encoded reconciliation query batch>`

> §7.3: A data extension service MUST support HTTP POST requests ... containing a data extension
> query in a form element named `extend`.
> `POST /  extend=<URL-encoded data extension query>`
> `GET /?extend=<URL-encoded data extension query>`

ADR 0026's phrasing "OpenRefine splits `/reconcile` from `/extend`" and "separate operations with
separate endpoints" should be corrected. The literal path names are not in the standard, and the
one endpoint that *is* separately addressed — property proposals — is given as a
`service_url` + `service_path` pair in the manifest (§7.1) rather than as a fixed path, precisely so
the service chooses its own URL layout. The argument ADR 0026 is making survives the correction
intact; the citation does not.

### `wikidata.reconci.link/en/api` and `/fr/api` are distinct services with distinct manifests — CONFIRMED

Both fetched live 2026-09-10.

| Field | `/en/api` | `/fr/api` |
| --- | --- | --- |
| `name` | `Wikidata reconciliation (en)` | `Wikidata reconciliation (fr)` |
| `defaultTypes[0].name` | `entity` | `entité` |
| `suggest.entity.service_path` | `/en/suggest/entity` | `/fr/suggest/entity` |
| `preview.url` | `.../en/preview?id={{id}}` | `.../fr/preview?id={{id}}` |
| `extend.propose_properties.service_path` | `/en/propose_properties` | `/fr/propose_properties` |
| `identifierSpace` | `http://www.wikidata.org/entity/` | *same* |
| `schemaSpace` | `http://www.wikidata.org/prop/direct/` | *same* |
| `versions` | `["0.1", "0.2"]` | *same* |

So: two services, two manifests, differing in every human-facing and endpoint-path field, agreeing
on identifier and schema space. That is the precedent ADR 0033 needs for "language is an optional
parameter in both directions and never required" being *insufficient* on its own — here language is
baked into the service identity rather than passed per request, and the manifest is what tells the
client which one it is talking to.

Also worth noting for ADR 0012 and ADR 0017: the live `/en/api` manifest's `extend.property_settings`
exposes a `rank` filter whose choices are `any` / `best` / `no_deprecated`, labelled "Any rank",
"Only the best rank", "Preferred and normal ranks" — the Wikibase rank model surfaced as a
reconciliation-time filter.

---

## IFLA LRM

Source: *IFLA Library Reference Model: A Conceptual Model for Bibliographic Information*, Riva, Le
Bœuf and Žumer, August 2017, as amended and corrected through December 2017,
<https://www.ifla.org/wp-content/uploads/2019/05/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf>
(fetched 2026-09-10). Section references are to Table 4.2 (Entities) and Table 4.4 (Relationships).

### "no work can exist without there being at least one expression" — ADR 0003 — CONFIRMED, but the truncation matters

LRM-E2 Work, scope notes, in full:

> A work comes into existence simultaneously with the creation of its first expression, **no work
> can exist without there being (or there having been at some point in the past) at least one
> expression of the work**.

ADR 0003 quotes it as "no work can exist without there being at least one expression", dropping "(or
there having been at some point in the past)".

That parenthesis is not decoration, and for this catalogue it is the interesting half. LRM already
allows a work whose only expression is **lost** — which is exactly *The Daleks' Master Plan*, the
fixture ADR 0057 and ADR 0060 build the extent rules around. The gap ADR 0003 is claiming against
LRM is therefore narrower than the truncated quote suggests: LRM forbids a work that was *never*
expressed, not a work whose expressions no longer survive. Our real departure is the un-owned
novel — a work whose expression exists in the world but not in this instance — which LRM does not
forbid at all, since LRM is not modelling holdings. The record is right that the model deviates; the
sentence overstates where.

### LRM-E9 Nomen — ADR 0005 — CONFIRMED, verbatim

Table 4.2:

> **LRM-E9 Nomen** — Definition: "An association between an entity and a designation that refers to
> it". Constraints: Superclass: res.
>
> Scope notes: A nomen associates whatever appellation (i.e., combination of signs) is used to refer
> to an instance of any entity found in the bibliographic universe with that entity. Any entity
> referred to in the universe of discourse is named through at least one nomen.
>
> ... In that sense, the nomen entity can be understood as **the reification of a relationship
> between an instance of res and a string**.

ADR 0005's quote is word-for-word the definition. And the scope note's "reification of a relationship
between an instance of res and a string" is a stronger justification for ADR 0005's decision than
the record currently uses: LRM says a nomen *is* a reified relationship, which is precisely what
ADR 0005 says a statement already is. Removing the `nomen` kind is not a departure from LRM — it is
recognising that the statement table already instantiates LRM-E9.

### LRM-E11 Time-span — CONFIRMED, verbatim

Table 4.2:

> **LRM-E11 Time-span** — Definition: "A temporal extent having a beginning, an end and a duration".
> Constraints: Superclass: res.

The scope note adds a point ADR 0005's `time_span` kind will meet immediately: "The information
available to the cataloguer, or the inherent characteristics of the time-span being identified, will
be reflected in the degree of precision used in recording of a temporal extent. For example, '14th
century' may be sufficiently precise..." — that is, LRM expects a time-span to be recorded at
whatever precision the source supports, not normalised to a date.

### LRM uses "Item" for the physical or digital copy — ADR 0002 — CONFIRMED

Table 4.2:

> **LRM-E5 Item** — Definition: "An object or objects carrying signs intended to convey intellectual
> or artistic content". Constraints: Superclass: res. The entities work, expression, manifestation,
> item are disjoint.
>
> Scope notes: ... An item is in many instances a single physical object, but in other cases, an item
> may consist of multiple physical pieces or objects. An item may be a part of a larger physical
> object, for example, when a file is stored on a disc which also contains other files, the portion
> of the disc holding the file is the physical carrier or item.

Examples given are the Codex Sinaiticus, the Book of Kells, and "Library of Congress Copy 2 of
Homer. The Odyssey" — copies, not abstractions. ADR 0002's statement of the inversion is correct.

### LRM-R22 is cardinality-restricted, unlike schema.org `isBasedOn` — ADR 0067 — CONFIRMED, with an important qualification

Table 4.4:

> **LRM-R22** — Domain: Work. Relationship name: "is a transformation of". Inverse name: "was
> transformed into". Range: Work. **Cardinality: M to 1**.
>
> Definition: This relationship indicates that a new work was created by changing the scope or
> editorial policy (as in a serial or aggregating work), the genre or literary form (dramatization,
> novelization), target audience (adaptation for children), or style (paraphrase, imitation, parody)
> of a previous work.

`M to 1` is exactly as ADR 0067 claims: a work may be a transformation of at most one source work.
And LRM-R22's definition explicitly names "dramatization, novelization" — the adaptation case
ADR 0067 is about.

**The qualification.** LRM is not without a many-to-many route for adaptation-like relationships.
The very next relationship up:

> **LRM-R21** — Domain: Work. "is inspiration for" / "is inspired by". Range: Work. **Cardinality: M
> to M**. Definition: This is the relationship between two works where the content of the first
> served as the source of ideas for the second.
>
> Examples: The musical *West Side Story* is inspired by the play *Romeo and Juliet*

And LRM-R22's own scope note concedes the boundary: "Some transformations may be considered as
being only inspired by a previous work."

So the accurate statement is: LRM restricts *transformation* to one source and offers *inspiration*
for the many-source case, whereas schema.org's `isBasedOn` collapses both and restricts neither.
ADR 0067 should say that rather than implying LRM has no M:M option, because the distinction is
live for this catalogue — a work adapting two novels is R21 territory under LRM and would have to
be modelled as such by anyone exporting conformant data.

For the schema.org half, see the schema.org section below: `schema:isBasedOn` has
`rangeIncludes` CreativeWork, Product and URL, and no cardinality constraint — though schema.org
has no cardinality mechanism at all, so this is true of every schema.org property and is a weaker
contrast than it reads as.

---

## LRMoo

Sources: *LRMoo v1.0* (the version carrying the FRBRoo migration tables),
<https://cidoc-crm.org/sites/default/files/LRMoo_V1.0.pdf>, and the current release *LRMoo v1.1.1*,
released November 2025, <https://cidoc-crm.org/extensions/lrmoo/html/LRMoo_v1.1.1.html> (both
fetched 2026-09-10).

### "LRMoo deprecated F16 Container Work, F17 Aggregation Work and F18 Serial Work with the remark 'use superclass F1 Work'" — ADR 0004 — CONTRADICTED on F18

Section 10.1, *Migration of FRBROO Classes* (Table 15, "Mapping of FRBROO Classes to LRMOO"),
reproduced exactly:

| FRBRoo class | LRMoo column | Explanation column |
| --- | --- | --- |
| F16 Container Work | Use superclass F1 Work | Deprecated unneeded subclasses of F1 Work |
| F17 Aggregation Work | Use superclass F1 Work | Deprecated unneeded subclasses of F1 Work |
| **F18 Serial Work** | **F18 Serial Work** | **Now a direct subclass of F1 Work** |
| | Else use superclass F1 Work | Implement only in conjunction with PRESSOO |

**F16 and F17 are as ADR 0004 says. F18 is not.** F18 Serial Work was *retained*, not deprecated,
and it is still a live class: LRMoo v1.1.1's class table declares 16 classes and F18 Serial Work is
one of them, with its property `R11 has issuing rule (is issuing rule of)`. LRMoo v1.0 §1 explains
why: "This includes the linkage to the PRESSOO model: the class F18 Serial Work and its property
R11 has issuing rule ... Although included in the LRMOO class declarations in section 6, F18 Serial
Work should be [implemented only in conjunction with PRESSOO]".

The list ADR 0004 wants — classes deprecated with the exact remark "Use superclass F1 Work" — is
longer than three and does not include F18. From the same table: F14 Individual Work, F15 Complex
Work, F16 Container Work, F17 Aggregation Work, F19 Publication Work, F20 Performance Work, F21
Recording Work.

The decision ADR 0004 records is unaffected — folding containers into `work` is exactly what F16 and
F17's deprecation supports, and the serial case is served by `work` plus a category statement. But
the citation names a class that was kept, and a reader who checks will find it.

### "LRMoo F38 covers individuals OR GROUPS of individuals" — CONFIRMED in LRMoo v1.0, but F38 has been moved out of LRMoo

LRMoo v1.0, §9.1, *Class declarations of classes transferred to CRMsoc*:

> **F38 Character** — Subclass of: E28 Conceptual Object.
> Scope note: This class comprises fictional or iconographic **individuals or groups of individuals
> (including families)** appearing in works in a way relevant as subjects. Characters may be purely
> fictitious or based on real persons or groups, but as characters they may exhibit properties that
> would be inconsistent with a real person or group. **Rather than merging characters with real
> persons, they should be described as disjoint, but related entities.**
>
> Examples: Harry Potter [in J. K. Rowling's series of novels and the films based on them]; Sinuhe
> the Egyptian [in Mika Waltari's novel]; The Knights of the Round Table [in fiction]
>
> Properties: R57 is based on (is basis for): E39 Actor; R58 has fictional member (is fictional
> member of): F38 Character

The "individuals or groups of individuals" wording is verbatim. The scope note is also the cleanest
external support anywhere in this file for ADR 0006 ("`person` means real humans only") — a standard
saying in as many words that characters and real persons "should be described as disjoint, but
related entities."

**Two things ADR-writers must not miss.** First, `R58 has fictional member` means a character can be
a *group* of characters with members — The Knights of the Round Table having Lancelot as a fictional
member. ADR 0005's single `character` kind can express that only as a category statement plus a
relation, which is fine but should be a conscious choice.

Second, **F38 is on its way out of LRMoo.** LRMoo v1.0 §9 says these classes "are not necessary for
an implementation of LRMOO. They should be implemented as a transition mechanism ... They are
intended to be transferred to CRMsoc", and the migration table's row reads `F38 Character | See
CRMsoc | Moved to other family model`. LRMoo v1.1.1 (November 2025) no longer declares it: its class
table lists 16 classes and F38 is not among them. Any ADR citing "LRMoo F38" should say "LRMoo v1.0
§9.1, since transferred to CRMsoc", or cite CRMsoc directly.

---

## BIBFRAME

Sources: the BIBFRAME vocabulary RDF, <https://id.loc.gov/ontologies/bibframe.rdf>, which declares
`owl:versionInfo 3.0.1`, `dcterms:issued 2025-12-03`; *Overview of the BIBFRAME 2.0 Model*,
21 April 2016 (`loc.gov` 403s directly, read via
<https://web.archive.org/web/2024/https://www.loc.gov/bibframe/docs/bibframe2-model.html>); the
BIBFRAME FAQ; and *Bibliographic Framework as a Web of Data: Linked Data Model and Supporting
Services*, LC, 21 November 2012. All fetched 2026-09-10.

### BIBFRAME uses "Item" for the physical or digital copy — ADR 0002 — CONFIRMED

Vocabulary, `bf:Item`:

> **Item** — "Single example of an Instance"

Model overview:

> **Item.** An item is an actual copy (physical or electronic) of an Instance. It reflects
> information such as its location (physical or virtual), shelf mark, and barcode.

Together with LRM-E5 above, ADR 0002's "IFLA LRM and BIBFRAME both use *Item* for the physical or
digital copy. We use it for the abstract thing being catalogued, which is the opposite" is exactly
right. Worth noting the term we actually collide with is BIBFRAME's **Work** — `bf:Work` is
"Resource reflecting a conceptual essence of a cataloging resource", which is what we call an item.

### "BIBFRAME collapsed two levels into one because cataloguers could not apply the distinction consistently" — ADR 0011 — the collapse is CONFIRMED, the reason is UNFOUNDED, and the pair collapsed is not the one implied

**The collapse is real.** FRBR/LRM has Work → Expression → Manifestation → Item; BIBFRAME has three
core classes. Model overview:

> BIBFRAME 2.0 organizes this information into three core levels of abstraction: Work, Instance, and
> Item.

And the vocabulary shows *which* pair was merged. `bf:expressionOf` and `bf:hasExpression` both run
**Work to Work**:

> `bf:expressionOf` — "Work or Hub that the described Work or Hub is an expression of; used to
> connect Works and/or Hubs under LRM/RDA guidelines or similar implementations"

An expression, in BIBFRAME, is another **Work**. So BIBFRAME's Work = LRM's Work + Expression, and
`bf:Instance` ("Resource reflecting an individual, material embodiment of a Work") = LRM's
Manifestation. **The collapsed pair is Work + Expression, not Expression + Manifestation.**

This matters because ADR 0064's edition rule — "A different translation, cut, narration or medium is
an edition. A different cover, printing or ISBN is a category or identifier statement ON an edition"
— is the Expression/Manifestation line. Under BIBFRAME, a translation is a *different Work* linked
by `bf:translationOf`, and a printing is a *different Instance*. So our "edition" sits where
BIBFRAME's Expression-absorbed-into-Work sits, not where its Instance sits. The structural claim
"one level where the standards have two" survives; "following BIBFRAME" does not survive a close
reading, because we and BIBFRAME collapsed different joins.

**The stated reason is not in BIBFRAME's published text.** Checked: the *Overview of the BIBFRAME
2.0 Model* (which does not mention FRBR, Expression, or any rationale at all); the BIBFRAME FAQ
(whose answer is "a conceptual/practical model that balances the needs of those recording detailed
bibliographic description, the needs of those describing other cultural materials, and those who do
not require such a detailed level of description"); and the 2012 LC report, whose only statement of
motive is:

> For example, the origin of the Work/Instance aspects of the BIBFRAME can reflect the FRBR
> relationships in terms of a graph rather than as hierarchical relationships, **after applying a
> reductionist technique to simplify things as much as possible**.

Nowhere does LC say that trained cataloguers could not apply the distinction consistently. The
nearest LC document that discusses cataloguer difficulty is the *BIBFRAME AV Modeling Study* (May
2014), and it is about a different problem — the FRBR/RDA split of principal creators at the work
level from contributors at the expression level for moving-image material: "This has been a source
of confusion for moving image catalogers who have trouble conceiving of the primary creators of a
motion picture work as the screenwriter, director, or filmmaker only." That is domain-specific
commentary in a study, not BIBFRAME's design rationale, and it does not support the ADR's sentence.

**Verdict: UNFOUNDED on the reason.** What would settle it: a citation to an LC BIBFRAME document,
BIBFRAME Update Forum paper, or a signed statement from the BIBFRAME editorial group that names
inconsistent cataloguer application as the reason for merging Expression into Work. If none exists,
ADR 0011 should either drop the causal clause or attribute it to whichever secondary source it came
from.

### "BIBFRAME has a Title class with six variant subclasses" — ADR 0014 — CONFIRMED on the count, CORRECTED on the shape

Vocabulary 3.0.1 has exactly six classes beneath `bf:Title`, but they are not six siblings:

```
bf:Title            "Title entity"
└── bf:VariantTitle      "Title variation"     (subClassOf bf:Title)
    ├── bf:KeyTitle           "Key title"
    ├── bf:AbbreviatedTitle   "Abbreviated title"
    ├── bf:ParallelTitle      "Parallel title proper"
    ├── bf:CollectiveTitle    "Collective title"
    └── bf:TransliteratedTitle "Transliterated title"
```

`bf:Title` itself is defined as "Title information relating to a resource: work title, preferred
title, instance title, transcribed title, translated title, variant form of title, etc." — so the
class alone already covers six kinds of title in its own definition, before any subclassing.

Two corrections. The subclass tree is one direct subclass plus five grandchildren, not six direct
subclasses. And **the count of six is recent**: five of them are dated `2016-04-21 (New)`, but
`bf:TransliteratedTitle` is dated `2023-11-30 (New [GH104])`. At BIBFRAME 2.0 as published there
were five. If the ADR intends to cite BIBFRAME 2.0 specifically, the number is five; if it intends
the current vocabulary, the number is six and the version is 3.0.1, not 2.0.

### Version currency note for ADR 0059

ADR 0059 lists "BIBFRAME 2.0" among the standards in play. The *model* document is still titled
*Overview of the BIBFRAME 2.0 Model* and is dated 21 April 2016, so that name is not wrong. But the
**vocabulary** ADR 0014 actually cites is at `owl:versionInfo 3.0.1`, issued 2025-12-03, with
`owl:priorVersion` `bibframe-3-0-0`. Anything counting classes or checking a definition should say
which vocabulary version it counted, because the answer has changed twice since 2016.

---

## schema.org

Source: `https://schema.org/version/latest/schemaorg-current-https.jsonld` (fetched 2026-09-10), with
spot checks against the rendered term pages.

### `schema:author` ranges over Person and Organization — ADRs 0059 and 0070 — CONFIRMED

> `schema:author` — "The author of this content or rating..."
> `schema:domainIncludes` = CreativeWork, Rating
> `schema:rangeIncludes` = **Organization, Person**

`schema:creator` has the same range, and its comment says so: "The creator/author of this
CreativeWork. This is the same as the Author property for CreativeWork."

### schema.org ships `Role` — CONFIRMED

> `schema:Role` — subClassOf `schema:Intangible`. "Represents additional information about a
> relationship or property. For example a Role can be used to say that a 'member' role linking some
> SportsTeam to a player occurred during a particular time period. Or that a Person's 'actor' role
> in a Movie was for some particular characterName. Such properties can be attached to a Role entity,
> which is then associated with the main entities using ordinary properties like 'member' or
> 'actor'."

Note the second example: schema.org's own illustration of Role is *an actor's role in a movie with a
particular characterName*. That is the reification pattern ADR 0070 needs for "as DIFFERENT ROLES
rather than one role pointing at two kinds of thing", and it is a closer precedent than the record
currently claims.

### "schema.org has 3 title properties" — ADR 0014 — JUDGEMENT; the count depends on what you count, and the likeliest enumeration gives four

No schema.org document states a number. Enumerating the text properties that can carry a title of a
`CreativeWork`:

| Property | Domain | Comment |
| --- | --- | --- |
| `schema:name` | Thing | "The name of the item." |
| `schema:alternateName` | Thing | "An alias for the item." |
| `schema:headline` | CreativeWork | "Headline of the article." |
| `schema:alternativeHeadline` | CreativeWork | "A secondary title of the CreativeWork." |

That is four. `schema:title` exists but its domain is `JobPosting` and its comment is "The title of
the job", so it is not one of them; `schema:titleEIDR` is a pending identifier property on
Movie/TVEpisode/TVSeason/TVSeries, not a title string.

Three is defensible if you exclude `headline` as article-specific, or exclude `alternateName` as
generic-to-Thing. It is not a fact the vocabulary asserts. ADR 0014's argument — that title is
single-valued nowhere in the field — is if anything strengthened by the correction, so the fix is to
name the properties rather than the number.

### `schema:isBasedOn` is not cardinality-restricted — ADR 0067 — CONFIRMED, but the contrast is weaker than it reads

> `schema:isBasedOn` — "A resource from which this work is derived or from which it is a modification
> or adaptation."
> `schema:domainIncludes` = CreativeWork
> `schema:rangeIncludes` = CreativeWork, Product, URL

There is no cardinality constraint, so a work may `isBasedOn` many sources. The caveat is that
**schema.org has no cardinality mechanism at all** — no `owl:maxCardinality`, no functional
properties, nothing. Saying `isBasedOn` "is NOT cardinality-restricted, unlike IFLA LRM's R22" is
true but is true of every one of schema.org's properties, so it is a fact about schema.org's
expressive power rather than a deliberate modelling choice about adaptation. If ADR 0067 wants a
standard that *chose* many-to-many for this relation, LRM-R21 "is inspired by" (M to M) is the
stronger citation.

---

## CIDOC CRM

Sources: *Definition of the CIDOC Conceptual Reference Model* **version 7.4**, August 2026,
<https://cidoc-crm.org/sites/default/files/cidoc_crm_version_7.4.pdf>, cross-checked against the
version 7.1.3 HTML declarations at <https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html> (both fetched
2026-09-10). The two agree on every point below.

### `P14 carried out by` ranges over `E39 Actor` — ADR 0070 — CONFIRMED

> **P14 carried out by (performed)**
> Domain: E7 Activity
> Range: **E39 Actor**
> Subproperty of: E5 Event. P11 had participant (participated in): E39 Actor
> Quantification: many to many, necessary (1,n:0,n)
> Scope note: This property describes the active participation of an instance of E39 Actor in an
> instance of E7 Activity. It implies causal or legal responsibility.
> Properties: **P14.1 in the role of: E55 Type**

Two things ADR 0070 should take from this rather than only the range. `P14.1 in the role of` is a
property-of-a-property: CRM's own answer to "different roles" is a qualifier on the relation, not a
second relation — which is the mechanism ADR 0067 uses for adaptation coverage and could equally
serve the Writer/Publisher/Network distinction ADR 0070 argues for. And the quantification `(1,n:0,n)`
means an activity must have at least one actor; a creation event with no known creator is not
expressible in CRM at all, which our "unknown is the absence of a row" rule (ADR 0060) deliberately
departs from.

`E39 Actor` itself:

> This class comprises people, either individually or in groups, who have the potential to perform
> intentional actions of kinds for which they can be held responsible.

with subclasses `E21 Person` and `E74 Group`.

### Version currency note

ADR 0059's list of standards in play does not version CIDOC CRM. The current release is **7.4
(August 2026)**; 7.1.3 is the version published as ISO 21127. Anything citing CRM should say which.

---

## The two "no standard says this" claims

These are the claims the brief singled out, and both need more care than the records give them.

### "NO STANDARD GIVES BOTH [reification and multiple orderings] IN ONE CONSTRUCT" — ADRs 0009 and 0059 — UNFOUNDED

I can confirm each half separately (see the OAI-ORE and IIIF sections above): ORE's Proxy is
aggregation-scoped reified membership, and IIIF's `behavior: "sequence"` gives multiple orderings of
one Manifest's Canvases. What I cannot establish is the **absence**, and one of the two standards
comes closer to giving both than ADR 0009 allows.

OAI-ORE, in one construct:

- §5.3 — the Proxy is a per-Aggregation URI for an Aggregated Resource ("The URI-P of the Proxy MUST
  be unique to the Aggregation"), i.e. reified membership.
- §4.3 — "A Resource Map MAY include one or more triples with the `ore:isAggregatedBy` predicate to
  assert that an Aggregated Resources is a constituent of other Aggregations", and §5.3.3 — "one
  Aggregated Resource MAY be in multiple Aggregations".
- §5.3.1 — sequencing is asserted *between Proxies*, and is therefore per-Aggregation.

Put together, ORE already expresses "one resource, many containers, each with its own ordering",
which is ADR 0009's headline sentence. What ORE does *not* give is two orderings of the **same**
Aggregation without minting a second Aggregation, and it defines no ordering predicate of its own
(§5.3.1's `xyz:hasNext` is explicitly "hypothetical"). IIIF gives the second-ordering-of-one-container
case but its Ranges are not reified memberships with their own provenance.

So the honest statement is narrower and still supports the decision: *no single standard gives, in
one construct, a reified membership that carries its own attributes **and** more than one ordering
of the same container.* The blanket "NO STANDARD GIVES BOTH" is an unbounded negative over every
standard in existence, and I did not check every standard — nor could I.

**What would settle it.** Either (a) narrow the claim to the eight standards ADR 0059 names, and
state it as "none of the standards in play", which is checkable and, on the evidence above, close to
true; or (b) keep the strong form and cite a survey. Candidates worth checking before asserting the
strong form: METS `<structMap>` (which permits multiple structMaps over one set of files, each with
its own `<div>` hierarchy — this is the nearest counter-example I am aware of and I did not verify
it), EAD, and RDF's own `rdf:Seq` / OWL reification.

### "neither `schema:author` nor CRM `P14` admits a fictional author" — ADRs 0059 and 0070 — CONTRADICTED

**schema.org: flatly contradicted.** `schema:author`'s range is `schema:Person` or
`schema:Organization`, and `schema:Person` is defined as:

> **A person (alive, dead, undead, or fictional).**

(Verified twice: in `schemaorg-current-https.jsonld` and on the rendered <https://schema.org/Person>
page, fetched 2026-09-10.) schema.org does not merely tolerate a fictional author — it names
fictional persons in the type's one-line definition. Reinforcing it, `schema:character` ("Fictional
person connected with a creative work") has `rangeIncludes` `schema:Person`, so schema.org models
characters *as* Persons. Under schema.org, `{"@type": "Book", "author": {"@type": "Person", "name":
"Newt Scamander"}}` is conformant, not a workaround.

**CIDOC CRM: contradicted in part.** `E21 Person` does exclude personae, in as many words:

> This class comprises real persons who live or are assumed to have lived. [...] In a bibliographic
> context, a name presented following the conventions usually employed for personal names will be
> assumed to correspond to an actual real person (an instance of E21 Person), unless evidence is
> available to indicate that this is not the case. **The fact that a persona may erroneously be
> classified as an instance of E21 Person does not imply that the concept comprises personae.**

But `E39 Actor`'s other subclass does not:

> **E74 Group** — [...] **A joint pseudonym (i.e., a name that seems indicative of an individual but
> that is actually used as a persona by two or more people) is a particular case of E74 Group.**
>
> Examples: [...] Nicolas Bourbaki [the collective pseudonym of a group of mathematicians...];
> **Betty Crocker** (Crocker, 2012); Ellery Queen [Ellery Queen is a pseudonym created in 1929 by
> American crime fiction writers Frederic Dannay and Manfred Bennington Lee.]

`E74 Group` is a subclass of `E39 Actor`, which is `P14`'s range. So a persona **can** be the actor
that carried out a creation event in CRM — and CRM's own example list includes Betty Crocker, an
entirely invented person used as an authorial identity. What CRM restricts is the *single-author*
persona: the joint-pseudonym sentence requires "two or more people".

**IFLA LRM has a mechanism too, and it is a third answer.** LRM-E7 Person is as exclusionary as CRM's
E21 — "figures generally considered fictional (for example, Kermit the Frog), literary (for example,
Miss Jane Marple) or purely legendary (for example, the wizard Merlin) are not instances of the
entity person" — and LRM-E8 Collective Agent takes joint pseudonyms, as CRM does. But LRM §5.5,
*Modelling of Bibliographic Identities*, handles the single-author persona directly:

> In the model, a bibliographic identity is a cluster of nomens used by a person in the same
> bibliographically significant context or contexts. [...] In a more complex case, the context of
> use may need to distinguish between nomens used by a person in writing **a series of novels about
> one imaginary world**, and the other nomens used by that person when writing another series of
> novels about a different imaginary world.
>
> The bibliographic identities formed by nomen clusters are a type of res, and have enough
> persistence to be assigned nomens, such as the International Standard Name Identifier (ISNI)...

So LRM's answer to "Rowling published as Newt Scamander" is a nomen cluster on Rowling with a
context of use, addressable in its own right.

**What this means for ADR 0070.** The decision — `created_by` takes a person, `credited_to` takes a
character, and they must not share a property — is *not* damaged. Nothing above lets one field hold
both "who made it" and "who is stated to have made it" without the two competing on rank, which is
the actual argument. But the record's justification is wrong in its facts, and it is wrong in the
direction that matters most for a project whose governing rule is "standards first": it claims a
gap where three of the standards in play have an answer, and the answers differ from each other and
from ours.

Suggested replacement for the "standards gap is real" sentence, all of it verifiable from this file:

> The standards disagree here rather than being silent. schema.org admits a fictional author
> outright (`schema:Person` is "a person (alive, dead, undead, or fictional)"). CIDOC CRM and IFLA
> LRM both exclude personae from their Person classes and route joint pseudonyms to a group class
> (`E74 Group`, `LRM-E8 Collective Agent`), and LRM §5.5 handles a single-author persona as a nomen
> cluster on the real person. None of the three separates "who made it" from "who is stated in the
> fiction to have made it" as two properties, which is what a catalogue of in-universe authorship
> needs, so per the governing rule the distinction goes in DATA.

---

## Readium Locator

Source: *Locators*, Readium Architecture, <https://readium.org/architecture/models/locators/>
(fetched 2026-09-10). Reference JSON Schema:
<https://github.com/readium/architecture/tree/master/schema/locator.schema.json>.

### "a normalised `progression` 0..1 plus an opaque locator" — ADR 0020 — CONFIRMED, with two corrections

The Location Object:

| Key | Definition | Format | Required |
| --- | --- | --- | --- |
| `fragments` | "Contains one or more fragment in the resource referenced by the Locator Object." | Array of strings | No |
| `progression` | "Progression in the resource expressed as a percentage." | **Float between 0 and 1** | No |
| `position` | "An index in the publication." | Integer where the value is > 0 | No |
| `totalProgression` | "Progression in the publication expressed as a percentage." | **Float between 0 and 1** | No |

And on the opacity of `fragments`:

> Given the flexible nature of the Readium Web Publication Manifest, we need the ability to provide
> locations into all sorts of resources (text, audio, video, images). Fragments are flexible enough
> to achieve that goal. [...] **They're by nature media-specific and should always be understood in
> the context of the resource that the locator points to** (by looking at `href` and `type`).

with a registry of fragment syntaxes per media type: HTML `id`; Media Fragment URI 1.0 (`t=67`,
`xywh=160,120,320,240`) for audio, video and images; PDF (`page=12`, `viewrect=50,50,640,480`). The
model's own audiobook example is `"fragments": ["t=389.84"], "progression": 0.607379,
"totalProgression": 0.50678`.

So ADR 0020's shape is right. Two corrections before this is implemented.

**There are two progressions, not one.** `progression` is within the *resource* (a chapter, a
track); `totalProgression` is within the *publication*. ADR 0020's per-edition progress figure is
`totalProgression`. Storing only `progression` would give a book on chapter 1 page 2 a progress of
0.03 for the chapter and no answer at all for the book, and every completion rule in ADR 0041 and
container roll-up in ADR 0068 needs the publication-level number.

**Every field of the Location Object is optional; `href` and `type` are the required ones on the
Locator itself.** Readium requires a Locator to say *which resource* it points into, and lets the
location within it be absent. A schema here that makes `progression` non-nullable is stricter than
Readium, and stricter in a way that will reject a legitimate "opened, nothing recorded yet" locator.

---

## Splink

Source: *Edge Metrics*, Splink documentation,
<https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_metrics.html>
(fetched 2026-09-10; the docs site does not stamp a version on the page).

### "accuracy is gameable by guessing the majority class" — ADR 0028 — CONFIRMED

Section *Metrics for Linkage* → *Accuracy*:

> Accuracy = (True Positives + True Negatives) / All Predictions
>
> This measures the proportion of correct classifications (of any kind). **This may be useful for
> balanced data but high accuracy can be achieved by simply assuming the majority class for highly
> imbalanced data (e.g. assuming non-matches).**

Verbatim, and the parenthetical "(e.g. assuming non-matches)" is the record-linkage-specific form of
the gaming ADR 0028 is guarding against.

**The same page carries a warning ADR 0028 should also be citing**, because it is the argument for
asserting *both* precision and recall rather than either:

> Each of these metrics looks at just one row or column of the confusion matrix. **A model cannot be
> meaningfully summarised by just one of these performance measures.**
>
> "Predicts cancer with 100% Precision" - is true of a "model" that correctly identifies one known
> cancer patient, but misdiagnoses everyone else as cancer-free.
>
> "AI judge's verdicts have Recall of 100%" - is true for a power-mad AI judge that declares everyone
> guilty, regardless of any evidence to the contrary.

The second example is precisely the defect ADR 0028 attributes to Jellyfin's `TmdbUtils.FindBestMatch`
(a scorer with no "no good match" return path), stated by Splink as a general property of recall
reported alone. And the page's opening note supports ADR 0028's insistence on a labelled fixture:
"All of these metrics are dependent on having a 'ground truth' to compare against. This is generally
provided by Clerical Labelling (i.e. labels created by a human)."

---

## Other standards claims found while reading the 72 records

These were not in the brief's list but are claims about standards, so they were checked too.

### "ORE Aggregations and IIIF Ranges are both their own classes" — ADR 0004 — CONFIRMED

ORE §3.1, *Aggregation*:

> An Aggregation is a Resource of type `ore:Aggregation` that is a set of other Resources. The type
> `ore:Aggregation` is associated with a Resource via an assertion by at least one Resource Map.

IIIF §2.1, *Defined Types*:

> **Range** — An ordered list of Canvases, and/or further Ranges. Ranges allow Canvases, or parts
> thereof, to be grouped together in some way. This could be for content-based reasons, such as
> might be described in a table of contents or the set of scenes in a play.

Both are first-class types. ADR 0004's statement of the deviation is accurate.

### "It is the one point all four standards agree on" (`person` means real humans only) — ADR 0006 — CONTRADICTED as stated

The record does not say *which* four standards. Taking ADR 0059's list of eight (IFLA LRM, LRMoo,
BIBFRAME 2.0, Schema.org, Dublin Core, PROV-O, OAI-ORE, IIIF Presentation 3.0), the agreement is not
unanimous, and the dissenter is one of the eight:

- **IFLA LRM agrees.** LRM-E7 Person: "The entity person is restricted to real persons who live or
  are assumed to have lived. [...] However, figures generally considered fictional (for example,
  Kermit the Frog), literary (for example, Miss Jane Marple) or purely legendary (for example, the
  wizard Merlin) are not instances of the entity person."
- **CIDOC CRM agrees.** E21 Person: "This class comprises real persons who live or are assumed to
  have lived. [...] The fact that a persona may erroneously be classified as an instance of E21
  Person does not imply that the concept comprises personae."
- **LRMoo agrees, and says so about characters specifically.** F38 Character: "Rather than merging
  characters with real persons, they should be described as disjoint, but related entities."
- **schema.org disagrees.** `schema:Person` is "A person (alive, dead, undead, or fictional)", and
  `schema:character` ranges over `schema:Person`.
- **PROV-O is silent.** `prov:Person` is defined only as "Person agents are people."

So the claim holds for the bibliographic and cultural-heritage models and fails for schema.org. The
fix is to name the standards: LRM, LRMoo and CIDOC CRM agree, schema.org does not, and the decision
follows the three that do — which is a stronger record than an unattributed "all four", because it
is checkable and it warns the reader that schema.org-shaped input will arrive with fictional people
typed as Persons.

### "OPDS, Subsonic and every other candidate IS TYPED BY MEDIUM" — ADR 0056 — JUDGEMENT

OPDS's own scope statements support the reading without stating it in those words.

OPDS Catalog 1.2 (published 11 November 2018, <https://specs.opds.io/opds-1.2.html>):

> The Open Publication Distribution System (OPDS) Catalog format is a syndication format for
> **electronic publications** based on Atom and HTTP.

OPDS Catalog 2.0 (<https://specs.opds.io/opds-2.0>, "a living standard. The core of the
specification has been stable since 2017"):

> Open Publication Distribution System (OPDS) 2.0 is based on the **Readium Web Publication Manifest
> model**, with a focus on aggregating **publications** together in order to facilitate their
> distribution.

"Publication" is broader than "book" — the Readium model covers audiobooks and comics — but it is
still a content-type scoping rather than a medium-agnostic catalogue protocol, and there is no
OPDS notion of a film or a TV episode. That is enough to support ADR 0056's decision. It is not
enough to support the stronger word "typed by medium" as a quotation from anything, so the record
should present it as our reading of the specs' scope, which is what it effectively is. Subsonic was
not checked in this pass.

---

## Summary

All 72 records under `docs/adr/` were read. **46 distinct claims about a published standard** were
found and checked against that standard's own text on 2026-09-10. Every verdict rests on a lookup
made in this run; nothing is from memory.

- **36 CONFIRMED**
- **6 CONTRADICTED**, in whole or in part
- **2 UNFOUNDED**
- **2 JUDGEMENT**

Every passage the records present as a quotation matched word for word: the OAI-ORE "not a 'global'
fact" sentence, LRM-E9 Nomen, LRM-E11 Time-span, the OWASP "Deny-lists are bypass-prone. Prefer
allow-lists." line, the MARC `deweyclassifierv0.1` example, and Splink's majority-class sentence.
The failures below are all in claims stated in the records' own words rather than quoted.

**6 CONTRADICTED.**

| ADR | Claim | What the standard says |
| --- | --- | --- |
| 0004 | LRMoo deprecated F16, F17 **and F18** with "use superclass F1 Work" | F18 Serial Work was **retained**: "F18 Serial Work \| F18 Serial Work \| Now a direct subclass of F1 Work". It is still declared in LRMoo v1.1.1. |
| 0026, 0032 | "OpenRefine splits `/reconcile` from `/extend`", "separate operations with separate endpoints" | Same endpoint, different parameter: `POST / queries=…` (§4.3) and `POST / extend=…` (§7.3). The operations *are* separated and data extension is a declared optional capability; the paths are not. |
| 0059, 0070 | "schema:author admits no fictional author"; "neither [schema:author nor CRM P14] admits a fictional author" | `schema:Person` is "A person (alive, dead, undead, or fictional)." CRM's `E74 Group`, a subclass of `E39 Actor`, expressly covers personae used by two or more people, with Betty Crocker and Ellery Queen as examples. |
| 0006 | `person` means real humans is "the one point all four standards agree on" | LRM, LRMoo and CIDOC CRM agree. schema.org — one of the eight standards ADR 0059 names — does not, and models characters as `schema:Person`. |
| 0071 | MARC 883 first indicator "0/1/2" | Four values: `#` No information provided/not applicable, `0` Fully machine-generated, `1` Partially machine-generated, `2` Not machine-generated. |
| 0034 | "DNS rebinding", implying the pin-the-resolved-address remedy comes from OWASP | The cheat sheet never uses "DNS rebinding"; it calls the attack "DNS pinning". Its remedies are internal-DNS-first resolution plus allowlist monitoring, and for Case 2, "don't forget to disable the support for redirection in the web client used". Connection pinning is ours, and is stronger than OWASP's. |

**2 UNFOUNDED.**

| ADR | Claim | Why, and what would settle it |
| --- | --- | --- |
| 0011 | BIBFRAME collapsed two levels into one "because trained cataloguers could not apply the distinction consistently" | The collapse is real, but no LC BIBFRAME document states that reason. The *Overview of the BIBFRAME 2.0 Model* gives no rationale at all; the FAQ says the model "balances the needs of those recording detailed bibliographic description…"; the 2012 report says "after applying a reductionist technique to simplify things as much as possible". **Settled by**: a citation to an LC BIBFRAME document or BIBFRAME editorial-group statement naming inconsistent cataloguer application. Separately, the pair BIBFRAME merged is Work + Expression (`bf:expressionOf` runs Work→Work), not Expression + Manifestation. |
| 0009, 0059 | "NO STANDARD GIVES BOTH [reification and multiple orderings] IN ONE CONSTRUCT" | Unbounded negative; not established, and OAI-ORE comes close — the Proxy is reified per-Aggregation membership (§5.3), one resource may be in many Aggregations (§4.3, §5.3.3), and sequencing is asserted between Proxies and is therefore per-Aggregation (§5.3.1). **Settled by**: narrowing it to "none of the standards in play" (checkable, and close to true), or by checking METS `<structMap>`, EAD and `rdf:Seq` and citing the survey. |

**2 JUDGEMENT.**

- ADR 0014, "schema.org three [title properties]" — no schema.org document states a count; the
  likeliest enumeration for a CreativeWork gives four (`name`, `alternateName`, `headline`,
  `alternativeHeadline`). Name them rather than count them.
- ADR 0056, "OPDS, Subsonic and every other candidate IS TYPED BY MEDIUM" — OPDS scopes itself to
  "electronic publications" (1.2) and to the Readium Web Publication Manifest model (2.0), which
  supports the decision but is our reading rather than a quotation. Subsonic not checked.

**Corrections to otherwise-confirmed claims**, worth making because someone will check them:

- ADR 0071's "MARC 21 field 883's worked example carries a version **for exactly this reason**" —
  the example is versioned (`$a deweyclassifierv0.1`), but MARC states no reason for it, and 883's
  own mechanism for expiring a computed claim is `$x` validity end date, not a version bump. Safe
  reading: "MARC's example is versioned, and versioning is what makes invalidation a query."

- ADR 0003 truncates LRM's sentence. The full text is "no work can exist without there being **(or
  there having been at some point in the past)** at least one expression of the work" — LRM already
  permits a work whose expressions are lost, which is the fixture case in ADRs 0057 and 0060.
- ADR 0014's six BIBFRAME title subclasses are one direct subclass (`bf:VariantTitle`) plus five
  under it, and the sixth (`bf:TransliteratedTitle`) is dated `2023-11-30`, so BIBFRAME 2.0 as
  published had five. The vocabulary is now at `3.0.1`, issued 2025-12-03; ADR 0059 still says 2.0.
- ADR 0067's contrast is real but weak: schema.org has no cardinality mechanism at all, so *no*
  schema.org property is cardinality-restricted. LRM's own many-to-many relation for this territory
  is LRM-R21 "is inspired by" (M to M), and LRM-R22's scope note concedes the boundary.
- ADR 0020 needs `totalProgression`, not `progression`: Readium's `progression` is within the
  resource, `totalProgression` within the publication, and every completion and roll-up rule needs
  the latter. All Location Object fields are optional in Readium.
- ADR 0034 should not be read as taking connection pinning from OWASP: the cheat sheet's remedies
  are internal-DNS-first plus allowlist monitoring, it never uses the phrase "DNS rebinding" (it
  calls the attack "DNS pinning"), and its Case 2 instruction is "don't forget to disable the
  support for redirection in the web client used".
- BCP 47's recommended spelling is `ar-Latn`, not `ar-latn`; case is insignificant for comparison
  but the registry form is RECOMMENDED for emission.
- ADR 0066's "the query is non-identifying" is a deviation from RFC 3986 §3.4, not a derivation
  from it, and needs `rel="canonical"` to carry the claim. The record should say so.
- LRMoo F38 has been moved out of LRMoo to CRMsoc and is absent from LRMoo v1.1.1; cite it as
  "LRMoo v1.0 §9.1, since transferred to CRMsoc".
- CIDOC CRM is at version 7.4 (August 2026); 7.1.3 is the ISO 21127 version. ADR 0059 versions
  neither CRM nor LRMoo.

**Version currency, collected.** ADR 0059's list of standards in play should carry versions, because
four of the eight have moved: BIBFRAME vocabulary 3.0.1 (2025-12-03), CIDOC CRM 7.4 (August 2026),
LRMoo 1.1.1 (November 2025), Reconciliation Service API 0.2 (2023-04-10). IFLA LRM (2017-12),
OAI-ORE 1.0 and IIIF Presentation 3.0.0 are unchanged.
