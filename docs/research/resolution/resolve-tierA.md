# Tier A resolution — G1..G11

STATUS: G1-G9 and G11 resolved. G10 was closed separately and is not covered here.

Started 2026-09-07 (G1-G5), resumed 2026-09-09 (G6-G9, G11). For each gap: what Plex does, what
Jellyfin does, what the wider industry does, and whether the "non-retrofittable" claim that puts it
in Tier A actually holds.

Method note: Plex evidence is `curl -s "https://support.plex.tv/articles/<slug>/"` (no User-Agent
header) plus python-plexapi source; Jellyfin evidence is jellyfin.org docs plus `jellyfin/jellyfin`
source read through the `gh` CLI; industry evidence is the named projects' own repos, docs and
published specifications. Every claim below carries a URL or a file path.

---
## G1 · Session and device identity

### What Plex does

Plex never had a cookie. Every request from every client carries a fixed block of `X-Plex-*`
headers, and the client identifier in that block is what makes a device a row.

`python-plexapi`'s `reset_base_headers()` is the canonical list, sent on every session request
(`plexapi/config.py`, read 2026-09-07 via
`gh api repos/pkkid/python-plexapi/contents/plexapi/config.py`):

```
X-Plex-Platform, X-Plex-Platform-Version, X-Plex-Provides, X-Plex-Product,
X-Plex-Version, X-Plex-Device, X-Plex-Device-Name, X-Plex-Client-Identifier,
X-Plex-Language, X-Plex-Sync-Version, X-Plex-Features
```

Eleven headers, not four. Three of them matter structurally: `X-Plex-Client-Identifier` (the
stable device key), `X-Plex-Provides` (a capability list — `controller`, `player`, `server`,
`sync-target`, `pubsub-player`) and `X-Plex-Language`. `X-Plex-Provides` is the field that makes
"play this on the TV from my phone" expressible at all: a controller can enumerate players
because each device declared what it can do at authentication time.

The device list is a first-class account object at `https://plex.tv/devices.xml`
(`plexapi/myplex.py:1636-1712`, class `MyPlexDevice`). Each row carries `clientIdentifier`,
`product`, `productVersion`, `platform`, `platformVersion`, `device`, `model`, `vendor`,
`provides`, `publicAddress`, `screenResolution`, `screenDensity`, `createdAt`, `lastSeenAt`
**and its own `token`**. So in Plex, as in Jellyfin, the device row *is* the session — one token
per device, not one token per account. Deletion is per device:
`MyPlexDevice.delete()` → `DELETE https://plex.tv/devices/{id}.xml`.

The user-facing article confirms the model and its consequences:
https://support.plex.tv/articles/115007577087-devices/ (HTTP 200, last modified 2019-02-28) —
"You can inspect a list of all devices that have been linked to your Plex account… Click the red
x on that device listing… Confirm the removal." It also documents the granularity that falls out
of a client-identifier key: "the same device is listed several times. This is particularly common
with Plex Web App, where each different browser you use is a separate instance."

Password rotation is explicitly the *blunt* alternative to per-device revocation, and Plex
documents it as such: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
(HTTP 200, last modified 2020-07-01) — "go to your Plex account profile, choose to change your
password, and check the **Sign out connected devices after password change** option… This will
invalidate all of your tokens." That is precisely the failure the prompt's single-password cookie
would be stuck with permanently.

Device-code pairing: `plexapi/myplex.py:1724-1790`, class `MyPlexPinLogin`, against
`https://plex.tv/api/v2/pins` — a four-character PIN entered at `https://plex.tv/link`, with
polling at one-second intervals, and an OAuth variant behind the same class. This is RFC 8628 in
all but name, and it exists because a TV remote cannot type a password. It is per-device by
construction: the PIN exchange yields a token bound to the `X-Plex-Client-Identifier` that
initiated it.

### What Jellyfin does

Exactly the shape the gap describes, and the sweep's summary is accurate.

`Jellyfin.Server.Implementations/Security/AuthorizationContext.cs` (read 2026-09-07) parses the
request into five fields:

```csharp
auth.TryGetValue("DeviceId", out deviceId);
auth.TryGetValue("Device",   out deviceName);
auth.TryGetValue("Client",   out client);
auth.TryGetValue("Version",  out version);
auth.TryGetValue("Token",    out token);
```

`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/Security/Device.cs` is the row,
and it is small:

```
Id (identity), UserId, AccessToken, AppName(64), AppVersion(32),
DeviceName(64), DeviceId(256), IsActive, DateCreated, DateModified, DateLastActivity
```

The constructor mints the token: `AccessToken = Guid.NewGuid().ToString("N", …)`. There is no
separate session table anywhere in the repo. A device row is a session, a session is a device
row, and per-device revocation is a `DELETE` on that row — which is why `DevicesController.cs`
can offer it at all.

Per-client display preferences hang off the same key, in a sibling table:
`Entities/Security/DeviceOptions.cs` → `(Id, DeviceId, CustomName)`. Note that it is keyed on
the *string* `DeviceId`, not on `Device.Id` — a small tell that it was added after the fact and
could not assume a device row exists.

Device-code pairing: **Quick Connect**. First commits on
`Jellyfin.Api/Controllers/QuickConnectController.cs` are 2020-08-16
(`gh api repos/jellyfin/jellyfin/commits?path=…`); it shipped in 10.7.0, tagged 2021-03-08
(`gh api repos/jellyfin/jellyfin/git/refs/tags/v10.7.0`). The API is `POST /QuickConnect/Initiate`
returning `{Secret, Code}`, then polling — RFC 8628's device/user code split under other names.

### Industry standard

There is a real standard here and it is not media-server-specific: **RFC 8628, OAuth 2.0 Device
Authorization Grant** (IETF, August 2019, https://www.rfc-editor.org/rfc/rfc8628). It is what
Netflix, YouTube, Spotify, Apple TV apps and both incumbents above independently converge on for
input-constrained devices. Plex's `plex.tv/link` PIN predates the RFC and matches its shape;
Jellyfin's Quick Connect postdates it and matches its shape.

The wider field is unanimous on *device rows*, and split only on *when they got them*:

- **Emby** — the ancestor of Jellyfin's design; the `Client`/`Device`/`DeviceId`/`Version`/`Token`
  authorization header is Emby's, inherited at the 2018 fork.
- **Navidrome** — implements the Subsonic API, where every request carries `c=` (client name).
  Navidrome materialises a `player` row from that: `db/migrations/20200310181627_add_transcoding_and_player_tables.go`.
  Note the date. Navidrome's first release was January 2020; the player table arrived in March,
  and it has been reshaped twice since — `20210619231716_drop_player_name_unique_constraint.go`
  and `20240802044339_player_use_user_id_over_username.go`.
- **Komga / Kavita** — JWT bearer tokens plus separately-managed API keys; neither has a device
  concept, and neither offers "play on another device".
- **Subsonic API** itself makes the client name a required query parameter on every call
  (`u`, `t`, `s`, `v`, `c`), which is the minimal version of the same idea: the wire format
  refuses to let a request be anonymous about who is asking.

Where there is no standard: what a device row must *contain*. Plex carries eleven fields
including screen geometry; Jellyfin carries five. Nobody agrees, and nothing depends on agreeing.

### Is it genuinely non-retrofittable?

**No. The claim does not hold — but the retrofit is the single most expensive one in this list,
and it has been done recently enough to price exactly.**

Audiobookshelf is the worked example, and it started from *precisely* CanonCore's proposed
position: an opaque, anonymous, long-lived token with no row behind it.

- **v2.26.0, 2025-07-12** — "JWT authentication with refresh tokens to replace old authentication
  system" and "Session model for managing sessions in the new auth system". The PR is
  `advplyr/audiobookshelf#4444`, *merged 2025-07-12, 52 files changed, +3168 / -862*
  (`gh api repos/advplyr/audiobookshelf/pulls/4444`).
- **v2.31.0, 2025-12-01** — token lifetimes reworked (#4756); "Admin users unable to close
  sessions for other users" (#4746).
- **v2.35.1, 2026-05-28** — "Duplicate refresh tokens across sessions can cause unexpected
  logout" (#5253 / #5255: *Add unique UUID to access and refresh tokens*). A session-identity bug,
  ten months after the rewrite.
- **#5281, 2026-06-02** — "/auth/refresh can make a session unrecoverable if the response is lost
  after token rotation". Another one.
- **v2.36.0, 2026-07-27** — only here does the user-visible feature set land: "Auth sessions table
  on account page w/ ability to logout of individual sessions", "Logout all devices button",
  "Changing user password invalidates all auth sessions", "Reject refresh tokens on API and
  WebSocket authentication" (#5387).

The decisive number is the contrast between the two ends of that timeline. The *model* change was
52 files and 3168 lines. The per-device revocation UI that the model made possible,
`advplyr/audiobookshelf#5400`, merged 2026-07-25, was **5 files, +131 / -2**. Twelve and a half
months and roughly 3,000 lines to install the row; a hundred and thirty lines to get the feature
everyone actually wanted once the row existed.

Navidrome tells the same story more cheaply, because it retrofitted at two months old rather than
at four years old: player table added 2020-03-10, unique constraint dropped 2021-06-19, key
changed from username to user id 2024-08-02. Three migrations to arrive at the shape.

**Verdict: reclassify to Tier B, with a strong "do it now" recommendation.** The gap's own
prescription — "four header fields and four columns, now" — is correct and costs almost nothing on
day one, and the ABS timeline is the argument for taking it. But it is demonstrably addable later,
so it is not in the same class as per-field provenance, which genuinely cannot be reconstructed
because the information was never captured. Every field a device row needs (client name, device
name, device id, version) is present in the request at the moment of the retrofit; nothing is
lost by waiting except thirteen months and three thousand lines. Do it in migration 1 because it
is cheap, not because it is impossible later.

One correction to the gap text: it says "four header fields and four columns". Plex uses eleven
headers, and the one the gap omits — `X-Plex-Provides`, the device's capability declaration — is
the one that "play this on the TV from my phone" actually depends on. If the point of the exercise
is casting (G51), the capability field belongs in the same first migration.

---
## G2 · Language, on every axis, including in the CMPP contract

The deepest item in the tier, and the one where the incumbents diverge most sharply from each
other. Taking the four sub-claims in turn.

### What Plex does

Plex splits language into three unrelated systems and stores **none of them per value**.

**1. Metadata language is a library setting, not a per-value fact.**
https://support.plex.tv/articles/advanced-settings-plex-movie-agent/ (HTTP 200, last modified
2025-04-13) lists, under "Specific to the Plex Movie Agent":

- *"Certification Country: This will influence which content rating system is used. **Changing
  this setting will require refreshing the metadata for new information to be reflected on
  items.**"*
- *"Use original titles: Use the original titles for all items, regardless of the library
  language."*
- *"Prefer artwork based on library language: Use localized posters when available. **This is
  determined by the library language setting.**"*

Three things follow, and they are the whole Plex answer. Language is a property of the *library*.
There is exactly one title per item, in the library's language. And the only way to change
language is to **re-fetch everything** — Plex says so in the article, in the imperative.
"Use original titles" is a boolean escape hatch, which is what you build when you have one title
column and two candidate languages: not a peer relationship, a switch.

Note that language and *country* are separate settings that both come from the same place. Content
ratings key on country, not language; artwork keys on language. Plex needs both.

**2. Track language is a per-user playback preference, matched against flags in the file.**
https://support.plex.tv/articles/204985278-account-audio-subtitle-language-settings/ (HTTP 200,
last modified 2025-07-24) is unusually explicit about the selection algorithm:

> "If an audio track that matches your preferred audio language is found, the first one will be
> used, else / If there are multiple unknown language audio tracks, the first track will be used,
> else / If there is a single audio track, it will be used even if the language doesn't match."

And on where the language comes from: *"For tracks embedded within the file, the language needs to
be set appropriately… If the language is not set, you can do so using various tools (e.g.
mkvtoolnix)"*, *"If the language for a track is not set (i.e. it is detected as 'unknown'), it will
be treated as if it does **not** match your preferred language settings"*, and for sidecars,
*"you'll want to ensure that the filename correctly includes the language code."*

This is G2 and G3 fused: language on a track is only knowable because something probed the
container. It is also a per-account setting, and the article says these settings are read on the
*sharing* side too — a guest on someone else's server brings their own preference.

Plex additionally names a **"Primary" language** — the preferred *subtitle* language is promoted to
that role, and the "Shown with Foreign Audio" mode compares the chosen audio track against it. So
Plex's model is: one primary language per user, plus per-axis overrides.

**3. Client language is a request header.** `X-Plex-Language` is in
`python-plexapi`'s `reset_base_headers()` (`plexapi/config.py`, default `'en'`), sent on every
request alongside the device identity headers. Plex's *wire protocol* carries language from the
first byte; its *database* does not.

The library-language setting has regional variants ("Spanish (Mexico)", "English (United Kingdom)",
"Chinese (Hong Kong)"): this comes from the sweep (`sweep-plex-support-D.md` under "094 —
/articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/", article 094) and
I did not independently confirm it at a Plex URL in this pass. It is corroborated from the other
side, though — see Jellyfin's shipped locale list below.

### What Jellyfin does

Jellyfin has all four of the things G2 says CanonCore is missing, and one more. The gap
understates Jellyfin's design in two places.

**A five-level preference cascade, not three.**
`MediaBrowser.Controller/Entities/BaseItem.cs:1742-1775`, `GetPreferredMetadataLanguage()`
(read 2026-09-07):

```
item.PreferredMetadataLanguage
  → first non-empty across GetParents()
  → first non-empty across GetCollectionFolders()
  → LibraryManager.GetLibraryOptions(this).PreferredMetadataLanguage
  → ConfigurationManager.Configuration.PreferredMetadataLanguage
```

Five levels: **item, ancestors, collection folder, library, server**. `GetPreferredMetadataCountryCode()`
at :1777-1806 is the identical cascade for country. `LibraryOptions.cs` carries
`PreferredMetadataLanguage`, `MetadataCountryCode` and — separately —
`SubtitleDownloadLanguages` (a string *array*, because you accept several).

Note the second and third rungs: an item inherits from its *ancestors*. That is exactly the shape
CanonCore's `groups` refuses to have — the gap is right that CanonCore's groups scope which
providers are asked and never what is asked of them, and Jellyfin's cascade is the counter-design.

**Language is on both sides of the provider contract.** This is the claim in the gap that most
needs correcting: Jellyfin's provider contract carries language in the *request* and in the
*response*.

- Request: `MediaBrowser.Controller/Providers/ItemLookupInfo.cs:41,47` —
  `public string MetadataLanguage { get; set; }` and `public string MetadataCountryCode { get; set; }`.
  Populated from the cascade at `BaseItem.cs:2669-2670`.
- Response: `MediaBrowser.Controller/Providers/MetadataResult.cs:44` —
  `public string ResultLanguage { get; set; }`, documented as *"Gets or sets the language the
  fetched metadata is in."*

**Content ratings are country-scoped, not language-scoped.** `BaseItem.cs:1859,1901,2953` call
`LocalizationManager.GetRatingScore(rating, GetPreferredMetadataCountryCode())`. This is a direct
hit on G11's "vocabularies have no notion of a scale": Jellyfin's answer to "is 15 stricter than
PG-13" is a per-country rating table that maps a certification string to an integer score.

**Regional variants, confirmed.** The shipped locale set at
`Emby.Server.Implementations/Localization/Core/` includes `en-GB.json`, `en-US.json`, `es-MX.json`,
`es-AR.json`, `es-DO.json`, `es_419.json`, `fr-CA.json`, `ar_SA.json`, `bg-BG.json` alongside the
bare two-letter files. Independent corroboration that a two-letter language code is not enough.

**The abandoned schema.** `src/Jellyfin.Database/…/Entities/Libraries/ItemMetadata.cs` is real in
the tree and is **not** in `JellyfinDbContext.cs`'s `DbSet` list (checked 2026-09-07 — the DbSets
are AccessSchedules, ActivityLogs, ApiKeys, Devices, DeviceOptions, DisplayPreferences, ImageInfos,
ItemDisplayPreferences, CustomItemDisplayPreferences, Permissions, Preferences, Users,
TrickplayInfos, MediaSegments, UserData, AncestorIds, AttachmentStreamInfos, BaseItems, Chapters,
ItemValues — no ItemMetadata). It is dead code for a schema Jellyfin designed and did not ship. Its
shape is worth reading precisely because it is the design a team reached for when they got a clean
sheet:

```csharp
protected ItemMetadata(string title, string language)   // both required
{
    ArgumentException.ThrowIfNullOrEmpty(title);
    ArgumentException.ThrowIfNullOrEmpty(language);
    …
}
[MinLength(3)][MaxLength(3)][StringLength(3)]
public string Language { get; set; }   // "ISO-639-3 3-character language codes"
```

Plus `Title`, `OriginalTitle`, **`OriginalLanguage`**, `SortTitle`, and collections of
`PersonRoles`, `Genres`, `Artwork`, `Ratings`, `Sources`. So: metadata as a *collection per item*,
language **required and non-nullable**, and a separate `OriginalLanguage` to hold "what language
was this made in" as distinct from "what language is this record in". The gap's summary of this is
accurate and the detail is stronger than the summary.

### Industry standard

There is a standard, it is unambiguous, and CanonCore's own list of governing standards already
contains three documents that mandate it.

**BCP 47 (RFC 5646) language tags are universal.** Everything below keys on them or on the ISO
codes they subsume.

**IIIF Presentation 3.0 §4.4, "Language of Property Values"** (https://iiif.io/api/presentation/3.0/,
version 3.0.0, fetched 2026-09-07) — the prompt names IIIF Presentation 3.0 as a standard in play,
and this is IIIF's single most distinctive design decision:

> "The values of these properties **must** be JSON objects, with the keys being the BCP 47 language
> code for the language, or if the language is either not known or the string does not have a
> language, then the key **must** be the string `none`. The associated values must be arrays of
> strings…"

with a worked example that is exactly CanonCore's problem — one painting with two English titles,
three French titles, and one untitled string:

```json
"label": {
  "en": ["Whistler's Mother", "Arrangement in Grey and Black No. 1: The Artist's Mother"],
  "fr": ["Arrangement en gris et noir no 1", "Portrait de la mère de l'artiste", "La Mère de Whistler"],
  "none": ["Whistler (1871)"]
}
```

and a four-branch normative **display-selection algorithm**, which is precisely the "two synopses
in two languages are two indistinguishable competing claims" problem the gap describes. IIIF also
notes "BCP 47 allows the script of the text to be included after a hyphen, such as `ar-latn`" —
script, not just language.

Two further points from IIIF that matter for CanonCore specifically. First, `none` is a *value*,
not a null: unknown-language and no-language are the same bucket and it is explicitly modelled.
Second, IIIF's algorithm says when *some* values have a language and none match, display the ones
that **do not** have a language — a rule you cannot express at all without the `none` key.

**IFLA LRM** — the prompt's primary standard, and the one that has a `nomen` entity, which
CanonCore adopts as a `kind`. LRM's Nomen entity carries language and script as attributes of the
name itself; that is the whole point of separating Nomen from the entity it names. (I fetched
https://www.iflastandards.info/lrm/lrmer.html, HTTP 200, but it is an 11KB index page rather than
the element set, so I am citing the design intent rather than a quoted attribute id. Treat this one
as weaker than the others.)

**Wikibase / Wikidata** — the prompt's model for `rank` and for the statements table. Wikidata
solves this at three levels: labels/descriptions/aliases are per-language maps on every entity; the
**`monolingualtext`** datatype attaches a language tag to a statement *value* (67 properties use
it); and RDF literals carry `@lang`. Notably, a **`multilingualtext`** datatype is listed under
"Pending data types → To plan" at https://www.wikidata.org/wiki/Help:Data_type (fetched
2026-09-07) — after thirteen years it is still unbuilt. Wikibase's answer is one language per
value, and several values.

**MusicBrainz** — https://musicbrainz.org/doc/Release (fetched 2026-09-07): a Release carries
*"Language: The language the release title and track titles are written in. The possible values are
taken from the **ISO 639-3** standard"* and *"Script: The script used to write the release title
and track titles. The possible values are taken from the **ISO 15924** standard."* Two columns,
language and script, same choice Jellyfin's abandoned schema made. MusicBrainz additionally puts
`locale` on aliases with a `primary` flag per locale — which is the "which of these is *the*
Japanese name" problem, solved with exactly the mechanism CanonCore already has for `rank`.

**The provider-contract side has no standard.** The **Reconciliation Service API 0.2** (W3C
Community Group Final Report, 2023-04-10,
https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/) — the spec behind
OpenRefine's `/reconcile` and `/extend`, which the prompt cites by name as its model for splitting
matching from applying — **has no language parameter and no language field anywhere in its
normative text.** I checked: the only occurrences of "language" in the document are in prose about
RDF and in a bibliography entry for OWL.

**Where the incumbents disagree:**
- Code system: Plex uses BCP 47-ish locale strings; Jellyfin's shipped code uses two-letter plus
  region files; Jellyfin's *abandoned* schema and MusicBrainz both chose ISO 639-3 three-letter.
  No convergence.
- Granularity: Plex stores one value in the library's language; Jellyfin stores one value and
  records which language it came in; IIIF and Wikidata store all values with tags. Three positions.
- Scope of the setting: Plex says library; Jellyfin says item→ancestor→folder→library→server;
  Audiobookshelf, Komga and Kavita have a single `language` field on the item with no preference
  system at all.

### Is it genuinely non-retrofittable?

**Split verdict. The `statements.language` column is Tier A and the claim holds. The CMPP contract
half is Tier B and the claim does not hold — there is a dated, in-place counter-example.**

**The contract half — refuted.** Emby/Jellyfin retrofitted language into an already-shipped
provider contract in one commit. `896cc599367894ff15405412ca824c447b6ed814`, **2016-09-14**,
"Prioritize metadata merging by preferred language" (`gh api repos/jellyfin/jellyfin/commits/896cc59…`),
against a codebase whose provider interface dated from 2011-2012 and whose `ItemLookupInfo` file
history goes back to at least 2014-02-07. The diff is small:

```diff
 public MetadataResult()
 {
     Images = new List<LocalImageInfo>();
+    ResultLanguage = "en";
 }
-
+public string ResultLanguage { get; set; }
```

plus, in `MetadataService.cs`, a re-ordering of provider results so that any result whose
`ResultLanguage` matches the requested `MetadataLanguage` merges first. Note two things. The
retrofit's backfill strategy is the constructor default `ResultLanguage = "en"` — every existing
and every non-declaring provider is *assumed* English, which is the cheapest possible answer and
also the precise cost of having waited. And the mechanism is a **merge order**, which is
structurally identical to CanonCore's existing source order: the retrofit CanonCore would need is
to make the source order a *(language, source)* order.

The objection to this evidence is fair and worth stating: Emby's provider contract is an in-process
.NET interface, and CMPP is HTTP against third-party repos on their own deploy cadence, which is
the gap's actual argument. But the HTTP case also has a worked answer. The Reconciliation Service
API has no language field, and the ecosystem's largest reconciliation service handles language
anyway by **putting it in the endpoint URL**: `https://wikidata.reconci.link/en/api` and
`https://wikidata.reconci.link/fr/api` are distinct services returning distinct manifests (verified
2026-09-07 — `"name":"entity"` vs `"name":"entité"`). One provider registration per language, no
contract change, no version bump, no coordination with anyone. That is a complete retrofit path for
CMPP that costs nothing today.

And the narrower point: **adding an optional request parameter and an optional response field to an
HTTP contract is additive, not breaking.** A provider that ignores `?language=` returns what it
returned before. A response with no `language` field means "unknown", which is IIIF's `none` and is
a legitimate value. What *would* be breaking is making it required — and nothing forces that.

**The statements column — upheld, for one specific reason.** The retrofit that cannot be done is
not "add a column". It is "recover which language each of the 40,000 already-stored values is in".
Emby's answer was to assume English. Plex's answer is in its own documentation: *"Changing this
setting will require refreshing the metadata for new information to be reflected on items"* — throw
it away and fetch again. Both are lossy, and both are what CanonCore would be reduced to.

But this is where CanonCore is genuinely better placed than either, and the tier assignment should
say so rather than treating it as pure loss. Every statement already carries `source` and
`observed_at`. If the server has a single language setting, then a language column added at
migration 12 is backfillable to "whatever the server language was when this was observed", which is
exactly Emby's `"en"` default but derived rather than assumed. And re-enrichment is non-destructive
in CanonCore in a way it is not in Plex: statements are appended with provenance, not overwritten,
so "fetch everything again in Japanese" adds rows rather than replacing them. Plex cannot do that
because it has one title column.

So the honest statement of the cost is: **the column is cheap now and costs a re-enrichment pass
plus a lossy backfill later.** That is a real cost and it argues for adding the column in migration
1. It is not the same class of loss as per-field provenance, where the information was never
observed by anything and cannot be recovered at any price.

**The `title` column — this is the part that is genuinely Tier A, and the gap slightly misplaces
it.** The unretrofittable decision is not `statements.language`; it is X4's decision that `title`
is a *column*. A column holds one value with no provenance and no rank. Two providers proposing a
Japanese and an English title have nowhere to both live. Moving `title` out of the items table into
statements later means every read path, every sort, every search index and every public payload
changes — and `sort_name` with it, because sort order is language-specific (Plex ships "Use
original titles" as a boolean precisely because it has one column and cannot hold two). That is a
schema-shape decision, and unlike a nullable column it cannot be added by an `ALTER TABLE`.

**Corrections to the gap text:**
- Jellyfin's cascade is **five** levels (item, ancestors, collection folder, library, server), not
  three.
- Jellyfin's provider contract **does** carry language in both directions today
  (`ItemLookupInfo.MetadataLanguage`, `MetadataResult.ResultLanguage`) — the gap implies only the
  abandoned schema had it.
- **Country is a second axis, not a synonym for language.** Plex and Jellyfin both carry
  language *and* country separately, because content ratings key on country and artwork keys on
  language. A `language` column alone does not close this gap.
- **Script is a third axis.** MusicBrainz (ISO 15924) and IIIF (`ar-latn`) both carry it. BCP 47
  subsumes it into the tag, which is the cheaper answer, and is the argument for BCP 47 over
  ISO 639-3.
- The `none` key from IIIF §4.4 is worth copying literally: unknown-language must be a value, not a
  null, or the "display the untagged ones" branch of the algorithm is inexpressible.

---
## G3 · Technical properties of a file, duration above all, and the analysis stage

### What Plex does

Plex runs a **named, separate, user-invocable stage** called Analyze, and the field list it
produces is the gap's field list almost verbatim.

https://support.plex.tv/articles/200289336-analyze-media/ (HTTP 200, last modified 2019-04-16):

> "Whenever an item is added to one of your Libraries, the Plex Media Server performs some analysis
> on it to gather information… Useful properties of your media might include (but not be limited
> to) things such to as: **Container** (MP4, MKV, AVI, M4A) · **Video Codec** (H.264, MPEG-2, VC-1,
> DivX, Xvid) · **Audio Codec** (AAC, MP3, AC3, DTS) · **Resolution** · **Duration** · **Bitrate**
> · **Aspect Ratio** · **Language**"

And the reason, stated as the product reason and not as an implementation note:

> "Your Server, together with your Plex Apps, can use this information to help determine **whether
> (and how) content can be played**… since your Plex Apps know what kind of content they can play
> and since your media analysis detected that the movie had DTS audio…"

That is X1's "say so plainly" requirement, and Plex's answer is: you cannot say it without having
analysed. Analysis also produces two side-effects Plex names separately — default artwork extracted
from the video, and video preview thumbnails ("a CPU-intensive process akin to transcoding the
file").

Analysis is invocable at three granularities — one item, a multi-select, or a whole library — from
the `…` menu, and the article warns that a library-wide run "may take a while".

**The storage shape is three levels, and duration appears at two of them.** From
`python-plexapi`'s `plexapi/media.py` (read 2026-09-07):

- `Media` — a *version* of the item. `aspectRatio, audioChannels, audioCodec, audioProfile,
  bitrate, container, duration, height, width, videoCodec, videoFrameRate, videoProfile,
  videoResolution, optimizedForStreaming, has64bitOffsets, hasVoiceActivity, target, proxyType,
  title`, plus photo-only EXIF fields (`aperture, exposure, iso, lens, make, model`). One item may
  have many `Media`.
- `MediaPart` — *"a single media part (often a single file)"*. `file, size, container, duration,
  audioProfile, videoProfile, packetLength, indexes, hasThumbnail, has64bitOffsets,
  optimizedForStreaming, accessible, exists, requiredBandwidths, **deepAnalysisVersion**`. One
  `Media` may have many `Part`s.
- `MediaPartStream` — the tracks inside the container, one row each.

Three details matter more than the field list. **`deepAnalysisVersion` is a version stamp on the
analysis result**, per file. **`accessible` and `exists` are separate booleans**, only populated on
a `checkFiles=True` reload — Plex distinguishes "the path is gone" from "the path is there and
unreadable". And the article documents the re-analysis trigger:

> "In rare cases, new versions of Plex Media Server may update the media analysis capabilities to
> correct something or add the ability to detect new things. In those cases, **content may be
> re-analyzed** when you access it after the new Server version is installed."

That sentence is the answer to the retrofittability question, written by Plex.

### What Jellyfin does

Jellyfin probes with **ffprobe**, unconditionally, and stores one row per stream in a wide table.

`MediaBrowser.MediaEncoding/Encoder/MediaEncoder.cs` (read 2026-09-07): `_ffprobePath` is derived
from the ffmpeg path by regex (`FfprobePathRegex().Replace(_ffmpegPath, "ffprobe$1")`, :221);
`GetMediaInfo` (:418) shells out with `-analyzeduration` and `-probesize` (:437-457); failure is
fatal — `throw new FfmpegException("ffprobe failed - streams and format are both null.")` (:571).
There is no fallback path. No ffmpeg, no Jellyfin.

`src/Jellyfin.Database/…/Entities/MediaStreamInfo.cs` is the storage, and it is **49 columns**:

```
ItemId, StreamIndex, StreamType, Codec, Language, ChannelLayout, Profile, AspectRatio, Path,
IsInterlaced, BitRate, Channels, SampleRate, IsDefault, IsForced, IsExternal, IsOriginal,
Height, Width, AverageFrameRate, RealFrameRate, Level, PixelFormat, BitDepth, IsAnamorphic,
RefFrames, CodecTag, Comment, NalLengthSize, IsAvc, Title, TimeBase, CodecTimeBase,
ColorPrimaries, ColorSpace, ColorTransfer, DvVersionMajor, DvVersionMinor, DvProfile, DvLevel,
RpuPresentFlag, ElPresentFlag, BlPresentFlag, DvBlSignalCompatibilityId, IsHearingImpaired,
Rotation, KeyFrames, Hdr10PlusPresentFlag
```

Four observations that bear on CanonCore directly. `Language` is on the **stream**, not the file —
G2 and G3 are the same table here. `IsExternal` means a sidecar and an embedded track are rows in
the same table, distinguished by a flag rather than by living in different places (CanonCore's
`files.role` puts them in different rows of `files` instead). `IsDefault`, `IsForced` and
`IsHearingImpaired` are the flags Plex's subtitle-selection article says it needs. And duration is
*not* here — it lives on the item as `RunTimeTicks`, because a duration belongs to the file, not to
a stream.

### Industry standard

Universal agreement that these properties exist and must be probed. No agreement on the prober,
and — importantly for CanonCore — **no consensus that it must be ffmpeg.**

- **ffprobe** (ffmpeg, LGPL/GPL) — Jellyfin (hard dependency), Emby, Audiobookshelf (vendors
  fluent-ffmpeg including `server/libs/fluentFfmpeg/ffprobe.js`).
- **MediaInfo / MediaInfoLib** — **BSD-2-Clause**, confirmed at
  `gh api repos/MediaArea/MediaInfoLib` (spdx_id `BSD-2-Clause`, last pushed 2026-08-28, actively
  maintained). Its `License.html` is the plain two-clause BSD text, copyright 2002-2025 MediaArea.net
  SARL. This is the named alternative in the gap and it checks out: it is not ffmpeg, it is
  permissively licensed, and it reads containers rather than decoding them.
- **TagLib** — **Navidrome migrated off ffmpeg onto it.** The repo has
  `adapters/gotaglib/gotaglib.go` as the live extractor (`go.senan.xyz/taglib v0.11.1` in `go.mod`)
  and keeps the old path in a directory literally named `scanner/metadata_old/ffmpeg/`. A media
  server replaced its probe backend wholesale, after shipping, and the old one is still sitting
  there under an `_old` name.
- **Calibre** — format-specific parsers, no external prober at all.
- **Komga / Kavita** — comic and book formats; page count and dimensions come from reading the
  archive and the images, not from a media prober.

Where there is genuinely no standard: **what "duration" means for a text or image edition.** This
is X5's problem and nothing in the field solves it uniformly. Audiobookshelf tracks audio duration
in seconds and, for ebooks, an EPUB CFI; Calibre stores no position at all; Komga and Kavita store
a page number. There is no cross-medium position type in the industry, which is evidence for the
prompt's "ONE number clears the position" being under-specified rather than for it being wrong.

### Is it genuinely non-retrofittable?

**No, and this is the weakest non-retrofittability claim in the whole tier. It should move to
Tier B — with the caveat that it blocks *shipping playback*, which is a different and real
constraint.**

The argument is short and it is decisive: **the file is still on disk.** Every property in G3 is
derivable, on demand, from bytes CanonCore has not thrown away. That is the definition of a
retrofittable field. Contrast per-field provenance, where the fact "TMDB said this on 3rd March"
is gone forever if it was not written down at the time.

The incumbents do not merely permit this retrofit, they perform it as routine maintenance:

- **Plex ships the re-analysis path as a documented feature and re-runs it on server upgrade** when
  "new versions of Plex Media Server may update the media analysis capabilities… content may be
  re-analyzed" (article above). `deepAnalysisVersion` on each `MediaPart` exists precisely so it
  can tell which files predate the current analyser.
- **Jellyfin adds technical-property columns by ordinary migration, repeatedly and recently.** From
  `src/Jellyfin.Database/Jellyfin.Database.Providers.Sqlite/Migrations/` (listed 2026-09-07):
  `20250327101120_AddKeyframeData.cs`, `20250327171413_AddHdr10PlusFlag.cs`,
  `20241112232041_fixMediaStreams.cs`, `20241112234144_FixMediaStreams2.cs`,
  `20260812050902_AddMediaStreamFilterIndex.cs`. Keyframe data and the HDR10+ flag were added on
  the same day in March 2025, to a table that has existed since the Emby era. Dolby Vision's eight
  columns and `IsHearingImpaired` arrived the same way. Jellyfin has been retrofitting this exact
  class of column for a decade and it costs one migration and a re-probe each time.
- **Navidrome replaced the whole prober** after shipping, as described above.

So the schema half is Tier C-to-B: a `media_streams` child table and a handful of columns on
`files` are additive, and the backfill is a scan, not a guess.

**What is actually being decided here, and it is not a schema freeze.** Three things:

1. **Whether ffmpeg is banned for *probing* as well as for transcoding.** This is X1 and it is a
   policy sentence, not a migration. MediaInfoLib being BSD-2-Clause and actively maintained makes
   the carve-out cheap and principled: "no transcoding, no encoding, no ffmpeg; container
   inspection via MediaInfo" is one sentence and it is defensible on the same grounds the ban was.
2. **Whether the scanner probes inline or analysis is a second stage.** Plex's answer — a distinct,
   separately-logged, separately-invocable stage with its own version stamp — is the better one and
   it costs a job and a column. The reason is not tidiness: a probe is orders of magnitude slower
   than a `stat`, and fusing them means the scanner's runtime is bounded by the slowest codec in
   the library. Adopt `deepAnalysisVersion` too; it is the mechanism that makes "we learned to
   detect something new" a re-run rather than a wipe.
3. **Whether "say so plainly" and the completion rules ship before analysis does.** *This* is the
   real constraint, and the gap is right that three settled rules are inert without duration. But
   the stop condition explicitly excludes playback ("They do not touch FILES, FILE IDENTITY, THE
   SCANNER, EDITION COVERAGE, PROGRESS, WATCH EVENTS OR PLAYBACK"), and the prompt names exercising
   the playback half as the first work after the cap. So the deadline for G3 is not migration 1 —
   it is the first playback commit. That is a genuine and near deadline, and it is worth saying
   plainly, but it is not the Tier A test.

**One thing here *is* worth deciding at migration 1, and the gap does not name it.** Plex's
`Media → Part → Stream` is three levels because a single logical version can span several files
(G4) and a single file contains several tracks. CanonCore's `files` table is one level, attached to
"item or edition, singular" (G8). If streams become a child table later that is additive; but if
`files` needs an ordinal (G4) and a coverage interval (G8), those are changes to the *attachment*,
and they interact. G3, G4 and G8 are one decision about the shape of the file layer, and taken
together that shape is worth settling early even though none of the three columns individually is
unretrofittable.

**Correction to the gap text:** it says Plex's Analyze pass is "separate from the scan and
separately logged". Separate from the scan, yes — but the article says analysis is *automatic on
add*, not deferred. The separateness is that it is independently **re-invocable** and
independently **versioned**, which is the property worth copying.

---
## G4 · Multi-part media: one edition spanning several files, in order

### What Plex does

Plex calls it **stacking**, keys it on filename, and — in the current version of its own
documentation — **tells users not to use it**.

https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/ (HTTP 200, last
modified **2026-05-22**), on multi-part movies:

> filenames end `- partX`, `- ptX`, `- cdX` … "and you replace X with the appropriate number
> (cd1, cd2, etc.)"
>
> **Notes:**
> - "Not all Plex apps support playback of stacked media"
> - "All parts must be of the same file format (e.g. all MP4 or all MKV)"
> - "All parts should have identical audio and subtitle streams in the same order"
> - "**Only stacks up to 8 parts are supported**"
> - "'Other Videos' libraries or those using the 'Plex Video Files Scanner' do not support stacked
>   content."
> - "Not all features will work correctly when using 'split' files."
> - "**To get a better overall experience, we strongly encourage you to instead use a tool to
>   join/merge the individual files into a single video.**"

That is the state of multi-part support at the market leader, dated four months ago. Seven caveats
and a recommendation to transcode your way out of the feature. The eight-part cap is the tell: a
hard limit like that is what a filename-keyed design produces when nobody wants to own the general
case.

Separately, Plex's *version* concept is a different mechanism entirely. `plexapi/media.py`'s
`Media` object carries `target` and `proxyType` (42 = optimized version), and one item holds many
`Media`, each holding many `Part`. So Plex's storage genuinely has both axes — several files in
sequence (`Part`s under one `Media`) and several alternatives (several `Media` under one item) —
even though the sequence axis is the one it disowns in the docs.

### What Jellyfin does

Two separate string arrays on `Video`, and the ordinal is the array index.
`MediaBrowser.Controller/Entities/Video.cs` (read 2026-09-07):

```csharp
public Guid? PrimaryVersionId { get; set; }      // :45
public string[] AdditionalParts { get; set; }    // :47   — sequence
public string[] LocalAlternateVersions { get; set; } // :49 — alternatives
public bool IsStacked => AdditionalParts.Length > 0; // :162
public IOrderedEnumerable<Video> GetAdditionalParts(User user = null) // :492
```

So Jellyfin does exactly what the gap prescribes for CanonCore — parts in order — and it makes the
Part/Version distinction structural: `AdditionalParts` is "more of the same thing, next", and
`LocalAlternateVersions` + `PrimaryVersionId` is "the same thing, differently". Resolution is
`Emby.Naming/Video/StackResolver.cs`, filename-driven like Plex's, with a dedicated
`ResolveAudioBooks` path that groups by directory.

This layer is still moving: `20260215201634_ChangePrimaryVersionIdToGuid.cs` (2026-02-15) and
`20260724185102_AddPrimaryVersionIdIndex.cs` (2026-07-24) are two migrations from this year on the
version link alone.

### Industry standard

No standard. Three approaches, and one of them is materially better than the two incumbents'.

- **Filename stacking** — Plex, Jellyfin, Emby, Kodi (`stack://` pseudo-protocol). The ordinal is
  parsed out of the name and never stored as a field the owner can correct.
- **A stored ordinal on the file row** — **Audiobookshelf**, and its shape is the one to copy.
  `server/objects/files/AudioFile.js` carries, per file: `index` (the resolved ordinal),
  `trackNumFromMeta`, `discNumFromMeta`, `trackNumFromFilename`, `discNumFromFilename`,
  `manuallyVerified`, `exclude`, and `duration`. Two independent *sources* for the ordering are
  kept side by side rather than collapsed; the owner can override; a file can be excluded from the
  sequence without being deleted.
- **Cumulative offsets computed on read** — also Audiobookshelf.
  `server/objects/files/AudioTrack.js` is `{index, startOffset, duration, title, contentUrl,
  mimeType, codec, metadata}`, and `setData(itemId, audioFile, startOffset)` fills `startOffset`
  from the running total of preceding durations. This is the piece the gap misses, and it is
  load-bearing: **an ordinal alone does not give you a position across parts.** "I am 4h12m into
  this audiobook" only maps back to (file 7, offset 214s) if every preceding file's duration is
  known. G4 therefore *requires* G3 for anything with a clock — which is a real dependency between
  two Tier A items and is not stated in either.

### Is it genuinely non-retrofittable?

**No. An integer column with a nullable default is the archetype of an additive migration, and the
backfill is exactly the filename parse that both incumbents use as their only mechanism.**

There is no lost information here. The files are on disk, their names contain the ordering, and if
the names do not, no schema decision made in migration 1 would have recovered it either. Plex and
Jellyfin both *derive* the ordinal at scan time from the filename rather than storing it, which is
proof by construction that the ordinal is recoverable from the corpus at any later date.

The one genuinely irreversible thing in this area is not the ordinal. It is **progress**. Progress
is per `(owner, edition)` and is one number. If an edition has three files and no ordering, any
progress number recorded against it is uninterpretable, and re-deriving the ordinal later does not
retroactively make an old number mean something. But that is not an argument for a Tier A column —
it is an argument that multi-part editions must not be *playable* before the ordinal exists, which
lands in the same place as G3: a first-playback-commit deadline, not a first-migration deadline.

**What to take from this gap, reordered by what actually matters:**

1. **The ordinal belongs on the file row, not in the filename.** This is where Audiobookshelf beats
   both incumbents and where Plex's public retreat ("we strongly encourage you to instead use a
   tool to join/merge") comes from: a derived ordinal cannot be corrected, so every mis-parse is a
   support ticket with no fix. Copy `trackNumFromMeta` / `trackNumFromFilename` / `manuallyVerified`
   / `exclude`: keep both derived sources, let the owner pin, let a file be excluded.
2. **Part and Version are two different relations and must not share a column.** Jellyfin proves
   this with two arrays; Plex proves it with `Part` under `Media` under item. The gap notes Plex
   calls the second a Version — the important consequence is that under direct-play-only, a Version
   is the *only* way to serve a device that cannot decode the primary file, so it is not optional
   decoration. It is also, notably, a second thing hanging off an edition, which makes
   `files → edition` a richer relation than "attached to item or edition, singular".
3. **Cross-part position needs per-part duration.** G4 cannot be delivered without G3.

**Verdict: Tier B/C on the schema, with a hard dependency edge to G3.** Add the ordinal in
migration 1 because it costs one column; do not claim it is unretrofittable, because both
incumbents retrofit it on every scan.

---
## G5 · Migration-ladder mechanics

Every sub-decision the gap lists exists, by name, in Jellyfin's code. This is the gap with the
cleanest answer available: there is a working implementation to copy, and a dated post-mortem
saying what it cost to arrive at it.

### What Jellyfin does

**The declaration.** `Jellyfin.Server/Migrations/JellyfinMigrationAttribute.cs` (read 2026-09-07):

```csharp
public JellyfinMigrationAttribute(string order, string name)   // order = ISO8601 DateTime string
public bool RunMigrationOnSetup { get; set; }
public JellyfinMigrationStageTypes Stage { get; set; } = JellyfinMigrationStageTypes.CoreInitialisation;
public DateTime Order { get; }
public string Name { get; }
public Guid? Key { get; }   // [Obsolete] "ONLY FOR LEGACY MIGRATIONS"
```

`RunMigrationOnSetup` is documented as *"whether the annotated migration should be executed on a
fresh install"* — exactly the sub-decision the gap names. The `Order` being an ISO8601 timestamp
rather than an integer is the mechanism that gives **one order across schema and data-fix
migrations**: EF Core's generated schema migrations under
`Jellyfin.Database.Providers.Sqlite/Migrations/` use the same `yyyyMMddHHmmss` prefix as the
hand-written data routines under `Jellyfin.Server/Migrations/Routines/`, so the two interleave in a
single sequence. The `Key` Guid is marked obsolete — the legacy scheme identified migrations by
GUID, and moving to ordered timestamps was itself a migration of the migration system.

**The stages.** `Jellyfin.Server/Migrations/Stages/JellyfinMigrationStageTypes.cs`, three of them:

```
PreInitialisation  = 1  "Runs before services are initialised. Reserved for migrations that are
                         modifying the application server itself. Should be avoided if possible."
CoreInitialisation = 2  "Runs after the host has been configured and includes the database
                         migrations."   ← default
AppInitialisation  = 3  "Runs after services has been registered and initialised. Last step
                         before running the server."
```

Plus a separate `Jellyfin.Server/Migrations/PreStartupRoutines/` directory for config-file
migrations that must run before anything else (`MigrateNetworkConfiguration`,
`MigrateEncodingOptions`, `MigrateMusicBrainzTimeout`, `RenameEnableGroupingIntoCollections`).

**The declared backup.** `Jellyfin.Server/Migrations/JellyfinMigrationBackupAttribute.cs`,
`AllowMultiple = true`, five booleans:

```
LegacyLibraryDb, JellyfinDb, Metadata, Trickplay, Subtitles
```

So a migration declares *what to back up*, not merely *that* to back up — and the set includes
on-disk artefact directories, not just the database. CanonCore's equivalent set would be the
database plus the artwork cache.

**The floor and the startup check — and the price of not having a version stamp.** This is the
sharpest evidence in the whole tier.
`Jellyfin.Server/Migrations/Routines/20250420193000_MigrateLibraryDbCompatibilityCheck.cs`:

```csharp
[JellyfinMigration("2025-04-20T19:30:00", nameof(MigrateLibraryDbCompatibilityCheck))]
…
private static void CheckMigratableVersion(SqliteConnection connection)
{
    CheckColumnExistance(connection, "TypedBaseItems", "lufs");
    CheckColumnExistance(connection, "TypedBaseItems", "normalizationgain");
    CheckColumnExistance(connection, "mediastreams", "dvversionmajor");
    …
        cmd.CommandText = $"Select COUNT(1) FROM pragma_table_xinfo('{table}') WHERE lower(name) = '{column}';";
        var result = cmd.ExecuteScalar()!;
        if (!result.Equals(1L))
        {
            throw new InvalidOperationException("Your database does not meet the required standard. Only upgrades from server version 10.9.11 or above are supported. Please upgrade first to server version 10.10.7 before attempting to upgrade afterwards to 10.11");
        }
}
```

Read what that actually does. Jellyfin cannot ask the old database what version it is, **because
the old `library.db` has no version stamp**. So it fingerprints the schema by probing
`pragma_table_xinfo` for three columns that happen to have arrived in the right releases, and
refuses to start if any is missing. That is the cost of the gap's first sub-decision, paid in full,
in 2025, by a ten-year-old project. It is also, on its own terms, a correct and cheap solution —
which is a fair counter-argument that a missing version stamp is survivable.

**The public consequences.** https://jellyfin.org/posts/jellyfin-release-10.11.0 (HTTP 200, fetched
2026-09-07), verbatim:

> "You MUST be running Jellyfin 10.10.7 before upgrading to 10.11.0! You may be fine with Jellyfin
> 10.9.11 but this is less-extensively tested. **Upgrading from any other versions is NOT supported
> and WILL fail**; upgrade to 10.10.7 first, then upgrade to 10.11.0. The initial upgrade will
> include **MULTIPLE LONG-RUNNING MIGRATIONS that may take up to several hours** depending on your
> library size and state. DO NOT CANCEL OR INTERRUPT THE SYSTEM during these migrations…"

And the rollback recipe, which is the gap's "declared backup with rollback on failure" spelled out
for users:

> "The upgrade will make a backup of your existing library.db file named `library.db.old`. This file
> can be used to recover should the upgrade fail… If you need to try the migrations again due to a
> failure, stop Jellyfin, rename this file back to `library.db`, then start Jellyfin again, and the
> migration will be re-attempted."

**The post-mortem.** https://jellyfin.org/posts/state-of-the-fin-2026-01-06 (HTTP 200, fetched
2026-09-07), verbatim:

> "Jellyfin 10.11 introduced a major EF Core refactor, consolidating the legacy `library.db` into a
> single unified `jellyfin.db`. Following **more than six months of development and an additional
> six months of release candidate testing**, version 10.11.0 was released last year… These issues
> are currently being tracked on GitHub across three categories: General bugs, Performance bugs,
> Migration and database bugs. We have been moving quickly to address these issues, delivering
> **four additional point releases with over 100 changes** since the initial 10.11.0 release… **The
> remaining migration issues are largely isolated, one-off cases and are unlikely to be resolved.**"

Twelve months of development and RC testing, then four point releases, then a written admission
that some instances stay broken.

### What Plex does

Plex is closed-source and does not publish its migration mechanics, so there is no equivalent
citation. What is observable is the shape of its answer to the same problem, and it is the opposite
one: Plex avoids migrating heterogeneous data by **freezing it**. From the sweep's reading of
https://support.plex.tv/articles/upgrade-music-libraries-new-metadata-system/ — when Plex changed
metadata providers in June 2019, "New content added to the library from this point forward will use
the new system. **Existing content will not change by default**… you need to take explicit action
to Refresh the content." Old rows keep the old semantics indefinitely; the user opts in per artist.
That is a legitimate third strategy and it is worth naming alongside "migrate everything" and
"quarantine what fails".

### Industry standard

There is a strong, boring standard here and every mature tool implements it.

- **A version table.** Alembic creates and reads `alembic_version`
  (https://alembic.sqlalchemy.org/en/latest/tutorial.html, fetched 2026-09-07: *"Alembic first
  checked if the database had a table called `alembic_version`, and if not, created it. It looks in
  this table for the current version, if any, and then calculates the path from this version to the
  version requested, in this case `head`"*). Flyway uses `flyway_schema_history`; Rails uses
  `schema_migrations`; Django uses `django_migrations`; EF Core uses `__EFMigrationsHistory`. No
  disagreement whatsoever.
- **A declared floor.** Flyway's answer is the **Baseline Version Setting** —
  https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-baseline-version-setting
  (HTTP 200, page last updated 2026-09-03, published 2025-01-15): *"The version to tag an existing
  schema with when executing baseline."* Type String, default `"1"`. Baselining is precisely "we do
  not migrate from before here".
- **`head` as a named target and a computed path.** Alembic's `upgrade head` computes the path from
  the recorded version; this is what makes "empty → head" a one-command CI job.
- **A fresh install must not replay repairs.** This is where practice diverges most and where
  Jellyfin's `RunMigrationOnSetup` is the clearest published answer. Rails' equivalent is
  `db:schema:load` + `rake db:schema:load` stamping all migrations as applied rather than running
  them; Django's is `--fake-initial`. Three names for the same idea; nobody skips it.

Where there is **no** standard, and the gap is right to flag it: **what to do with a row that
cannot be transformed.** Alembic, Flyway, Rails and Django all assume a migration either succeeds
or aborts the transaction. None of them has a quarantine concept. Jellyfin's honest answer is the
one quoted above — some rows never migrate and the project stops trying. The gap's proposal ("a
migration that cannot transform a row quarantines it and counts it") has no industry precedent I
could find in a migration framework, and that is an argument *for* it rather than against: it is
the one place CanonCore would be ahead, and it costs a table CanonCore already has.

### Is it genuinely non-retrofittable?

**Mostly no, with one genuine exception.**

- **Version stamp — retrofittable, and everyone retrofits it.** Flyway's `baseline` command exists
  for exactly this: point it at an unstamped production database, declare a baseline version, and
  the ladder starts from there. Jellyfin's fingerprint check is the cruder version of the same move
  and it works. What you lose by waiting is not the ability to have a stamp; it is the ability to
  distinguish versions *earlier* than the baseline — which is why the compatibility check has to
  probe for three arbitrary columns instead of reading one integer.
- **Floor, startup check, staging, `RunMigrationOnSetup` — all retrofittable, all dated.** Jellyfin
  added the entire framework (`JellyfinMigrationAttribute`, the three stages, the backup attribute,
  the compatibility check) in the 10.11 cycle, in 2025, into a codebase from 2018 that inherited a
  codebase from 2011. The `[Obsolete]` legacy-Guid constructor is the seam where the old system is
  still visible. That is a complete, in-place retrofit of migration-ladder mechanics onto a project
  with hundreds of thousands of installs.
- **Empty→head CI run — retrofittable at any moment.** It is a CI job. It costs nothing to add on
  day one and nothing to add on day 900, except that on day 900 it will fail and you will have to
  fix whatever it finds.

**The exception, and it is the real Tier A content of this gap: the migrations you write before you
have the discipline are the ones you cannot fix.** A ladder is only forward-applicable if every rung
was written to be. Once a released version has run migration 7 on someone else's data, migration 7
is frozen — that is the prompt's own rule and it is correct. So what is unretrofittable is not the
*mechanism* but the *history*: every migration authored before the rules exist is a rung you may
later discover is not forward-applicable, and by then it is somebody's production database.
Jellyfin's "remaining migration issues… are unlikely to be resolved" is exactly that debt coming
due.

**Verdict: Tier A for the *rules*, Tier B/C for the *mechanism*.** The distinction matters for what
goes into migration 1. A version table, a floor constant and an `applied_on` timestamp are three
lines and belong there. The stage enum, the backup declaration and the quarantine table can arrive
whenever they are needed — Jellyfin proves it. But "every migration is written to be
forward-applicable, and CI proves it from empty every release" is a *policy that must be in force
from commit 1*, because its violations are only discoverable after they have shipped.

**The one thing to copy verbatim:** the ISO8601-timestamp ordering key. It is what lets schema
migrations and data-fix migrations share one sequence without a second numbering scheme, and it is
the sub-decision in the gap's list that is hardest to change later, because renumbering a ladder
that has run on someone's data is exactly the thing the ladder rule forbids.

---
## G6 · CMPP has no version

Resumed 2026-09-09. **Citation warning, and it is not decoration: SPEC.md was being edited
concurrently** by another resolution pass throughout this session, and its line numbers moved four
times while G6-G11 were being written (`EVERY PROVIDER WE WRITE…` was line 550, then 591, then 820).
Every `SPEC.md:NNN` below was re-verified against the working copy at HEAD `4d09b18` plus
uncommitted changes, **SPEC.md md5 `21ee641b473aa1d34c5ff07790965c26`**, on 2026-09-09 — all 33
citations resolved to their quoted anchor at that moment. They will drift again. **Trust the quoted
text, not the number**: every citation carries enough of the line to be found by search.

### First: what does CMPP stand for?

**Nothing, anywhere in the current specification. The acronym is used and never expanded, and the
one expansion that exists in the repo is in archived material, is contested, and was contested by
the archive itself.**

Every occurrence in the live documents:

- `SPEC.md:82` — "This is the test that fails if CMPP is secretly two bespoke integrations"
- `SPEC.md:810` — "CMPP is CanonCore's own contract. No compatibility layer with any other product."
- `SPEC.md:815` — "THE CMPP STORE — publicly addable providers, ACCEPTED rather than open."
- `CONTEXT.md`, the **CMPP** headword under "Sources" — defined but not expanded:
  "**CMPP**: / CanonCore's own provider contract, answered over HTTP by every provider."
- `HANDOFF.md:97` — "Providers are URLs answering a contract (CMPP)"

The only expansion in the entire repository is in the forensic record, at
`17-ALL-TERMS-raw.md:55`, and it is recorded there **as a conflict**:

> **CMPP** | RB: "The **CanonCore Metadata Provider Protocol**: the HTTP contract between the
> product and any external metadata source. Metadata, never media bytes." _Avoid_: plugin API,
> scraper, importer, provider SDK, "Canonical Media Provider Protocol". … **Expansion conflict**:
> UNI calls it "the canonical-metadata contract" and flags the acronym as inherited: *"Naming note:
> acronym inherited from the spec — Universora-native name TBD."*

and again at `:343`:

> **13. CMPP's expansion changed.** … RB fixes it as "the **CanonCore Metadata Provider Protocol**"
> and adds `_Avoid_: "Canonical Media Provider Protocol"` — naming the wrong expansion as a scar.

So: three candidate expansions have been in circulation across predecessor projects
(*CanonCore Metadata Provider Protocol*, *Canonical Media Provider Protocol*, *canonical-metadata
contract*), one predecessor explicitly recorded the expansion as unresolved, and the current
SPEC.md and CONTEXT.md settle it by not stating one at all. **I am not inventing one.** The
decision is open, and it is a decision worth taking in the same change that versions the contract,
because a version string is the first thing that gets a name stamped on it — `identifier`,
`User-Agent`, a media type. Note that the two live documents *do* agree on the substance ("provider
contract", "answered over HTTP", "never media bytes"); it is only the letters that have no referent.

### What Plex does

**Plex's third-party metadata provider contract has a `version` field in the provider root, and it
made it optional.** This is the closest possible analogue to CMPP: Plex reopened third-party
metadata as a plain HTTP contract on **2025-12-09** and published a schema for the provider's root
response.

Official documentation, https://developer.plex.tv/pms/ (fetched 2026-09-09; the embedded OpenAPI
document declares `"openapi":"3.1.0"` and `"info":{"title":"Plex Media Server","version":"1.2.2"}`),
section **"MediaProvider Response"**:

> The root of the Media Provider must return some necessary attributes which define a metadata
> provider.
>
> | Field | Type | Required | Description |
> |---|---|---|---|
> | `identifier` | string | **Yes** | Unique identifier for this media provider |
> | `title` | string | **Yes** | A human readable title for the media provider |
> | **`version`** | **string** | **No** | **The version of the API being called** |
> | `Feature` | array | **Yes** | Array containing the features provided by the media provider |

The same table is in Plex's own reference implementation, `plexinc/tmdb-example-provider` (created
2025-10-07, last pushed 2025-11-12, 18 stars, no licence file; read 2026-09-09 via `gh api`), in
`docs/MediaProvider.md`, and the type in `src/models/MediaProvider.ts` is:

```typescript
export interface MediaProvider {
  identifier: string;
  title: string;
  version?: string;          // optional
  Types: TypeDefinition[];
  Feature: Feature[];
}
```

with the example value `"version": "1.0.0"`.

Three things to take from this, and the third is the important one:

1. **The field exists and is in the root response** — the same place CanonCore would have to put
   it, returned from a GET on the provider's base URL with no parameters.
2. **It is optional, and its description is ambiguous.** "The version of the API being called" does
   not say whether it is the *contract* version or the *provider's own* version, and the example
   value `1.0.0` is consistent with either reading. That ambiguity is what an optional field with a
   one-line description buys you, and it is worth not copying.
3. **Plex does not evolve the contract by version. It evolves it by capability.** The `Feature`
   array is the mechanism: `metadata` and `match` are Required, `collection` is not, and the wider
   media-provider feature list (`search`, `content`, `manage`, `timeline`, `rate`, `playqueue`,
   `subscribe`, `promoted`, `continuewatching`, `imagetranscoder`, `queryParser`, `grid`, …) is a
   set a provider declares into. A provider that does not implement a thing omits its feature entry,
   and the server does not offer it. Adding a capability is therefore additive by construction and
   needs no version bump at all — which is exactly why Plex could afford to leave `version` optional.

And it is worth recording what a *live* third-party HTTP metadata contract looks like nine months
into its life. Plex staff, 2025-12-09, https://forums.plex.tv/t/announcement-custom-metadata-providers/934384
(post 1, fetched via the Discourse JSON endpoint 2026-09-09):

> **Current limitations and missing features** … Currently only Movie and TV Libraries are
> supported. Music libraries will come later… Only **unauthenticated requests** are currently
> supported… Metadata support for "streams" is not yet implemented… **Provider-specific preferences
> are not yet implemented.** … Currently we only pass some fixed standard query parameters with
> requests like language, country, etc. **Expect some bugs early on.**

Every one of those is a future breaking change to a contract third parties are being invited to
build against *today*. Plex shipped it anyway, with an optional version field and a feature array,
and told developers to start. That is the market leader's actual risk appetite on this exact
question.

### What Jellyfin does

Jellyfin has no third-party metadata *contract* to version. Its metadata providers are in-process
.NET classes implementing `IRemoteMetadataProvider<TItemType, TLookupInfo>`, shipped inside plugin
assemblies. So the versioning problem lands one level down, on the **ABI**, and Jellyfin's answer
there is the sharpest published statement in the category of what a version bump means.

**Per-version `targetAbi` in the plugin manifest.** `MediaBrowser.Model/Updates/VersionInfo.cs`
(read 2026-09-09 via `gh api repos/jellyfin/jellyfin/contents/...`):

```csharp
/// <summary>
/// Gets or sets the ABI that this version was built against.
/// </summary>
/// <value>The target ABI version.</value>
[JsonPropertyName("targetAbi")]
public string? TargetAbi { get; set; }
```

Note *per version*, not per plugin: a `VersionInfo` row carries `version`, `changelog`, `targetAbi`,
`sourceUrl`, `checksum`, `timestamp`, `repositoryName`, `repositoryUrl`. One plugin can therefore
offer several versions built against several server ABIs, and the server picks.

**The check, and the fallback.** `Emby.Server.Implementations/Updates/InstallationManager.cs`
(read 2026-09-09):

```csharp
:131   if (!Version.TryParse(ver.TargetAbi, out var targetAbi))
:137   if (_applicationHost.ApplicationVersion >= targetAbi)
:201   if (Version.TryParse(version.TargetAbi, out var targetAbi) && _applicationHost.ApplicationVersion < targetAbi)
:269   var appVer = _applicationHost.ApplicationVersion;
:271       .Where(x => string.IsNullOrEmpty(x.TargetAbi) || Version.Parse(x.TargetAbi) <= appVer);
```

Line 271 is the retrofit rule in one clause: **an empty `targetAbi` is treated as compatible with
everything.** Absence has a defined meaning, and that meaning is the pre-versioning behaviour.

**A first-class status for the mismatch.** `MediaBrowser.Model/Plugins/PluginStatus.cs`:

```csharp
/// <summary>
/// This plugin does not meet the TargetAbi requirements.
/// </summary>
NotSupported = -2,
```

An incompatible extension is not an error and not a crash; it is a *state* the plugin sits in,
listed in the UI, alongside `Disabled`, `Malfunctioned`, `Superseded` and `Deleted`.

**And the release rule that defines the bump.** https://jellyfin.org/docs/general/contributing/release-procedure/
(HTTP 200, fetched 2026-09-09):

> Jellyfin uses semantic versioning. All releases will have versions in the `X.Y.Z` format, starting
> from `10.0.0`. …
> **X: Major Versions** — Breaks compatibility with the **HTTP or plugin APIs**
> **Y: Minor Versions** — Introduces new features; Makes minor backwards-compatible API changes
> **Z: Hotfix Versions** — Critical bug fixes or minor changes

The gap's summary of this is accurate. The major-version trigger is defined *entirely* by what a
release does to the interfaces other people build against — not by feature size, not by scope. That
is a rule CanonCore can adopt verbatim and it costs a paragraph.

The page also carries the honest caveat, worth quoting because CanonCore's `Do not preserve backward
compatibility` is the same posture stated more baldly:

> Note however that the `10.Y.Z` release chain represents the "cleanup" of the codebase, so it
> should be accepted that `10.Y.Z` breaks all compatibility, at some point, with previous
> Emby-compatible interfaces, and **may also break compatibility with previous 10.Y releases if
> required for later cleanup work.**

### Industry standard

There is a real standard here, and unusually the single best precedent is a specification SPEC.md
already cites for something else.

**The W3C Reconciliation Service API** — the OpenRefine `/reconcile` protocol. SPEC.md invokes it at
line 766 ("OpenRefine splits /reconcile from /extend") to justify the matching/applying split. The
same specification answers G6, and answers it *by having performed the exact retrofit under
discussion*.

W3C Community Group Final Report, **specs 0.2, 2023-04-10**,
https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/ (HTTP 200,
fetched 2026-09-09), §3.1 Service Manifest:

> When the reconciliation service endpoint is queried with a HTTP GET query without parameters, the
> service manifest MUST be returned. A service manifest consists of the following fields:
>
> **`versions`** — The array of API versions supported by the endpoint, such as `["0.1", "0.2"]`.
> **Since this field did not exist in version 0.1, services which do not declare a `versions` field
> are expected to only support version 0.1.**

and §1.4.2, listing what 0.2 changed:

> Initial improvements to the specifications made by our Community Group. Most of them are
> backwards-compatible, except for the requirement to support CORS…
> — **Let manifests announce which versions of the protocol are supported by the service**

That is the whole answer to "a contract with no version cannot evolve", written down by a W3C
community group about a contract with dozens of independently operated third-party endpoints. The
version field was **added in the second version**, and the absence of the field was given a defined
meaning. Note also the *shape*: an **array**, not a scalar — a service declares every version it
speaks, so a client can negotiate rather than guess.

**Subsonic** is the other end of the design space and shows a fuller handshake. https://www.subsonic.org/pages/api.jsp
(HTTP 200, fetched 2026-09-09):

- On every request: `v` — Required: **Yes** — "The protocol version implemented by the client, i.e.,
  the version of the `subsonic-rest-api.xsd` schema used".
- On every response: `<subsonic-response xmlns="http://subsonic.org/restapi" status="failed"
  version="1.1.0">` — the server states its version too.
- And two reserved error codes, in both directions:
  **`20` — "Incompatible Subsonic REST protocol version. Client must upgrade."**
  **`30` — "Incompatible Subsonic REST protocol version. Server must upgrade."**

Subsonic is the contract Navidrome implements, which SPEC.md cites at line 1225 as the
highest-leverage client work in the category. Its version handshake is mandatory, bidirectional,
and has been carried by every third-party Subsonic client for fifteen years.

**Where the incumbents disagree, and it matters:** Plex evolves by **capability declaration**
(optional version, required feature array); Subsonic evolves by **version negotiation** (required
version, no feature array); the Reconciliation API does **both** (a `versions` array *and* optional
service blocks — `preview`, `suggest`, `extend` — that a manifest either declares or omits). The
Reconciliation API's combination is the right one to copy, and CanonCore is already half way there:
`browse OPTIONAL and DECLARED` (SPEC.md:470, `providers` table) is a capability declaration in everything but name.
What is missing is only the other half.

There is no standard on the *format* of the version string. Semver (Jellyfin, Plex's example),
a two-part decimal (Reconciliation, Subsonic), and a dated URI (IIIF's `@context`) are all in use.
Nothing depends on agreeing.

### Is it genuinely non-retrofittable?

**No — and the counter-evidence is unusually direct, because the closest analogue in the world
performed this exact retrofit and wrote down how. But the deadline the gap is reaching for is real;
it is simply not the first migration.**

Three separate claims are tangled together in the gap text. Take them apart.

**Claim 1: "you cannot retroactively version somebody else's already-deployed service." True, and
irrelevant.** You do not have to. You version *your own* contract, and you define what the absence
of a version means. Both incumbents and the standard do precisely this:

- Reconciliation API 0.2: "services which do not declare a `versions` field are expected to only
  support version 0.1."
- Jellyfin `InstallationManager.cs:271`: `string.IsNullOrEmpty(x.TargetAbi) || Version.Parse(x.TargetAbi) <= appVer`.

The retrofit costs exactly one thing: **you burn the default.** "No version field" becomes
permanently reserved to mean "version 1", and you get one such bump for free. After that the field
is mandatory anyway. So the honest price of deferring is not a rewrite — it is one interpretation,
spent once.

**Claim 2: "CMPP is implemented by third parties, on their own deploy cadence." Not yet it isn't,
and not at the stop condition.** SPEC.md:63 requires "TWO WORKING PROVIDERS, each in its own repo
**in the CanonCore organisation**", and SPEC.md:820 makes that structural: "EVERY PROVIDER WE WRITE
LIVES IN A SEPARATE REPO in the CanonCore organisation. Separate deploy, separate lifecycle, no
shared code." At the four green conditions, the population of CMPP implementers is *one person* and
both repos are theirs. The third parties enter at SPEC.md:815, **THE CMPP STORE**, which the sweep
itself files as Tier C policy and which is nowhere in the stop condition.

So the deadline is not migration 1 and it is not the first commit. It is **the first provider
CanonCore does not operate** — the store's first accepted entry, or the first private URL somebody
else runs. That is a genuine, nameable, and much later deadline, and stating it that way is more
useful than "Tier A", because it tells you what event closes the window rather than which sprint.

**Claim 3, the one that actually holds: the field is a rounding error and the moment is now.**
Everything above argues the gap is *mis-tiered*, not that it is wrong to act. The cost of adding
`version` to the CMPP root response before anything ships is one string in one JSON object and one
line in the response validator. The cost of adding it after the store opens is a compatibility
shim, a defined default, and a migration for every stored provider row. The asymmetry is enormous
and the work is trivial. Nobody sensible defers this.

**What to actually decide, in priority order:**

1. **Copy the Reconciliation API's shape, not Plex's.** A `versions` **array** in the provider root
   response, **required**, listing every contract version the provider speaks. An array rather than
   a scalar because it is what makes a transition possible at all: during a bump, a provider
   declares `["1","2"]` and both old and new CanonCore instances work against it. A scalar forces a
   flag day, which is precisely the thing a store cannot coordinate.
2. **Keep declaring capabilities as well, and treat that as the primary evolution mechanism.** CMPP
   already has one — `browse OPTIONAL and DECLARED` — and Plex's `Feature` array shows how far it
   scales: thirteen capabilities, two required, and no version bump for any of them. **Most CMPP
   changes should be a new optional capability, not a new version.** A version bump should be
   reserved for changing the meaning of something that already exists, which is the only change a
   capability flag cannot express.
3. **Adopt Jellyfin's definition of a major version verbatim.** "Breaks compatibility with the HTTP
   or plugin APIs" — for CanonCore, "breaks CMPP or the public read path". SPEC.md's `Do not
   preserve backward compatibility` (line 1361, CONSTRAINTS) is a rule about internal code paths and it says
   nothing about a contract other people implement; the two rules need to be visibly distinct or an
   implementer will apply the wrong one to CMPP. That is a paragraph, and it is the cheapest thing
   in this entire gap.
4. **Give a version mismatch a defined outcome, not an exception.** Subsonic reserves error codes 20
   and 30 in both directions; Jellyfin gives it a plugin *state*, `NotSupported = -2`, so an
   incompatible extension shows in the UI as incompatible rather than as broken. CanonCore's
   equivalent is a provider row state — the same instinct as `quarantine` on a vocabulary, and the
   same reason: an unusable thing that is *named* unusable is fixable, and one that merely errors is
   not.
5. **Expand the acronym, or stop using it.** See above. Three expansions have circulated, one
   predecessor recorded it as unresolved, and the live documents use the letters nine times
   (three in SPEC.md, five in CONTEXT.md, one in HANDOFF.md) without saying what they stand for. The version string will carry whatever name is chosen,
   so this is the moment.

**Verdict: Tier B, with a hard deadline that is not the first migration.** The version field is
retrofittable — the W3C Reconciliation Service API retrofitted it into a live multi-implementer
contract and published the rule for doing so, and Jellyfin runs the same rule in code. The window
closes at the first provider CanonCore does not operate, not at the four green conditions. Add it
anyway, in the first version of the contract, because it costs one field and defers nothing. The
*non-retrofittable* framing is what should be corrected; the *do it now* conclusion is right.

---
## G7 · Artwork has no rank, no dimensions, no per-role limit and no quality floor

Scope note: **the `rank` / `is_default` quarter of this gap is already resolved, in
`resolve-X7-X13.md` under X7**, with Plex's `selected` flag, Komga's `MarkSelectedPreference`,
Wikidata's preferred rank and IIIF's ordered thumbnail array, plus fifteen years of Plex forum
evidence that a pin without a survival rule is not a pin. That verdict stands and is not repeated
here. This section resolves the other three — **dimensions, a per-role limit, and a quality floor** —
and the blurhash the gap names as adjacent.

**A change landed in SPEC.md between the sweep and this pass, and it reverses the retrofit answer.**
The `artwork` table now reads (SPEC.md:536-560, working copy, read 2026-09-09):

> `artwork` ITS OWN TABLE, not a statement. **The PROVIDER URL IT CAME FROM, THE LOCALLY STORED
> BYTES, `fetched_at`**, the role (poster|backdrop|title-logo|still), the licence and attribution
> string it came with, and its extracted palette. **THE BYTES ARE STORED AND SERVED BY CANONCORE.**
> … EXPIRY IS A READ-TIME CHECK, NOT A JOB. A row whose `fetched_at` is older than its provider's
> declared `max_cache_age` reads as ABSENT

and `providers` now carries "A PROVIDER ALSO DECLARES ITS CACHE CEILING AND **ITS STORED IMAGE
VARIANT**. `max_cache_age` is absent for the archive's wiki and six months for TMDB… Declaring the
stored variant too (a w500 poster, a w780 backdrop) is what makes the image store bounded BY THE
CATALOGUE at design time" (SPEC.md:481-491).

The sweep's finding was written against a table that held a URL. It now holds bytes. Read the whole
of what follows with that in mind: it makes two of the four items *easier* and one of them *much
worse*.

### What Plex does

**On the contract side, Plex asks for less than CanonCore already has, and asks for none of the four
things in this gap.** From the official metadata-provider schema, https://developer.plex.tv/pms/
(fetched 2026-09-09) and mirrored in `plexinc/tmdb-example-provider` `docs/Metadata.md` (read
2026-09-09 via `gh api`):

> ### `Image` Array (Highly Recommended)
> **Array of all available image assets in various dimensions.**
>
> Not all types are required but it is recommended to supply at least "coverPoster" (or "snapshot"
> for episode items) and "background"…
>
> | Field | Type | Required | Description |
> |---|---|---|---|
> | `type` | string | Yes | Image type: "background", "backgroundSquare", "clearLogo", "coverPoster", "snapshot" |
> | `url` | string | Yes | Full URL to the image asset |
> | `alt` | string | No | Alt text for accessibility |

Three fields. The header says "in various dimensions" and then **no dimension is transmitted**. No
rank, no vote, no limit, no minimum size. Note that this is the *whole* candidate list Plex's own
2025-26 provider contract carries.

The ordering is instead expressed **out of band**, by two scalar attributes on the item itself:

> | `thumb` | string | No | A publicly accessible URL to the **default** poster/thubnail for the item |
> | `art` | string | No | A publicly accessible URL to the **default** background artwork for the item |

So Plex's answer to "which of five posters is *the* poster" at the contract boundary is: the
provider names it in a separate scalar field, and the array is everything else. That is a `default`
pointer rather than a rank, and it is the cheapest possible version of X7's `is_default`.

There is one axis Plex's contract *does* carry that CanonCore's does not:

> ### `OriginalImage` Array (Recommended)
> The same attributes as `Image` but provides images in the **original language** of the content if
> the requested language doesn't match the original language.

**On the storage side, Plex stores no dimensions either.** `python-plexapi`'s `BaseResource`
(`plexapi/media.py:1039-1066`, read 2026-09-09 via `gh api repos/pkkid/python-plexapi/contents/plexapi/media.py`)
is the complete stored artwork row:

```python
self.key      = data.attrib.get('key')
self.provider = data.attrib.get('provider')   # 'local', or None if agent-supplied
self.ratingKey= data.attrib.get('ratingKey')  # media:// | metadata:// | upload://
self.selected = utils.cast(bool, data.attrib.get('selected'))
self.thumb    = data.attrib.get('thumb')
```

Five fields. `selected` is the pin (X7). **No width, no height, no size, no rank.**

**Plex does derive two things from the bytes, and stores both.** `plexapi/video.py` (read
2026-09-09) carries, per item, `artBlurHash` ("BlurHash string for artwork image.", `:19`) and
`thumbBlurHash` ("BlurHash string for thumbnail image.", `:33`), plus `ultraBlurColors`
(`:469`, `:671`, `:860`, `:1098`) resolving to `plexapi/media.py class UltraBlurColors`, whose
entire content is four hex strings:

```python
self.bottomLeft  = data.attrib.get('bottomLeft')
self.bottomRight = data.attrib.get('bottomRight')
self.topLeft     = data.attrib.get('topLeft')
self.topRight    = data.attrib.get('topRight')
```

So the market leader computes **both** a palette and a blurhash off artwork, and stores both. That
independently corroborates SPEC.md's palette rule and answers the gap's blurhash suggestion: it is
not speculative, it is what Plex ships. Note also the shape — a four-corner palette, not one colour,
because the thing it drives is a gradient behind the poster.

**The controls Plex gives the owner are rules, not per-row fields.**
https://support.plex.tv/articles/advanced-settings-plex-movie-agent/ (HTTP 200, fetched 2026-09-09,
"Last modified on: April 13, 2025"):

> **Prefer artwork based on library language**: Use localized posters when available. This is
> determined by the library language setting.
> **Use local assets**: When scanning this library, use local posters and artwork if present.

No limit setting. No minimum-size setting. Plex has neither, anywhere I could find in its published
settings or its provider contract.

### What Jellyfin does

**Jellyfin has, by name, three of the four things the gap asks for, and the third is a per-role
limit that defaults to 1.** This is the cleanest "there is a working implementation to copy" in the
tier.

**The per-role limit and the quality floor are one object.**
`MediaBrowser.Model/Configuration/ImageOption.cs`, read 2026-09-09, complete:

```csharp
public class ImageOption
{
    public ImageOption() { Limit = 1; }
    public ImageType Type { get; set; }
    public int Limit { get; set; }
    public int MinWidth { get; set; }
}
```

Three fields — type, limit, minimum width — and the default limit is **one**.

**The defaults are per item type and per role**, and they are opinionated.
`MediaBrowser.Model/Configuration/TypeOptions.cs`, `DefaultImageOptions["Movie"]`, read 2026-09-09:

```csharp
new ImageOption { Limit = 1, MinWidth = 1280, Type = ImageType.Backdrop },
// Don't download this by default as it's rarely used.
new ImageOption { Limit = 0, Type = ImageType.Art },
// Don't download this by default as it's rarely used.
new ImageOption { Limit = 0, Type = ImageType.Disc },
new ImageOption { Limit = 1, Type = ImageType.Primary },
new ImageOption { Limit = 0, Type = ImageType.Banner },
new ImageOption { Limit = 1, Type = ImageType.Thumb },
new ImageOption { Limit = 1, Type = ImageType.Logo },
```

Read that as a design statement: **three of seven roles default to zero**, with the reason in the
comment, and the only floor anyone bothered to set is 1280px on the backdrop — because a backdrop is
the one thing rendered full-bleed.

**The floor is applied to the candidate before the fetch, and unknown width passes.**
`MediaBrowser.Providers/Manager/ItemImageProvider.cs:559` (singular images) and `:674` (multi):

```csharp
// :559
var eligibleImages = images
    .Where(i => i.Type == type && (i.Width is null || i.Width >= minWidth))
    .ToList();

// :674
if (image.Width.HasValue && image.Width.Value < minWidth) { continue; }
```

The `i.Width is null ||` clause is worth copying verbatim: **a candidate whose width the provider did
not state is not rejected.** Unknown is not treated as failing. That is the same instinct SPEC.md
applies to completion ("WHERE NEITHER THE PROBE NOR THE CLIENT HAS SUPPLIED A DURATION, COMPLETION
IS UNKNOWN… never a fabricated true").

**The limit is applied as a loop break, not a query cap** (`:665-672`):

```csharp
foreach (var image in images.Where(i => i.Type == imageType))
{
    if (item.GetImages(imageType).Count() >= limit) { break; }
    if (image.Width.HasValue && image.Width.Value < minWidth) { continue; }
    ...
```

so the limit is counted against images *already held*, not against this batch — which is what makes
a re-run idempotent rather than additive.

**The candidate the provider hands over is nine fields, not two.**
`MediaBrowser.Model/Providers/RemoteImageInfo.cs`, read 2026-09-09:

```
ProviderName, Url, ThumbnailUrl, Height, Width, CommunityRating, VoteCount, Language, Type, RatingType
```

Width, height, a community rating, a vote count and a language — every one of them a field CMPP has
no slot for. Note what Jellyfin then *does* with them: it uses `Width` for the floor, `Language` for
the ordering (`ProviderManager.cs:363`, `return result.OrderByLanguageDescending(preferredLanguage);`),
and **it does not rank by `CommunityRating` at all** for downloads — the rating is carried through
to the manual picker and otherwise ignored. It has the rank and declines to use it automatically.

**Dimensions are stored, as a real column, in a real table.**
`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/BaseItemImageInfo.cs`, read
2026-09-09:

```csharp
public required Guid Id { get; set; }
public required string Path { get; set; }      // path to the original image
public DateTime? DateModified { get; set; }
public ImageInfoImageType ImageType { get; set; }
public int Width { get; set; }
public int Height { get; set; }
public byte[]? Blurhash { get; set; }
public required Guid ItemId { get; set; }
```

That is CanonCore's `artwork` table with a blurhash where the palette goes. The blurhash library is
`BlurHashSharp` / `BlurHashSharp.SkiaSharp` 1.4.0-pre.1 (`Directory.Packages.props:13-14`), an
implementation of woltapp/blurhash (MIT, 17k stars, created 2019-06-26, last pushed 2024-07-08).

**And this is the finding that decides the retrofit question.** Jellyfin does not merely have these
columns — **it backfills them automatically, forever, as a standing condition.**
`Emby.Server.Implementations/Library/LibraryManager.cs`, read 2026-09-09:

```csharp
// :2519  ImageNeedsRefresh
if (image.Width == 0 || image.Height == 0 || string.IsNullOrEmpty(image.BlurHash))
{
    return true;
}

// :2605  UpdateImagesAsync
size = _imageProcessor.GetImageDimensions(item, image);
image.Width  = size.Width;
image.Height = size.Height;
...
var blurhash = _imageProcessor.GetImageBlurHash(image.Path, size);
image.BlurHash = blurhash;
```

A row with a zero width, a zero height or an empty blurhash is *by definition* stale and gets
re-derived from the file. That is a self-healing backfill written into the refresh path, and it is
guarded by exactly one condition, at `:2521`: `if (image.Path is not null && image.IsLocalFile)`.
**Jellyfin can retrofit these columns at zero cost because it has the bytes.**

**One thing not to copy.** Jellyfin's rank is the array index, and reordering is a swap:
`Jellyfin.Api/Controllers/ImageController.cs:440`,
`POST /Items/{itemId}/Images/{imageType}/{imageIndex}/Index?newIndex=`, implemented as
`await item.SwapImagesAsync(imageType, imageIndex, newIndex)`. A positional key that changes when
you reorder is precisely what SPEC.md:224 already rejects one table over, for placements: "STABLE
SURROGATE ID, because a key made of (parent, position) — **which is what Jellyfin actually uses** —
means reordering changes the key and every external reference goes stale." Same mistake, same
codebase, second table. X7's `is_default` boolean avoids it.

### Industry standard

There is no standard for the numbers. There is a very clear standard for **which fields exist**, and
the single most useful piece of evidence is TMDB's own published example response — because TMDB is
a *required* provider under SPEC.md:63-66.

**TMDB's documented image object is seven fields**, and its documented example is alarming.
From https://developer.themoviedb.org/reference/movie-images and the sibling
`/3/collection/{collection_id}/images` operation in the same OpenAPI document (fetched 2026-09-09;
the response example is the Star Wars Collection, `id: 10`):

```json
{"aspect_ratio":1.778,"height":1080,"iso_639_1":null,
 "file_path":"/d8duYyyC9J5T825Hg7grmaabfxQ.jpg",
 "vote_average":5.464,"vote_count":30,"width":1920}
```

Parsed out of that documented example, for **one** catalogue entry from **one** provider in **one**
call:

- **142 images: 33 backdrops and 109 posters.**
- Strictly **sorted descending by `vote_average`** — 5.464, 5.454, 5.376, 5.356, … down to 0.0.
  I verified the ordering programmatically over all 33 backdrops; it holds exactly. **The provider
  ships the rank.**
- **33 of the 109 posters have `vote_average: 0.0`** — nobody has ever voted on them.
- Poster widths run **500 to 2000**; backdrop widths run **1280 to 3840**.
- Posters span **15 language values**: `null, cs, de, el, en, es, fr, he, hu, it, pl, pt, ru, sk, uk`.
- The smallest poster in the set is `{"width":500,"height":750,"iso_639_1":"fr","vote_average":5.312,"vote_count":1}`.

And the query parameter that exists to manage exactly this, from the same document:
`include_image_language` — "specify a comma separated list of ISO-639-1 values to query, for example:
`en-US,null`", with the note "If you have a `language` specified, it will act as a filter on the
returned items."

Multiply against SPEC.md's own sizing guide — the archive extract has **11,285 stories** — and the
unbounded case is roughly 1.6 million artwork rows from one provider, each now carrying **stored
bytes**. At SPEC's own estimate of "roughly 50-150KB each", that is 80-240 GB. The declared stored
variant (w500/w780) bounds the size of *each* row; it does nothing about the *number* of rows.
**SPEC.md's sentence "what makes the image store bounded BY THE CATALOGUE at design time" is only
half true: it bounds the width, not the count.**

**Komga is the reference implementation of the artwork row CanonCore is now building**, and it
carries all three fields. `komga/src/main/kotlin/org/gotson/komga/domain/model/ThumbnailSeries.kt`,
read 2026-09-09 via `gh api`:

```kotlin
data class ThumbnailSeries(
  val thumbnail: ByteArray? = null,   // the stored bytes
  val url: URL? = null,
  val selected: Boolean = false,      // the pin  (X7)
  val type: Type,                     // SIDECAR | USER_UPLOADED
  val mediaType: String,
  val fileSize: Long,
  val dimension: Dimension,           // width and height
  val id: String = TsidCreator.getTsid256().toString(),
  ...
```

Bytes, pin, provenance class, media type, **file size and dimensions**, and a **stable surrogate id**
rather than an index. That is the shape to copy, and it is one line different from where SPEC.md's
artwork table now stands.

**Where the two incumbents disagree, plainly:** Jellyfin has a per-role limit and a minimum width and
no candidate list; Plex has a candidate list and a pin and neither a limit nor a floor. Neither has
all four. Nothing in the category has a *provider-declared* limit; every limit is a consumer-side
policy.

**Where there is no standard at all:** the numbers. Jellyfin's 1280px backdrop floor is the only
published figure I found anywhere, and its `Limit` defaults are 1 or 0 with no stated reasoning
beyond "rarely used". Do not look for a right answer; pick one and make it configurable, as Jellyfin
did.

### Is it genuinely non-retrofittable?

**Split three ways, and the split changed under the SPEC edit that added stored bytes. Dimensions
and the blurhash became fully retrofittable. The limit and the floor became materially more
urgent.**

**1. `width` / `height` on the artwork row — NO, fully retrofittable, and one incumbent retrofits
them automatically on every refresh.** The bytes are on local disk (SPEC.md:540, "THE BYTES ARE
STORED AND SERVED BY CANONCORE"). Width and height are a property of bytes you have not thrown away.
This is the G3 argument verbatim — "the file is still on disk" — applied to a smaller file. Jellyfin
proves the retrofit is not merely possible but *routine*: `ImageNeedsRefresh` treats
`Width == 0 || Height == 0 || BlurHash is empty` as stale and `UpdateImagesAsync` re-derives all
three, guarded only by `image.IsLocalFile`. Copy that condition and the columns backfill themselves.
Add the columns in migration 1 anyway, because they are two integers and the layout argument
("without them no layout can reserve space") is real — but the non-retrofittability claim does not
survive the change to storing bytes.

**2. The palette and a blurhash — NO, and SPEC.md now contains a stale sentence about this.**
SPEC.md:558-559 still reads "Extract the palette when the artwork is fetched, onto this row. **Cheap
then, awkward to backfill across thousands of images later.**" That sentence was true when the table
held a URL. It is no longer true eight lines above its own paragraph, which now says the bytes are
stored locally. Backfilling a palette across thousands of *local* images is a scheduler task over
local files — which SPEC.md already has, and already lists: "palette extraction" is named in the
task registry (SPEC.md:1025). **This is an internal contradiction introduced by the concurrent edit
and it should be corrected in the same pass**, either by deleting the "awkward to backfill" clause or
by rewriting it as "cheap at fetch, and re-derivable from the stored bytes if the extractor changes"
— which is the more useful statement, because the extractor *will* change, and the recently added
`derived:palette-v2` source-identity rule (SPEC.md:408-419) exists precisely to make that
re-derivation targetable. Add the blurhash at the same time and for the same reason: Plex ships
`thumbBlurHash`/`artBlurHash`, Jellyfin ships `BaseItemImageInfo.Blurhash` via BlurHashSharp, it is
~30 bytes, and it is computed from the same decode you are already doing for the palette.

**3. A per-role limit and a minimum-width floor — these are NOT columns, and that is exactly why
they cannot be deferred.** This is the real Tier A content of G7 and the gap files it as a schema
issue, which understates it.

A limit and a floor are **fetch-time policy**. They do not sit in the schema, so there is nothing to
migrate — and it is tempting to conclude from that that they are retrofittable. The opposite is
true, for three compounding reasons:

- **The cost is incurred on the first enrichment run, not on the first migration.** SPEC.md's
  enrichment "reaches ALL connected providers at once". The first time that runs across a real
  catalogue with TMDB connected, you have already written 142 rows and 142 blobs for the item that
  had 142 candidates. There is no migration to write, and no migration that helps.
- **Fixing it afterwards is a delete, and a delete needs a basis for choosing.** To trim 109 posters
  to 3 you need to know which 3. TMDB told you: it sorted them by `vote_average` and told you the
  vote count and the language. If you did not record the position or the vote, that ordering is
  gone with the response, and the only surviving basis for choosing is insertion order — which is
  the same ordering, but you can no longer *say* so, and you cannot distinguish "TMDB ranked this
  first" from "this is the row that happened to insert first". **That is a provenance loss in the
  product whose reason #3 for existing is that nobody stores provenance.**
- **The floor is applied to the candidate, and the candidate's width is not recoverable from the
  stored bytes.** SPEC.md now has providers declare a *stored variant* — "a w500 poster, a w780
  backdrop". Once you have downscaled to w500, measuring the local file tells you 500, not whether
  the original was 3840 or 600. Jellyfin's floor works on `RemoteImageInfo.Width`, the width the
  provider stated *before* the fetch. So a floor is genuinely a decision that has to be taken at
  the door, and the information it needs is destroyed by the very transform SPEC.md has just
  adopted.

The mitigation SPEC.md already has, and it caps the blast radius without removing the problem: TMDB
rows expire at six months by read-time check ("A row whose `fetched_at` is older than its provider's
declared `max_cache_age` reads as ABSENT"), so an unbounded TMDB fetch self-corrects within six
months. It does not self-correct for the archive's own wiki, where `max_cache_age` is **absent**.

**What to actually decide, in priority order:**

1. **Copy `ImageOption` wholesale: `{role, limit, min_width}`, per role, defaulting to `limit = 1`.**
   It is three fields, it is the exact shape of the problem, and it is the only published solution.
   Set `limit = 0` for roles the first surface does not render, with Jellyfin's comment attached —
   the same "SEED ONLY WHAT THE FIRST SURFACE NEEDS" logic SPEC.md:464 already applies to properties.
2. **Copy the `Width is null` escape verbatim.** A candidate whose width the provider did not state
   passes the floor. Plex's contract states no dimensions at all, so under a strict floor a Plex-shaped
   provider would contribute zero artwork. Unknown must not read as failing — the same rule SPEC.md
   already states for duration and for extent.
3. **Put `width` and `height` on the candidate in the CMPP response, and use them at the door.**
   This is the one CMPP change in G7, and it is the one thing here with a real deadline: it is a
   contract field, so it lands in G6's window (the first provider CanonCore does not operate), not
   the schema's. Jellyfin's `RemoteImageInfo` carries width, height, language, community rating and
   vote count; TMDB supplies all five; CMPP as specified transmits none. Carry at minimum
   width, height and language.
4. **Record the provider's position, or the provider's own rank value, on the artwork row.** One
   integer. It is the difference between "we can trim this later on the provider's own judgement"
   and "we can only trim this arbitrarily". This is the genuinely lossy field in G7 and it is the
   one the gap describes least clearly, because it is not `rank` in X7's sense — X7's `is_default` is
   the *owner's* pin; this is the *provider's* ordering, and they are two different claims by two
   different sources about the same set of rows. Under SPEC.md's own model those are simply two
   things with two sources, which is what the whole design is for.
5. **Add `width`, `height` and a blurhash to the artwork row, and copy Jellyfin's `ImageNeedsRefresh`
   condition** so a row missing any of them re-derives itself from the stored bytes on the next
   refresh. Add `file_size` too, as Komga does; it is free at write time and it is what makes "how
   much disk is the artwork store using" answerable without walking the filesystem.
6. **Fix the stale "awkward to backfill" sentence** (item 2 above).

**Verdict: Tier C for the columns, Tier A for the two policies — and the Tier A half is a fetch-time
rule, not a migration.** `width`, `height`, `file_size` and a blurhash are additive columns whose
backfill is a local scan, and Jellyfin performs that backfill automatically on every refresh; the
gap's "awkward to backfill across thousands of already-fetched images" was written against a table
that stored URLs and does not survive the change to storing bytes. But **the per-role limit and the
quality floor must exist before the first enrichment run against a real provider**, because their
cost lands at fetch time, the information needed to repair the damage (the provider's ordering and
the candidate's original width) is discarded by that same fetch, and TMDB's own published example
shows the market-leading provider returning **142 images for a single item, in fifteen languages,
sorted by a vote score CanonCore currently has nowhere to put.**

---
## G8 · A file may cover several works, and a work may need several files

Scope note: **the second half of this gap is now closed in SPEC.md.** The concurrent edit added, to
the `files` block (SPEC.md:346-368, read 2026-09-09): "A FILE IS A PART OR A VARIANT, and those are
two relations rather than one column", "THE PART ORDINAL IS STORED, NEVER PARSED ON READ… BOTH
derived readings of it… plus `manually_verified` and `excluded`", and "MULTI-PART EDITIONS MUST NOT
BE PLAYABLE BEFORE THE ORDINAL EXISTS." That is G4's verdict applied, and it settles *a work needing
several files*.

What remains untouched is the first half, and it is still stated in the singular: **"files — bytes.
Attached to item or edition, NEVER to a placement"** (SPEC.md:333). One file, one subject. This
section resolves that.

### What Plex does

**Plex supports it, documents an interval, materialises several items over one file, and tells you
not to do it.** https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/ (HTTP 200,
fetched 2026-09-09, "Last modified on: May 22, 2026"), section **"Multiple Episodes in a Single
File"**:

> If a single file covers more than one episode, name it using the following format:
> `/TV Shows/ShowName/Season 02/ShowName – sXXeYY-eZZ – Optional_Info.ext`
> Where you specify the appropriate season, episode numbers (**the first and last episode covered in
> the file**), and file extension. For example, `s02e18-e19`.
>
> **Note**: Multi-episode files will **show up individually in Plex apps** when viewing your library,
> but **playing any of the represented episodes will play the full file**. If you want episodes to
> behave truly independently, you're best off using a tool to split the file into individual
> episodes.

Three things there, all load-bearing:

1. **The wire format is an interval** — first and last. Not a set.
2. **The catalogue keeps N items, not one.** Each episode remains its own row, browsable, addressable
   and orderable. The file is shared.
3. **There is no offset.** Playing episode 19 plays the file from the top. Plex's honest position is
   that the *cataloguing* is right and the *playback* is not, and its recommended fix is to change
   the files.

The sibling section, **"Episodes Split Across Multiple Files"**, is the G4 half and carries the same
retreat, with the cost enumerated:

> **Warning!**: While Plex does have limited support for content split across multiple files, it is
> not the expected way to handle content. Doing this may negatively impact usage of various Plex
> features (**including, but not limited to, preview thumbnails, skip intro, audio/subtitle stream
> selection across parts**, and more). We recommend users instead join the files together…
> **Only stacks up to 8 parts are supported**

**Correction to the gap text, and it matters because it is the gap's only Plex evidence.** The gap
says "Plex's NFO format supports repeated `<episodedetails>` blocks for the first case". That
attribution is wrong on both counts. Plex's own NFO documentation,
https://support.plex.tv/articles/using-nfo-metadata-files-with-plex/ (HTTP 200, fetched 2026-09-09,
"Last modified on: July 14, 2026"), states "**The Plex NFO Agent follows the Kodi NFO
specification**" and its documented `<episodedetails>` example is a **single** block with one
`<season>` and one `<episode>`. Repeated `<episodedetails>` blocks are **Kodi's** convention, not
Plex's (proven below from Jellyfin's own source). And the same article's **Known Limitations**
section says the opposite of what the gap implies:

> **Known Limitations**
> **Multi-part files**: Movies split across multiple files (pt1, pt2) are **not currently supported
> by the NFO Agent.**

So Plex's newest metadata path handles neither half through NFO. The multi-episode support is in the
*scanner*, keyed on the filename, exactly as G4 found for stacking.

### What Jellyfin does

**Jellyfin gives the opposite answer: one item, carrying an interval, with the two works' titles
concatenated.**

The field exists at both levels and is named for the case. `Emby.Naming/TV/EpisodeInfo.cs` (read
2026-09-09 via `gh api`):

```csharp
/// <summary>
/// Gets or sets optional ending episode number. For multi-episode files 1-13.
/// </summary>
public int? EndingEpisodeNumber { get; set; }
```

and it lands on the stored entity as `Episode.IndexNumberEnd` (`MediaBrowser.Controller/Entities/TV/Episode.cs`;
also surfaced on `BaseItemDto` and on `RemoteSearchResult`, so it is in the public API and in the
provider contract).

**And Jellyfin's NFO parser is the authoritative statement of whose convention the repeated blocks
are.** `MediaBrowser.XbmcMetadata/Parsers/EpisodeNfoParser.cs`, read 2026-09-09:

```csharp
// Split the nfo into its episodedetails blocks.
// This is needed because XBMC metadata uses multiple episodedetails blocks
// instead of an episodenumberend tag.
const string Srch = "</episodedetails>";
```

XBMC — that is, Kodi. Jellyfin reads Kodi's N-block form and converts it into its own
one-item-plus-interval form. **The conversion is lossy, and the code says so plainly:**

```csharp
// Extract the details of the lowest numbered episode into the item that is returned to the caller
ReadEpisodeDetailsFromXml(item, episodes[0].Xml, settings, cancellationToken);

// Concatenate the name, originalTitle and overview tags of the remaining episodes with the first one
// and take the highest episode number as the last episode of the file
...
    name.Append(" / ").Append(additionalEpisode.Item.Name);
    overview.Append(" / ").Append(additionalEpisode.Item.Overview);
    originalTitle.Append(" / ").Append(additionalEpisode.Item.OriginalTitle);
...
    item.Item.IndexNumberEnd = Math.Max((int)additionalEpisode.Item.IndexNumber,
                                        item.Item.IndexNumberEnd ?? (int)additionalEpisode.Item.IndexNumber);
```

Two episodes go in; one row comes out, named `"The Cave of Skulls / The Forest of Fear"`, with a
single overview built by string concatenation and an interval `[1, 2]`. **The second work no longer
exists as a thing that can be placed, described, or watched.**

For CanonCore that is disqualifying, and it is disqualifying for a reason the product already
states. Under SPEC.md every episode is a `work` item, and multi-placement is the entire product: a
release-order container and a story-order container must be able to hold episodes 18 and 19 at
different positions. Jellyfin's collapse makes that inexpressible — there is one row, so there is one
position. The stop condition itself (SPEC.md:69-78: "Better Call Saul's first episode sits in both at
different positions") would fail against a merged row.

### Industry standard

No standard, and the three implementations give **three different answers** — which is unusual
enough to be worth stating flatly:

| | catalogue rows | file rows | interval? | per-work offset? |
|---|---|---|---|---|
| **Plex** | N items, shown individually | 1, shared | yes, `eYY-eZZ` on the filename | **no** — "playing any of the represented episodes will play the full file" |
| **Jellyfin** | **1** item, titles joined with " / " | 1 | yes, `IndexNumber`..`IndexNumberEnd` | no |
| **Kodi** | N items | 1, shared | **a set, not an interval** | **yes** — episode bookmarks, since v13 |

**Kodi is the only implementation in the category with the offset, and it is the only one that has
documented what the offset does not fix.** https://kodi.wiki/view/Bookmarks (fetched 2026-09-09 via
`r.jina.ai`; kodi.wiki returns 403 to plain `curl`):

> ### Episode bookmarks
> Starting in **v13**, you can set "episode bookmarks" for video files or ISOs that contain multiple
> episodes. This will allow you to **jump directly to the point when a given episode begins**, from
> the library, even if it is in the middle of the video file.
>
> **Note:**
> - Kodi **won't automatically mark individual episodes as watched**. Watching the last episode in
>   the file can also cause **all** the episodes to show up as watched, since Kodi is going off of
>   **the whole video file, rather than individual sections**.
> - If you watch part of the file, say one episode but not another, **both episodes will show as
>   being in-progress** and will prompt for a resume point.

That is a twelve-year-old feature with its own bug report attached to it in the documentation, and it
is the single most useful paragraph in this gap: **a seek offset solves navigation and does not solve
progress.** Progress is a clock, the clock belongs to the file, and several works sharing one file
share one clock.

**And Kodi's naming rules prove the coverage is a set, not an interval.**
https://kodi.wiki/view/Naming_video_files/Episodes (fetched 2026-09-09 via `r.jina.ai`):

> **For Kodi v21 and below:** … `S01E01E02E04.mkv` … `S01E01E02E04` = Season 1, Episode 1, 2 & 4.
> **Note that Episode 3 is not included.**
> - Only the episodes in the file name will be added, e.g. `Angel (1999) S01E01E04.mkv` will scrape
>   episodes 1 and 4 but **not include episodes 2 and 3**.
>
> **Multi-Episode Files** — Starting with **Kodi v22** you can now specify episode ranges:
> `S01E01-E04.mkv` … *Note that Episodes 2 and 3 are included.*
>
> **Note:** It is recommended that multi-episode files be split into Single Episode files.

Kodi added the *range* form fourteen years after the *enumeration* form, and kept both — because the
enumeration expresses something the range cannot. A file can hold episodes 1 and 4 and not 2 and 3.
So the gap's proposed shape ("an interval on the attachment mirroring `edition_coverage`") is the
right family and the wrong cardinality: **`edition_coverage` is already defined as "a SET OF
INTERVALS" (SPEC.md:323) and the attachment needs the same, for the same reason.** One interval
would force a scanner reading `S01E01E04` either to claim episodes 2 and 3 (false) or to drop them
(silent). That is precisely the argument SPEC.md already makes one table up: "Coverage is never a
scalar column."

**A case none of the three has, and CanonCore will.** Every implementation above is episode-scoped:
the several things sharing a file are always siblings under one parent, numbered on one axis. A
domain-general catalogue gets the harder version — a double-bill reel holding a feature and a short,
a compilation VHS, a single broadcast recording holding the end of one programme and the start of
another. There is no `eYY-eZZ` for those, because they are not numbered parts of anything shared.
Whatever shape is chosen has to express "this file covers *these subjects*" without assuming the
subjects are consecutive integers under a common parent. That points at a join table, with the
interval as a nullable qualifier on the join row rather than as the join key.

### Is it genuinely non-retrofittable?

**The schema change is retrofittable and ordinary. The scanner rule is not, and that is where the
Tier A content actually lives.**

**1. Column-to-join-table is a normal migration.** `files.edition_id` (nullable FK) becoming
`file_subjects (file_id, edition_id|item_id, coverage…)` is: create the table, `INSERT … SELECT`
every non-null FK, drop the column, update the readers. Every ORM does this and nothing is lost —
one-to-many is a strict subset of many-to-many, so the existing data maps in without a guess. There
is no per-field-provenance-style information destruction here. **The gap's "Schema-level, so before
the first migration" is not established by anything I could find.**

**2. What *is* irreversible is the scanner's decision at import, and it is Jellyfin's answer that
makes it so.** If the scanner meets `s02e18-e19.mkv` and does what Jellyfin does — create ONE item
named `"Episode 18 / Episode 19"` with a concatenated overview — then from that moment:

- every placement, statement, favourite, note and progress row hangs off the merged thing;
- the two works were never distinct, so there is nothing to split *back* to;
- and undoing it is exactly the problem of **G9**, minus G9's one advantage, because a merge at
  least has two ids and an alias table behind it. A scanner collapse has neither. There is no
  record that two works were ever involved.

So the deadline is real, and it is the first scan of a real corpus, not the first migration. And the
rule that meets it is one sentence and costs nothing: **the scanner never collapses two subjects into
one item because they share a file.** Plex and Kodi both take this position; Jellyfin does not; and
under SPEC.md's model Jellyfin's position is not merely worse, it is incompatible with the stop
condition.

**3. Progress is the half that collides with a decision SPEC.md has already frozen, and Kodi has
published what happens.** SPEC.md:502-506: "progress — per (owner, edition). … PER EDITION, not per
item, because finishing a novelisation must not mark the film watched. This is the decision that
justifies editions existing at all." Now put two episodes on one file:

- If each episode is its own item with its own edition, and the same file attaches to both editions,
  progress stays correct **only if the attachment says which span of the file belongs to which
  edition.** Without that, one clock feeds two progress rows and the same file position means
  "finished" for one and "nearly finished" for the other.
- If instead the two episodes share one edition to share the clock, then finishing episode 18 marks
  episode 19 watched — **the literal thing the per-edition rule exists to prevent**, and the literal
  thing Kodi documents: "Watching the last episode in the file can also cause all the episodes to
  show up as watched."

SPEC.md already has the right instrument for this and has just used it one paragraph away, for the
part ordinal: "**MULTI-PART EDITIONS MUST NOT BE PLAYABLE BEFORE THE ORDINAL EXISTS.** Progress is
one number per (owner, edition), so progress recorded against an unordered three-file edition is
uninterpretable, and deriving the ordinal later never gives that old number meaning." The identical
sentence applies here with the identical justification, and writing it is free.

**What to actually decide, in priority order:**

1. **A scanner rule, now, in words: several subjects sharing one file are several items.** Never a
   merged row, never a concatenated title. This is the only thing in G8 that is genuinely lost if
   deferred, and it is one sentence.
2. **A join table between files and subjects, with coverage as a set of intervals on the join row.**
   The set, not the interval, on Kodi's `S01E01E04` evidence; the join row, not the key, because the
   general case (a double bill) is not consecutive integers under a shared parent. Do this in
   migration 1 because it is cheap and because the alternative is a migration later, not because the
   later migration is impossible.
3. **State that a file shared by several editions is not playable until the attachment carries a
   span**, mirroring the ordinal rule verbatim. Then the seek offset is a later, additive field and
   the progress model never has to record a number it cannot interpret.
4. **Expect to need the offset eventually, and know it is not enough.** Kodi has had episode
   bookmarks since v13 and still marks the wrong episodes watched, because the offset gives you
   navigation and completion needs a per-subject span *and* a per-subject clock. Do not ship the
   offset believing it closes the progress question.
5. **Correct the gap's Plex/NFO attribution** when this is folded back into SPEC.md: repeated
   `<episodedetails>` is Kodi's, Plex documents a single block and follows Kodi's spec, and Plex's
   NFO agent explicitly does not support multi-part files at all.

**Verdict: Tier A for the scanner rule and the playability rule; Tier B/C for the join table.** The
gap is right that this must be decided early and wrong about which part is expensive. Turning a
foreign key into a join table is a routine migration that loses nothing. Turning two works that were
merged into one row at scan time back into two works is G9 with no alias table and no record of the
merge — which is to say, impossible. The three-line rule that prevents it costs nothing today and
cannot be bought back later at any price.

---
## G9 · Reversing a merge

The specification's whole statement of merge is three lines (SPEC.md:1083-1085, under the heading
"DELETE — The one place data is actually lost", SPEC.md:1071-1073):

> Merge: the loser becomes a PERMANENT ALIAS and stays resolvable forever, so old URLs never break.
> Statements from both re-point at the survivor and keep their own provenance, so a disagreement
> becomes two claims rather than a lost value.

**The gap's central factual claim does not survive checking.** It says "Plex, Jellyfin, Calibre and
MusicBrainz all ship split." Verified below: **one of the four does.** Jellyfin's is for versions,
not identity, and is incomplete; Calibre has none; MusicBrainz has none. And the two systems whose
data model SPEC.md actually copies — Wikibase for `rank` and statements, MusicBrainz for identifiers
and the permanent-alias rule — have both declined to build one, one of them with a seven-year-old
open ticket saying why.

That correction does not weaken the finding. It strengthens it, and it changes what should be built.

### What Plex does

**Plex genuinely ships split, and it is one API verb.** `python-plexapi`
`plexapi/mixins/split_merge.py` (read 2026-09-09 via `gh api`), complete:

```python
class SplitMergeMixin:
    """ Mixin for Plex objects that can be split and merged. """

    def split(self):
        """ Split duplicated Plex object into separate objects. """
        key = f'{self.key}/split'
        self._server.query(key, method=self._server._session.put)
        return self

    def merge(self, ratingKeys):
        key = f"{self.key}/merge?ids={','.join(str(r) for r in ratingKeys)}"
        self._server.query(key, method=self._server._session.put)
        return self
```

**Which types can be split is precise, and it is not everything.** `plexapi/mixins/__init__.py`
(read 2026-09-09) composes `SplitMergeMixin` into exactly four: `MovieMixins:132`,
`ShowMixins:141`, `ArtistMixins:172`, `AlbumMixins:180`. `SeasonMixins`, `EpisodeMixins`,
`ClipMixins` and `TrackMixins` do not have it. The user-facing article agrees and hedges:
https://support.plex.tv/articles/201018248-merge-or-split-items/ (HTTP 200, fetched 2026-09-09,
"Last modified on: February 27, 2019"):

> **Split Apart Items**
> **In some cases** "Merged" items can be split apart to reveal the individual items.
> Splitting can be done to: Movies · TV Shows/Series (**not individual episodes**) · Music Artist
>
> **Note**: The first item you select is what all selected items will be merged into.

**Why Plex can do this at all is the architectural point, and it is not "Plex built an inverse".**
For movies the article's own framing is version grouping, not identity collapse: "If you have
several different versions of the same Movie (maybe a SD and HD version), you can combine them to a
single item… The Merged item now has a **number badge that indicates how many items are included**."
The constituents are still there and still counted. Split dissolves a grouping; it does not
reconstruct anything that was destroyed. **Plex ships split because Plex's merge never deleted
anything.** That is the design lesson, and it is available to CanonCore for free.

I did **not** verify what Plex's split does to watch state or collection membership after the split;
the article is silent and I found no source that says. Stated as unknown rather than guessed.

### What Jellyfin does

**Jellyfin has no item-identity merge at all**, so the gap's inclusion of it needs qualifying. What
it has is version merging, and that pair is worth reading closely because **the inverse is
incomplete in exactly the place CanonCore's would be.**

`Jellyfin.Api/Controllers/VideosController.cs` (read 2026-09-09):

```csharp
[HttpPost("MergeVersions")]                      // :183
[HttpDelete("{itemId}/AlternateSources")]        // :139   "Removes alternate video sources."
```

`MergeVersions` is **non-destructive by construction**. No row is deleted; the losers get a pointer:

```csharp
foreach (var item in items.Where(i => !i.Id.Equals(primaryVersion.Id)))
{
    item.SetPrimaryVersionId(primaryVersion.Id);
    await item.UpdateToRepositoryAsync(ItemUpdateType.MetadataEdit, ...);

    // Re-route any playlist/collection references from this item to the primary
    await _libraryManager.RerouteLinkedChildReferencesAsync(item.Id, primaryVersion.Id);
    ...
    alternateVersionsOfPrimary.Add(new LinkedChild { ItemId = item.Id, Type = LinkedChildType.LinkedAlternateVersion });
}
```

and `DeleteAlternateSources` is the stated inverse:

```csharp
foreach (var link in _libraryManager.GetLinkedAlternateVersions(item))
{
    link.SetPrimaryVersionId(null);
    link.LinkedAlternateVersions = Array.Empty<LinkedChild>();
    await link.UpdateToRepositoryAsync(ItemUpdateType.MetadataEdit, ...);
}
item.LinkedAlternateVersions = Array.Empty<LinkedChild>();
item.SetPrimaryVersionId(null);
```

**Compare the two blocks and one line has no counterpart.** The merge calls
`RerouteLinkedChildReferencesAsync(item.Id, primaryVersion.Id)` — "Re-route any playlist/collection
references from this item to the primary". The unmerge restores `PrimaryVersionId` and
`LinkedAlternateVersions` and **does not re-route anything back.** After a Jellyfin unmerge, the
playlist and collection memberships that used to belong to the loser are still on the survivor.

That is CanonCore's problem, live, in the incumbent, today: **the identity link is reversible and the
membership re-pointing is not.** For CanonCore the memberships are `placements`, and placements are
the product. Jellyfin's version of this bug costs a playlist entry; CanonCore's would cost the
ordering that is the reason the product exists.

Jellyfin's *identity* answer, for the one entity type where it does merge, is the one SPEC.md already
cites at line 1151-1153: people are keyed on their name, "so two people sharing a name merge
irreversibly, and two spellings of one person cannot be merged even when their external ids match.
Its maintainers say there is no fix without a redesign." That is a merge with no inverse and no
record, arrived at by accident rather than by decision.

### Industry standard

**There is no standard, and — this is the finding — the field is split not between "has split" and
"doesn't", but between systems whose merge was never destructive and systems that accepted
irreversibility on purpose.**

**Calibre — no split.** The manual, https://manual.calibre-ebook.com/gui.html (HTTP 200, fetched
2026-09-09):

> **Merge book records**: Gives you the capability of merging the metadata and formats of two or
> more book records. **You can choose to either delete or keep the records that were not clicked
> first.**

The only reversibility on offer is *declining to destroy at merge time*. That is a pre-merge option,
not an inverse, and once you have chosen "delete" there is nothing.

**MusicBrainz — no split, and it is a deliberate absence.**
`metabrainz/musicbrainz-server` `lib/MusicBrainz/Server/Constants.pm` (read 2026-09-09) declares
**eleven** merge edit types and no inverse:

```perl
$EDIT_ARTIST_MERGE => 4;        $EDIT_LABEL_MERGE => 14;      $EDIT_RELEASEGROUP_MERGE => 24;
$EDIT_RELEASE_MERGE => 311;     $EDIT_WORK_MERGE => 44;       $EDIT_PLACE_MERGE => 64;
$EDIT_RECORDING_MERGE => 74;    $EDIT_AREA_MERGE => 84;       $EDIT_SERIES_MERGE => 143;
$EDIT_INSTRUMENT_MERGE => 134;  $EDIT_EVENT_MERGE => 153;
```

GitHub code search for `unmerge` across `metabrainz/musicbrainz-server` returns **0 results**
(`gh api "search/code?q=unmerge+repo:metabrainz/musicbrainz-server"`, run 2026-09-09), and
https://musicbrainz.org/doc/Edit_Types (fetched 2026-09-09) lists no unmerge or split edit type for
any entity.

What MusicBrainz *does* have is precisely the rule SPEC.md has already adopted, and it is worth
quoting because it is the reference statement of it —
https://musicbrainz.org/doc/MusicBrainz_Identifier (HTTP 200, fetched 2026-09-09):

> An entity can have more than one MBID. **When an entity is merged into another, its MBIDs redirect
> to the other entity.**

**Wikidata — no automated unmerge, a manual procedure with a documented expiry, and a ticket open
since 2019.** This is the most relevant source in the section, because Wikibase is where SPEC.md's
`rank` (preferred/normal/deprecated) comes from.

https://www.wikidata.org/wiki/Help:Merge (fetched 2026-09-09), section headed **"Unmerging"** and
prefixed *"Tracked in Phabricator Task T237262"*:

> Canceling a wrong merge could be done in a few steps:
> - Go to the history page of the item onto which the merge has been done and restore the revision
>   just before the merge.
> - Go to the history page of the merged item and restore the revision just before the merge.
>
> **The order is important** (especially if the item has sitelinks)…
>
> **Some bots (KrBot for example) are known to replace the redirected items in statements with their
> target redirects a certain period of time (24 hours for KrBot) after the merge.** The next step is
> to ping bot owners… so they can run the code to cancel the merge if that period of time passed and
> some bot did the substitution, so that the statements can be restored with the right item.

https://phabricator.wikimedia.org/T237262, **"Tool for undoing Wikidata merges"**, authored by
Jarekt **2019-11-04**, status **Open, Needs Triage, Assigned To: None** as of 2026-09-09:

> We need a tool for easy un-merge. Right now un-merging involves: Restoring merged item to the
> previous version · Restoring redirect to the previous version · **The third step should be review
> of all the links to the new item to figure out which item to assign it to. This step is especially
> painful.**

That third step is the gap's exact sentence — "nothing records which pre-merge item they hung off" —
written by a Wikidata editor seven years ago, still unfixed.

Note also that Wikidata treats the **converse** as a separate, documented, manual procedure:
"Help:Split an item will help you if the item has not been merged but if statements on two topics
are mixed-up on a unique item for some reason." Splitting a never-merged item is a different problem
from reversing a merge, and only the second has a record to work from.

**Open Library — a generic changeset undo, and its source documents why undo fails.**
`openlibrary/plugins/upstream/recentchanges.py` (read 2026-09-09):

```python
if undo_error := change.get_undo_error():
    # The undo's save would be rejected by infobase validation, e.g.
    # because pre-merge records reference authors that have since been
    # merged into other authors. See internetarchive/openlibrary#5664.
    add_flash_message("error", undo_error)
else:
    change._undo()
```

`internetarchive/openlibrary#5664`, **"Undo bad author merge"**, opened **2021-09-16**, **still open**
as of 2026-09-09:

> A bad author merge cannot be reversed and is subsequently preventing the reversal of bad
> work/edition edits.

— filed against a merge from **2014-04-04**.

**The convergent lesson across all five, and it is not the one the gap draws.** Nobody's problem is
that they failed to write down which rows moved. Open Library *does* have a full per-key revision
history and a generic `_undo()`; Wikidata *does* have per-item revision history. Both still fail,
and both fail for the same reason: **an inverse only exists while nothing downstream has depended on
the merged state.** Wikidata quantifies the window at 24 hours, after which a bot has rewritten every
referencing statement to point at the redirect. Open Library's window ends whenever a later merge
touches the same records. **Reversibility is not a property you store. It is a property that decays.**

### Is it genuinely non-retrofittable?

**The mechanism is retrofittable; the history is not — the same shape as G5's verdict, and for the
same reason. But CanonCore starts from a better position than any of the five above, and two of the
three pieces it needs are already mandated.**

Take the two candidate designs the gap names separately.

**(a) "A merge record" — already 90% present, and cheap to finish.** SPEC.md:579 gives `aliases` as
"a merged-away id stays resolvable FOREVER", and SPEC.md:619 mandates "Timestamps, tombstones and a
change sequence on **every** table". An alias row with a timestamp already tells you *that* a merge
happened, *which two ids* were involved and *when*. That is the merge record, minus a name for it.
Making it explicit costs a column or two. It is retrofittable in the ordinary sense — but the alias
rows written before you add the column will have no `merged_at` unless the mandated timestamp is
honoured, which it will be, so in practice this half retrofits itself.

This is materially better than the incumbents. Because the loser's id stays resolvable forever,
CanonCore's worst-case unmerge is **"recreate the loser, empty, at its original id"** — the shell
always survives. Wikidata has to restore a revision; Open Library has to pass validation. CanonCore
just has to stop resolving an alias. Neither incumbent has that floor.

**(b) "`merged_from` on the re-pointed rows" — this is the genuinely lossy half, and it is not one
column.** Once `UPDATE placements SET item_id = survivor WHERE item_id = loser` has run, the fact
that a given placement arrived with the loser is gone. The gap is right that statements are the only
table with any purchase here, and even that purchase is illusory: a statement knows its **source**,
and both pre-merge items may have carried statements from the same provider, so `source` cannot
separate them. Placements, editions and files carry nothing at all.

But **`merged_from` is the wrong instrument**, and SPEC.md already mandates the right one.
"a change sequence on every table" is a change log. If a merge is one changeset, and every row it
re-points records that changeset in its change-sequence entry, then the inverse is *derivable*:
"every row whose change-sequence entry attributes its `item_id` change to changeset 4711". That is
exactly Open Library's `change._undo()`, it generalises past merge to every destructive operation,
and it needs no per-table `merged_from` column. **The decision to make is not "add `merged_from`"; it
is "the change sequence names an operation, not just a row version".** That is one more field on a
structure SPEC.md has already committed to, and it is worth taking now precisely because retrofitting
*meaning* onto an existing change log is the thing that cannot be done — you can add the column, but
every changeset written before it is anonymous forever.

**Why this is nevertheless Tier A, stated as a deadline rather than a tier.** Everything above is
cheap and most of it is already committed. What makes the timing urgent is not cost, it is **when the
first merge happens**. De-duplicating an import is the first thing anyone does with a catalogue, and
SPEC.md's own first act is importing an archive with 11,285 stories and 36,620 redirects. Merges
will happen in week one. Every merge performed before the operation is recorded is a merge with no
inverse — permanently, because there is nothing to reconstruct from. That is precisely G5's
structure: "what is unretrofittable is not the *mechanism* but the *history*."

**Three things the gap does not say, and each is worth more than the column it asks for:**

1. **Say plainly that merge is destructive, in the same paragraph that says delete is.** SPEC.md:1071-1073
   states "DELETE — The one place data is actually lost" and then, twelve lines later, describes an
   operation that loses the association between every re-pointed row and its origin. Under the
   project's own "say so plainly" rule that sentence is currently false. Fixing the sentence is free
   and it is the cheapest correction in this entire tier.
2. **Preview the merge, exactly as delete is previewed.** SPEC.md:1075-1077 already requires delete
   to be "previewed with counts before acting… Show what would happen first: containers left,
   children orphaned, survivors." Merge has the same blast radius and no preview. A count of
   placements, statements, editions, files and progress rows about to move is the same query the
   delete preview runs, against the same tables. This is one screen, reusing existing machinery, and
   it is the control that stops most bad merges before they need reversing.
3. **Decide, and state, how long an undo is offered and what it does when it cannot fully unwind.**
   This is the piece every source above discovered the hard way. Wikidata's honest window is 24
   hours; Open Library's undo throws an error and leaves the user with a flash message. CanonCore has
   a better answer available for free because it is already the house rule elsewhere: a partial
   unmerge should **say what it could not restore and why**, and leave the rest reversed — the same
   posture as "WHERE THE EXTENT IS UNKNOWN THE ANSWER IS UNKNOWN — never false, never a fabricated
   true". An unmerge that silently half-works is worse than none.

**Verdict: Tier A on the deadline, Tier C on the cost, and the gap's supporting evidence needs
replacing.** Do not argue this from "Plex, Jellyfin, Calibre and MusicBrainz all ship split", because
three of those four do not, and the argument collapses under a single check. Argue it from the
opposite and stronger fact: **the two most sophisticated provenance systems in existence — Wikidata,
whose rank model SPEC.md copies, and Open Library, which has a full generic undo — both have open
tickets, five and seven years old, saying that reversing a merge is unsolved, and both name the same
cause: nothing recorded which pre-merge entity the re-pointed references belonged to.** CanonCore can
have the record for the price of one field on a change log it has already promised to build, and it
starts with an alias table that guarantees the loser's id survives, which is a floor neither of them
has. Take it before the first import.

---
## G11 · Vocabularies have no normalised match key, and no notion of a scale

Two separate asks in one gap. They are resolved separately because the evidence points in opposite
directions: **the scale is a real hole with a published solution; the normalised key is real too,
but the argument the gap gives for it is measurably wrong.**

Current specification (working copy, read 2026-09-09, SPEC.md md5 `0e604141d80e7fdb3a0cf2e8d2ab49e5`):

- SPEC.md:615-618 — "Every vocabulary is a lookup table with `retired` AND a separate `quarantine`
  state… NO database enums anywhere"
- SPEC.md:442-443 — "`properties` — THE LOAD-BEARING TABLE. datatype, value-kind (literal vs item),
  cardinality, validation."
- SPEC.md:1350-1352 — "Imports are dirty. Vocabularies need a quarantine state separate from
  retired: the archive's own `medium` field holds **71 distinct values of which about 50 are one-use
  wreckage** from twenty years of hand-typed infoboxes."

### Part 1 — the normalised match key

#### What Jellyfin does

The gap's description is accurate and understates it. `CleanValue` is a **column on the vocabulary
table**, and the design decision that matters is which index is unique.

`src/Jellyfin.Database/Jellyfin.Database.Implementations/Entities/ItemValue.cs` (read 2026-09-09),
complete:

```csharp
public class ItemValue
{
    public required Guid ItemValueId { get; set; }
    public required ItemValueType Type { get; set; }
    public required string Value { get; set; }
    /// <summary>Gets or Sets the sanitized Value.</summary>
    public required string CleanValue { get; set; }
    public ICollection<ItemValueMap>? BaseItemsMap { get; set; }
}
```

`ModelConfiguration/ItemValuesConfiguration.cs`, and this is the whole design in two lines:

```csharp
builder.HasIndex(e => new { e.Type, e.CleanValue });               // lookup, NOT unique
builder.HasIndex(e => new { e.Type, e.Value }).IsUnique();         // identity, unique on the RAW value
```

**Uniqueness is on the raw value. The normalised key is only an index.** So `Sci-Fi` and `sci fi`
remain two rows with two identities and one shared lookup key. That is exactly the gap's "the
original survives for provenance", made structural rather than promised.

The normaliser, `src/Jellyfin.Extensions/StringExtensions.cs:153-175` (read 2026-09-09):

```csharp
/// Normalizes a string for comparison by removing diacritics, converting to lowercase,
/// replacing punctuation/special characters with spaces, and collapsing whitespace.
public static string GetCleanValue(this string value)
{
    var cleaned = value.RemoveDiacritics().ToLowerInvariant();
    cleaned = Regex.Replace(cleaned, @"[^\p{L}\p{N}\s]", " ");
    cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
```

It is used for more than vocabulary matching: `MediaBrowser.Controller/Entities/BaseItem.cs:1932-1962`
applies `GetCleanValue()` to both sides when evaluating a user's blocked and allowed tags —
so the normalised key is **load-bearing for access control**, not just for tidiness.

**And Jellyfin recomputes the whole thing whenever the normaliser changes.**
`Jellyfin.Server/Migrations/Routines/20260610120000_RefreshCleanNamesAndValues.cs` — dated
**2026-06-10**, three months ago:

```csharp
[JellyfinMigration("2026-06-10T12:00:00", nameof(RefreshCleanNamesAndValues))]
[JellyfinMigrationBackup(JellyfinDb = true)]
...
var newCleanName = string.IsNullOrWhiteSpace(item.Name) ? string.Empty : item.Name.GetCleanValue();
if (!string.Equals(newCleanName, item.CleanName, StringComparison.Ordinal)) { ... }
...
catch (Exception ex)
{
    _logger.LogWarning(ex, "Failed to update CleanName for item {Id} ({Name})", item.Id, item.Name);
}
```

It partitions at 10,000 rows, logs progress, declares a backup, writes only changed rows, and
**warns per row on failure without aborting the migration** — which is, incidentally, a working
example of the quarantine-rather-than-abort pattern G5 found no precedent for in any migration
framework.

The table has been tightened repeatedly: `20241113133548_EnforceUniqueItemValue.cs` (2024-11-13),
`20250405075612_FixItemValuesIndices.cs` (2025-04-05), then the 2026 refresh. Three migrations in
under two years on one two-column table.

#### What Plex does

Nothing published that I could verify. Plex's metadata-provider contract carries no normalised form
and no matching key for tags or genres: the `Genre` array in `docs/Metadata.md`
(`plexinc/tmdb-example-provider`, read 2026-09-09) is `{tag}` and nothing else. Plex's matching is at
the *record* level (the `match` feature with hints) rather than the *value* level, so the question
does not arise in its contract. **Stated as absent rather than guessed at**; Plex's server-side
handling of duplicate genre strings is not documented anywhere I could find.

#### Industry standard

There is no standard, and the honest summary is that the raw-plus-folded-key pattern is a **common
implementation habit** rather than a specification. Nothing in SKOS, Dublin Core or Schema.org
defines a normalised match key; the relevant standards (Unicode UAX #15 normalisation forms, CLDR
collation) operate one level below and do not make `Sci-Fi` equal `sci fi`. Postgres offers the
mechanism (`citext`, or a generated column with its own index) and takes no position on the policy.
Jellyfin's shape is the best available published reference and it is a codebase, not a spec.

#### Measured against the actual corpus — and this is where the gap is wrong

The gap's argument is: "The archive's 71-value `medium` field with ~50 pieces of one-use wreckage —
the prompt's own stated reason for having `quarantine` — is exactly what a normalised key makes
**actionable** rather than merely bucketed."

I measured it. `~/tardis-pipeline/data/db/tardis.duckdb`, opened read-only 2026-09-09, applying
Jellyfin's `GetCleanValue` transform as SQL (`lower`, strip non-alphanumerics to spaces, collapse
whitespace, trim).

**First, the specification's own figure checks out.** The Semantic MediaWiki property `Medium`:

| rows | distinct values | occurring once | occurring twice or fewer |
|---|---|---|---|
| 11,174 | **70** | **44** | **50** |

SPEC.md says "71 distinct values of which about 50 are one-use wreckage". 70 and 50 (at ≤2 uses);
44 at strictly one use. Close enough to stand, and worth correcting to 70.

**Second, the normalised key collapses none of it.**

```
WITH v AS (SELECT DISTINCT value FROM page_properties WHERE property='Medium')
SELECT count(*) AS raw_distinct, count(DISTINCT <cleanvalue(value)>) AS clean_distinct FROM v;
--  raw_distinct = 70 , clean_distinct = 70
```

**70 → 70. Zero.** And looking at the wreckage explains why instantly. The 44 one-use values are not
`Sci-Fi` versus `sci fi`. They are:

```
and how to slay them · brian braddock · nearly killed christmas · plus cat · and nine ·
the lily savage show · vol. 36,379 · no. 7. · first draft. editor: paul cornell ·
1957 - viewing notes · a fela kuti story · hm · r · fpa · minion · the diminuations
```

Fragments of book titles, subtitle halves and editorial notes that landed in the medium field
because an infobox template was filled in wrong. **The wreckage is semantic, not orthographic.** No
case-folding, diacritic-stripping or punctuation-squashing touches it. What handles it is precisely
what SPEC.md already has: `quarantine`.

**Third, the same result holds across the whole corpus.** Sweeping the 45 largest properties in
`page_properties` (518,768 rows), raw-distinct versus clean-distinct:

| property | rows | raw | clean | collapsed | % |
|---|---|---|---|---|---|
| Series | 10,462 | 1,014 | 946 | 68 | **6.71** |
| Issues | 3,017 | 2,049 | 1,992 | 57 | 2.78 |
| Job | 7,462 | 1,502 | 1,481 | 21 | 1.40 |
| Has image | 38,868 | 34,882 | 34,804 | 78 | 0.22 |
| Publisher | 10,420 | 381 | 379 | 2 | 0.52 |
| **Writer** | 11,111 | 1,566 | 1,565 | **1** | **0.06** |
| Species | 21,842 | 1,599 | 1,598 | 1 | 0.06 |
| **Medium** | 11,174 | 70 | 70 | **0** | **0.00** |
| Release date | 11,068 | 4,370 | 4,370 | 0 | 0.00 |

The best case in the entire corpus is 6.71%. `Writer` — a person-name vocabulary, where you would
most expect spelling variants — collapses **one value out of 1,566.**

**Fourth, and this is the case that does support building it.** Matching *across* two
representations of the same field is a different question from deduplicating *within* one. The
archive contains both: the SMW property `Medium` (70 values) and the derived `story_summary.medium`
column (665 distinct values, 523 of them one-use, contaminated with issue-number prefixes like
`DWM 617 comic story`). Matching the second against the first:

| | values matched, of 665 |
|---|---|
| raw exact match | **32** |
| clean-key match | **44** |

A 37.5% relative improvement, 1.8 percentage points absolute. Better, and still small — because the
dominant failure here is prefix contamination, which normalisation does not address either.

**Conclusion for Part 1: the normalised key is a *matching* feature, not a *cleaning* feature, and
the gap sells it as the latter.** It is worth having — Jellyfin uses it for tag-based access control
where a mismatch is a privacy failure, and cross-source matching is the whole point of CMPP — but
the archive evidence the gap cites in its support argues against it, not for it, and should not be
used.

### Part 2 — the ordered vocabulary, and the scale

#### What Jellyfin does

**This is the strongest single implementation found anywhere in this tier, and it answers the gap's
own example exactly.**

`MediaBrowser.Model/Entities/` (all read 2026-09-09):

```csharp
public class ParentalRatingSystem {                 // per country
    public required string CountryCode { get; set; }
    public bool SupportsSubScores { get; set; }
    public IReadOnlyList<ParentalRatingEntry>? Ratings { get; set; }
}
public class ParentalRatingEntry {
    public required IReadOnlyList<string> RatingStrings { get; set; }   // MANY raw strings
    public required ParentalRatingScore RatingScore { get; set; }       // ONE score
}
public class ParentalRatingScore {
    public int Score { get; set; }
    public int? SubScore { get; set; }
}
```

Four things in that model, each of which the gap's one-line "a scale with a min and a max"
understates:

1. **The scale is named and scoped.** A `ParentalRatingSystem` per country, because the same string
   means different things in different systems.
2. **Many raw strings map to one point on the scale.** `RatingStrings` is a *list* — so the
   normalised-key problem (Part 1) and the ordering problem are solved by the same structure.
3. **Two levels of ordering**, with `SupportsSubScores` declared per system.
4. **It is data, not code.** `Emby.Server.Implementations/Localization/Ratings/` holds **45 files**:
   `0-prefer.json` plus 44 country codes (`ar au be bg br ca cl co cz de dk es fi fr gb gr hu id ie
   in it jp kr kz lt mx nl no nz ph pl pt ro ru se sg sk th tr tw ua uk us za`).

**The gap asks "Is 15 stricter than PG-13". Here is Jellyfin's literal answer**, from `gb.json` and
`us.json` (read 2026-09-09):

```json
// gb.json                                    // us.json
{"ratingStrings":["12A","12PG"],              {"ratingStrings":["PG-13"],
 "ratingScore":{"score":12,"subScore":0}}      "ratingScore":{"score":13,"subScore":0}}
{"ratingStrings":["12","12+"],                {"ratingStrings":["TV-14"],
 "ratingScore":{"score":12,"subScore":1}}      "ratingScore":{"score":14,"subScore":0}}
{"ratingStrings":["15"],
 "ratingScore":{"score":15,"subScore":3}}
{"ratingStrings":["Mature","Adult","R18"],
 "ratingScore":{"score":1000,"subScore":0}}
```

So yes — 15 > 13 — **but only because a human mapped both national systems onto a shared integer
axis, by hand, in a data file.** Note the details that only fall out of real use: `12A` and `12` are
the same score with different sub-scores; `score: 1000` is an explicit sentinel for "Adult", because
adult is not an age; and `us.json` enumerates all fifteen permutations of the US content descriptors
(`TV-14-D`, `TV-14-DL`, … `TV-14-DLSV`) as one entry at `subScore: 1`.

**This is Jellyfin's second attempt.** `ParentalRating.Value` (a bare `int?`) is still present and
marked `/// <remarks>Deprecated.</remarks>`; the score/sub-score model arrived in
`Rework parental ratings`, committed **2025-03-31**. So the flat scale shipped, proved insufficient,
and was replaced in place — which is direct evidence on retrofittability, below.

**And the resolver is a catalogue of exactly the dirt SPEC.md's `quarantine` exists for.**
`Emby.Server.Implementations/Localization/LocalizationManager.cs:373-465`:

```csharp
// Some providers may list multiple ratings separated by '/' (e.g. "SE:15 / SE:15+ / SE:Från 15 år").
var ratingValues = rating.Split('/', ...);
...
private static readonly string[] _unratedValues = ["n/a", "unrated", "not rated", "nr"];
if (_unratedValues.Contains(rating.AsSpan(), StringComparison.OrdinalIgnoreCase)) { return null; }
// Convert ints directly
if (TryParseRatingAsScore(rating, out var ratingAge)) { return new(ratingAge, null); }
// Fairly common for some users to have "Rated R" in their rating field
rating = rating.Replace("Rated :", "").Replace("Rated:", "").Replace("Rated ", "").Trim();
// ... country dictionary, then "gb-15"/"gb:15" prefix forms, then US, then every system,
// ... then split on ':' and '-' for "US:PG-13", "Germany: FSK-18", "DE-FSK-18"
return null;
```

Two things to steal outright: the explicit **unrated sentinel list** returning `null` rather than a
number, and the final `return null` — **unknown, never a fabricated value**, which is the same rule
SPEC.md already states for duration, completion and extent.

#### What Plex does

Plex normalises every rating onto **one fixed 0-10 scale at the contract boundary**, and declares
the bounds only in NFO.

Provider contract, `Rating` array (https://developer.plex.tv/pms/ and `docs/Metadata.md`, both read
2026-09-09):

> | `image` | string | Yes | Image identifier for critic rating badge |
> | `type` | string | Yes | `audience` or `critic` |
> | `value` | float | Yes | The rating represented by a **floating point value between 0 and 10** |

with a closed set of four badge identifiers (`imdb://image.rating`, `themoviedb://image.rating`,
`rottentomatoes://image.rating.ripe`, `rottentomatoes://image.rating.upright`) and the note "Adding
new types is not currently supported." So the provider is required to do the rescaling, and Plex
stores the point without the scale.

The NFO path is the opposite and is the better shape.
https://support.plex.tv/articles/using-nfo-metadata-files-with-plex/ (HTTP 200, fetched 2026-09-09,
"Last modified on: July 14, 2026"):

```xml
<ratings>
  <rating name="imdb" max="10" default="true"><value>7.7</value><votes>121637</votes></rating>
  <rating name="themoviedb" max="10"><value>7.5</value><votes>1550</votes></rating>
</ratings>
```

**`name`, `max`, `default`, `value`, `votes`** — a named scale, its upper bound, a designated
default, the point and the sample size. That is the gap's ask, in a format Plex adopted rather than
invented (it follows the Kodi NFO specification), and it is strictly more expressive than Plex's own
provider contract.

For content ratings Plex takes the *system* seriously and the *ordering* not at all: **"Certification
Country: This will influence which content rating system is used. Changing this setting will require
refreshing the metadata for new information to be reflected on items."**
(https://support.plex.tv/articles/advanced-settings-plex-movie-agent/, fetched 2026-09-09, last
modified 2025-04-13). I found no published Plex mapping of rating strings to an ordered scale.

#### Industry standard

**There are two, and they answer two different questions. This is the distinction the gap collapses.**

**Order without distance — SKOS.** W3C Recommendation, *SKOS Simple Knowledge Organization System
Reference* (https://www.w3.org/TR/skos-reference/, fetched 2026-09-09), §9:

> SKOS concept collections are labeled and/or ordered groups of SKOS concepts. Collections are
> useful where a group of concepts shares something in common… or **where some concepts can be
> placed in a meaningful order**.
>
> S29 — `skos:OrderedCollection` is a sub-class of `skos:Collection`.
> S33/S34 — the `rdfs:domain` of `skos:memberList` is `skos:OrderedCollection`; its `rdfs:range` is
> `rdf:List`.
> S35 — `skos:memberList` is an instance of `owl:FunctionalProperty` [one list per collection].

So the W3C answer to "is this vocabulary ordered" is a **list**, and it gives you sequence but not
magnitude. It answers "15 comes after 12A in the BBFC list". It cannot answer "is 15 stricter than
PG-13", because the two live in different lists and a list has no shared axis.

**Distance with declared bounds — Schema.org**, which SPEC.md:56 already names as a governing
standard. https://schema.org/Rating (fetched 2026-09-09):

> `ratingValue` — Number or Text — The rating for the content.
> `bestRating` — Number or Text — **The highest value allowed in this rating system.**
> `worstRating` — Number or Text — **The lowest value allowed in this rating system.**

Note "in this rating **system**" — Schema.org, like Jellyfin, scopes the bounds to a named system
rather than making them global. That is the min and max the gap asks for, and CanonCore is already
committed to the standard it comes from.

**Where they disagree, and it matters for CanonCore:** SKOS says a vocabulary is a list; Schema.org
says a scale is a bounded numeric range; Jellyfin says a scale is a *named system* mapping many
strings onto an integer axis with a tiebreaker. TMDB 7/10 versus RT 70/100 is answered by
Schema.org's shape (rescale by declared bounds). "Is 15 stricter than PG-13" is answered only by
Jellyfin's shape (a hand-built cross-system axis), and **no standard provides it** — because it is
a curatorial judgement, not a fact. Say that plainly rather than looking for a spec that settles it.

### Is it genuinely non-retrofittable?

**Neither half is. One of them has just been retrofitted in the incumbent, in public, twice.**

**The normalised key — NO, and Jellyfin proves it three separate ways.** The key is *derived* and the
raw value is *kept*, which is the definition of a recomputable column:

- `20241113133548_EnforceUniqueItemValue.cs` added the uniqueness constraint **after** the table
  existed (2024-11-13).
- `20250405075612_FixItemValuesIndices.cs` reshaped the indices (2025-04-05).
- `20260610120000_RefreshCleanNamesAndValues.cs` **recomputed every `CleanName` and every
  `CleanValue` in the entire database** (2026-06-10), partitioned, backed up, per-row error tolerant.

Adding the column later costs one migration and one pass. **Changing the normaliser later costs the
same migration** — which is the real point, because you will change it. A normalised key is not a
schema freeze; it is a cache.

The one thing that *is* frozen is the unique constraint, and it is the decision to get right at
migration 1 rather than the column: if uniqueness lands on `(type, clean_value)` instead of
`(type, raw_value)`, then `Sci-Fi` and `sci fi` cannot coexist, the second insert is rejected or
silently folded, and **the original is gone** — which is the one thing here that no later migration
recovers. Jellyfin got this right (unique on `Value`, index only on `CleanValue`); copy it exactly,
and note that it is the opposite of the instinct most people have.

**The scale — NO, and Jellyfin retrofitted it in 2025 in a live product.** `ParentalRating.Value`
was a flat `int?`; it is still there, marked Deprecated, alongside the `ParentalRatingScore`
score/sub-score model introduced by "Rework parental ratings" (2025-03-31). A scale is a lookup
table plus a resolver, and both are addable. SPEC.md's `properties` table is already described as
holding "datatype, value-kind, cardinality, validation" and adding "ordering" to a definitions table
is an `ALTER` plus data, exactly like adding a validation rule — which SPEC.md:454-457 already
commits to supporting after the fact: "Tightening a rule NEVER rejects existing rows: it marks the
property as having offenders and lets you list them."

**What is not retrofittable is the ordering *data*, and only where nobody else has it.** Age
ratings, review scores and star systems all have published external orderings that can be imported
whenever they are needed; Jellyfin's 45 JSON files are freely licensed and directly reusable. But an
ordering the *owner* asserts — a canon-confidence scale, a completeness grade, any project-specific
ranked vocabulary — exists nowhere else and is lost if it was never captured. That is the same
argument as per-field provenance and it applies to a much smaller surface than the gap implies.

**What to actually decide, in priority order:**

1. **`(type, raw_value)` unique; `(type, clean_value)` indexed, not unique.** This is the only
   frozen decision in G11. Copy Jellyfin's two index lines verbatim, and copy `GetCleanValue`'s
   definition too (diacritics, lowercase-invariant, non-alphanumeric to space, collapse, trim) so
   the transform is written down rather than reinvented per call site.
2. **Do not justify the normalised key with the archive.** It collapses 0 of 70 `Medium` values and
   1 of 1,566 `Writer` values. Justify it with matching across sources — which is what CMPP is for,
   what Jellyfin uses it for, and where it measurably improved the archive's own cross-representation
   match rate from 32 to 44 values out of 665.
3. **Keep `quarantine` as the answer to dirty imports.** The measurement above is the strongest
   available evidence *for* SPEC.md's existing quarantine decision: the wreckage is semantic, and
   nothing but a human looking at it will fix `first draft. editor: paul cornell`.
4. **Model the scale as a named system, not as a column on `properties`.** Jellyfin's
   `{system → [{strings[], score, subScore}]}` and Schema.org's `{ratingValue, bestRating,
   worstRating}` agree that the bounds belong to a *system*, not to a field. A `medium` property and
   a `content_rating` property may both be "ordered" while belonging to entirely different axes, and
   an ordering flag on `properties` cannot express that. This is the substantive design correction
   to the gap, which proposes "a lookup is a scale with a min and a max" — the min and max are not
   the vocabulary's, they are the system's.
5. **Steal the two honesty rules from `LocalizationManager`:** an explicit unrated/none sentinel
   list, and `return null` when nothing matches. An unmapped rating string must resolve to unknown,
   never to zero and never to the nearest guess. SPEC.md already applies this rule to duration,
   completion and extent; ratings are the fourth place it belongs.
6. **Distinguish ordered-list from numeric-scale, and say which each vocabulary is.** SKOS gives the
   first, Schema.org the second, and they are not interchangeable: a list orders within one system
   and a scale compares across them. Most CanonCore vocabularies need neither, a few need the first,
   and only ratings need the second.

**Verdict: Tier B for the scale, Tier C for the normalised key, with one Tier A line inside it.**
Neither half is frozen and the incumbent retrofitted both within the last eighteen months — the
clean-value recompute is dated 2026-06-10 and the rating-scale rework 2025-03-31, both into a
codebase with hundreds of thousands of installs. The single genuinely irreversible decision is
which index carries the uniqueness: put it on the raw value, because a unique normalised key
destroys the original on insert and no later migration brings it back. Everything else here is an
`ALTER`, a data file and a recompute — and the archive measurement says the normalised key will do
far less cleaning than the gap promises, so it should be argued for on matching or not at all.

---
