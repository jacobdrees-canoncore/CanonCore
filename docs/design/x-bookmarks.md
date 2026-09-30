# X bookmarks: what CanonCore takes from them

Decision record, 30 Sep 2026. Jacob went through his X bookmarks one at a time in a grill, with each post, its linked sites and its App Store pages open in Safari. Every bookmark was first analysed with the `analysing-design-bookmarks` skill; the method is in `analysing-bookmarks-for-design.md` beside this file. The cards, sheets, bursts and captures live outside the repo in `~/orca/projects/CanonCore/xmcp/analysis/`, one folder per post, because they are derived from other people's posts.

**Scope.** 101 bookmarks were archived on 30 Sep 2026. Ten personal ones were left out, and six text-only posts that are not design material were set aside, leaving the 85 below. The numbers are the grill's order, newest first.

## The buckets

Every bookmark sits in exactly one of these, decided before the round began:

- **Recreate**: an exact standalone replica of a real product, in its own site like `~/canoncore/untitled-replica`, so its design can be studied closely. CanonCore adapts from a replica later; a replica is never CanonCore itself.
- **UI system**: a component library, kit, tool or asset source to study, or to install or buy.
- **Inspiration**: a design idea for the prototype, kept as its card and nothing more.
- **Skip**: dropped.

An app with no website is recreated as a **SwiftUI replica** of its key screens, built from its App Store screenshots, screen recordings and any TestFlight build, since that is the stack of CanonCore's own apps.

## Decisions

- **Recreate four products:** untitled.stream (the web replica is under way; a SwiftUI replica of its app follows), America.gov (web), and Brink and MD Vinyl (SwiftUI). None of the four publishes its source (checked on GitHub, 30 Sep 2026), so each is rebuilt from the live product. Wafer's console was dropped on 30 Sep.
- **The frosted-folder portfolio gives CanonCore one signature component, the folder (ADR 0020); untitled.stream is the foundation.** The folders' contents peek out and open into springy galleries (github.com/fayazara/portfolio-site-template). It is not recreated: its own code is used, with the author's permission, and ships once a licence is in its repo (ADR 0019). (Revised 30 Sep: this bullet first called the portfolio the foundation.)
- **Adopt:** shadcn/lint, and Google Stitch's DESIGN.md format alongside it for the agents that build CanonCore.
- **Evaluate as web-client dependencies:** Arc and ObsidianUI.
- **Study, and use where they fit:** Bencho.dev (a favourite), React Bits Micro, Interaction Kit, uselayouts (MIT), dqnamo's Kitchen, Cuelume, dither-kit, the progressive-blur component, and fayazara's macOS app skills for the Mac app.
- **Assets and tools:** Grainient, perhaps paid; texture packs; Grainrad; a Midjourney style code; Appthetics as one way to make a mascot.
- **CanonCore needs a brand, including a mascot.** Mascot and branding research is its own piece of work, later; bookmarks 21, 23, 68, 69 and 75 feed it.
- **A possible philosophy for the iOS app:** use Apple's system components as they ship and let content carry the brand (bookmark 24).

## Themes

What Jacob kept returning to, for whoever designs the prototype:

- **Physical media**: object-like icons, stamps, shelves, crates, records, collectible cards.
- **Dither and ASCII**: dithered gradients, halftone screens and character-grid images.
- **Serif mixed with sans**: an editorial or bookish serif for titles over a plain sans UI.

## Follow-ups

- Go through the 38 apps in the B2TF directory (b2tf.app) for more inspiration.
- Go through all of fayazara's repositories one by one.
- Read competitors' DESIGN.md files (getdesign.md lists over 550).
- Look into https://x.com/dhruvmakes/status/2034645922492375185; bookmarking it lets the next sync collect it.
- Retry backgrounds.supply, which failed with a Cloudflare SSL error on 30 Sep.

## Every bookmark

### Recreate (4, plus the foundation and one dropped)

- 2. @fayazara, Serif-led government site: one ask bar over an image stage: America.gov, standalone website replica
- 15. @gow88_, Cover-tinted episode carousel with motion blur, and a floating mini-player: Brink, SwiftUI replica of key screens
- 29. @kazarov_d, Wafer console: painted backdrop behind sign-in and a translucent model catalogue: dropped 30 Sep (was a maybe recreation of app.wafer.ai)
- 48. @fayazara, Portfolio of frosted "folders" that open into springy galleries: use its existing code exactly, or at least base CanonCore off it; not recreated (permission reported by Jacob to copy the folders and opening animation)
- 70. @byhewar, [untitled]: a dark, quiet home for work-in-progress music: web replica under way in butterfish; also do its SwiftUI app replica (App Store id 6445854828)
- 80. @mobbin, MD Vinyl's first-run tour: one tooltip that walks along the tab bar: MD Vinyl, SwiftUI replica (App Store id 1606306441)

### UI system (18)

- 7. @eliakuratli, Arc UI site, recommended as an AI-agent skill source: Arc, study and evaluate as a web-client dependency (covers n=7, 9, 10)
- 9. @eliakuratli, Arc UI library launch reel: stateful controls, rolling numbers, dashboards: Arc (answered with n=7)
- 10. @eliakuratli, Arc: a React component library with calm, per-state motion: Arc (answered with n=7)
- 18. @athrix_codes, ObsidianUI banner: pixelated blue light streaks converging on a wordmark: ObsidianUI, evaluate alongside Arc
- 19. @davidhaz, React Bits Micro: 30 small interaction components: React Bits Micro
- 20. @shadcn, shadcn/lint: design-system rules that coding agents can verify: we'll use shadcn/lint
- 21. @AdityaShips, Appthetics mascot maker: chat on the left, versioned variants on a dotted canvas: Appthetics as a candidate for making the mascot. New decision: CanonCore needs a brand, including a mascot
- 22. @cabralorenzo, Bencho.dev launch: a tilted wall of live UI blocks drifting behind the wordmark: Bencho.dev, a favourite (especially loves this one)
- 33. @basit_designs, Dithered animated gradients as full-bleed phone backgrounds: Grainient, happy to maybe pay for it. Theme: loves dithered gradients, more bookmarks to come (covers n=33 and 44)
- 41. @armondme, Interaction Kit: small React components for the quiet details: Interaction Kit
- 42. @marmobs, The Dynamic Island as a receipt printer you tear off: dqnamo's Kitchen (https://www.dqnamo.com/kitchen) as part of the UI system; the receipt printer is one of its experiments
- 44. @basit_designs, Dither gradient phone screens: halftone colour fields with one pill button: Grainient (answered with n=33); dither gradient theme
- 50. @davidmokos_, Progressive blur header and footer for Expo: progressive blur header/footer (Expo component; the effect for CanonCore's apps)
- 57. @dwhitedesign, Cuelume: synthesised interaction sounds, one attribute per element: Cuelume (web interaction sounds)
- 58. @grimcodes, dither-kit: pixel-dithered sparkline charts on a dark dashboard: dither-kit; small, but its code could be built upon (dither theme)
- 61. @zeke, Mac menu-bar stats popover, and agent skills for native macOS apps: fayazara's macos-app-skills for the Mac app. Follow-up: go through all of fayazara's repos one by one
- 71. @heynavtoor, DESIGN.md: a design system as one markdown file for agents: use Google Stitch's DESIGN.md format alongside shadcn/lint; look into competitors' DESIGN.md files to help (follow-up)
- 81. @0xUrvish, Photo stack that expands into a gallery grid, built with Motion: uselayouts (github.com/iurvish/uselayouts, MIT, uselayouts.com); the stack-to-gallery is one of its experiments

### Inspiration and UI system (3)

- 74. @Mastermindraws, Four glitch textures: screen-pixel grids, noise, scanline smear, halftone streaks: textures as an asset source; dither theme
- 75. @The_Sycomore, "Cutecore": a Midjourney style reference of felted 3D toys: the Midjourney style code as a tool; mascot/brand research
- 77. @Kanishk3D, Binary-digit ASCII renderings of images, coloured per glyph: Grainrad as a tool; ASCII/dither theme

### Inspiration (42)

- 1. @revmpstudio, Step tracker Home: sentence summary over a full-bleed map, stat card and pill tab bar
- 4. @ktnr23, App icon as a blister-packed toy car: physical-media iconography theme
- 6. @stevelauda_, Studio identity set as distressed postage stamps: physical-media vibe
- 8. @FinnoTaylor, Photo folders that open into a throwable card stack: a later bookmark may have a component to build it with
- 12. @joshmillgate, Keyframe inspector with scrub-bar fields and an orange timeline: likes the look of it
- 13. @johnpalmer, A 2023 AI brand identity: one blue circle, a family of symbols, a tabbed prompt box: the logo and the serif font
- 14. @penguindsgn, Otherwise brand posters: serif headlines on cards over halftone gradients
- 16. @micka_design, CSS text-wrap: pretty for body, balance for headings: web type rule
- 17. @_heyrico, A product-design token cheat sheet, shown on a dark AI workspace
- 23. @semochkin_alex, Mascot emotion sheet: one owl, eight moods: one possible approach for the mascot; mascot and branding research for CanonCore comes later
- 24. @appllamaio, Four big apps on the iOS 26 floating glass tab bar: maybe a philosophy for the CanonCore iOS app (use system components, let content carry the brand)
- 26. @radiofun8, Book carousel with motion blur that opens into a frosted "ask about this book" sheet
- 28. @marcelkargul, Soft pale-green wellness app with a pill tab bar and fade-through tabs: maybe, more as a design philosophy (soft, low-contrast calm)
- 30. @emirayaz, Landing hero: serif headline beside a slowly shifting out-of-focus light field: the right-hand light field is a video we could make with Midjourney
- 31. @basit_designs, Pale card set with living glass-orb renders
- 32. @jackcring, B2TF: a gallery of skeuomorphic retro iOS apps: source: go through B2TF's 38 apps for more inspiration (follow-up)
- 35. @Talhadesignn, Ink-wash mountain hero with a serif-italic accent: loves the background (a copy is in Downloads; do not use it, inspiration only)
- 36. @basit_designs, Three quiet portrait panels with a living glass sphere and a "Thinking" orb
- 37. @ayushsoni_io, Conduit brand: blurred-photo gradients under crisp white UI cards
- 38. @hivinz_, Frosted-glass folders holding artwork cards: Collections as frosted folders
- 39. @joshpuckett, A chat interface driven by a state-machine panel: each event plays its transition: maybe for CanonCore's future Storybook (states you step through and judge in motion)
- 40. @nilseller, Warm-white app shell with a book serif for titles: likes the mix of serif and sans serif (theme)
- 43. @coleHardik, Dark split sign-up with a looping light-orb video
- 46. @HilaShmuel, Warm knowledge graph with focus-on-a-tag filtering: an Entity graph with focus filtering
- 47. @Kerroudjm, Poster-first series app with voice search, and a customisable game shelf: poster-first Series, customisable physical shelf
- 52. @basit_designs, Dither gradient poster and a phone hero: black to red and blue with halftone edges: dither theme
- 54. @saisatvik_, Warm-dark dashboard recipe: Inter Display, one brown-black, three radii
- 55. @KrisAnfalova, Split hero: white headline panel beside a glass chat over a flower photo: Voxai is a Framer concept by Kris Anfalova, not a real product
- 62. @_heyrico, The same token cheat sheet, shown on a light agent workspace
- 63. @uihssn, ASCII-character overlays on gradients and photos as hero backgrounds: could maybe use the photos themselves
- 64. @gabriell_lab, Blur plus light tint instead of a 40% black scrim: modal/sheet rule
- 65. @praveenisomer, Dithered violet flower video as a hero, over an editorial serif page: dither + serif
- 66. @keilethh, Stillness hero: serif headline over a voxel landscape: likes the imagery (voxel landscape)
- 67. @keilethh, Landing cards with voxel-art illustrations: mountains and a seated statue: voxel imagery
- 68. @The_Sycomore, AI-generated brand kits: a 3x3 board as a brand's whole system: for the brand research: a method and a format for a brand kit
- 69. @LexnLin, AI-generated brand board, and the prompt that made it: brand research: the prompt as a method
- 72. @dhruvmakes, Square cards with slowly flowing mesh gradients behind big type: follow-up: look into https://x.com/dhruvmakes/status/2034645922492375185 (bookmark it so the next sync collects it)
- 73. @Aurelien_Gz, A 3D card-stack gallery: flip the front image away, hover to scrub the stack: flick through a Collection like a crate
- 76. @AdamKPx, Tilt-to-move poster card with an artwork-tinted backdrop: tilting poster Item card
- 78. @Aurelien_Gz, Holographic trading card on iPhone whose foil follows the phone's tilt
- 84. @raul_dronca, Hold-to-delete: images drop into the button one by one as it fills: hold-to-delete for destructive actions; build from Emil Kowalski's open walkthrough (Raul has no repo or library for it)
- 85. @appadappajappa, Lamp shop demo: a theme switch dims the room, a light switch turns the lamps on: artwork that responds to the theme

### Skip (16)

- 3. @uxmiles, One continuous camera through dark UI controls: toggle, slider, notifications, keyboard
- 5. @sucodeee, Peelable sticker shader with five finishes: white, sparkle, prism, ripple, halftone
- 11. @motion_so, Two AI-made brand films side by side: tangle-to-asterisk and a jar of notes
- 25. @AdityaSur11, Eyes-only idle loop for a mascot, generated on a node canvas
- 27. @kail_designs, Motion-blurred photo backgrounds, and free fonts set over them
- 34. @andrew_n_carr, AI-generated character animation: a pink dragon's idle, walk and fire-breath
- 45. @miu21590, Clew: a learning map as a zoned dependency graph with a topic side panel
- 49. @MengTo, A 3D bookshelf you browse sideways, pull a book from and open
- 51. @MengTo, 3D books that spin, open and fan their pages into a detail view: Skip (covers n=51 and 53)
- 53. @thebuggeddev, 3D books in three.js that fly forward, spin and open beside their details: Skip (answered with n=51)
- 56. @AmirMushich, Cloud Canvas: a moodboard that floats uploaded images as a draggable 3D globe
- 59. @Tanjim38, Light SaaS dashboard that builds itself in, with a slide-in assistant panel
- 60. @heysatya_, Book collections: fanned covers that settle onto a shelf
- 79. @heysatya_, Three studio prototypes: button-to-sheet morph, cover-tinted detail, blurred context menu
- 82. @tar_uniqueee, A designer's year of iPhone interaction prototypes (two reels)
- 83. @basit_designs, Landing hero: a soft iridescent sphere that the camera dives into and pulls back from

