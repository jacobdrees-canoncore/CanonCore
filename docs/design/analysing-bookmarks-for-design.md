# Analysing the X bookmarks for design inspiration

Research note, 29 September 2026. Question from Jacob: how best to analyse each of the 76 design
bookmarks (video, photos, every frame, and everything the post connects to, including the real
product) so the grill can ask, per bookmark, what he likes and where it applies in CanonCore.

Claims marked (measured) were measured on the XMCP archive at
`/Users/jacobrees/orca/projects/CanonCore/xmcp/xmcp.db` (opened read-only) and its `media/`
folder on this date. Everything else carries its source.

## What the archive already holds

**Scope.** 76 bookmarks from `digest.md`, plus 14 posts they quote (measured). 25 of the 76 are
tagged `tooling` or `other` in the digest and are likely skips (measured).

**Media.** 51 videos across 48 posts and 54 photos across 29 posts, 373 MB in all; 69 of the 76
bookmarks have media on themselves or their quoted post (measured). The 51 videos total 966
seconds: median 16.9 s, shortest 6.0 s, longest 43.3 s. 36 are 60 fps, 9 are 30 fps, 4 are 120
or 240 fps, and 2 are variable rate. That is 50,900 frames (measured).

**Video quality is already the best X offers.** For every one of the 51 videos, the file held is
the highest-bitrate MP4 variant X listed (measured, by matching each file's dimensions against the
largest `bit_rate` entry in the Media's `variants`). The data dictionary documents `variants` with
`bit_rate`, `content_type` and `url`, plus `duration_ms` and `preview_image_url`
([X data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary)). There is nothing
better to fetch.

**Alt text is empty.** No Media in scope carries alt text in either place X puts it (measured).
XMCP's own capture found the same across 506 Media (`docs/agents/x-api-findings.md`, section 7, in
the XMCP repo). The pictures have to be looked at.

**Audio.** 21 of the 51 videos have an audio track (measured). Claude cannot hear it, and no
speech-to-text tool is installed here (measured: no `whisper`). For a bookmark like Cuelume
(interaction sounds), the sound is the point and needs Jacob's ears.

**Link data is already unwound.** X gives `expanded_url` (its own t.co unwind) and `unwound_url`
(the final destination), with `title`, `description` and preview `images` on short posts
([data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary)); XMCP stores
`unwound_url` in preference, because 52 captured entities differed between the two
(`x-api-findings.md`, section 6). 12 posts are long-form `note_tweet` posts, whose links carry no
title (measured; section 4 of the same file). 3 bookmarks carry a `card_uri`, which the API names
but does not expand ([data dictionary](https://docs.x.com/x-api/fundamentals/data-dictionary)).

## Where the links go

**26 of 76 bookmarks link somewhere off X** (measured, own post or quoted post). The rest link
only to their own media or to other posts. Destinations by kind (measured):

- GitHub repos or profiles: 8 (macos-app-skills, books, complete-shelf, Clew, shadcn lint, ...)
- Live product or demo sites: 15 hosts (grainient.supply from two bookmarks, backgrounds.supply,
  interactionkit.org, reactbits.dev, obsidianui.dev, appthetics.com, b2tf.app, tripwire.sh
  dither-kit, cuelume-site.pages.dev, bencho.dev, dqnamo.com experiment, mengto.github.io
  complete-shelf, two vercel.app demos, untitled.stream)
- An Apple app: 1, Brink: Podcast Player, linked as a TestFlight beta (bookmark 1 and the post it
  quotes)
- Reading or reference: tbaggery, cbea.ms, press.stripe.com, trevornoah.com, reddit, linktr.ee,
  one X Article

**Other X posts.** 18 links point at other posts; 17 of them are already in the archive and 1
(`yahyavision/status/2046934883755307087`) is not (measured). 4 bookmarks show media that belongs
to someone else's post (a re-share); the media itself is held (measured).

**50 bookmarks have no off-X link, from 42 distinct authors; 38 of those are design-tagged**
(measured). For these the product, if there is one, is found from the author: bio, website field,
pinned post. Most are designers posting concepts, so often there is no product, only a portfolio.

## Following the product

**App Store apps resolve for free.** The iTunes Search and Lookup APIs
(`itunes.apple.com/search`, `/lookup`) need no key, take `term`, `entity=software`, `country` and
`id`, are limited to about 20 calls a minute, and return `screenshotUrls`, `ipadScreenshotUrls`,
`appletvScreenshotUrls`, `trackViewUrl` and `sellerUrl`
([Apple, Search API](https://performance-partners.apple.com/search-api)). Tried on bookmark 1: a
search for "brink podcast" in the GB store returns *Brink: Podcast Player*, seller URL
trybrink.app, 8 iPhone screenshots, no Apple TV ones (measured).

**TestFlight needs a device, not a browser.** A public link is opened in the TestFlight app on an
Apple device, and a build expires after 90 days
([Apple, TestFlight](https://developer.apple.com/testflight/),
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)).
Claude cannot install it; Jacob can, and a screen recording from his phone then goes through the
same video steps below.

**Websites screenshot and record for free.** Playwright takes full-page screenshots
(`fullPage: true`) and records video per browser context, written when the context closes
([screenshots](https://playwright.dev/docs/screenshots), [videos](https://playwright.dev/docs/videos)).
A site is where Claude sees the real thing best: real type, real colours, hover states, and the
CSS itself.

**Author profiles: browser free, API cheap.** A user read costs US$0.010 per resource under
pay-per-use ([X pricing](https://docs.x.com/x-api/getting-started/pricing)), and
`GET /2/users` takes up to 100 ids with `user.fields` including `url`, `description`, `entities`
and a `pinned_post_id` expansion ([users by ids](https://docs.x.com/x-api/users/get-users-by-ids)).
The 42 authors would cost US$0.42, all 65 authors in the 76 US$0.65. Reading the same profiles in
Jacob's logged-in browser costs nothing, but automating that is scraping, which X's terms ban
without written consent ([Yahoo/Engadget report of the 2023 terms change](https://finance.yahoo.com/news/x-updates-terms-ban-crawling-133548149.html);
the primary terms page returned HTTP 402 to a fetch and was not read). Recommendation: spend the
US$0.42 once, only after Jacob approves it, or open the handful that matter by hand during the
grill. The archive has `authors.username` only, no bio or URL (measured).

## Getting motion into stills

Claude reads images, not video, and a GIF is read as its first frame only
([Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). So every
video has to become pictures. The question is which pictures.

**Scene-change detection is the wrong tool for UI recordings.** FFmpeg's `select` exposes a
`scene` score from 0 to 1 and recommends a threshold of 0.3 to 0.5; its own example tiles scene
changes into a mosaic (`select='gt(scene\,0.4)',scale=160:120,tile`)
([FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect)). On these videos
it finds almost nothing: at 0.3, 44 of the 51 videos yield only their first frame, 92 frames in
all; even at 0.1, 33 videos yield two frames or fewer (measured). UI demos are continuous scrolls
and swipes with no cuts. `scdet` is the same detector with a percentage threshold, default 10
([FFmpeg, scdet](https://ffmpeg.org/ffmpeg-filters.html#scdet)).

**`mpdecimate` does not thin them either.** It drops frames whose 8x8 blocks barely differ from
the last (defaults `hi` 64*12, `lo` 64*5, `frac` 0.33)
([FFmpeg, mpdecimate](https://ffmpeg.org/ffmpeg-filters.html#mpdecimate)). At native rate it kept
36,684 of 50,900 frames; after sampling to 2 fps it kept 1,869 of about 1,930 (measured). There
is little stillness to remove. Keyframes are no better a proxy: 347 across all 51 videos, placed
by the encoder, not by the design (measured).

**What works: two views per video.**

1. *An overview sheet at a fixed rate.* `fps=2` then `tile=6x4`, one sheet per 12 seconds. All 51
   videos make about 100 sheets, and the 2 fps pass over all of them took 17 seconds (measured).
   `tile` takes `layout`, `padding`, `margin` and `color`
   ([FFmpeg, tile](https://ffmpeg.org/ffmpeg-filters.html#tile)). A test sheet of bookmark 1 showed
   the whole story at a glance: the card carousel, the per-cover background tint changing, the
   floating mini-player and tab bar (measured, viewed).
2. *A native-rate burst on each transition.* 0.5 s at the source rate, cropped to the device,
   `tile=10x3`. On bookmark 1 this showed what no sheet can: the page swipe runs from frame 8 to
   about frame 26 at 60 fps, so roughly 0.3 s, with a heavy directional motion blur mid-flight and
   no visible overshoot on settle (measured, viewed). Counting frames gives timing; the positions
   of an element across frames show the easing shape, roughly.

**Two practical limits.** This Homebrew FFmpeg 8.1.2 has no `drawtext` filter, so frame numbers
cannot be stamped onto tiles (measured); reading order (left to right, top to bottom) has to stand
in. And images are downscaled past a long edge of 2576 px (4784 visual tokens) on current models,
with a stricter 2000 px limit once a request holds more than 20 images
([Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). A full
6x4 sheet of phone frames is too small to read UI text; crop to the device and make a detail tile
when text matters. 29 of the archive's 60 photos exceed 2576 px on a side (measured) and are best
viewed cropped as well as whole.

## What Claude can and cannot judge

**Can judge from stills:** layout and grid, hierarchy, spacing rhythm, type choices and scale
(named families only when distinctive), colour palette and how it derives from artwork, component
anatomy, information density, light and dark treatment, glass and blur materials, how a screen
adapts across the frames of a flow.

**Can judge from sheets and bursts, approximately:** what moves and in what order, the duration of
a transition to within a frame or two, whether it overshoots, blur and parallax, which element
leads a shared-element transition.

**Cannot judge:** how it feels under the finger (drag resistance, velocity hand-off, haptics),
sound, true easing curves (a spring's parameters can be guessed, not measured), smoothness at
120 Hz, and anything off-screen in the recording. Also no named people: Claude does not identify
people in images ([Claude vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)).
For motion, the grill should show Jacob the clip itself and treat Claude's reading as a
description to confirm, not a verdict.

## How design libraries capture motion

Mobbin records screens with interesting motion as short videos rather than stills, and added video
to flows because transitions and micro-interactions cannot be shown by static screens
([Mobbin changelog](https://mobbin.com/changelog), as summarised by search; the page itself
returned HTTP 403 and was not read). Refero separates *styles* (colour, type, spacing, a
`DESIGN.md` of tokens), *screens* and *flows*
([Refero Styles](https://styles.refero.design/), [Refero MCP](https://refero.design/mcp), via
search summaries). The lesson for us: keep the clip as the record of motion, keep stills for the
static reading, and write down tokens (colours, sizes, durations) per bookmark rather than
adjectives. A Mobbin MCP server is configured here but exposes only its sign-in step until authenticated; it could look up the
real product's screens where Mobbin has them.

## Recommended pipeline

Per bookmark, in order; everything off X is free, and nothing calls the X API.

1. **Read the post.** Text, quoted post, author, link titles, from the archive.
2. **Photos.** View each whole; crop a detail tile if it is over 2576 px or text-dense.
3. **Videos.** Probe it; make the 2 fps overview sheets; view them; pick the transitions; make a
   burst per transition; view those.
4. **Links.** For each off-X destination: classify (product site, app, repo, reading). Screenshot
   sites at desktop and phone width, full page, and record a short scroll video for sites with
   motion. For a repo, read the README and screenshot any demo it links. For an app, run iTunes
   Lookup and pull the iPhone, iPad and Apple TV screenshots.
5. **No link.** Note the author's handle for the optional profile read (step above) and move on;
   do not guess a product.
6. **Write the card** (below) for the grill.

**Time and cost.** Extraction for all 51 videos is minutes of CPU (17 s for the overview pass,
measured). The real cost is viewing: about 100 overview sheets, perhaps 1 to 3 bursts per video,
54 photos, and screenshots for about 26 bookmarks. In money: US$0 without the profile read,
US$0.42 with it.

## Per-bookmark checklist

- [ ] Post text, quoted post and author read; digest tags checked
- [ ] Every photo viewed (whole, plus crop if over 2576 px or text-dense)
- [ ] Every video: overview sheet(s) at 2 fps viewed; bursts made for each transition
- [ ] Audio present? Flag for Jacob to listen
- [ ] Every off-X link opened, classified and captured (site screenshots, repo README, App Store
      screenshots)
- [ ] TestFlight or app-only? Flag for Jacob to install and screen-record
- [ ] No link? Author handle noted for the profile read
- [ ] Card written: what it shows; layout, motion, typography, colour, interaction and density
      notes with concrete values (hex, sizes, durations in frames); candidate CanonCore surface
      (web, iPhone, Mac, Apple TV; which screen); what Claude could not judge

## As a skill

A repeatable procedure an agent could follow. Not written as a skill yet.

**Inputs.** A post id (or "all" meaning `digest.md`), the archive root
`/Users/jacobrees/orca/projects/CanonCore/xmcp`, and an output root, proposed
`/Users/jacobrees/orca/projects/CanonCore/xmcp/analysis/<post_id>/`, outside the repo beside the
archive it derives from.

**Steps.**

1. *Gather* (script). Query the archive read-only for the post, its quoted post, author, links and
   media rows. Write `post.json`.
2. *Probe* (script). `ffprobe` each video for duration, rate, size and audio. Write `media.json`.
3. *Overview sheets* (script). Per video:
   `ffmpeg -i <video> -an -vf "fps=2,scale=480:-2,tile=6x4:padding=8:color=white" -fps_mode vfr sheets/<media_key>-%02d.jpg`.
4. *Photo details* (script). `sips -Z 2576` a copy of each oversize photo; keep the original.
5. *Look* (agent). View every sheet and photo. Note the transitions worth a closer look as
   timestamps.
6. *Bursts* (script, driven by the agent's timestamps).
   `ffmpeg -ss <t> -t 0.5 -i <video> -an -vf "crop=...,scale=240:-2,tile=10x3:padding=4:color=white" -frames:v 1 bursts/<media_key>-<t>.jpg`.
   The crop rectangle is the agent's call from the sheet.
7. *Links* (script to classify, agent to capture). Classify by host: x.com or twitter.com,
   github.com, apps.apple.com or testflight.apple.com, everything else a site. Sites: Playwright
   full-page screenshots at 1440 and 390 wide into `links/`. Apps: iTunes Search or Lookup, save
   the JSON and the screenshots. Repos: README text. TestFlight and audio: add to a
   `for-jacob.md` list rather than attempting them.
8. *Card* (agent). Write `card.md` from the checklist above, with values, not adjectives, and a
   "could not judge" line.
9. *Index* (script). Regenerate a one-line-per-bookmark index linking each card, for the grill.

**Script versus judgement.** Steps 1 to 4, 6's extraction, 7's classification and App Store
fetch, and 9 are deterministic and belong in one script. Choosing transitions and crops, deciding
what on a site is worth capturing, and every word of the card are agent judgement. Anything
touching the X API (the author profile read) stays out of the skill unless Jacob approves the
spend each time.
