# SwiftUI recreations: how hard, and which to do

> **Decided 30 Sep 2026** (`plan-2026-09-30.md`): [untitled]'s app is replicated in full; Brink
> and MD Vinyl each open with a recorded look, then Jacob picks a full replica or a study sketch.
> The recommendation below was the input to that decision. Later the same day all three apps were
> on the phone and an agent, not Jacob, makes the recordings (`driving-the-iphone.md`).

Research note, 30 Sep 2026. Question from Jacob: how easy is it really to recreate three
closed-source iPhone apps as SwiftUI replicas of their key screens (Brink: Podcast Player, MD
Vinyl and [untitled]), and which should stay as inspiration instead. The bookmark decisions put
all three in Recreate (`x-bookmarks.md`, bookmarks 15, 70 and 80). A replica exists to study a
design closely so CanonCore can adapt its patterns later; it is never CanonCore itself.

"(measured)" means read on this date from the named source. Everything else carries a link to its
owner, or is listed under "Claims not sourced" at the end.

## The short answer

**Most of what makes these apps look hard is now built into SwiftUI.** The floating glass tab bar,
the mini-player above it, glass buttons, paged carousels, scroll-driven effects, zoom transitions
and ordered tooltips all have system APIs (next section). Three things remain custom: a live
directional motion blur (a Metal shader), colour taken from artwork (Core Image, a few lines), and
anything drawn to look physical (records, turntables, waveforms), which has to be drawn from
scratch because the originals' assets cannot be copied.

**The real cost is the inputs, not the code.** An iOS app has no DOM. Nothing can read a
shipped app's view tree, fonts, colours or spring values; they come from recordings measured
frame by frame, and from the few stills the App Store serves. Every one of those stills is a
marketing composite, not a screen.

**Recommendation:** replicate [untitled]'s key screens; do study sketches of Brink's Home and of
MD Vinyl's tour and record; build nothing else of either. The table at the end gives the reasons.

## What the inputs really are

**App Store screenshots are full resolution, but framed.** The saved copies in
`xmcp/analysis/*/links/appstore-<id>/` are 221 to 392 px wide thumbnails (iPhone). The image server
returns the originals when the size token in the URL is raised (measured: Brink 1284 x 2778, MD
Vinyl 1290 x 2796, [untitled] 1242 x 2208). All eight of Brink's and all eight of [untitled]'s are
phones inside captioned marketing frames; five of MD Vinyl's ten are full-bleed (three app
screens and two Home Screens showing its widgets), the other five are collages (measured, viewed).
[untitled] uploads only the 5.5-inch size (1242 x 2208), so its stills are small and letterboxed;
their age is not known. Screenshots are layout references, not
pixel references. The iTunes Lookup API that lists them is documented at
[Apple, Search API](https://performance-partners.apple.com/search-api).

**Screen recordings are the primary source.** Control Center records the screen to Photos, and
"Some apps might not allow you to record audio or video"
([Apple Support 102653](https://support.apple.com/en-us/102653)). A recording goes through the
bookmark skill's two views: a 2 fps overview sheet, then a native-rate burst on each transition,
which gives durations to a frame and shows overshoot, blur and ordering, but not true easing
curves or how a gesture feels (`analysing-bookmarks-for-design.md`, "What works: two views per
video" and "Cannot judge"). The Brink bookmark videos are 60 fps and MD Vinyl's is 59.99 fps
(measured, `media.json`). Only Jacob's iPhone can make these recordings.

**The bookmark videos are short.** Brink: 11.3 s and 6.7 s; MD Vinyl: 8.3 s, starting mid-tour;
[untitled]: four stills, no video (measured, `media.json` and the cards). They cover one
interaction each, which is why they suit a study sketch better than a full replica.

**Mobbin holds shipped screens and flows.** It is "a searchable library of real mobile apps" with
screens, "End-to-end flows such as onboarding" and UI patterns, from "real shipped products"
([Mobbin](https://mobbin.com/)). Brink's maker links his Mobbin page from his portfolio (measured,
the `gowthamoleti.com` bundle links `mobbin.com/screens/9fcbb76c-...`), and the MD Vinyl bookmark
was posted by @mobbin itself. The Mobbin MCP server configured here needs Jacob's sign-in before it
returns anything (`analysing-bookmarks-for-design.md`).

**This Mac can build and preview the replicas.** Xcode 27.0 (27A266a) with iOS 27.0 and tvOS 27.0
simulator runtimes is installed (measured, `xcodebuild -version`, `xcrun simctl list runtimes`).
iOS 27 is the current release: the SwiftUI changelog has June and September 2026 sections, and
Brink's current release notes read "Built for iOS 27" (measured,
[SwiftUI updates](https://developer.apple.com/documentation/updates/swiftui), iTunes Lookup).
Every API below is available from iOS 26 or earlier unless marked.

## What cannot be recovered

**No view tree.** Xcode's debugger, and with it the view debugger, attaches only where the
`get-task-allow` entitlement allows: "The boolean value of get-task-allow determines whether
Xcode's debugger can attach to the app"
([TN2415](https://developer.apple.com/library/archive/technotes/tn2415/_index.html)). Xcode adds
it to development builds; an App Store or TestFlight build of someone else's app is not one.

**Accessibility Inspector reads less than it seems.** It lists "connected devices and apps you can
inspect"; for iOS you "select the name of the device on which the app is running, then pick the
app from the processes menu", and it shows an element's accessibility properties, actions and its
path in the hierarchy
([Apple, Inspecting the accessibility of the screens in your app](https://developer.apple.com/documentation/accessibility/inspecting-the-accessibility-of-screens)).
Apple frames it around your own app; whether a third-party App Store app appears in that menu is
not documented and was not tested. `driving-the-iphone.md` later gets the accessibility tree of
any installed app through WebDriverAgent (`mobile: source`), so Inspector is not needed for it. At best it yields labels
and structure, never colours, fonts, radii or motion.

**No binary work.** The standard App Store licence forbids to "copy ..., reverse-engineer,
disassemble, attempt to derive the source code of, modify, or create derivative works of the
Licensed Application", except where that restriction "is prohibited by applicable law"
([Apple, Licensed Application EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/)).
Brink's App Store description names this licence as its terms (measured). MD Vinyl's App Store
page offers no custom licence (measured), and Apple's page says the Standard EULA applies unless a
custom one is provided, so the same terms govern it. Extracting either app's image assets or fonts
from the app bundle is on the wrong side of that line.

## What the law allows

**Studying a running app is protected in the UK.** "It is not an infringement of copyright for a
lawful user of a copy of a computer program to observe, study or test the functioning of the
program in order to determine the ideas and principles which underlie any element of the program"
while running it, and a contract term that forbids this is void
([CDPA 1988 s.50BA](https://www.legislation.gov.uk/ukpga/1988/48/section/50BA),
[s.296A](https://www.legislation.gov.uk/ukpga/1988/48/section/296A)). Installing the free App Store
builds and using them to study their behaviour is that act. Keeping a recording is not what
s.50BA addresses; the nearer basis is fair dealing for private study
([s.29(1C)](https://www.legislation.gov.uk/ukpga/1988/48/section/29)).

**Layout is not protected; the artwork is.** The US Copyright Office "will not accept a claim to
copyright in 'format' or 'layout'", and copyright excludes "any idea, procedure, process, system,
method of operation" ([Circular 33](https://www.copyright.gov/circs/circ33.pdf), revised 03/2021).
So a replica may reproduce structure, spacing, timing and behaviour, but draws its own records,
turntable, icons and illustrations, uses its own sample artwork, and uses SF Pro or a licensed face
rather than the app's fonts. The UK's own position on screen designs was not read at source (see
the last section), so the rule here is the stricter one: nothing drawn by them goes in.

**App Review never sees a replica.** Guideline 4.1 forbids to "copy the latest popular app ... or
make some minor changes to another app's name or UI and pass it off as your own"
([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). It binds
submissions. The replicas stay private: each is its own repository under `~/canoncore/` with a private backup
in the `jacobdrees-canoncore` organisation (ADR 0022), like `~/canoncore/untitled-replica`, and is never
submitted, published or shown as anyone's product.

**TestFlight is confidential.** A tester agrees that anything in a beta "that is not already
publicly available shall be considered confidential unless the Application Provider explicitly
authorises public disclosure", and may not "make any copy of or otherwise reproduce any Beta App"
([TestFlight Terms, UK](https://www.apple.com/legal/internet-services/itunes/testflight/gb/terms.html)).
Brink's TestFlight and App Store builds are both 1.2.40 (TestFlight per `for-jacob.md`, 27 Sep;
App Store per iTunes Lookup: release 29 Sep 2026). So record the App Store build; the TestFlight adds nothing until it runs
ahead, and then only with Gowtham Oleti's say-so.

**[untitled] has a written prohibition and a verbal permission.** Its terms forbid to "make
derivative works of, ... reverse engineer any part of the Service", and Jacob reports the owner's
permission as verbal (`~/canoncore/untitled-replica/docs/untitled-stream-capture.md`, lines
129 to 141). That note is about the website; whether the permission covers the iOS app is not
recorded.

## What each hard element takes in SwiftUI

Availability is read from each symbol's page on developer.apple.com (measured).

| Element | Built in? | What to use |
| --- | --- | --- |
| Liquid Glass tab bar | Yes | A plain `TabView` on iOS 26: "the tab bar on iPhone floats above the content, and can be configured to minimize on scroll" with `tabBarMinimizeBehavior(_:)` ([WWDC25, Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/)). `Tab` role `.prominent` gives one tab prominent visual treatment, iOS 27 only ([TabRole.prominent](https://developer.apple.com/documentation/swiftui/tabrole/prominent)). |
| Floating mini-player | Yes, iOS and iPadOS only | `tabViewBottomAccessory(content:)`, iOS 26 and iPadOS 26, not macOS or tvOS ([docs](https://developer.apple.com/documentation/swiftui/view/tabviewbottomaccessory(content:))); "like this playback view in Music" (WWDC25 323). |
| Custom glass shapes | Yes | `glassEffect(_:in:)`, `GlassEffectContainer`, `glassEffectID(_:in:)`, `.buttonStyle(.glass)`, all iOS 26, and every platform but visionOS ([glassEffect](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))). A container lets elements "share their sampling region" (WWDC25 323). |
| Paged carousel with peeking cards | Yes | `scrollTargetBehavior(.viewAligned)` with `scrollTargetLayout()`, `containerRelativeFrame` and `contentMargins`, all iOS 17 ([ViewAlignedScrollTargetBehavior](https://developer.apple.com/documentation/swiftui/viewalignedscrolltargetbehavior)). |
| Motion blur while paging | No | Built-in `blur(radius:)` is "a Gaussian blur", not directional ([docs](https://developer.apple.com/documentation/swiftui/view/blur(radius:opaque:))). `CIMotionBlur` works on images, not live views ([Core Image Filter Reference](https://developer.apple.com/library/archive/documentation/GraphicsImaging/Reference/CoreImageFilterReference/)). A live one is a Metal function applied with `layerEffect(_:maxSampleOffset:isEnabled:)`, iOS 17 ([docs](https://developer.apple.com/documentation/swiftui/view/layereffect(_:maxsampleoffset:isenabled:))), strength driven by `scrollTransition` phase (iOS 17) or `onScrollGeometryChange` (iOS 18). |
| Cover-tinted background | Partly | No SwiftUI colour-extraction API was found. `CIAreaAverage` "Returns a single-pixel image that contains the average color" (Filter Reference); `CIKMeans` "Create[s] a palette of the most common colors found in the image" (`CIFilter.localizedDescription(forFilterName:)`, measured; its [doc page](https://developer.apple.com/documentation/coreimage/cikmeans) has no description). The gradient behind is a `LinearGradient` or `MeshGradient` (iOS 18). `backgroundExtensionEffect()` (iOS 26) mirrors and blurs artwork under the safe area. |
| Zoom and matched transitions | Yes | `navigationTransition(.zoom(sourceID:in:))` with `matchedTransitionSource(id:in:)`, iOS 18, not macOS ([zoom](https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:))); "continuously interactive" ([WWDC24, Enhance your UI animations and transitions](https://developer.apple.com/videos/play/wwdc2024/10145/)). `matchedGeometryEffect` since iOS 14. |
| Scroll-driven effects | Yes | `scrollTransition` and `visualEffect` (iOS 17), "great for use in scrollviews" ([WWDC24, Create custom visual effects with SwiftUI](https://developer.apple.com/videos/play/wwdc2024/10151/)); `onScrollGeometryChange` and `scrollPosition` (iOS 18); `scrollEdgeEffectStyle` (iOS 26). |
| Tooltips and tours | Yes | TipKit `Tip` and `popoverTip` (iOS 17), `TipGroup` (iOS 18) presents tips "one at a time, either in a specific order or using the first tip eligible" ([WWDC24, Customize feature discovery with TipKit](https://developer.apple.com/videos/play/wwdc2024/10070/)); `TipViewStyle` (iOS 17) restyles them ([docs](https://developer.apple.com/documentation/tipkit/tipviewstyle)). |
| Waveform scrubber | No | Draw it: `Canvas` (iOS 15) or Swift Charts (iOS 16) over samples read with AVFoundation, a `DragGesture` for the playhead. |
| Speed and pitch controls | Mostly | `AVAudioUnitTimePitch` changes "playback rate and pitch shifting independently" ([docs](https://developer.apple.com/documentation/avfaudio/avaudiounittimepitch)); `Slider` shows tick marks when given a `step` since June 2025 ([SwiftUI updates](https://developer.apple.com/documentation/updates/swiftui)). |
| Spinning record, tonearm, record stack | Primitives only | `rotationEffect` with `TimelineView` (iOS 15), `AngularGradient` for the groove sheen ("also known as a conic gradient", [docs](https://developer.apple.com/documentation/swiftui/angulargradient)), `rotation3DEffect` for the stack, `sensoryFeedback` (iOS 17) for the needle drop. The look is all drawing. |

## The three apps

**Brink (bookmark 15).** Minimum iOS 26.0, "a clean, fluid Liquid Glass interface" (iTunes
Lookup, measured). Its chrome looks like the system's, so the tab bar and mini-player are close to free.
What it teaches is the Home row: one card per page with neighbours peeking, a directional blur
across the middle 8 to 10 frames of a roughly 15-frame swipe, and a cover tint that crossfades a
few frames after the card lands (the card's measurements). The screenshots add a podcast page
that "adapts to individual podcast", a chapters sheet, a transcript player, a weekly summary,
a world map and smart playlists (measured, viewed). The map, the AI summaries and the transcripts
are features, not patterns CanonCore lacks a model for.

**MD Vinyl (bookmark 80).** Minimum iOS 16.4, released 2022, 2,652 ratings (iTunes Lookup,
measured). Everything memorable is drawn: the tilted record-stack library, the turntable with a
tonearm, coloured and splattered vinyl, widgets. None of that artwork may be copied, so a faithful
replica means drawing a turntable and records well, which is illustration work, not layout. The
bookmark itself is the three-step tour over the tab bar, a 200 ms crossfade in place with the tail
sliding to the next tab (the card). The tour is expected to run on first launch (`for-jacob.md`, unverified). The
real app plays through Spotify or Apple Music, which a replica would stub with local files.

**[untitled] (bookmark 70).** Minimum iOS 17.6 (measured). Its screens are the ones closest to
CanonCore's: a library grid of artwork with a play chip, a project page (an album page by another
name) with a disc peeking behind the artwork, a floating now-playing capsule with a mini waveform,
a player with a waveform scrubber and loop region, speed and pitch sliders with ticks, a stems
mixer, a recorder and the share sheet (the card; screenshots, measured, viewed). All are standard
SwiftUI plus one custom waveform. The web replica has already measured its palette and type
(#191919, #252525, the single accent #FDE14F: the card), so the iOS replica starts with tokens in
hand and shows how one product adapts across web and iPhone. Its App Store stills are small and
letterboxed (see above) and the app needs an account, so recordings are essential.

## How established teams do this

**They study rather than clone.** Mobbin, Refero and similar libraries keep screens, flows and
recorded clips of shipped products (above, and `analysing-bookmarks-for-design.md`, "How design
libraries capture motion"). Rauno Freiberg's "Invisible details of interaction design" describes
the other half: "maniacally replaying hundreds of slow motion screen recordings", then building
the interaction to feel it: "After building a few touch interactions myself using SwiftUI, I
realised that might not always be the case"
([rauno.me](https://rauno.me/craft/interaction-design)). That is a study sketch: one interaction,
rebuilt until it matches the recording.

**Breakdowns exist for two of the three.** Social Growth Engineers' App Breakdown #29 covers MD
Vinyl's skeuomorphism ("Placing the stylus on the vinyl to play music feels genuinely delightful",
2 Feb 2026,
[SGE](https://www.socialgrowthengineers.com/md-vinyl-a-lesson-in-skeuomorphism-and-intentional-design-app-breakdown-29)),
and #31 is a video on [untitled]'s "Polished Use of Colour and Exceptional Transitions"
([YouTube](https://www.youtube.com/watch?v=kfNeLGg17jE), not watched). A Pratt IxD critique reads
[untitled]'s project screen, player and sharing (Nikhil Shetty, 11 Sep 2024,
[IXD@Pratt](https://ixd.prattsi.org/2024/09/design-critique-untitled-ios-app/)). None is a rebuild.

## What the makers publish

**Brink: nothing reusable.** Gowtham Oleti has 72 public GitHub repositories; the only
podcast-related one is a fork of AntennaPod (Android, GPL-3.0), and none is Brink (measured,
GitHub API). His portfolio has a Brink landing page and privacy page, but its one case study is
District by Zomato; it links a 9to5Mac spotlight (20 Jun 2026) and Mobbin (measured, the site's
JavaScript bundle). trybrink.app has no design writing or source
([trybrink.app](https://trybrink.app/)).

**MD Vinyl: nothing.** md.studio redirects to the App Store developer page, which lists 13 MD
Studio apps (measured, `curl -I` and iTunes Lookup). The 2022 Apple Design Award finalist was MD
Clock by Hangzhou Midi Technology, not MD Vinyl (measured,
[ADA 2022](https://developer.apple.com/design/awards/2022/)). No maker repository was found.

**[untitled]: nothing public.** A GitHub organisation `sintitulo` exists (created 17 Jan 2026, 0
public repositories; that it is the company's is unverified). Everything else on GitHub is
third-party tooling around untitled.stream: downloaders, an API wrapper, x2player "based off
untitled.stream's ui" (measured, GitHub search).

**Third-party clones are study only.** unidad11/unicast is a SwiftUI podcast app "inspirada en
Overcast con vista por tarjetas y estética Brink"; benedictisais/jb-vinyl calls itself an "md vinyl
clone for ios 9". Neither has a licence (measured), and a clone of someone else's design is no
better a source than the app.

## Effort

The one calibration point: the web replica had 1 of 50 screens built in its first day, with capture
tooling included (`what-to-do-next.md`, "Risks"). Matching by eye against recordings is slower per
screen than matching against a DOM, so the figures below are the author's estimates in agent
sessions (one implementer run), not measurements.

**Brink.** Faithful key screens (Home, podcast page, player with chapters sheet, playlists): 6 to
10 sessions. Study sketch of Home (paged carousel, directional blur shader, cover tint, system tab
bar and bottom-accessory mini-player, zoom into an episode): 1 to 2 sessions.

**MD Vinyl.** Faithful key screens (record-stack library, turntable player, tour, share card): 8
to 12 sessions, plus drawing records and a turntable. Study sketch of the tour, built once with
TipKit (`TipGroup` ordered, a custom `TipViewStyle`) and once as a plain overlay to see which
matches, then the spinning record with a draggable tonearm: 2 to 3 sessions.

**[untitled].** Faithful key screens (library grid, project page, player with waveform and loop,
edit with speed, pitch and stems, mini-player): 5 to 8 sessions, since the tokens exist.

**What an agent can do alone:** fetch the full-size screenshots, build layouts in Xcode previews
on the installed iOS 27 simulator, write the blur shader and colour extraction, and time its own
build against the bookmark bursts. **What needs Jacob:** approving WebDriverAgent on the phone
once, keeping it unlocked and on charge for sessions (`driving-the-iphone.md`), signing in to
Mobbin, confirming that [untitled]'s permission covers the app, and judging feel under the finger,
which no recording shows.

## Recommendation

| App | Recommendation | What it rests on |
| --- | --- | --- |
| [untitled] | **Replicate key screens**: library grid, project page, player with waveform and loop, speed and pitch edit, mini-player | Closest to CanonCore's own screens (library, album-like page, player); pairs with the web replica and reuses its tokens; nearly all standard SwiftUI; the owner's permission is reported. Needs recordings, since the stills are marketing frames, and Jacob's check that the permission covers the app. |
| Brink | **Study sketch** of Home: the paged cover-tinted carousel with directional motion blur, the bottom-accessory mini-player, and the zoom into an episode; optionally the podcast page's per-show theme | The chrome appears to be Apple's own Liquid Glass, so copying it teaches nothing beyond the WWDC25 session; the novel parts are one row and one tint. The rest is AI and map features. Use the App Store build, not TestFlight (confidentiality). |
| MD Vinyl | **Study sketch** of two interactions: the three-step tab-bar tour, and the spinning record with its tonearm | Everything else is drawn artwork that may not be copied, so a faithful replica is an illustration job; the tour tests whether TipKit fits CanonCore's first run, and the record serves the physical-media theme. Needs a fresh install recorded by Jacob. |

## Claims not sourced

- That App Store and TestFlight builds lack `get-task-allow`: TN2415 says what the entitlement
  does and shows it in a development build, but does not state that distribution builds omit it.
- Whether Accessibility Inspector lists third-party App Store apps on a device: not documented,
  not tested (WebDriverAgent covers the need, `driving-the-iphone.md`).
- The UK position on copyright in screen designs (the CJEU's BSA judgment, C-393/09): neither
  EUR-Lex nor InfoCuria returned the text, so it is not relied on.
- The frame rate of an iPhone screen recording: not found in Apple's support page; measure it
  with `ffprobe` on the agent's first `devicectl` recording (`plan-2026-09-30.md`, Driving the
  iPhone).
- That Mobbin holds MD Vinyl's and [untitled]'s flows: inferred from @mobbin posting the MD Vinyl
  tour; unverified until Jacob signs in. Brink's Mobbin page is linked by its maker.
- That MD Vinyl's tour runs on first launch: `for-jacob.md` says so, but that is the analysing
  agent's inference; no MD Vinyl source was read.
- The effort figures are estimates, as the Effort section says.
- The SGE video on [untitled] was not watched; only its title is cited.
