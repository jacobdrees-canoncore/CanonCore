# Validating CNCORE-8 and CNCORE-9

Verification run: **2026-09-10**. Every verdict below rests on a lookup made during this run;
nothing is carried over from the ADRs' own "Evidence" lines or from memory.

Sources of record for the tickets under test:

- CNCORE-8 — "TMDB provider, and the contract test"
  <https://linear.app/jacobrees-canoncore/issue/CNCORE-8/tmdb-provider-and-the-contract-test>
- CNCORE-9 — "The multi-placement test, from two independent sources"
  <https://linear.app/jacobrees-canoncore/issue/CNCORE-9/the-multi-placement-test-from-two-independent-sources>
- ADRs read in full: `docs/adr/0028`, `0036`, `0037`, `0057`.

---

## Section 1 — TMDB licence claims (CNCORE-8, ADR 0036, ADR 0037)

Primary source: <https://www.themoviedb.org/api-terms-of-use>, fetched **2026-09-10**.
The page's own footer reads: *"This Agreement was last updated on: October 20, 2023."*
The operator is named on the page as **TiVo Platform Technologies LLC**, not "The Movie Database Inc."

### 1.1 The cache clause — CONFIRMED

Ticket claim: *"Caching is a CEILING of six months, not an obligation to hold one, and it covers
'any information', so a cached poster and a cached runtime are treated identically."*

The clause sits in **Paragraph 1.C, Restrictions**, under the lead-in *"In addition, You must not:"* —

> Cache, for longer than 6 months, any information obtained through or from TMDB or the TMDB APIs.

Both halves of the ticket's reading hold on the verbatim text:

- It is framed as a prohibition on caching *longer than* six months. Nothing in the document
  obliges a licensee to hold a cache for any period, so "ceiling, not an obligation" is correct.
- The object is **"any information obtained through or from TMDB or the TMDB APIs"**, not
  "images". Paragraph 1.A separately defines *TMDB Content* as *"any content (including audio or
  visual content) or other information available through, on, or from the TMDB APIs or TMDB"*.
  A poster and a runtime are therefore inside the same clause, exactly as the ticket says.

**Verdict: CONFIRMED.** The design consequence the ticket draws from it — a provider-declared
`max_cache_age` checked at read time — is a product decision the terms neither require nor forbid,
but it does satisfy the clause without depending on a scheduled job.

### 1.2 The attribution notice, verbatim — CONFIRMED

Ticket claim: *"The attribution notice must be verbatim and prominent, and the TMDB logo less
prominent than ours."*

**Paragraph 3, Attribution**, in full:

> You must use the TMDB logo to identify Your use of TMDB, the TMDB APIs, or TMDB Content. Any use
> of any TMDB logos in Your Application must be less prominent than the logos or marks that
> primarily describe or identify Your Application and must make it clear that use of any TMDB logos
> does not imply any endorsement, certification, or other approval by TMDB. In addition, You must
> place the following notice prominently in or on Your Application:
>
> "This [website, program, service, application, product] uses TMDB and the TMDB APIs but is not
> endorsed, certified, or otherwise approved by TMDB."

**Verdict: CONFIRMED**, and the string quoted in ADR 0036 matches this character for character,
square brackets included.

Two obligations the ticket's phrasing under-states, both load-bearing for an acceptance criterion:

1. Using the TMDB logo is **mandatory**, not optional — *"You must use the TMDB logo to identify
   Your use"*. The acceptance criterion "the attribution notice appears verbatim and prominently,
   with the TMDB logo less prominent than ours" reads as though the logo were a thing to be
   constrained if present. It has to be present.
2. There is a **third** requirement in the same paragraph that neither ticket nor ADR carries: the
   logo use *"must make it clear that use of any TMDB logos does not imply any endorsement,
   certification, or other approval by TMDB."* In practice the verbatim notice discharges this if
   it sits with the logo, but it is a separate sentence in the terms.

### 1.3 The image-hosting prohibition and its scope — JUDGEMENT (text confirmed, characterisation is weaker than stated)

Ticket claim: prohibited is *"use as an image hosting service for banner advertisements"*; ADR 0037
and ADR 0036 go further and call it *"narrower than a blanket ban, and the clause a hotlinking
design would have to argue against."*

The verbatim clause, again from the Paragraph 1.C *"You must not"* list:

> Use TMDB as an image hosting service for banner advertisements, graphics, etc.

**The text is CONFIRMED exactly as ADR 0036 quotes it, including the "graphics, etc." tail.** The
*characterisation* is the part that does not survive contact with the wording:

- The ticket body drops the tail and says only *"for banner advertisements"*. On the full clause the
  scope is "banner advertisements, **graphics, etc.**" — an open-ended list, not a narrow one. A
  poster hotlinked from `image.tmdb.org` is a graphic served by TMDB, and "etc." leaves no obvious
  edge to the category.
- So the conclusion both ADRs reach — **don't hotlink, store the bytes** — is the right one and is
  *more* strongly supported than they claim, not less. What is wrong is the reassurance that the
  clause is "narrower than a blanket ban". Read plainly it is closer to a ban on using TMDB as
  anyone's image CDN, and the safe reading is the one the design already follows.

**Verdict: JUDGEMENT.** Quote is right, framing is optimistic. ADR 0037's decision is unaffected;
ADR 0036's parenthetical "narrower than a blanket ban" should be struck or softened, and CNCORE-8
should quote the tail so an implementer does not read "banner advertisements" as the whole scope.

### 1.4 The destination-website clause, and whether it names LLM/AI — CONFIRMED

Ticket claim: use *"on or in connection with a 'destination' website ... or for driving traffic"*
counts as commercial use needing a separate written agreement, *"a clause that now explicitly names
LLM and AI query-response systems."*

**Paragraph 2.A, Commercial Use**, opens:

> The license in Paragraph 1.A above does not permit any commercial use of TMDB, the TMDB APIs, or
> TMDB Content. ... is, for the purposes of these terms and conditions, considered a commercial use
> and is only permitted under a separate written agreement between You and TMDB.

and lists among *"Common examples (which are by no means exhaustive) of commercial uses"*:

> Using TMDB, the TMDB APIs, or TMDB Content on or in connection with a "destination" website,
> search engine, or interactive query-response system (including large language model (LLM),
> artificial intelligence, or any other machine learning based interactive query-response systems
> or chatbots) ("Chatbot(s)"), or for driving traffic or generating revenue for a website, search
> engine, or Chatbot (including from advertising displayed on or by the website, search engine,
> Chatbot).

**Verdict: CONFIRMED** on every element: the clause exists, it sits under Commercial Use, commercial
use requires *"a separate written agreement"*, and it does explicitly name LLM, artificial
intelligence, machine-learning query-response systems and chatbots.

One qualifier the ticket does not carry: the list is prefaced *"which are by no means exhaustive"*,
and Paragraph 2.A also reserves to TMDB *"the right to, in its sole discretion, determine whether
Your use is commercial"* and *"to monitor Your use or Your Application to make or revise its
determination."* The ticket's instruction to settle this with TMDB before the demo ships is
therefore the only reliable route — self-assessment is expressly not decisive.

### 1.5 A restriction neither ticket nor ADR carries — CONTRADICTED (by omission)

This is the material finding of the section. Both CNCORE-8 and ADR 0036 present the AI/LLM problem
as **only** a commercial-use example, escapable by a written agreement, and ADR 0036 states that it
*"governs the DEMO's use of TMDB content, not the building of the software."* The terms contain a
**second, separate AI clause that is a flat prohibition, in the restrictions list, with no
commercial qualifier and no written-agreement escape hatch.** Final bullet of Paragraph 1.C:

> Use the TMDB APIs or TMDB Content in connection with, including for training, a machine learning
> (ML) or artificial intelligence (AI) based Application.

Paragraph 1.A reinforces it from the other direction, reserving to TMDB *"the right to make
derivatives of the TMDB APIs or TMDB Content, or to use the TMDB APIs or TMDB Content in connection
with, or for training, a machine learning or artificial intelligence based Application."*

Paragraph 2.A carries a fifth commercial example on the same theme:

> Training or validating a machine learning or artificial intelligence system (including large
> language models and Chatbots) using TMDB content, collecting data sets containing TMDB Content for
> such training or validation, or providing archived or cached data sets containing TMDB Content to
> another person or entity for such training or validation.

Why this matters here rather than being pedantry: CanonCore is not an AI application, so the 1.C
restriction most likely does not bite on the product. But ADR 0036's specific reassurance — that the
AI language *"governs the DEMO's use of TMDB content, not the building of the software"* — is
answering the Paragraph 2.A clause while the Paragraph 1.C clause says something stronger and
different, and 1.C is the one with no negotiated way out. The ADR's sentence reads as a settled
disposal of the AI question and it has only disposed of half of it.

**Verdict: CONTRADICTED (by omission).** ADR 0036 and CNCORE-8 should name Paragraph 1.C's
restriction alongside the Paragraph 2.A example, and state plainly that a written agreement covers
the second and not the first.

### 1.6 A second omitted restriction — JUDGEMENT

Also in the Paragraph 1.C *"You must not"* list, and quoted nowhere in the tickets or ADRs:

> Make derivatives of the TMDB APIs or TMDB Content.

CMPP normalises provider responses into a claim structure and stores component signals. Whether
that is a "derivative" of TMDB Content is a genuinely arguable legal question, not a settled one.
It belongs in the same conversation with TMDB that CNCORE-8 already requires before the demo ships,
which is one conversation rather than two.

**Verdict: JUDGEMENT** — flag it into the existing pre-demo TMDB conversation; do not block on it.

### 1.7 Termination requires purge — CONFIRMED

Ticket claim: *"Termination requires purging all cached TMDB content, which `source` on every
statement and artwork row already makes one delete."*

**Paragraph 1.D, Term and Termination**, closing sentence:

> If TMDB terminates Your license, or You terminate your license, You must immediately cease all use
> of the TMDB APIs, TMDB Content, and any TMDB API key(s), and you must promptly delete or otherwise
> purge all TMDB Content, including any cached content.

**Verdict: CONFIRMED**, and note two details the ticket's paraphrase drops. The obligation extends
to the **API key(s)** as well as the content, and the trigger is bilateral — it fires when *you*
terminate, not only when TMDB does. The acceptance criterion "all content from one provider can be
purged with a single operation" is the right shape; add key revocation to it.

---

## Section 2 — TMDB API technical claims (CNCORE-8, ADR 0037)

All lookups in this section made **2026-09-10** against `developer.themoviedb.org` and, where
stated, against the live API and image CDN.

### 2.1 Rate limit, and what a breach returns — CONFIRMED for the limit, UNFOUNDED for headers and retry guidance

Ticket claim (acceptance criterion): *"Rate limiting is respected and a rate-limit response is a
declared failure mode, not a crash."* The ticket does not state a number, which turns out to be the
right call.

<https://developer.themoviedb.org/docs/rate-limiting>, fetched 2026-09-10, is the whole page:

> **Legacy Rate Limits** — As of December 16, 2019, we have disabled the original API rate limiting
> (40 requests every 10 seconds.) ...
>
> While our legacy rate limits have been disabled for some time, we do still have some upper limits
> to help mitigate needlessly high bulk scraping. They sit somewhere in the 40 requests per second
> range. This limit could change at any time so be respectful of the service we have built and
> respect the `429` if you receive one.

- **Current limit: CONFIRMED** as *"somewhere in the 40 requests per second range"* — deliberately
  vague, self-described as changeable at any time.
- **The legacy 40-per-10-seconds figure is dead** and has been since 2019-12-16. Any implementation
  or third-party guide quoting 40/10s is wrong. This matters because the stale figure is what most
  search results and older client libraries still repeat.
- **Status code: CONFIRMED `429`**, named in the docs.
- **Headers: UNFOUNDED.** TMDB documents no rate-limit headers at all. A live unauthenticated
  request to `https://api.themoviedb.org/3/configuration` on 2026-09-10 returned `HTTP/2 401` with
  headers `content-type`, `date`, `server: openresty`, `cache-control`, `x-cache`, `via`,
  `x-amz-cf-pop`, `alt-svc`, `x-amz-cf-id`, `vary` — and **no `x-ratelimit-*` and no `retry-after`**.
  The `X-RateLimit-Limit/Remaining/Reset` triplet that circulates in blog posts and older clients
  belongs to the pre-2019 regime.
- **Retry guidance: UNFOUNDED.** The only instruction TMDB gives is *"respect the `429` if you
  receive one."* No documented backoff, no documented `Retry-After`.

**What would settle the header question:** provoking a real 429 against an authenticated key and
dumping the response headers. That is not something to do casually against a service whose terms
prohibit *"an excessive amount of bandwidth"* and behaviour that *"adversely impacts the stability
of TMDB"* (Paragraph 1.C). The honest engineering answer is to assume nothing: treat 429 as a
declared failure mode, read `Retry-After` **if present**, and otherwise back off exponentially with
jitter. That is exactly the shape CNCORE-8's criterion already asks for.

**Verdict: CONFIRMED** (limit, status code) / **UNFOUNDED** (headers, retry guidance) — and the
ticket is right not to name a number. If anything is added, it should be the instruction *not* to
hardcode 40/10s from stale sources.

### 2.2 Auth: is an API key still the scheme? — CONTRADICTED (partially)

Ticket claim (acceptance criterion): *"TMDB is a separate repository answering CMPP, with a
user-supplied key."*

<https://developer.themoviedb.org/docs/authentication-application>, fetched 2026-09-10:

> Application level authentication would generally be considered the default way of authenticating
> yourself on the API. Version 3 is controlled by either a single query parameter, `api_key`, or by
> using your access token as a `Bearer` token.
>
> #### Bearer Token
>
> **The default method to authenticate is with your access token.** If you head into your account
> page, under the API settings section, you will see a new token listed called *API Read Access
> Token*. This token is expected to be sent along as an `Authorization` header. ...
>
> Using the Bearer token has the added benefit of being a single authentication process that you can
> use across both the v3 and v4 methods. Both authentication methods provide the same level of
> access, and which one you choose is completely up to you.

The documented example is:

```
curl --request GET \
     --url 'https://api.themoviedb.org/3/movie/11' \
     --header 'Authorization: Bearer <<access_token>>'
```

Findings:

- TMDB has **not** dropped the API key. `api_key` as a query parameter still works and is still
  documented. So "user-supplied key" is not wrong.
- But TMDB now calls the **API Read Access Token the default**: *"The default method to authenticate
  is with your access token."* Every current code sample on the developer site — image languages,
  append-to-response, the endpoint reference pages — uses `Authorization: Bearer`, not `api_key`.
- The read access token is the better choice for this project on two independent grounds. It works
  across v3 and v4 with one credential, and it travels in a header rather than in the query string,
  so it does not end up in access logs, referrers, or a cached URL.

**Verdict: CONTRADICTED (partially).** The claim "with a user-supplied key" is *permitted* but is no
longer what TMDB's own docs steer you to. CNCORE-8's acceptance criterion should say **"a
user-supplied credential (TMDB API Read Access Token, sent as a Bearer header)"**. Left as "key", an
implementer will most likely put the secret in a query string, which is the worse of the two
supported options and reads as dated.

Note this sits directly on ADR 0035 (`ship-no-api-keys`): whatever that ADR says about not shipping
credentials applies to the read access token identically, and the wording there is worth checking
for the same key-versus-token drift.

### 2.3 The image CDN, sizes, and `/configuration` — CONFIRMED

<https://developer.themoviedb.org/docs/image-basics>, fetched 2026-09-10:

> In order to generate a fully working image URL, you'll need 3 pieces of data. Those pieces are a
> `base_url`, a `file_size` and a `file_path`.
>
> The first two pieces can be retrieved by calling the /configuration API and the third is the file
> path you're wishing to grab on a particular media object. Here's what a full image URL looks like
> if the poster_path of `/1E5baAaEse26fej7uHcjOgEE2t2.jpg` was returned for a movie, and you were
> looking for the w500 size:
>
> `https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg`

- **Base URL: CONFIRMED** `https://image.tmdb.org/t/p/`. The `/configuration` response example on
  <https://developer.themoviedb.org/reference/configuration-details> gives both
  `"base_url":"http://image.tmdb.org/t/p/"` and `"secure_base_url":"https://image.tmdb.org/t/p/"` —
  **use `secure_base_url`**; the plain `base_url` field is still http.
- **Size variants: CONFIRMED**, and here is the full documented set from the `/configuration`
  example response:
  - `backdrop_sizes`: `w300`, `w780`, `w1280`, `original`
  - `logo_sizes`: `w45`, `w92`, `w154`, `w185`, `w300`, `w500`, `original`
  - `poster_sizes`: `w92`, `w154`, `w185`, `w342`, `w500`, `w780`, `original`
  - `profile_sizes`: `w45`, `w185`, `h632`, `original`
  - `still_sizes`: `w92`, `w185`, `w300`, `original`

  So `w500` is a **poster and logo** size, and `w780` is a **poster and backdrop** size. Neither is
  valid for every image role — `w500` is not a backdrop size and `w780` is not a still size.
  A design that hardcodes one pair across all roles will 404 on some of them.
- **How `/configuration` is meant to be used: CONFIRMED** as the source of `base_url` and
  `file_size`. The reference page's own description is minimal: *"The data returned here in the
  configuration endpoint is designed to provide some of the required information you'll need as you
  integrate our API. For example, you can get a list of valid image sizes and the valid image
  address."* The getting-started page adds: *"The configuration methods are useful to get the static
  lists of data we use throughout the database ... The configuration method also holds useful image
  information."*
- **What the docs do NOT say, contrary to widespread belief:** there is no current instruction to
  cache the configuration response for a set period, and no "check every few days" guidance. That
  advice, which several third-party guides attribute to TMDB, is not on the page today. **UNFOUNDED**
  as a TMDB requirement.

**Verdict: CONFIRMED** for base URL, sizes and the role of `/configuration`.

Practical consequence for ADR 0037, which stores bytes rather than hotlinking: because the bytes are
stored, the `/configuration` call is needed only at fetch time, and the size list can be fetched once
per run rather than per image. The one thing not to do is hardcode `base_url`, since it is the field
`/configuration` exists to supply.

Live check, 2026-09-10: `HEAD https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg`
returned `HTTP/2 200`, `content-type: image/jpeg`, `content-length: 124727`, and
`server: BunnyCDN-FR1-1324` with `cache-control: public, max-age=31919000`. The image CDN is
**BunnyCDN**, while the API itself sits behind **CloudFront/openresty** — two different edges, worth
knowing when diagnosing a failure.

### 2.4 Current API version — CONFIRMED (v3)

<https://developer.themoviedb.org/docs/getting-started>, fetched 2026-09-10, opens:

> Welcome to version 3 of The Movie Database (TMDB) API. This is where you will find the definitive
> list of currently available methods for our movie, tv, actor and image API.

**v3 is current**, base path `https://api.themoviedb.org/3/`. A v4 exists but is not a successor
that deprecates v3: the auth page describes the Bearer token as usable *"across both the v3 and v4
methods"*, and v4 covers user-authenticated list and account operations. For a read-only provider,
**v3 is the correct and current target**, as of 2026-09-10.

### 2.5 ADR 0037's "142 images for ONE item" figure — UNFOUNDED

ADR 0037 states: *"TMDB's own documented example returns 142 images for ONE item, 109 of them
posters across 15 languages."*

I could not find this figure in TMDB's current documentation. The pages that would carry it —
`docs/image-basics`, `docs/image-languages`, `docs/append-to-response`, `reference/movie-images` —
were fetched on 2026-09-10 and none contains an image count. `docs/image-languages` uses movie `550`
(Fight Club) as its worked example for `include_image_language` but quotes **no totals**. There is no
`docs/images` page at all (404).

The underlying *point* stands on its own and does not need the number: `include_image_language`
exists precisely because a single item carries many images across many languages, which is why ADR
0037's per-role limit and quality floor are fetch-time policy rather than something deferrable.

**Verdict: UNFOUNDED.** **What would settle it:** one authenticated
`GET /3/movie/550/images?include_image_language=` call, counting the returned `posters` array and its
distinct `iso_639_1` values, with the date recorded — and noting that the count is live data that
drifts, not a documented constant. Either source the number that way or drop it and keep the
argument, which does not depend on it.

---

## Section 3 — Splink and record-linkage evaluation (ADR 0028, feeding CNCORE-9's fixture)

Primary source: Splink's "Edge Metrics" topic guide,
<https://moj-analytical-services.github.io/splink/topic_guides/evaluation/edge_metrics.html>,
fetched **2026-09-10**. Splink's current release is **4.0.17**, published **2026-09-03** (PyPI,
checked 2026-09-10), so the docs read are the current ones.

### 3.1 "Splink documents accuracy as gameable by guessing the majority class" — CONFIRMED

ADR 0028's claim, verbatim: *"never accuracy, which Splink documents as gameable by guessing the
majority class."*

Splink's Accuracy section, verbatim:

> **Accuracy** = (True Positives + True Negatives) / All Predictions
>
> This measures the proportion of correct classifications (of any kind). This may be useful for
> balanced data but **high accuracy can be achieved by simply assuming the majority class for highly
> imbalanced data (e.g. assuming non-matches).**

**Verdict: CONFIRMED.** The wording is current as of 2026-09-10 and the ADR's paraphrase is faithful.
Note the direction of the example: Splink's majority class in record linkage is **non-matches**, so
the degenerate scorer that games accuracy is one that says **no** to everything. That is the opposite
of the degenerate scorer ADR 0028 goes on to worry about, which matters below.

Wider literature agrees and is not merely Splink's opinion: record linkage is characterised by
severe class imbalance (the candidate-pair space grows quadratically while true matches grow
linearly), and accuracy is not used as a headline metric anywhere in the field.

### 3.2 "Precision and recall are the standard pair, rather than accuracy" — CONTRADICTED (partially)

The half of this that is right: **precision and recall are unambiguously the right choice over
accuracy**, and Splink defines both as first-class metrics —

> The True Positive Rate (Recall) is the proportion of matches that are correctly predicted by Splink.
>
> The Positive Predictive Value (Precision), is the proportion of predicted matches which are true
> matches.

The half that is contradicted: Splink does **not** present precision and recall as the endpoint. The
same page carries an explicit warning against exactly that framing:

> **Warning** — Each of these metrics looks at just one row or column of the confusion matrix. **A
> model cannot be meaningfully summarised by just one of these performance measures.**
>
> "Predicts cancer with 100% Precision" - is true of a "model" that correctly identifies one known
> cancer patient, but misdiagnoses everyone else as cancer-free.
>
> "AI judge's verdicts have Recall of 100%" - is true for a power-mad AI judge that declares everyone
> guilty, regardless of any evidence to the contrary.

and it goes on to recommend composite metrics:

> It is very rare that a single metric defines the desired behaviour of a model. Therefore,
> **evaluating performance with a composite metric (or a combination of metrics) is advised.**

Splink then names three, in increasing robustness, and warns about the first:

- **F-score** — with a warning attached: *"F-score does not account for class imbalance in the data,
  and is asymmetric (i.e. it considers the prediction of matching records, but ignores how well the
  model correctly predicts non-matching records)."*
- **P₄ score** — the harmonic mean of Recall, Specificity, Precision and Negative Predictive Value.
  *"This addresses one of the issues with the F-Score as it considers how well the model predicts
  non-matching records as well as matching records."*
- **Matthews Correlation Coefficient (φ)** — ranges −1 to 1 rather than 0 to 1.

This is corroborated outside Splink. Hand and Christen, *"A note on using the F-measure for
evaluating record linkage algorithms"* (Statistics and Computing, 2018,
<https://link.springer.com/article/10.1007/s11222-017-9746-6>) is the standing critique of F-measure
in this exact field. And a 2024 study in *Computational Statistics*
(<https://link.springer.com/article/10.1007/s00180-024-01539-5>) reports Matthews Correlation
Coefficient, G-Mean and Cohen's kappa performing consistently well on imbalanced data while accuracy
and AUC perform poorly — the same ordering Splink's page arrives at.

**Verdict: CONTRADICTED (partially).** "Precision and recall, never accuracy" is a large improvement
on accuracy and defensible for this project. But ADR 0028's phrasing implies precision and recall are
where the authorities land, and they are not: Splink's own page says a pair of single-row metrics
cannot summarise a model and advises a composite.

**Judgement for this project, though:** asserting **both** precision and recall in one test largely
closes the gap the warning describes, because the two degenerate scorers Splink names fail on
opposite metrics — say-yes-to-everything tanks precision, say-no-to-everything tanks recall. Pinning
both is a real gate. A committed test with two named thresholds is also easier to read in a diff and
easier to explain in a failure message than a single P₄ number, which is worth something in a
portfolio project whose point is legibility. **The recommendation is to keep precision and recall as
the asserted gate and soften ADR 0028's claim about what the field standard is**, rather than to
switch metrics.

### 3.3 ADR 0028's reasoning about "no match" rows is inverted — CONTRADICTED

This is the substantive finding of the section and it is a straightforward, correctable error.

ADR 0028 says:

> ... over a labelled subset of the fixture that MUST include rows whose correct answer is "no match".
>
> **Without those rows recall is never exercised** and a scorer that says yes to everything scores
> perfectly.

The **conclusion is right** and the **reason is backwards.** Working from the definitions Splink
gives, on a labelled subset containing only true-match rows:

- **Recall** = TP / (TP + FN) is computed over the true matches. Those are precisely the rows that
  *are* present. Recall **is** exercised — a scorer that misses matches is caught by it.
- **Precision** = TP / (TP + FP) is the metric that dies. With no true non-matches in the set there
  is nothing to produce a false positive, so FP = 0 and precision is trivially 1.0 regardless of the
  scorer.
- A scorer that says yes to everything therefore scores **recall 1.0 and precision 1.0** — perfect,
  as the ADR says — but it is **precision** that the missing rows would have caught, not recall.

So the fix is one word: *"Without those rows **precision** is never exercised."* It matters because
the sentence as written tells an implementer the wrong thing to assert. Someone who adds the no-match
rows and then gates on recall alone has built a test that a say-yes-to-everything scorer still passes,
which is the exact defect the ADR exists to prevent.

**Verdict: CONTRADICTED.** ADR 0028's requirement is correct; its justifying sentence names the wrong
metric and should be corrected before anyone implements against it.

### 3.4 The Jellyfin defect cited in ADR 0028 — NOT RE-VERIFIED IN THIS RUN

ADR 0028 cites `TmdbUtils.FindBestMatch` opening with `bestScore = 0` and `best = results[0]`. That
is a source-code claim about a third-party repository, outside this brief's scope (which covers TMDB
terms and testing tooling), and I did not open Jellyfin's source during this run.

**Verdict: UNFOUNDED for the purposes of this document** — not because it is doubted, but because no
lookup in this run touched it. `docs/research/verify-adr-jellyfin.md` records an earlier check.
**What would settle it:** re-reading the current `TmdbUtils` source at a pinned commit and recording
the permalink and date, since the cited method is exactly the kind of thing upstream may have fixed.

---

## Section 4 — Test tooling (CNCORE-8's contract test, CNCORE-9's over-HTTP test)

All npm versions in this section were read from the npm registry on **2026-09-10**; PyPI likewise.
Every date given is the publish date of that package's `latest` tag.

### 4.1 Asserting on server-rendered HTML over HTTP, without a browser — CONFIRMED that maintained options exist

CNCORE-9 says the test *"Runs at the first seam, over HTTP against the running app."* Nothing in the
ticket names a tool, so there is no claim to contradict — the question is what is actually available
today. Two pieces are needed: something to make the request, and something to assert on the HTML.

**Making the request.** Node's built-in `fetch` is the obvious answer and needs no dependency.
Beyond it:

| Option | Latest | Published | Fit |
| --- | --- | --- | --- |
| Node built-in `fetch` (undici under the hood; `undici` standalone 8.10.2) | — | 2026-09-04 | No dependency. Correct default. |
| `supertest` | 7.2.2 | 2026-01-06 | Maintained, but binds to a Node `http.Server` instance. Awkward against `next start`, which owns its own server. Not the natural fit here. |
| Playwright's `request` fixture / `APIRequestContext` (`playwright` 1.63.0) | 1.63.0 | 2026-09-04 | Real HTTP with **no browser launched**. Playwright's API-testing docs state you can *"send requests to the server directly from Node.js without loading a page and running js code in it."* Respects `baseURL` and `extraHTTPHeaders`. |
| `next-test-api-route-handler` | 5.0.7 | 2026-08-16 | Maintained, but scoped to Route Handlers, not rendered pages. Wrong seam for CNCORE-9. |

**Asserting on the HTML.** All of these are actively maintained as of 2026-09-10:

| Parser | Latest | Published | Character |
| --- | --- | --- | --- |
| `cheerio` | 1.2.0 | 2026-01-23 | jQuery-style selectors, no DOM emulation, fastest. |
| `happy-dom` | 20.14.3 | 2026-09-09 | Fuller DOM than cheerio, much lighter than jsdom. Most actively released of the set. |
| `jsdom` | 30.0.1 | 2026-07-29 | The heaviest and most spec-complete. What Next.js's own Vitest guide configures. |
| `linkedom` | 0.18.13 | 2026-07-07 | Light DOM-ish parser, good for server-side HTML. |
| `node-html-parser` | 9.0.4 | 2026-09-07 | Minimal and fast. |
| `@testing-library/dom` | 10.4.1 | 2025-07-27 | Not a parser — layers `getByRole`/`getByText` semantic queries over jsdom or happy-dom. Slower release cadence but stable and not abandoned. |

**Verdict: CONFIRMED** — the capability exists and is well maintained. There is no need for a browser
and no need for Playwright's browser half.

**Judgement for CNCORE-9:** `fetch` + `cheerio` is the smallest thing that works and matches this
repo's stated preference for the simplest implementation. If the assertions want to read as
"the user sees X at position 2" rather than as CSS selectors, `happy-dom` + `@testing-library/dom`
buys that at the cost of one more dependency, and is worth it if the test's failure message is meant
to name the broken claim, which CNCORE-9 explicitly asks for.

**A shortcut worth considering instead.** ADR 0045 (`the-public-read-path-names-every-field`) implies
a JSON read path exists. Asserting multi-placement positions against **JSON** rather than parsed HTML
would give a test that is deterministic, immune to markup churn, and needs no parser at all. HTML
parsing is only required if the invariant being protected is genuinely about what is rendered.
CNCORE-9's invariant — one item, two placements, different positions — is a data claim, not a
rendering claim. Worth settling before implementation, because it changes the dependency list.

### 4.2 Is Vitest the current default for this stack? — CONFIRMED, with a live version hazard

**Current stable: `vitest` 5.0.0, published 2026-09-03** (npm, checked 2026-09-10). Other dist-tags
on the same day: `V4` → 4.1.11, `V3` → 3.2.7. For comparison, `jest` is 30.5.1, published 2026-09-01,
so Jest is not abandoned either — this is a preference, not a correctness question.

Next.js documents both. <https://nextjs.org/docs/app/guides/testing> (docs version 16.3.4,
lastUpdated 2026-02-03) lists Cypress, Jest, Playwright and Vitest, and assigns them:

> **Vitest** — Learn how to set up Vitest with Next.js for **Unit Testing**.
>
> **Playwright** — Learn how to set up Playwright with Next.js for **End-to-End (E2E) Testing**.

**Verdict: CONFIRMED** that Vitest is a current, first-class, Next.js-documented choice for this
stack. It is the right default for CNCORE-8's contract test.

**Three current facts that will bite an implementer, all dated 2026-09-10:**

1. **Vitest 5.0 has hard platform floors.** Vitest's migration guide states: *"Vitest 5.0 requires
   Vite >= 6.4.0 and Node.js >= 22.12.0."* Check the repo's Node version before adopting 5.
2. **Next.js's own example is two majors behind.** `examples/with-vitest/package.json` on `canary`
   pins `"vitest": "^3.2.4"` and `"jsdom": "^26.1.0"` (jsdom's latest is 30.0.1). The written guide
   at `/docs/app/guides/testing/vitest` was last updated **2026-08-25**, nine days *before* Vitest
   5.0.0 shipped, and its install command is unpinned (`pnpm add -D vitest ...`) — so following the
   guide literally installs a major the guide has never been tested against. Expect to do the
   integration work yourself.
3. **Peer-dependency churn around the React plugin.** `@vitejs/plugin-react` 6.1.1 (2026-08-28)
   declares `peerDependencies: { vite: "^8.0.0", ... }`, while Vitest 5 asks only for Vite >= 6.4.0
   and Vite's latest is 8.2.2. The Next.js example pins `@vitejs/plugin-react ^5.0.1`. This is a
   solvable but real matrix, and it is a reason to keep the contract test on the plain `node`
   environment with no React plugin at all.

**Breaking changes in Vitest 5 that matter to a test calling live services**, from the migration guide:

- `clearMocks` now defaults to `true`.
- **Unawaited async assertions now fail** rather than silently auto-awaiting. This is a genuine
  improvement for a test full of `await expect(...).resolves`, and it will surface latent bugs in any
  test suite ported from v4.
- The `-t` CLI filter now matches full test names joined by `' > '`, which changes any CI invocation
  that filters by name.

### 4.3 What Vitest offers a contract test that calls two external HTTP services — CONFIRMED

CNCORE-8's test must call `search`, `lookup` and `browse` on **two** providers and assert the same
shapes. The features that matter, all current in Vitest 5:

- **Parameterisation** — `test.for` / `describe.each` runs one suite body against a table of
  providers (`test.for` confirmed current in Vitest's docs, 2026-09-10). This is the mechanism that makes the test a *contract* rather than two copies: adding a
  third provider is a new row, and a divergence names which provider failed in the test title. This
  is the single most important feature for the ticket and it is built in.
- **Environment gating** — `describe.skipIf` / `describe.runIf` (`describe.skipIf` confirmed current,
  2026-09-10). The TMDB provider needs a credential
  (see 2.2). Gating the suite on its presence lets CI run the wiki half unconditionally and the TMDB
  half only where the credential exists, without the test lying about what it covered. Pair this with
  a **loud skip**, not a silent one, or the gate becomes a way for the contract test to pass while
  testing nothing.
- **`expect.soft`** — confirmed current 2026-09-10; Vitest's own docs describe it as *"useful for
  checking multiple independent conditions, such as validating an API response."* It collects several
  assertion failures in one run instead of stopping at the first. For a shape-comparison test, seeing all six divergences at once beats six re-runs.
- **`testTimeout` and `retry`** — per-test, needed for anything crossing a real network.
- **Snapshot testing** — `toMatchSnapshot` / inline snapshots. Useful for pinning a **normalised
  shape** (key sets, types, claim structure) rather than live values, which drift.
- **`vi.stubEnv`** — for credential handling inside tests without leaking into the process.

**Verdict: CONFIRMED** — Vitest covers the ticket's needs without extras.

**One caution.** For a test whose entire purpose is that it calls the real services, do **not** reach
for `msw` (2.15.0, 2026-07-08) or `nock` (14.0.17, 2026-07-30). Both are healthy and both are the
right tool for the app's own unit tests, but mocking the providers in the contract test would destroy
the exact property CNCORE-8 exists to prove. The ticket is right that the test must call the providers
directly; that decision should be written down where an implementer will see it, because reaching for
MSW is the obvious instinct.

### 4.4 Is there an established contract-testing tool that fits better than a bespoke test? — CONTRADICTED (the ticket is right; Pact does not fit, and its own docs say so)

The ticket asserts a bespoke test. The brief asks whether an established tool fits better. **It does
not**, and the evidence is Pact's own documentation rather than an opinion.

**Pact** (`@pact-foundation/pact` 17.1.4, published 2026-09-07 — very much alive). Its own
"What is Pact good for?" page (<https://docs.pact.io/getting_started/what_is_pact_good_for>, fetched
2026-09-10) lists when Pact is a good fit:

> - You (or your team/organisation/partner organisation) control the development of both the consumer
>   and the provider.
> - The consumer and provider are both under active development.
> - The provider team can easily control the data returned in the provider's responses.
> - The requirements of the consumer(s) are going to be used to drive the features of the provider.

and when it is not. Three of those exclusions land squarely on CNCORE-8:

> - Testing new or existing providers where the functionality is **not being driven or altered by the
>   needs of particular consumers**.
> - **Pass-through APIs** that merely forward requests without validation.
> - Scenarios where you **cannot control test data** or load data into the provider.

CMPP is a published protocol that providers implement; it is not driven by one consumer's needs. The
providers are adapters over a wiki and TMDB — pass-through by design. And TMDB's data is emphatically
not ours to control. Pact is **consumer-driven contract testing** for services inside one
organisation, and CMPP is the opposite arrangement: **provider-driven conformance** to a published
spec, which is the OpenAPI/JSON-Schema world, not the Pact world.

**So the right established pattern is schema-based conformance**, not Pact: one machine-readable CMPP
schema, one suite that runs against every implementation. Availability, checked 2026-09-10:

| Tool | Latest | Published | Status |
| --- | --- | --- | --- |
| `schemathesis` (Python) | 4.26.1 | 2026-09-08 | **Actively maintained.** Property-based conformance against an OpenAPI schema. The strongest off-the-shelf option — but Python, so a second toolchain. |
| `ajv` (JSON Schema) | 8.20.0 | 2026-04-24 | Maintained. The validation engine, not a test harness. |
| `zod` | 4.6.1 | 2026-09-09 | Maintained, very active. Schema-as-TypeScript, parses and types in one. |
| `@seriousme/openapi-schema-validator` | 2.9.1 | 2026-08-05 | Maintained. Validates the *spec document*, not responses. |
| `@apideck/portman` | 1.35.0 | 2026-05-23 | Maintained. OpenAPI → Postman contract tests. Heavy for this. |
| `dredd` | 14.1.0 | **2021-11-16** | **Dormant ~5 years.** Do not adopt. |
| `jest-openapi` | 0.14.2 | **2022-01-03** | **Dormant ~4.5 years.** |
| `chai-openapi-response-validator` | 0.14.2 | **2022-01-03** | **Dormant ~4.5 years.** |
| `vitest-openapi` | 1.0.3 | **2023-10-02** | **Dormant ~3 years.** A Vitest port of `jest-openapi`, itself dormant. |
| `openapi-response-validator` | 12.1.3 | **2023-05-24** | **Dormant ~3 years.** |

That table is the finding. **The JavaScript niche of "assert this HTTP response satisfies my OpenAPI
spec" is essentially abandoned** — every library built for it stopped publishing between 2021 and
2023. There is no maintained JS drop-in. The maintained answer is either Schemathesis in Python or
`ajv`/`zod` wired into your own harness, which is a bespoke test with a schema at its centre.

**Verdict: CONTRADICTED** as a challenge to the ticket — no established tool fits better, and Pact
specifically is ruled out by Pact. **The ticket's bespoke test is correct.**

**One improvement worth making to CNCORE-8, though.** "Asserts the same response shapes" is currently
prose. If the shapes live in a **single committed CMPP schema** (`zod` is already in this stack's
idiom, and `ajv` if the schema must be language-neutral JSON Schema) and both providers are validated
against **that one artefact** via `describe.each`, then:

- the contract has one definition rather than being implied by assertions,
- a third provider costs one table row and no new assertions,
- and the acceptance criterion *"That test fails if either provider diverges from the contract"*
  becomes mechanically true rather than a promise about how the assertions were written.

That is the difference between a bespoke test and a bespoke *conformance suite*, and it is a small
change to the ticket's wording, not a change of approach.

---

## Section 5 — Versions, dated

Every row read on **2026-09-10** from the registry named. "Published" is the publish date of that
package's `latest` tag, which is the honest signal of maintenance.

### The two the brief asked for

| Thing | Current | Dated | Source |
| --- | --- | --- | --- |
| **Vitest** | **5.0.0** | published **2026-09-03** | npm registry `dist-tags.latest`. Also live: `V4` → 4.1.11, `V3` → 3.2.7. Requires **Vite >= 6.4.0 and Node.js >= 22.12.0**. |
| **TMDB API** | **v3** | confirmed current **2026-09-10** | <https://developer.themoviedb.org/docs/getting-started>: *"Welcome to version 3 of The Movie Database (TMDB) API. This is where you will find the definitive list of currently available methods."* Base path `https://api.themoviedb.org/3/`. A v4 exists alongside for user-auth/list methods; it does not deprecate v3. |

### Everything else touched in this run

| Package | Latest | Published | Note |
| --- | --- | --- | --- |
| `next` (docs) | 16.3.4 | docs updated 2026-02-03 / 2026-08-25 | Testing guide and Vitest guide respectively. |
| `jest` | 30.5.1 | 2026-09-01 | Alive; Vitest is a preference, not a correctness call. |
| `playwright` | 1.63.0 | 2026-09-04 | `request` fixture does HTTP with no browser. |
| `@next/playwright` | 16.3.4 | 2026-08-31 | Self-described **Experimental**, and requires Cache Components. |
| `@testing-library/react` | 16.3.3 | 2026-08-27 | |
| `@testing-library/dom` | 10.4.1 | 2025-07-27 | Slower cadence, not abandoned. |
| `@vitejs/plugin-react` | 6.1.1 | 2026-08-28 | Peer-deps `vite: ^8.0.0`. |
| `vite` | 8.2.2 | 2026-08-20 | |
| `jsdom` | 30.0.1 | 2026-07-29 | Next.js example still pins `^26.1.0`. |
| `happy-dom` | 20.14.3 | 2026-09-09 | Most actively released HTML/DOM option. |
| `cheerio` | 1.2.0 | 2026-01-23 | |
| `linkedom` | 0.18.13 | 2026-07-07 | |
| `node-html-parser` | 9.0.4 | 2026-09-07 | |
| `supertest` | 7.2.2 | 2026-01-06 | |
| `next-test-api-route-handler` | 5.0.7 | 2026-08-16 | Route Handlers only. |
| `msw` | 2.15.0 | 2026-07-08 | Right for unit tests, wrong for the contract test. |
| `nock` | 14.0.17 | 2026-07-30 | Same. |
| `undici` | 8.10.2 | 2026-09-04 | Backs Node's built-in `fetch`. |
| `@pact-foundation/pact` | 17.1.4 | 2026-09-07 | Healthy, but ruled out by Pact's own fit criteria. |
| `schemathesis` (PyPI) | 4.26.1 | 2026-09-08 | Best-maintained schema conformance tool, Python. |
| `ajv` | 8.20.0 | 2026-04-24 | |
| `zod` | 4.6.1 | 2026-09-09 | |
| `@seriousme/openapi-schema-validator` | 2.9.1 | 2026-08-05 | Validates spec documents, not responses. |
| `@apideck/portman` | 1.35.0 | 2026-05-23 | |
| `splink` (PyPI) | 4.0.17 | 2026-09-03 | Docs read in Section 3 are current. |
| `openapi-response-validator` | 12.1.3 | **2023-05-24** | Dormant. |
| `vitest-openapi` | 1.0.3 | **2023-10-02** | Dormant. |
| `jest-openapi` | 0.14.2 | **2022-01-03** | Dormant. |
| `chai-openapi-response-validator` | 0.14.2 | **2022-01-03** | Dormant. |
| `dredd` | 14.1.0 | **2021-11-16** | Dormant. |

---

## Section 6 — Summary

### Counts

| Verdict | Count |
| --- | --- |
| CONFIRMED | 11 |
| CONTRADICTED | 4 against the tickets and ADRs (+1 against the brief's own challenge, §4.4) |
| UNFOUNDED | 4 |
| JUDGEMENT | 2 |

21 claims adjudicated in total.

### CONFIRMED (11)

TMDB cache clause and its "any information" scope (1.1) · the attribution notice verbatim and the
logo-prominence rule (1.2) · the destination-website clause naming LLM/AI/chatbots as commercial use
requiring a separate written agreement (1.4) · termination requiring purge of cached content (1.7) ·
TMDB's rate limit of ~40 req/s and the `429` status (2.1, limit and status only) · the image CDN base
URL, size variants and the role of `/configuration` (2.3) · TMDB API v3 as current (2.4) · Splink
documenting accuracy as gameable by assuming the majority class (3.1) · maintained no-browser
HTML-over-HTTP tooling existing today (4.1) · Vitest as a current Next.js-documented default for this
stack (4.2) · Vitest having the features CNCORE-8's contract test needs (4.3).

### CONTRADICTED (4) — full detail in the sections cited

1. **§1.5 — TMDB's flat AI prohibition is missing from CNCORE-8 and ADR 0036.** Both treat the AI/LLM
   problem as *only* a Paragraph 2.A commercial-use example escapable by a written agreement. TMDB's
   Paragraph 1.C restrictions list contains a **separate, unqualified prohibition** with no
   written-agreement escape: *"Use the TMDB APIs or TMDB Content in connection with, including for
   training, a machine learning (ML) or artificial intelligence (AI) based Application."* ADR 0036's
   sentence that the AI language *"governs the DEMO's use of TMDB content, not the building of the
   software"* answers the 2.A clause and reads as though it had settled the whole question. It has
   settled half.

2. **§2.2 — "with a user-supplied key" is dated.** TMDB's auth docs now say *"The default method to
   authenticate is with your access token"* (the API Read Access Token, sent as
   `Authorization: Bearer`), and every current code sample uses it. `api_key` as a query parameter
   still works, so the ticket is not *wrong* — but as written it will steer an implementer to put a
   secret in a query string, the worse of the two supported options.

3. **§3.2 — "precision and recall" is not where the authorities land.** Splink's own page warns
   *"A model cannot be meaningfully summarised by just one of these performance measures"* and advises
   *"evaluating performance with a composite metric (or a combination of metrics)"*, naming P₄ and
   Matthews Correlation Coefficient, and warning that F-score *"does not account for class imbalance
   ... and is asymmetric."* Asserting **both** precision and recall is still a sound gate for this
   project — the two degenerate scorers fail on opposite metrics — but ADR 0028's framing overstates
   the consensus.

4. **§3.3 — ADR 0028's reasoning is inverted, and this one is a plain error.** It says *"Without those
   rows recall is never exercised."* On a set of only true-match rows it is **precision** that is
   never exercised (no true negatives ⇒ no false positives ⇒ precision trivially 1.0); recall is
   exercised fine, and the say-yes-to-everything scorer simply aces it. The ADR's conclusion is right
   and its stated reason names the wrong metric. Left as written, an implementer could add the
   no-match rows and gate on recall alone, which the defective scorer still passes.

*(§4.4 is recorded as CONTRADICTED against the brief's challenge, not against the ticket: no
established tool fits better, and Pact's own documentation rules Pact out. The ticket's bespoke test
is correct.)*

### UNFOUNDED (4)

1. **§2.1 — TMDB's rate-limit headers and retry guidance.** TMDB documents **no** rate-limit headers
   and no backoff guidance; the only instruction is *"respect the `429` if you receive one."* A live
   request on 2026-09-10 returned no `x-ratelimit-*` and no `retry-after`. The
   `X-RateLimit-Limit/Remaining/Reset` triplet circulating in blogs and older clients belongs to the
   pre-2019 regime, as does the **40-requests-per-10-seconds** figure, disabled 2019-12-16.
   *Settled by:* provoking a real 429 on an authenticated key and dumping headers — which the terms'
   bandwidth and stability clauses make an unattractive thing to do deliberately. Assume nothing:
   honour `Retry-After` if present, otherwise exponential backoff with jitter.

2. **§2.3 — the belief that TMDB tells you to cache `/configuration` and re-check every few days.**
   Not on the page today. Widely repeated by third-party guides; **not a TMDB requirement.**
   *Settled by:* citing a TMDB page that says it, or dropping the claim.

3. **§2.5 — ADR 0037's "142 images for ONE item, 109 of them posters across 15 languages."** Not in
   TMDB's current docs. `docs/image-basics`, `docs/image-languages`, `docs/append-to-response` and
   `reference/movie-images` were all fetched 2026-09-10 and none carries an image count; there is no
   `docs/images` page (404). The *argument* does not depend on the number.
   *Settled by:* one authenticated `GET /3/movie/550/images?include_image_language=`, counting the
   `posters` array and its distinct `iso_639_1` values, recording the date — and noting it is live
   data that drifts, not a documented constant. Otherwise drop the figure and keep the point.

4. **§3.4 — ADR 0028's Jellyfin `TmdbUtils.FindBestMatch` claim.** Outside this brief's scope and not
   re-checked in this run, so it cannot be reported as confirmed here.
   *Settled by:* re-reading the current source at a pinned commit and recording the permalink and
   date — worth doing, since upstream may have fixed it.

### JUDGEMENT (2)

1. **§1.3 — "narrower than a blanket ban" is optimistic.** The verbatim clause is *"Use TMDB as an
   image hosting service for banner advertisements, graphics, etc."* The quote in ADR 0036 is exact,
   but CNCORE-8's body drops the tail and says only *"for banner advertisements"*. With
   *"graphics, etc."* the scope is open-ended, and a hotlinked poster is a graphic served by TMDB.
   The conclusion both ADRs reach — store the bytes, don't hotlink — is therefore **better** supported
   than they claim, not worse. Strike or soften the reassurance; keep the decision.

2. **§1.6 — "Make derivatives of the TMDB APIs or TMDB Content" is prohibited** in Paragraph 1.C and
   is quoted nowhere in the tickets or ADRs. Whether normalising TMDB responses into CMPP claims is a
   "derivative" is genuinely arguable. Fold it into the TMDB conversation CNCORE-8 already requires
   before the demo — one conversation, not two. Do not block on it.

### Does either ticket need editing before it is worked?

**CNCORE-8 — yes, three small edits, none of them a change of approach.**

1. Add TMDB's **Paragraph 1.C flat AI prohibition** alongside the Paragraph 2.A commercial example,
   and state plainly that a written agreement addresses the second and not the first. This is the one
   finding that changes what "settle two clauses with TMDB before the demo" means in practice — it is
   arguably three clauses, and one of them has no negotiated route.
2. Change the credential in the acceptance criterion from *"a user-supplied key"* to **"a
   user-supplied TMDB API Read Access Token, sent as an `Authorization: Bearer` header"**, and check
   ADR 0035 (`ship-no-api-keys`) for the same key-versus-token drift.
3. Quote the image-hosting clause **with its "graphics, etc." tail** so nobody reads
   "banner advertisements" as the whole scope.

Optional and worth considering: make *"asserts the same response shapes"* concrete by putting the
shapes in **one committed CMPP schema** validated against both providers via `test.for`. That turns
the criterion *"fails if either provider diverges"* from a promise about how assertions were written
into something mechanically true, and makes a third provider one table row. Also worth writing into
the ticket: **do not mock the providers** — MSW is the obvious instinct and it would destroy the one
property the test exists to prove.

**CNCORE-9 — no blocking edits. One question worth settling first.**

Nothing in CNCORE-9 was contradicted. Its design is well supported by what is current: running over
HTTP against the running app **avoids** the limitation Next.js documents for unit testing
(*"async Server Components are new to the React ecosystem ... we recommend using End-to-End Testing
over Unit Testing for async components"*), so the ticket's chosen seam is the one Next.js itself
points at.

The question to settle before implementation: **assert against the JSON read path rather than parsed
HTML?** CNCORE-9's invariant — one item, two placements, different positions — is a data claim, not a
rendering claim. JSON needs no parser, is immune to markup churn, and gives cleaner failure messages,
which the ticket explicitly wants (*"a failing test says which claim broke rather than which row"*).
If HTML is genuinely wanted, `fetch` + `cheerio` is the smallest maintained option and
`happy-dom` + `@testing-library/dom` the most legible. This changes the dependency list, so it is
cheaper to decide now than during implementation.

**Dependency between them worth flagging:** CNCORE-9 requires expected positions *"from two
independent external sources"*, one of which is TMDB. The TMDB half of that fixture is TMDB Content,
so it inherits Section 1's obligations — the six-month cache ceiling, and purge on termination — even
though it lives in a committed test fixture rather than the database. A committed fixture is a cache
that no read-time `max_cache_age` check will ever expire. That is worth a sentence in CNCORE-9, and it
is not currently in either ticket.

**Correction needed outside both tickets:** ADR 0028 §3.3, one word — *recall* → *precision*.
