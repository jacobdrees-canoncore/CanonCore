# Apple sample code: what a media app can start from

Research note, 30 Sep 2026. Question from Jacob: before the full tvOS recreation, list every
Apple sample project a media app like CanonCore can legitimately copy from (tvOS first, then iOS,
macOS and multiplatform), pick the best base for the recreation, and check the licence and that
the samples build here. A recreation is a design reference, never CanonCore itself.

> **Revised 3 Oct 2026.** The tvOS recreation (CC-34) was dropped: the tvOS 27 simulator has no TV
> app (measured 3 Oct 2026), so it would have needed device recordings. These samples now feed the
> Apple prototype (CC-39) directly: TVCatalog, Destination Video, Focus Cookbook and the full-screen
> layout sample. The Top Shelf sample stays in project 10, as sorted below. Where this note planned
> for the recreation, it now reads for the Apple prototype's Apple TV screens.

"(measured, 30 Sep 2026)" means read or run on this Mac on this date. Page facts come from each
sample's JSON at `developer.apple.com/tutorials/data/documentation/<path>.json` and dates from the
download's `Last-Modified` header. Everything else is linked, or listed under "Claims not sourced".

## The short answer

**Apple publishes 49 samples that run on tvOS, but only two are SwiftUI media apps.** The Sample
Code Library lists 652 samples; 49 name tvOS as a platform, and most are Metal, TVML or single
features (measured, 30 Sep 2026, every page's `metadata.platforms`). The two are
[Creating a tvOS media catalog app in SwiftUI](https://developer.apple.com/documentation/swiftui/creating-a-tvos-media-catalog-app-in-swiftui)
("TVCatalog") and [Destination Video](https://developer.apple.com/documentation/visionos/destination-video).

**Both build and run on the tvOS 27 simulator with no changes.** The screenshots are described
below (measured, 30 Sep 2026).

**They cover different things, and the Apple prototype's Apple TV screens need both.** TVCatalog is a component
catalogue of the TV app's lockups, shelves, fold and product page, with buttons that do nothing.
Destination Video is a working app: a sidebar with folder sections, SwiftData, detail pages and
`AVPlayerViewController` with an Up Next tab. Neither is a copy of Apple's TV app.

**The licences allow it, but two different licences are in use.** Most samples ship the MIT
(Expat) text, which ADR 0019 already accepts. Destination Video, Landmarks, Wishlist and the 2026
SharePlay gallery ship Apple's older sample licence (SPDX `AML`). Fedora calls that one "free and GPL compatible",
but the FSF does not list it. Apple's videos and artwork in the samples are a separate question
(see Licence).

**Recommendation:** build the Apple prototype's Apple TV screens (CC-39) on TVCatalog as the
component base and Destination Video as the app skeleton. (Amended 3 Oct 2026: the 30 Sep
recommendation was to recreate Apple's TV app from them and match it against recordings of the real
TV app on tvOS 27; that recreation, CC-34, was dropped.) Infuse and Plex are not studied: the Owner decided on 30 Sep 2026, after the verification, that the TV app alone is the reference (`plan-2026-09-30.md`). Reasons for the rest are in the last section.

## The tvOS samples

All 49 were checked. The table leaves out 19 Metal samples, the six TVML, TVMLJS and TVMLKit samples and the
generic ones (game controllers, StoreKit, SwiftData basics, peer-to-peer, Background Assets,
RealityKit, the UIKit navigation bar). "Updated" is the zip's `Last-Modified` (measured,
30 Sep 2026). Unless noted, each is licensed MIT.

| Sample | Platforms (minimum) | Updated | What CanonCore takes |
| --- | --- | --- | --- |
| [Creating a tvOS media catalog app in SwiftUI](https://developer.apple.com/documentation/swiftui/creating-a-tvos-media-catalog-app-in-swiftui) | tvOS 18 | 10 Jun 2024 | Lockups, shelves, hero fold, product page, search, sidebar. **The component base** (next section). |
| [Destination Video](https://developer.apple.com/documentation/visionos/destination-video) | iOS 18, iPadOS 18, macOS 15, tvOS 18, visionOS 2 | 16 Feb 2026 | One SwiftUI target for every platform CanonCore ships. `sidebarAdaptable` with `TabSection` "Collections", SwiftData models, `AVPlayerViewController` with an Up Next tab, zoom transitions (iOS only). Licence: AML. **The app skeleton.** |
| [Enhancing your app's content with tab navigation](https://developer.apple.com/documentation/swiftui/enhancing-your-app-content-with-tab-navigation) | same as above | 16 Feb 2026 | A second sample page for Destination Video; it downloads the same `DestinationVideo.zip` (measured). |
| [Creating immersive experiences using a full-screen layout](https://developer.apple.com/documentation/tvuikit/creating-immersive-experiences-using-a-full-screen-layout) | tvOS 13 | 23 Feb 2024 | `TVCollectionViewFullScreenLayout` for full-bleed paging (UIKit, 133 MB). The pattern behind a full-screen hero carousel. |
| [Building a Full Screen Top Shelf Extension](https://developer.apple.com/documentation/tvservices/building-a-full-screen-top-shelf-extension) | tvOS 13 | 16 Feb 2024 | A full-screen Top Shelf carousel (the sample fills it with featured movies), the pattern to carry Continue Watching or new items. |
| [Mapping Apple TV users to app profiles](https://developer.apple.com/documentation/tvservices/mapping-apple-tv-users-to-app-profiles) | tvOS 15 | 16 Feb 2024 | Maps each Apple TV user to a CanonCore profile ([WWDC22 110384](https://developer.apple.com/videos/play/wwdc2022/110384/)). |
| [Supporting Multiple Users in Your tvOS App](https://developer.apple.com/documentation/tvservices/supporting-multiple-users-in-your-tvos-app) | tvOS 14 | 16 Feb 2024 | The older per-user data pattern. |
| [Simplifying User Authentication in a tvOS App](https://developer.apple.com/documentation/authenticationservices/simplifying-user-authentication-in-a-tvos-app) | tvOS 15 | 19 Jun 2024 | Signing in without typing on the remote. |
| [Supporting remote interactions in tvOS](https://developer.apple.com/documentation/avfoundation/supporting-remote-interactions-in-tvos) | tvOS 16 | 21 Nov 2024 | Remote commands and events in each playback situation. |
| [Working with overlays and parental controls in tvOS](https://developer.apple.com/documentation/avkit/working-with-overlays-and-parental-controls-in-tvos) | tvOS 13 | 26 Apr 2024 | Player overlays, parental controls and channel flipping on `AVPlayerViewController`. |
| [Adopting Picture in Picture playback in tvOS](https://developer.apple.com/documentation/avkit/adopting-picture-in-picture-playback-in-tvos) | iOS 14, tvOS 14 | 26 Apr 2024 | PiP on tvOS. |
| [Creating a seamless multiview playback experience](https://developer.apple.com/documentation/avfoundation/creating-a-seamless-multiview-playback-experience) | iOS 26, tvOS 26 | 20 Oct 2025 | Several synchronised players plus AVRouting ([WWDC25 302](https://developer.apple.com/videos/play/wwdc2025/302/)). |
| [Supporting Continuity Camera in your tvOS app](https://developer.apple.com/documentation/avkit/supporting-continuity-camera-in-your-tvos-app) | tvOS 17 | 26 Apr 2024 | Not needed for a media library; listed because it was asked about. |
| [Becoming a now playable app](https://developer.apple.com/documentation/mediaplayer/becoming-a-now-playable-app) | iOS 12.2, macOS 10.14, tvOS 12.2 | 24 Dec 2024 | Now Playing info and remote command centre on every platform. |
| [Browsing and Modifying Photo Albums](https://developer.apple.com/documentation/photokit/browsing-and-modifying-photo-albums) | iOS 11, tvOS 13.2 | not fetched | A UIKit album grid. Minor. |

**Samples that do not exist.** These pages return 404 (measured, 30 Sep 2026):
`swiftui/enhancing-your-app-with-fluid-transitions`, `swiftui/building-a-great-video-playback-experience`,
`avkit/creating-a-custom-playback-ui` and `tvservices/building-a-top-shelf-extension`. In the
Sample Code Library, the only Top Shelf sample is the full-screen one.
[Customizing the tvOS playback experience](https://developer.apple.com/documentation/avkit/customizing-the-tvos-playback-experience)
is an article and has no download.

## iOS, macOS and multiplatform samples worth copying from

| Sample | Platforms (minimum) | Updated | What CanonCore takes |
| --- | --- | --- | --- |
| [Landmarks: Building an app with Liquid Glass](https://developer.apple.com/documentation/swiftui/landmarks-building-an-app-with-liquid-glass) | iOS 26, macOS 26 | 22 Jun 2026 | `glassEffect`, `GlassEffectContainer`, `glassEffectID`, `backgroundExtensionEffect()`, and scrolling under a sidebar. Four more Landmarks pages share this zip. The frosted-glass half of the folder. Licence: AML (measured). |
| [Wishlist: Planning travel in a SwiftUI app](https://developer.apple.com/documentation/swiftui/wishlist-planning-travel-in-a-swiftui-app) | iOS 27 | 8 Jun 2026 | "organizes trips into collections", with `navigationTransition(.zoom)` and `matchedTransitionSource`. The nearest Apple sample to a folder that opens into a gallery. Licence: AML (measured). |
| [Creating visual effects with SwiftUI](https://developer.apple.com/documentation/swiftui/creating-visual-effects-with-swiftui) | iOS 18 | 12 Jun 2024 | Scroll effects, custom transitions, shaders ([WWDC24 10151](https://developer.apple.com/videos/play/wwdc2024/10151/)). |
| [Composing advanced graphics effects with SwiftUI](https://developer.apple.com/documentation/swiftui/composing-advanced-graphics-effects-with-swiftui) | iOS 26, macOS 26, visionOS 26 | 20 Jul 2026 | WWDC26 session 322's layered effects. |
| [Controlling the timing and movements of your animations](https://developer.apple.com/documentation/swiftui/controlling-the-timing-and-movements-of-your-animations) | iOS 17, macOS 14 | 25 Jul 2023 | Phase and keyframe animators, for spring timing. |
| [Making a card game with drag, drop, and reordering in SwiftUI](https://developer.apple.com/documentation/swiftui/making-a-card-game-with-drag-drop-and-reordering-in-swiftui) | macOS 27 | 10 Jun 2026 | WWDC26 session 271's reordering modifiers, for curation by drag on the Mac. |
| [Adopting drag and drop using SwiftUI](https://developer.apple.com/documentation/swiftui/adopting-drag-and-drop-using-swiftui) | iOS 18, macOS 15, visionOS 2 | 29 Oct 2024 | Drag between collections. |
| [Creating custom container views](https://developer.apple.com/documentation/swiftui/creating-custom-container-views) | iOS 18 | 25 Oct 2024 | Subview access for a custom folder or stack container ([WWDC24 10146](https://developer.apple.com/videos/play/wwdc2024/10146/)). |
| [Focus Cookbook](https://developer.apple.com/documentation/swiftui/focus-cookbook-sample) | iOS 17, macOS 14 (no tvOS) | 14 Jun 2023 | `FocusState`, `defaultFocus`, `focusable(interactions:)`, `onMoveCommand`, `onKeyPress` (measured grep). The focus APIs neither tvOS sample uses. |
| [Food Truck](https://developer.apple.com/documentation/swiftui/food-truck-building-a-swiftui-multiplatform-app) | iOS 16.4, macOS 13.3 | 7 Oct 2025 | One target for Mac, iPad and iPhone. |
| [Backyard Birds](https://developer.apple.com/documentation/swiftui/backyard-birds-sample) | iOS 17.2, macOS 14.2, watchOS 10.2 | 8 Dec 2023 | SwiftData plus widgets. |
| [Bringing robust navigation structure to your SwiftUI app](https://developer.apple.com/documentation/swiftui/bringing-robust-navigation-structure-to-your-swiftui-app) | iOS 18, macOS 15 | 17 Sep 2024 | `NavigationStack` and split-view paths, with restoration. |
| [Building a great Mac app with SwiftUI](https://developer.apple.com/documentation/swiftui/building-a-great-mac-app-with-swiftui) | macOS 12 | 7 Oct 2025 | Sidebar, tables and toolbars on the Mac. |
| [Playing video content in a standard user interface](https://developer.apple.com/documentation/avkit/playing-video-content-in-a-standard-user-interface) | iOS 13 | 26 Apr 2024 | Full-screen, inline and PiP playback (UIKit). Its licence adds that the WWDC videos it links "are Copyright Apple Inc. All rights reserved". |
| [Supporting coordinated media playback](https://developer.apple.com/documentation/avfoundation/supporting-coordinated-media-playback) | iOS 15 | 21 Nov 2024 | SharePlay watch-together with `AVPlaybackCoordinator`. |
| [Creating a collaborative photo gallery with SharePlay](https://developer.apple.com/documentation/groupactivities/creating-a-collaborative-photo-gallery-with-shareplay) | iOS 26, macOS 26, visionOS 26 | 16 Feb 2026 | Shared curation of a gallery. Licence: AML (measured). |
| [Integrating AirPlay for long-form video apps](https://developer.apple.com/documentation/avfoundation/integrating-airplay-for-long-form-video-apps) | iOS 13 | 21 Nov 2024 | AirPlay from iPhone to the TV. |
| [Using AVFoundation to play and persist HTTP live streams](https://developer.apple.com/documentation/avfoundation/using-avfoundation-to-play-and-persist-http-live-streams) | iOS 18 | 21 Nov 2024 | HLS playback and offline downloads. |
| [Editing and playing HDR video](https://developer.apple.com/documentation/avfoundation/editing-and-playing-hdr-video) | iOS 14, macOS 11 | 21 Nov 2024 | HDR playback. |
| [Supporting custom media formats and decoders](https://developer.apple.com/documentation/mediaextension/supporting-custom-media-formats-and-decoders) | macOS 15 | 14 Sep 2026 | MediaExtension format readers, which only exist on macOS. Relevant if AVPlayer on the Mac must open containers it does not support. |
| [Generating high-quality thumbnails from videos](https://developer.apple.com/documentation/vision/generating-thumbnails-from-videos) | iOS 18, macOS 15 | 24 Sep 2024 | Choosing poster frames with Vision. |

## The component base: TVCatalog

**It is a catalogue, not an app.** It has 17 Swift files, 1,401 lines, and one commit: "New
project to demonstrate how to build a tvOS app in SwiftUI". Its deployment target is tvOS 18 and
it builds with Swift 6 (measured, 30 Sep 2026). It belongs to
[WWDC24 10207, Migrate your TVML app to SwiftUI](https://developer.apple.com/videos/play/wwdc2024/10207/).
The page says it "shows how to create the standard content lockups for tvOS, and provides best
practices for building out rows of content shelves".

**Screens.** `ContentView` is a top tab bar with four tabs: Stack, Buttons, Description and
Search. Three more views (`SidebarContentView`, `SectionsView` and `HeroBackgroundView`) are
only reachable from Xcode previews (measured, read).

- **Stack** is the landing page. A hero takes 80% of the height (`containerRelativeFrame`) and
  holds Show and More Info buttons. Below it are three shelves: a poster Movie Shelf of 6 per
  row, a square TV and Music Shelf of 5 per row, and a Content Cards shelf of 3 per row.
- **Buttons** shows every tvOS button style: bordered, tinted, prominent, plain, borderless
  poster and landscape, circle, card, and a custom `CardOverlayLabelStyle` card with a gradient
  scrim.
- **Description** is a product page "similar to those you see on the Apple TV app, with a custom
  material blur". It has Sign Up, Buy or Rent and Add to Up Next buttons, a synopsis that opens
  in a `fullScreenCover`, and cast credits.
- **Search** is a 4-column grid with `searchable` and `searchSuggestions`.
- **SidebarContentView** (preview only) is a TV-app-like sidebar made with `.sidebarAdaptable`:
  Search, Up Next, Movie Store, TV Store, Browse, and a Library `TabSection` containing All, Want
  to Watch, Movies, TV Shows and My Samples.

**Focus handling is almost entirely the button styles'.** The code uses `focusSection()` once,
on the hero. It never uses `focusable`, `FocusState`, `defaultFocus`, `onMoveCommand` or
`onExitCommand` (measured grep). The page gives the reason for the one it does use: without a
focus section, "moving focus up from the right side of the shelves below might fail, or might
jump all the way to the tab bar because the focus engine searches for the nearest focusable view
along a straight line".

**Lockups.** `.borderless` "provides the primary lockup style you use in tvOS, including all the
focus interactions and hover effects", and it attaches a `highlight` hover effect to the first
`Image`, "providing lift, a specular highlight, and gimbal motion effects". `.card` "provides a
platter and a more subtle motion effect on focus", "similar to the search result lockups on the
Apple TV app". The page's advice is to put a separate `Image` and `Text` in the label rather than
a `Label`. Where the title should show only on focus, a `visibleWhenFocused()` modifier reads
`isFocused` (measured, read).

**Shelves.** Each shelf is a `ScrollView(.horizontal)` around a `LazyHStack(spacing: 40)`, with
`.scrollClipDisabled()` so the focused lockup can grow. The button style goes on the shelf, and
each item gets `containerRelativeFrame(.horizontal, count: n, spacing: 40)`, which lines the
outer items up with the safe area.

**The fold is the most TV-app-like part.** The hero background is a full-screen image under
`.regularMaterial`, masked by a `LinearGradient`. `onScrollVisibilityChange` sets `belowFold`,
and animating the gradient stops' opacity blurs the whole image. A custom
`FoldSnappingScrollTargetBehavior` snaps the scroll to the top of the page or to the first shelf
(measured, read).

**How faithful to the TV app it is.** Faithful where the system does the work: the focus lift,
the specular highlight, the parallax, and a Liquid Glass tab bar and buttons once built against
tvOS 27 (see "What the screenshots show"). Everything else is a placeholder. Every button action
except the synopsis is `{}`, and More Info pushes a placeholder `Text("Hello")`. The
data is 15 bundled artworks (portrait and landscape) and lorem ipsum. There are no episodes, no
Up Next row with progress, no player and no model layer. It shows how to build the TV app's
parts, but not how they fit together.

## The app skeleton: Destination Video

**A working multiplatform app from one target.** It has 44 Swift files and 4,329 lines in the app
folder (46 and 4,372 with the Studio package), and one
`DestinationVideo` target whose `SUPPORTED_PLATFORMS` covers tvOS, iOS, macOS and visionOS with
`SDKROOT = auto`. Its git history runs from 7 Jun 2024 to 16 Jan 2026 (four commits; measured, 30 Sep 2026).
The zip is 1.19 GB: about half is the bundled `.git` history, and the rest is mostly Reality
Composer content, two `.mov` files and the asset catalogue.

**Its tvOS shape is the TV app's sidebar.** Watch Now, Library, New, Favorites and Search come
first, then `TabSection`s headed "Collections" and "Animations" (see "What the screenshots show"). Watch Now
is a hero plus shelves of `.card` buttons. On tvOS, `Constants.swift` gives its own sizes: a
card 550 wide, a hero 900 tall with text at most 800 wide, and 50 pt between cards. The hero is the one `focusSection()` (measured,
read). The page says each tvOS card "fully scales and lifts up", and that a `Section` header
lets "the title to also lift and move as the card expands".

**It shows playback done the system way.** `PlayerModel` creates the `AVPlayerViewController`,
and `SystemPlayerView` adds an Up Next tab through `customInfoViewControllers`, sized 500 x 250 on
tvOS. Data is SwiftData
(`Video`, `Genre`, `Person`, `UpNextItem`). The zoom navigation transitions are compiled only
`#if os(iOS)` (measured, read), even though `zoom(sourceID:in:)` is available from tvOS 18
([docs](https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:))).
So the springy folder-to-gallery opening on the TV is CanonCore's own to build.

## Licence

**Most samples are MIT, word for word.** TVCatalog's `LICENSE.txt`, quoted in full (measured,
30 Sep 2026):

> Copyright © 2024 Apple Inc.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software
> and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
> BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The same text, with only the year changed, ships in Mapping Apple TV users (2024), Focus Cookbook
(2023), Supporting remote interactions, Working with overlays, Top Shelf, Creating custom
container views (2024), the multiview sample (2025) and the card game (2026) (measured, 30 Sep
2026). This is the Expat licence, which ADR 0019 accepts as it is: the FSF lists Expat as
"compatible with the GNU GPL". The only duty is to keep Apple's copyright line and this notice
with any copied file.

**Destination Video uses Apple's older sample licence.** Quoted from its `LICENSE.txt` (measured,
30 Sep 2026):

> Copyright (C) 2026 Apple Inc. All Rights Reserved.
>
> IMPORTANT: This Apple software is supplied to you by Apple Inc. ("Apple") in consideration of
> your agreement to the following terms, ... Apple grants you a personal, non-exclusive license,
> under Apple's copyrights in this original Apple software (the "Apple Software"), to use,
> reproduce, modify and redistribute the Apple Software, with or without modifications, in source
> and/or binary forms; provided that if you redistribute the Apple Software in its entirety and
> without modifications, you must retain this notice and the following text and disclaimers in
> all such redistributions of the Apple Software. Neither the name, trademarks, service marks or
> logos of Apple Inc. may be used to endorse or promote products derived from the Apple Software
> without specific prior written permission from Apple. Except as expressly stated in this
> notice, no other rights or licenses, express or implied, are granted by Apple herein, including
> but not limited to any patent rights ...

Landmarks, Wishlist and the 2026 SharePlay gallery carry the same text. SPDX registers it as `AML`, "Apple MIT
License", and marks it not OSI-approved ([SPDX AML](https://spdx.org/licenses/AML.html)). Fedora
says: "This is Apple's variant of MIT. They've added wording around patents ... It is free and
GPL compatible" ([Fedora, Apple MIT License](https://fedoraproject.org/wiki/Licensing/Apple_MIT_License)).
It is not on the FSF's list: the only Apple entries there are the APSL and the Common
Documentation License (measured, `gnu.org/licenses/license-list.html`). The FSF has not ruled on
it. The Owner decided on 30 Sep to accept it like MIT, and ADR 0019 records that, so:

- **copy freely from MIT and AML samples**, keeping Apple's notice on every copied file.

**Do not ship Apple's media.** The MIT grant covers "this software and associated documentation
files". One sample's licence separately says its WWDC videos "are Copyright Apple Inc. All rights
reserved". The samples' images and videos (TVCatalog's 30 bundled image sets, Destination
Video's `.mov` files) should stay in the throwaway Apple prototype and never go into the repo. The
prototype uses the data snapshot's artwork anyway. Apple's name and marks may not "endorse or promote"
anything built from the AML samples. So the prototype is never called "Apple TV app", and it
lives in its own private repository, like the replicas (ADR 0022).

## Building them here

**Both tvOS samples build unchanged for the tvOS 27 simulator.** Xcode 27.0 (27A266a), tvOS 27.0
runtime (24J360), "Apple TV 4K (3rd generation)" simulator (measured, 30 Sep 2026):

```sh
xcodebuild -project TVCatalog.xcodeproj -scheme TVCatalog \
  -destination 'platform=tvOS Simulator,id=7AD90519-5ED9-43D2-8651-822271BB3693' \
  -derivedDataPath <scratch>/dd-tvcatalog CODE_SIGNING_ALLOWED=NO build
# ** BUILD SUCCEEDED **, 10.3 s wall, one warning (App Intents metadata skipped)

xcodebuild -project DestinationVideo.xcodeproj -scheme DestinationVideo \
  -destination 'platform=tvOS Simulator,id=7AD90519-5ED9-43D2-8651-822271BB3693' \
  -derivedDataPath <scratch>/dd-destvideo CODE_SIGNING_ALLOWED=NO build
# ** BUILD SUCCEEDED **, 16.1 s wall, 3 warnings (one Swift 6 weak-capture, App Intents)
```

Each was then installed with `xcrun simctl install`, launched with `xcrun simctl launch`
(bundle ids `com.example.apple-samplecode.TVCatalog` and
`com.example.apple-samplecode.DestinationVideo`) and captured with
`xcrun simctl io <udid> screenshot` at 3840 x 2160. The screenshots were saved to the session
scratchpad, not the repo, so these copies are temporary:
`/private/tmp/claude-501/-Users-jacobrees-orca-workspaces-CanonCore-ridgehead/81697d65-8ab7-4cff-a261-d96a9dcf4bb9/scratchpad/shots/`
(`tvcatalog-stack.png` and `destinationvideo-tvos.png`, with `-small` copies).

**What the screenshots show.** TVCatalog opens on its Stack page: a full-bleed sunset hero,
"tvOS with SwiftUI", glass Show and More Info capsules, the first poster shelf below the fold
line, and a glass capsule tab bar at the top. Destination Video opens with a floating frosted
sidebar over its hero: Watch Now selected, a "Collections" section with four collections, and
an "Animations" section. Both samples target tvOS 18, so the glass comes from the tvOS 27 SDK and
not from the sample code (measured, viewed). Only the launch screens were captured: `simctl`
cannot press remote buttons, so moving focus below the fold needs the Simulator window's arrow
keys or a remote.

## Open-source SwiftUI tvOS clients (secondary references)

Licence and stars from the GitHub API (measured, 30 Sep 2026). Under ADR 0019, MIT and AGPL code
can be copied. MPL-2.0 keeps its own file-level terms. Anything marked NOASSERTION or "none" is
for study only.

| Repository | Licence | Stars | Notes |
| --- | --- | --- | --- |
| [jellyfin/Swiftfin](https://github.com/jellyfin/Swiftfin) | MPL-2.0 | 4,190 | iOS and tvOS. `TVOS_DEPLOYMENT_TARGET = 26.1` and iOS 18.6 in `Swiftfin.xcodeproj` (measured). The most complete open client. |
| [benjaminRoberts01375/Stingray](https://github.com/benjaminRoberts01375/Stingray) | MIT | 250 | tvOS-only Jellyfin client that "Attempts to use as many of the native APIs as possible"; tvOS 18.0 target; on the App Store. **The closest copyable SwiftUI TV-app-style client.** |
| [yattee/yattee](https://github.com/yattee/yattee) | AGPL-3.0 | 3,719 | Video player for iOS, tvOS and macOS. Same licence as CanonCore. |
| [SRGSSR/pillarbox-apple](https://github.com/SRGSSR/pillarbox-apple) | MIT | 105 | A reactive AVPlayer playback layer from a public broadcaster. A player library, not a client. |
| [kingslay/KSPlayer](https://github.com/kingslay/KSPlayer) | GPL-3.0 | 1,669 | AVPlayer plus FFmpeg player for iOS, macOS, tvOS and visionOS. |
| [videolan/vlc-ios](https://github.com/videolan/vlc-ios) | NOASSERTION (API) | 1,304 | VLC for iOS and Apple TV. Mostly UIKit. |
| [Moonfin-Client/Moonfin-Core](https://github.com/Moonfin-Client/Moonfin-Core) | GPL-2.0-or-later (README) | 769 | Multiplatform Jellyfin client, mostly Dart/Flutter rather than SwiftUI. GPL-2.0-or-later per its README, so usable as GPL-3.0 alongside AGPL-3.0 code. |
| [superuser404notfound/Sodalite](https://github.com/superuser404notfound/Sodalite) | NOASSERTION | 50 | Jellyfin client for Apple TV, iPhone and iPad. Study only. |

## Claims not sourced

- That the Apple TV app itself adopted Liquid Glass in tvOS 26 and 27: seen only in how the
  samples render on the tvOS 27 SDK, not read from Apple.
- That AML is compatible with the AGPL: Fedora says "GPL compatible" without naming a version;
  the FSF has not listed it. ADR 0019 relies on Fedora's ruling.
- That the samples' images and videos are outside the MIT grant: the licence does not say either
  way; only one sample carries an explicit note, for WWDC videos.
- That Apple TV screens can be recorded: no longer needed. The tvOS recreation, dropped 3 Oct 2026,
  had a first ticket to test `devicectl`, and the Apple prototype builds from the
  samples rather than from recordings (`plan-2026-09-30.md`). The iPhone path is in
  `driving-the-iphone.md`.
- Infuse's and Plex's tvOS apps were not opened or recorded; what is said about them is judgement.
- Browsing and Modifying Photo Albums' date was not fetched.

## Recommendation

(Amended 3 Oct 2026: the 30 Sep verdict was to recreate Apple's TV app from TVCatalog and
Destination Video. That recreation was dropped, and the two feed the Apple prototype, CC-39,
directly.)

| Option | Verdict | Why |
| --- | --- | --- |
| **TVCatalog plus Destination Video, in the Apple prototype** | **Build on** | Apple's own code gives the focus behaviour, lockups, shelves, fold and product page, and MIT lets TVCatalog's code be copied. Destination Video adds the one-target structure, a sidebar with collection sections and system playback with Up Next, which is CanonCore's shape: browse, collections, AVPlayer. Both build here in seconds. What they lack (real navigation, progress rows, a season and episode page, Liquid Glass on tvOS 27, springy folder openings) is what the Apple prototype decides. |
| Infuse or Plex | Not studied | Dropped by the Owner on 30 Sep 2026, after the verification: the TV app alone is the reference (`plan-2026-09-30.md`). |
| Swiftfin or Stingray as the base | Secondary reference | Stingray (MIT) is copyable and native, but it is one developer's reading of the TV app. Swiftfin is MPL-2.0, targets tvOS 26.1, and carries its own design history. Read them for answers to real client problems (server sessions, resume, track pickers), not for design. |

**Order.** CC-39's spec owns the order. The samples suggest one: build TVCatalog's Stack and
Description pages on the data snapshot, then graft in Destination Video's sidebar (AML, copied with
Apple's notice since ADR 0019 accepts it) with Collections as folders. The prototype lives in its own
repository, `~/canoncore/design-prototype`, with a private remote (ADR 0022).

## Every sample, sorted

**All 652 samples were fetched and classified, and the two totals are equal.** The index is
`developer.apple.com/tutorials/data/documentation/samplecode.json`. Its 30 topic sections list
667 links, which are 653 distinct pages because the WWDC26 section repeats samples from the
others. The featured links are all among them, and the index links no collection pages to
follow. Of the 653, 652 have role `sampleCode` and a download. The other one,
[Checking IDs with the Verifier API](https://developer.apple.com/documentation/proximityreader/checking-ids-with-the-verifier-api),
has role `article` and no download, so it is not a sample. All 653 page JSONs were fetched with
no failures, and each sample's title, abstract and `metadata.platforms` was read. **Total
fetched: 652 samples. Total classified: 652. The count matches the library's 652**
(measured, 30 Sep 2026). The 652 samples share 637 distinct zips (measured).

The manifest has one row per sample: path, title, platforms, verdict and reason. It is in the
session scratchpad, not the repo:
`/private/tmp/claude-501/-Users-jacobrees-orca-workspaces-CanonCore-ridgehead/81697d65-8ab7-4cff-a261-d96a9dcf4bb9/scratchpad/apple-samples.tsv`.

**How the verdicts were set.** The clients are iPhone, iPad, Mac, Apple TV and the web.
visionOS and watchOS are not clients (the Owner's decision, 30 Sep 2026). A sample built for
those two, even with an iPhone companion, is a Drop. A multiplatform sample is judged only on iOS, iPadOS, macOS and
tvOS. iPad is a client with its own adaptive layout, so iPadOS samples count.

| Verdict | Meaning | Count |
| --- | --- | --- |
| Keep | A base of the Apple prototype's Apple TV screens (CC-39) | 3 |
| Combine | Folded into a named design effort | 13 |
| Later | A product building block, with its project | 40 |
| Drop | Not relevant | 596 |
| **Total** | | **652** |

### Keep (3)

| Sample | Licence | Why |
| --- | --- | --- |
| [Creating a tvOS media catalog app in SwiftUI](https://developer.apple.com/documentation/swiftui/creating-a-tvos-media-catalog-app-in-swiftui) | MIT | The component base: lockups, shelves, the fold, the product page, search and sidebar. |
| [Destination Video](https://developer.apple.com/documentation/visionos/destination-video) | AML | The app skeleton: one target for tvOS, iOS, iPadOS and macOS, a sidebar with Collections sections, and `AVPlayerViewController` with Up Next. AML: copy with Apple's notice (ADR 0019). |
| [Enhancing your app's content with tab navigation](https://developer.apple.com/documentation/swiftui/enhancing-your-app-content-with-tab-navigation) | AML | A second sample page for Destination Video. It downloads the same zip. |

### Combine (13)

| Design effort | Sample | Licence | What it gives |
| --- | --- | --- | --- |
| Apple prototype, Apple TV | [Focus Cookbook](https://developer.apple.com/documentation/swiftui/focus-cookbook-sample) | MIT | `FocusState`, `defaultFocus`, `focusable(interactions:)` and `onMoveCommand`: the focus APIs neither base uses. |
| Apple prototype, Apple TV | [Creating immersive experiences using a full-screen layout](https://developer.apple.com/documentation/tvuikit/creating-immersive-experiences-using-a-full-screen-layout) | MIT | `TVCollectionViewFullScreenLayout`, the full-bleed paging behind a hero carousel. It is UIKit, so rebuild the pattern in SwiftUI. |
| folder component | [Landmarks: Building an app with Liquid Glass](https://developer.apple.com/documentation/swiftui/landmarks-building-an-app-with-liquid-glass) | AML | `glassEffect`, `GlassEffectContainer` and `glassEffectID`: the frosted-glass half of the folder. |
| folder component | [Wishlist: Planning travel in a SwiftUI app](https://developer.apple.com/documentation/swiftui/wishlist-planning-travel-in-a-swiftui-app) | AML | Trips as collections that open with `navigationTransition(.zoom)`. The nearest sample to a folder opening into a gallery. |
| folder component | [Creating custom container views](https://developer.apple.com/documentation/swiftui/creating-custom-container-views) | MIT | Subview access for a custom folder or stack container. |
| folder component | [Composing custom layouts with SwiftUI](https://developer.apple.com/documentation/swiftui/composing-custom-layouts-with-swiftui) | MIT | The `Layout` protocol and a radial layout: how a closed folder can fan out its covers. |
| motion study | [Controlling the timing and movements of your animations](https://developer.apple.com/documentation/swiftui/controlling-the-timing-and-movements-of-your-animations) | MIT | Phase and keyframe animators, for spring timing to measure against recordings. |
| motion study | [Creating visual effects with SwiftUI](https://developer.apple.com/documentation/swiftui/creating-visual-effects-with-swiftui) | MIT | Scroll effects, custom transitions, shaders and a text renderer. |
| motion study | [Composing advanced graphics effects with SwiftUI](https://developer.apple.com/documentation/swiftui/composing-advanced-graphics-effects-with-swiftui) | MIT | The layered effects from WWDC26, on iOS and macOS 26. |
| untitled app replica | [Creating visuals with Music Understanding analysis results](https://developer.apple.com/documentation/musicunderstanding/create-visuals-using-musicunderstanding-analysis-results) | MIT | Charts a song's loudness over time, beats and sections: a source for the player's waveform. iOS, iPadOS, Mac Catalyst, macOS and visionOS 27 only. Also serves project 5. |
| prototype's Apple half | [Landmarks: Applying a background extension effect](https://developer.apple.com/documentation/swiftui/landmarks-applying-a-background-extension-effect) | AML | `backgroundExtensionEffect()`: artwork that extends under the sidebar on iPad and Mac. |
| prototype's Apple half | [Landmarks: Extending horizontal scrolling under a sidebar or inspector](https://developer.apple.com/documentation/swiftui/landmarks-extending-horizontal-scrolling-under-a-sidebar-or-inspector) | AML | Shelves that scroll under a sidebar on iPad and Mac. |
| prototype's Apple half | [Landmarks: Refining the system provided Liquid Glass effect in toolbars](https://developer.apple.com/documentation/swiftui/landmarks-refining-the-system-provided-glass-effect-in-toolbars) | AML | Toolbar groupings that read well in glass. |

The four Landmarks pages download one zip.

### Later (40)

No sample serves project 4 (the CMPP Store) or project 7 (Comics). Unless marked, each is MIT.

| Project | Sample | What it gives |
| --- | --- | --- |
| 1 | [Playing video content in a standard user interface](https://developer.apple.com/documentation/avkit/playing-video-content-in-a-standard-user-interface) | `AVPlayerViewController` full screen, inline and PiP on iPhone and iPad (UIKit). |
| 1 | [Becoming a now playable app](https://developer.apple.com/documentation/mediaplayer/becoming-a-now-playable-app) | Now Playing info and the remote command centre on iOS, macOS and tvOS. |
| 1 | [Supporting remote interactions in tvOS](https://developer.apple.com/documentation/avfoundation/supporting-remote-interactions-in-tvos) | Remote commands and events in each playback situation. |
| 1 | [Using AVFoundation to play and persist HTTP live streams](https://developer.apple.com/documentation/avfoundation/using-avfoundation-to-play-and-persist-http-live-streams) | HLS playback. Its persistence half is the pattern for Downloads. |
| 1 | [Simplifying User Authentication in a tvOS App](https://developer.apple.com/documentation/authenticationservices/simplifying-user-authentication-in-a-tvos-app) | The tvOS sign-in sheet, to compare with device-code pairing. Its autofill needs associated domains, which a self-hosted install cannot declare. |
| 1 | [Storing CryptoKit Keys in the Keychain](https://developer.apple.com/documentation/cryptokit/storing-cryptokit-keys-in-the-keychain) | Keeping the pairing credential in the Keychain. |
| 1 | [Bringing robust navigation structure to your SwiftUI app](https://developer.apple.com/documentation/swiftui/bringing-robust-navigation-structure-to-your-swiftui-app) | `NavigationStack` and split-view paths, with restoration. |
| 1 | [Food Truck](https://developer.apple.com/documentation/swiftui/food-truck-building-a-swiftui-multiplatform-app) | One target for Mac, iPad and iPhone, with an adaptive layout. |
| 1 | [Building a great Mac app with SwiftUI](https://developer.apple.com/documentation/swiftui/building-a-great-mac-app-with-swiftui) | Sidebar, tables and toolbars on the Mac. |
| 1 | [Customizing window styles and state-restoration behavior in macOS](https://developer.apple.com/documentation/swiftui/customizing-window-styles-and-state-restoration-behavior-in-macos) | Mac window styles and restoration. It downloads an older Destination Video (zip dated 20 Jul 2024), so this is the skeleton's macOS half. AML. |
| 1 | [Enhancing the accessibility of your SwiftUI app](https://developer.apple.com/documentation/accessibility/enhancing-the-accessibility-of-your-swiftui-app) | SwiftUI accessibility, for the accessibility pass that closes each project. |
| 1 | [Creating accessible views](https://developer.apple.com/documentation/swiftui/creating-accessible-views) | Accessibility modifiers on custom views. |
| 2 | [Adopting drag and drop using SwiftUI](https://developer.apple.com/documentation/swiftui/adopting-drag-and-drop-using-swiftui) | Moving Items between Orderings. |
| 2 | [Making a card game with drag, drop, and reordering in SwiftUI](https://developer.apple.com/documentation/swiftui/making-a-card-game-with-drag-drop-and-reordering-in-swiftui) | Reordering modifiers (WWDC26 session 271), for reordering an Ordering on the Mac. |
| 3 | [Supporting coordinated media playback](https://developer.apple.com/documentation/avfoundation/supporting-coordinated-media-playback) | SharePlay watch-together with `AVPlaybackCoordinator`. |
| 3 | [Creating a collaborative photo gallery with SharePlay](https://developer.apple.com/documentation/groupactivities/creating-a-collaborative-photo-gallery-with-shareplay) | Curating a gallery together. AML. |
| 3 | [Mapping Apple TV users to app profiles](https://developer.apple.com/documentation/tvservices/mapping-apple-tv-users-to-app-profiles) | Each Apple TV user mapped to a CanonCore profile. |
| 3 | [Working with overlays and parental controls in tvOS](https://developer.apple.com/documentation/avkit/working-with-overlays-and-parental-controls-in-tvos) | Parental controls and player overlays. |
| 5 | [Playing custom audio with your own player](https://developer.apple.com/documentation/avfaudio/playing-custom-audio-with-your-own-player) | A gapless queue on `AVSampleBufferAudioRenderer`, with long-form AirPlay 2, for music, audiobooks and podcasts. |
| 5 | [Integrating CarPlay with Your Music App](https://developer.apple.com/documentation/carplay/integrating-carplay-with-your-music-app) | CarPlay for music, audiobooks and podcasts. |
| 5 | [Integrating your music app with Apple Intelligence](https://developer.apple.com/documentation/appintents/integrating-your-music-app-with-apple-intelligence) | The audio App Intents schema, so Siri can play from the Library. |
| 6 | [Building a cross-platform web browser](https://developer.apple.com/documentation/webkit/building-a-cross-platform-web-browser) | SwiftUI `WebView` and `WebPage` (iOS and macOS 26; the sample itself needs iOS, iPadOS and macOS 26.4), to host the ebook reader. ADR 0009 keeps ebooks off tvOS. |
| 8 | [Adopting Picture in Picture playback in tvOS](https://developer.apple.com/documentation/avkit/adopting-picture-in-picture-playback-in-tvos) | PiP on tvOS. |
| 8 | [Creating a seamless multiview playback experience](https://developer.apple.com/documentation/avfoundation/creating-a-seamless-multiview-playback-experience) | Several synchronised players plus AVRouting. |
| 8 | [Editing and playing HDR video](https://developer.apple.com/documentation/avfoundation/editing-and-playing-hdr-video) | HDR playback. |
| 8 | [Integrating AirPlay for long-form video apps](https://developer.apple.com/documentation/avfoundation/integrating-airplay-for-long-form-video-apps) | AirPlay from iPhone to the TV. |
| 8 | [Supporting custom media formats and decoders](https://developer.apple.com/documentation/mediaextension/supporting-custom-media-formats-and-decoders) | MediaExtension format readers and decoders, for containers AVPlayer cannot open. macOS only. |
| 8 | [Enhancing your app with machine learning-based video effects](https://developer.apple.com/documentation/videotoolbox/enhancing-your-app-with-machine-learning-based-video-effects) | `VTFrameProcessor` effects such as super resolution. The sample is macOS 27 only. |
| 8 | [Continuing User Activities with Handoff](https://developer.apple.com/documentation/foundation/continuing-user-activities-with-handoff) | Continuing an Item on another device. |
| 8 | [Maintaining a local copy of server data](https://developer.apple.com/documentation/swiftdata/maintaining-a-local-copy-of-server-data) | A read-only local cache of server data, for browsing offline alongside Downloads. |
| 8 | [Bringing multiple windows to your SwiftUI app](https://developer.apple.com/documentation/swiftui/bringing-multiple-windows-to-your-swiftui-app) | A player window beside the Library on the Mac. |
| 9 | [Annotating a Map with Custom Data](https://developer.apple.com/documentation/mapkit/annotating-a-map-with-custom-data) | Filming locations as custom annotations with callouts. |
| 9 | [Decluttering a Map with MapKit Annotation Clustering](https://developer.apple.com/documentation/mapkit/decluttering-a-map-with-mapkit-annotation-clustering) | Clustering many filming locations. |
| 9 | [Searching, displaying, and navigating to places](https://developer.apple.com/documentation/mapkit/searching-displaying-and-navigating-to-places) | Place names from coordinates, and opening a place in Maps. |
| 10 | [Building a Full Screen Top Shelf Extension](https://developer.apple.com/documentation/tvservices/building-a-full-screen-top-shelf-extension) | A full-screen Top Shelf carousel (the sample shows featured movies), to carry CanonCore's Continue Watching. |
| 10 | [Building Widgets Using WidgetKit and SwiftUI](https://developer.apple.com/documentation/widgetkit/building-widgets-using-widgetkit-and-swiftui) | Home Screen widgets. |
| 10 | [Accelerating app interactions with App Intents](https://developer.apple.com/documentation/appintents/acceleratingappinteractionswithappintents) | Siri, Spotlight and Shortcuts. |
| 10 | [Adopting App Intents to support system experiences](https://developer.apple.com/documentation/appintents/adopting-app-intents-to-support-system-experiences) | Intents and entities across system experiences on iOS and macOS 27. AML. |
| 10 | [Showcase App Data in Spotlight](https://developer.apple.com/documentation/coredata/showcase-app-data-in-spotlight) | Indexing Items in Spotlight. The sample uses Core Data, but its indexing calls carry over. |
| 10 | [Localizing Landmarks](https://developer.apple.com/documentation/xcode/localizing-landmarks) | Localisation with String Catalogs. AML. |

### Drop (596), by family

| Family | Count | Why |
| --- | --- | --- |
| visionOS only | 81 | Not a client. Includes one iPad companion that only controls a visionOS app. |
| UIKit and AppKit | 62 | The app is SwiftUI. These cover things SwiftUI modifiers already give, or apply only to iPad apps running on the Mac and Mac Catalyst. |
| Metal and GPU compute | 58 | GPU rendering, compute and ML on the GPU. SwiftUI draws everything CanonCore needs. |
| ARKit, RealityKit and spatial | 54 | AR, 3D scenes, and authoring spatial, immersive or Cinematic video. |
| Other app services | 52 | Calendar, contacts, Messages, PencilKit, the Photos picker, SiriKit's older domains, TipKit, Live Activities, and pushes, which need an APNs key a self-hosted server cannot hold on its own. |
| Vision, Core ML and intelligence | 45 | On-device ML and speech. Poster frames, saliency crops and subtitles are server jobs for every client, the web included. |
| System, security and networking | 34 | Drivers, VMs, crypto and filtering. Passkeys and Sign in with Apple need associated domains, which cannot name every self-hosted install. |
| Accelerate | 31 | Image and signal maths. Dominant artwork colours belong on the server. |
| Data, persistence and superseded app samples | 22 | Core Data, iCloud and local SwiftData stores, while the server is the source of truth; also older samples others replace (Fruta, Backyard Birds, 2021 materials). |
| Camera and screen capture | 20 | CanonCore plays media and records none. |
| Developer tools and language | 20 | Tooling, and server code in languages CanonCore does not use. |
| Audio production and drivers | 16 | Synthesis, effects and drivers. The client plays through AVPlayer. |
| Bluetooth, NFC and nearby devices | 15 | Accessories and proximity. |
| HealthKit and fitness | 12 | Health and workouts. |
| Web and browser | 10 | Safari extensions, and a UIKit web view that the SwiftUI one replaces. |
| Games and haptics | 10 | Games, controllers and haptics. |
| Video authoring and encoding | 8 | Encoding and editing. The server prepares media on Linux, and HLS interstitials exist for ads. |
| watchOS | 8 | Not a client. Apple lists iOS for each, but only as the watch app's companion. |
| Maps and location (not project 9) | 8 | User location, indoor maps and overlays. Filming locations need only the three MapKit samples under Later. |
| StoreKit, payments and commerce | 8 | CanonCore sells nothing in the app. |
| Accessibility (covered) | 7 | UIKit, AppKit and WWDC challenge versions of the two SwiftUI accessibility samples under Later, plus the Dim Flashing Lights sample for apps that draw their own flashing content. |
| TVML | 6 | The TV client is SwiftUI. |
| MusicKit | 3 | The Apple Music catalogue. CanonCore plays its own files. |
| CarPlay (not media) | 2 | Navigation and food ordering. |
| HomeKit | 2 | Home automation. |
| Superseded tvOS samples | 2 | See below. |

### Changes to the earlier tables

This note's first two tables named 36 samples. The sweep keeps 31 of them as Keep, Combine or Later and drops five, each with a reason. It also corrects the licence of two it keeps:

- **Supporting Multiple Users in Your tvOS App: Drop.** Mapping Apple TV users to app profiles
  supersedes it.
- **Browsing and Modifying Photo Albums: Drop.** It is a UIKit album grid, and TVCatalog covers
  grids.
- **Supporting Continuity Camera in your tvOS app: Drop.** The table already said a media
  library does not need it.
- **Backyard Birds: Drop.** Widgets come from the WidgetKit sample, and the client does not keep
  its own SwiftData store.
- **Generating high-quality thumbnails from videos: Drop.** The server picks poster frames once
  for every client. Vision runs only on Apple devices.
- **Wishlist and Landmarks keep their places, but their licence is corrected.** Both are AML,
  not MIT (measured, 30 Sep 2026, each zip's `LICENSE.txt`). Landmarks' grant also excludes "any
  accompanying photographs". Under the rule in Licence (ADR 0019), their code is copied with
  Apple's notice kept; Landmarks' photographs are not.

### Licences found in this sweep

The `LICENSE.txt` of every Keep, Combine and Later zip was read (measured, 30 Sep 2026). All are
MIT except these AML ones:

- Destination Video, plus its tab-navigation article.
- The older Destination Video zip behind "Customizing window styles".
- All five Landmarks pages, which share one zip.
- Wishlist.
- Localizing Landmarks, whose grant also excludes "any accompanying photographs".
- Adopting App Intents to support system experiences.
- The SharePlay gallery.

Two MIT zips carry an extra line: in Playing video content and in Supporting coordinated media
playback, the linked WWDC videos are "Copyright Apple Inc. All rights reserved". Maintaining a
local copy of server data adds a third-party ACKNOWLEDGMENTS file.

For the folder component, Creating custom container views and Composing custom layouts are MIT.
The glass and zoom halves come from AML samples, which ADR 0019 accepts like MIT since 30 Sep, so
they are copied with Apple's notice kept.

### What this means for the Apple prototype's Apple TV screens

**Nothing in the sweep changes which samples they start from.** Exactly 49 samples name tvOS, the same as above, and
TVCatalog and Destination Video are still the only SwiftUI media apps among them. Of the other
603 samples, none adds a tvOS screen. Two findings affect the Mac and iPad halves instead:

- Destination Video has a second, older zip, and its macOS window code is the skeleton's Mac
  half.
- The glass and zoom references are AML.
