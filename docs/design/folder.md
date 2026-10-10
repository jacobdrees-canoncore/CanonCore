# The folder: verdict record and tokens

Decision record, 9 Oct 2026, closing the folder component's spec (CC-37) for CanonCore. The folder
was studied from fayazara's portfolio template and rebuilt twice in a private repository, in React
with Motion and in SwiftUI for iPhone, iPad and Mac (ADR 0022). This record is what leaves that
repository: the spring mapping, the look the Owner picked on each platform, the Apple TV answer, the
folder's tokens and what descends from fayazara's code. It is words and tokens only. Project 1
builds CanonCore's own folder from it, test-first, and the design prototypes cite it for the folder.

A folder is a presentation, not a domain concept (ADR 0020): any grouping may be shown as one, and
`GLOSSARY.md` still avoids "folder" as a name for a Collection, Franchise, Show or Ordering.

Every value below is the build's at the private repository's main branch, commit `f3096e7` (CC-58's
merge, 9 Oct 2026), and was checked against it when this record was written; the Apple TV section's
come from the same repository at commit `73d3dcd` (CC-60's merge).

## What the folder is

A closed folder is a back panel (a tab and a body in one silhouette), up to five cards hanging in
it, and a frosted front over the lower 76% carrying the title, a count and an arrow. The cards'
tops peek out above the front.

- **Fan.** With a pointer over it, or keyboard focus on it, the front tilts back 30 degrees and the
  cards fan out and rise. The card under the pointer is singled out: it straightens, rises further
  and grows to 1.05, and its neighbours lean away from it.
- **Gallery.** A click, a tap or Return opens the gallery: the front flings back to 80 degrees and
  fades, and the cards fly out of the folder to a row across the middle of the screen, over an
  opaque scrim that hides the page and the emptied folder (amended 10 Oct 2026, CC-252: it was the
  original's 0.86 wash over a blur). The centred card is full size and straight; the others are smaller, tilted and
  fading. Arrows, swipes and a click on a side card step through them.
- **Closing.** Escape, the close button or a click on the scrim flies the cards home, centre card
  first, into the still-open folder. Only once every card has landed does the front shut over them.
- **Reduced motion** makes every spring instant. **Reduced transparency** makes the front opaque.

## The spring mapping

The folder moves on seven of Motion's duration-based springs, each written as fayazara wrote it
(the table under Motion, below). The motion study confirmed every one of them against the live
original, recorded at 120 Hz and fitted from its computed transforms, and corrected none.

**On the web**, the folder runs them as Motion's own `type: "spring", duration, bounce`, which is
what the original runs.

**On Apple, the folder runs Motion's spring itself, not SwiftUI's.** Equal numbers were the
expected route (ADR 0020 as first written) and were measured instead of assumed. They miss:

- **Equal numbers are a different spring.** Given SwiftUI's `spring(duration:bounce:)`, the seven
  springs miss Motion's curves by 17 to 35% of the travel, worst early in the move: SwiftUI's
  duration is perceptual, and Motion's is the whole spring's, the time its envelope takes to decay
  to 0.001.
- **No single ratio converts them.** The SwiftUI duration that fits best runs from 0.605 to 0.740
  of Motion's, depending on the bounce.
- **No table survives an interruption.** A hand-tuned table fits from rest to within 0.11% of the
  travel, but SwiftUI's springs carry velocity into the next animation, and Motion's duration-based
  springs do not: the original's fan, reversed 63 ms in, stops dead and comes back from rest. With
  SwiftUI's springs, the reversed fan's outer cards swung past the turn and failed the trace (5.45%
  of the folder's width against a 1% limit). Apple's documentation gives SwiftUI's springs as
  preserving velocity across overlapping animations, and names no option to start one from rest.

So the rule is "write Motion's numbers; they mean what they mean in Motion". The Apple folder ports
Motion's spring (`findSpring` in motion-dom 12.43.0, MIT by its npm package, read 9 Oct 2026) as a SwiftUI `CustomAnimation`:

- **The curve.** Damping ratio is 1 − bounce, clamped to 0.05 to 1. The stiffness is solved, from
  Motion's first guess of 5 / duration and its eleven Newton steps, so the envelope has decayed to
  0.001 at the duration. The value is drawn from rest and snaps to exactly 1 at the duration, as
  Motion's generator does. Against Motion's own generator at 61 points through each spring, the
  worst difference was 5e-10.
- **The interruption.** When an animation merges into a running one, the new leg starts from
  wherever the old one had reached, at rest. The custom animation reports no velocity, so nothing
  merging into it inherits any.
- **The delay.** An interrupted value holds still through the next spring's delay, as Motion's
  does, so the spring carries its own delay rather than SwiftUI's `delay`.
- **Its limit.** A gesture-driven release, where carried velocity is wanted, would use SwiftUI's own
  spring. The folder has none.

With the mapping applied, every clip of the motion study passed its trace against the original on
the Mac on 9 Oct 2026 (the reversed fan at 0.011% of the folder's width, against 5.45% on SwiftUI's
springs). The iPad simulator and the iPhone deliver about 60 frames a second, below the trace's
frame-rate rule, so the Mac's trace stands for both (the Owner, 9 Oct 2026): the springs are the
same shared code on every Apple platform, and what is the iPhone's own (a tap opening the gallery,
swipes stepping it, a portrait layout) is covered by UI tests.

**For CanonCore:** the web client uses Motion's duration-based springs with these numbers, and the
Apple app carries its own port of Motion's spring, built test-first against Motion's generator.

## The looks the Owner picked

A pick is a material, frosted or glass; light and dark follow the app's theme, so each pick carries
both themes' tokens (the Owner, 9 Oct 2026).

| Platform | Pick | Lowest contrast measured, title / count (AA asks 4.5) |
| -- | -- | -- |
| Web | **frosted** | light 8.97 / 5.50, dark 7.97 / 6.51 |
| Apple: iPhone, iPad and Mac | **frosted** | light 10.95 / 6.82, dark 11.63 / 9.03 |

Both platforms share one material, so one set of tokens serves both (below), with the platform
differences named beside them.

Contrast is measured from pixels: every placeholder artwork in the demo (over 20 on the web, 24 on
Apple, the most colourful included) is laid behind the front in turn, and the lowest WCAG ratio
between the text and any pixel behind it is kept. Apple's figures are the lowest across the Mac,
the iPhone 17e simulator and the iPad Pro 11-inch simulator. fayazara's own values fail AA under
the same test (title 4.16, count 1.27 on the web), which is why the tint thickens towards the text
and the text is darker than the original's.

**Not picked: Liquid Glass**, on both platforms. On Apple it is the system's `glassEffect` over a
lens that clouds towards the text, with the arrow rising out of it as a glass button of its own as
the folder fans; on the web it is a CSS twin (blur 8px, saturate 200%, brightness 1.1, a specular
rim and a sheen). Its measured contrast, kept as the looked-at alternative: web light 6.13 / 4.68;
Apple light 8.99 / 6.35, dark 5.47 / 7.81.

**Not picked: a long-press fan on touch.** It was built (CC-58) and turned down. On iPhone and iPad
a tap opens the gallery, and the fan stays a hover flourish for the Mac and for an iPad with a
pointer. Apple's Human Interface Guidelines give touch and hold as "Open a contextual menu" and
say to avoid using a familiar gesture for an action unique to the app
(developer.apple.com/design/human-interface-guidelines/gestures, read 9 Oct 2026).

**Still open, by ADR 0023:** on the web, the pick sits inside the web prototype's Look switch
(untitled's look or Arc's where they disagree, CC-38), and whether the frosted tint counts as a
decorative gradient under Arc's rules is decided there. On Apple, the Apple prototype (CC-39)
settles whether Arc's rules apply. Each verdict is recorded beside the pick when it is made.

## The tokens

Named on Arc's roles where Arc has one (radii, shadows, durations, easings, springs), and with
`folder-` or `gallery-` names otherwise, so none collides with Arc's `:root` variables (ADR 0023).
The surface, the gallery's title and its count use Arc's `--background`, `--foreground` and
`--text-secondary`, whose values win; the front's text has tokens of its own, so the measured
contrast never rests on Arc's values.

### In DESIGN.md's front matter

The block below lints as the front matter of a DESIGN.md (Google's format, `version: alpha`) with
no error and one expected warning, `missing-primary`, since CanonCore's DESIGN.md takes its primary
from Arc's mirror (`npx -p @google/design.md@0.4.0 designmd lint`, 9 Oct 2026). DESIGN.md has no dark-mode key, so dark values carry a
`-dark` suffix. Its `rounded` scale takes only px, em and rem, and every radius of the folder is a
fraction of the folder's or the card's width so it scales with them, so the radii sit in `spacing`
as unitless fractions, which DESIGN.md allows for ratios. What each unitless value is a fraction
of, or measured in:

- of the folder's width: `radius-folder-front-x`, `folder-fan-closed-spread`,
  `folder-fan-neighbour-yield`; of the folder's height: `folder-front-top`; of the front's own
  height: `radius-folder-front-y`;
- of the card's own width: `radius-folder-card`, `radius-folder-card-gallery`,
  `folder-card-matte-padding`; of the card's own height: `folder-fan-rise`, `folder-fan-single-rise`;
- of the viewport: `gallery-unit-width`, `gallery-unit-height`; of the gallery unit: `gallery-gap`;
- degrees: `folder-front-tilt-fanned`, `folder-front-tilt-flung`, `gallery-tilt-max`;
- multipliers: `folder-aspect` (width over height), the scales, the opacities and the saturations
  (`folder-front-saturate` 1.8 is CSS `saturate(180%)`).

<!-- tokens:start -->
```yaml
version: alpha
name: CanonCore folder
description: The frosted folder, picked on the web and on Apple (CC-63).
colors:
  folder-front-title: "#171717"
  folder-front-count: "#404040"
  folder-arrow: "#737373"
  folder-front-tint-top: "rgb(255 255 255 / 0.5)"
  folder-front-tint-bottom: "rgb(255 255 255 / 0.72)"
  folder-front-opaque: "#ececec"
  folder-back-top: "#f4f4f4"
  folder-back-bottom: "#e2e2e2"
  folder-back-rim: "rgb(255 255 255 / 0.8)"
  folder-card-matte: "#ffffff"
  folder-card-blank: "#e5e5e5"
  gallery-scrim: "rgb(250 250 250)"
  gallery-close: "rgb(255 255 255 / 0.7)"
  gallery-close-ring: "rgb(0 0 0 / 0.05)"
  gallery-hint: "#a3a3a3"
  folder-front-title-dark: "#fafafa"
  folder-front-count-dark: "#d4d4d4"
  folder-arrow-dark: "#a3a3a3"
  folder-front-tint-top-dark: "rgb(38 38 38 / 0.6)"
  folder-front-tint-bottom-dark: "rgb(23 23 23 / 0.8)"
  folder-front-opaque-dark: "#262626"
  folder-back-top-dark: "#2a2a2a"
  folder-back-bottom-dark: "#1f1f1f"
  folder-back-rim-dark: "rgb(255 255 255 / 0.08)"
  folder-card-matte-dark: "#f5f5f5"
  folder-card-blank-dark: "#404040"
  gallery-scrim-dark: "rgb(10 10 10)"
  gallery-close-dark: "rgb(255 255 255 / 0.1)"
  gallery-close-ring-dark: "rgb(255 255 255 / 0.08)"
  gallery-hint-dark: "#737373"
typography:
  folder-title:
    fontSize: 14px
    fontWeight: 500
  folder-count:
    fontSize: 12px
    fontWeight: 400
spacing:
  folder-aspect: 1.17647
  folder-front-top: 0.24
  folder-front-padding: 20px
  folder-title-gap: 2px
  folder-arrow-size: 16px
  radius-folder-front-x: 0.075
  radius-folder-front-y: 0.116
  radius-folder-card: 0.09
  radius-folder-card-gallery: 0.035
  folder-card-matte-padding: 0.03
  blur-folder-front: 16px
  folder-front-saturate: 1.8
  folder-press-scale: 0.98
  folder-fan-closed-spread: 0.06
  folder-fan-neighbour-yield: 0.04
  folder-fan-rise: -0.24
  folder-fan-single-rise: -0.34
  folder-fan-single-scale: 1.05
  folder-front-tilt-fanned: -30
  folder-front-tilt-flung: -80
  gallery-unit-width: 0.46
  gallery-unit-height: 0.52
  gallery-side-scale: 0.6
  gallery-gap: 0.08
  gallery-fade-step: 0.16
  gallery-fade-floor: 0.3
  gallery-tilt-max: 6
  gallery-bar-padding: 24px
  gallery-close-size: 32px
  gallery-hint-bottom: 28px
```
<!-- tokens:end -->

### What the sizes mean

- **The folder** is 20 wide by 17 tall (`folder-aspect`). Its silhouette, on a 400 by 340 box: a
  tab 180 wide and 60 deep with 26-unit corners, joined to the body by a concave sweep of radius
  34, and a body with 30-unit corners. The front covers the folder from 24% of its height down
  (`folder-front-top`), with corners of 7.5% of the folder's width by 11.6% of the front's own
  height, the body's 30 units.
- **The cards** hang by position, cycling through five shapes, each a width in % of the folder's
  width, an aspect ratio and a drop from the top in % of the folder's height: 34% at 4:5 and 5%,
  44% at 4:3 and 9%, 37% at 1:1 and 4%, 42% at 3:2 and 10%, 32% at 3:4 and 6%. A card keeps its own
  aspect ratio and its shape's area. The middle card sits on top.
- **The matte** is white, 3% of the card's width on every side (`folder-card-matte-padding`). Its corner
  is 9% of the card's width in the folder and 3.5% in the gallery, where 9% would make a stadium;
  the inner corner is the outer less the matte, so the curves stay concentric, as Arc's rule asks.
- **The fan.** Closed, the cards spread 6% of the folder's width per step from the middle and turn
  6 degrees across the stack (the outermost at ±3 with five cards). Fanned, they spread to just
  span the folder (the step is 100% less the widest card's width, over the gaps), turn 11 degrees
  across the stack and rise 24% of their own height. A singled-out card rises 34%, straightens and
  scales to 1.05; its neighbours yield 4% of the folder's width. The front tilts back 30 degrees
  about its bottom edge, under a 1000 px perspective from the folder's centre, and flings to 80.
- **The gallery** sizes its cards off one unit, the smaller of 46% of the viewport's width and 52%
  of its height: the centred card's longer side is one unit. Side cards are 0.6 of their own fit,
  0.08 of a unit apart, faded by 0.16 a step down to 0.3, and tilted between −6 and 6 degrees by a
  hash of their index, so a card lands at the same angle every visit. Every card is centred on the
  screen's middle row.

### Elevation and blur

DESIGN.md's front matter has no shadow or blur scale, so these are its Elevation section, in CSS.
Arc names shadows `--shadow-*`; these extend that role and do not replace Arc's own.

| Token | Value (light) | Value (dark) |
| -- | -- | -- |
| `--shadow-folder-back` | `drop-shadow(0 1px 2px rgb(0 0 0 / 0.06)) drop-shadow(0 6px 12px rgb(0 0 0 / 0.06)) drop-shadow(0 18px 32px rgb(0 0 0 / 0.07))` | the same |
| `--shadow-folder-front` | `0 -2px 6px -1px rgb(0 0 0 / 0.08)` | `0 -2px 8px -1px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.08)` |
| `--shadow-folder-card` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` | the same |
| `--folder-front-fill` | a gradient, top to bottom, from `folder-front-tint-top` to `folder-front-tint-bottom`, over `blur-folder-front` and `folder-front-saturate` | the same, from the `-dark` tints |
| `--gallery-backdrop` | `gallery-scrim`, opaque, with no blur (CC-252) | `gallery-scrim-dark`, the same |

The back's shadows follow the silhouette (`drop-shadow`, since `box-shadow` cannot follow the tab):
a tight contact shadow, a mid layer for form and a wide ambient one. The back's rim is a 1-unit
stroke of `folder-back-rim` on the 400-unit box.

**Where Apple differs:**

- The front's blur is the system's `.ultraThinMaterial` under the same tint, not a 16px blur, and
  the gallery's backdrop is the opaque scrim, as on the web (CC-252).
- The front has a 1pt rim, white at 0.6 in light and at 0.08 in dark; its shadow is black at the
  theme's opacity with radius 3 and a −2 offset.
- The Apple build's shadow radii are half the web's blur: the back's are radius 1, 6 and 16 at
  offsets 1, 6 and 18, and the card's radius 1.5 and 1 at offset 1.
- The back's rim is a 0.7pt stroke, and the front's arrow is SF Symbols' `arrow.up.right` at 13pt
  bold, where the web draws a 16px icon.
- The front's text is the system font at the same sizes and weights; on the web the build used
  fayazara's SF Compact stack, and CanonCore's web client uses Arc's Inter (ADR 0023).

### Motion

DESIGN.md has no motion tokens; Arc keeps its springs in `motion-tokens` as `spring.*`, so the
folder's extend that role. Each is Motion's duration-based spring: duration is the whole spring's.

| Spring | Duration | Bounce | Moves |
| -- | -- | -- | -- |
| `spring.folder-open` | 0.55 s | 0.35 | the fan opening, and the front tilting back |
| `spring.folder-close` | 0.3 s | 0.1 | the fan folding away |
| `spring.folder-focus` | 0.3 s | 0.18 | singling one card out, and letting it go |
| `spring.folder-fling` | 0.45 s | 0.2 | the front flinging back and fading as the gallery opens |
| `spring.folder-stage` | 0.55 s | 0.18 | cards flying out, and stepping between them |
| `spring.folder-home` | 0.5 s | 0.12 | cards flying back into the folder |
| `spring.folder-shut` | 0.6 s | 0.25 | the front shutting over the landed cards |

| Token | Value | Use |
| -- | -- | -- |
| `stagger.folder-fan-open` | 0.04 s a step, from the middle card out | the fan opening |
| `stagger.folder-fan-close` | 0.02 s a step | the fan folding |
| `stagger.folder-gallery` | 0.05 s a step from the centred card | cards flying out |
| `stagger.folder-home` | 0.03 s a step from the middle card | cards flying home; the front shuts once the last has landed |
| `--duration-folder-corner` | 450 ms | the matte's corner, 9% to 3.5% and back, as a flight starts |
| `duration.standard` (Arc's, 0.24 s today) | 240 ms | the gallery's scrim fading in and out |
| `--ease-folder` | `cubic-bezier(0.25, 0.1, 0.25, 1)` (CSS `ease`) | both of the above, as the original and the Apple build time them |
| press | scale 0.98 over 160 ms on `cubic-bezier(0.23, 1, 0.32, 1)` | a press on the folder, on a fine pointer only (web) |

The original names no curve for the scrim's fade or the corner, so they run on CSS `ease`, which
the Apple build uses. The web build ran them on fayazara's two page curves, `cubic-bezier(0.23, 1,
0.32, 1)` for the fade and `cubic-bezier(0.77, 0, 0.175, 1)` for the corner. Which CanonCore keeps
is not decided here: the two builds differ, and nothing traced either curve.

## Where the folder and Arc's rules disagree

For the web prototype's verdicts (ADR 0023), not settled here:

- **Bounce.** Arc keeps visible bounce for playful moments; the folder's springs bounce from 0.1
  to 0.35, and are its signature.
- **Shadows.** Arc puts shadows only on floating layers and never stacks them; the folder's back
  stacks three, and its cards rest on two.
- **The frosted tint** is a gradient; whether it is decorative is the prototype's call.
- **The press** scales to 0.98, against Arc's 0.97.
- **The arrow.** The build draws Phosphor's `arrow-up-right` (bold, MIT) as fayazara does, and SF
  Symbols' `arrow.up.right` on Apple; Arc's icons are lucide's.
- **The hint's 28px** sits off Arc's 4px spacing tokens, which have no `--space-7`.
- **Focus on the web** (10 Oct 2026). Keyboard focus fans the folder, and Arc's keyboard ring now shows beside the fan: the folder drops its own `outline: none` (ADR 0023, amended). The ring follows the button's rectangle, not the tab's silhouette, and the fanned cards rise above it; how that reads is the prototype's call.

## Apple TV

**The folder does not survive tvOS's system focus lift. Apple TV's focus signal is the folder's
own fan, with no system lift** (the Owner, 9 Oct 2026, from CC-60's verdict).

CC-60 put the SwiftUI folder on Apple TV in the Apple TV 4K (3rd generation) simulator, tvOS 27.0,
driven by the simulator's remote. Apple TV has no pointer and no touch on the screen, so focus
stands in for hover: the focused folder fans, select opens the gallery, left and right step it, and
Back sends the cards home and hands focus back to the folder. That part works with or without the
lift.

With the system's lift (`hoverEffect(.lift)`), the same frame against the same build without it:

| | With the lift | Without it |
| -- | -- | -- |
| the front | drawn flat: its tilt back is gone | tilts back, as on the Mac |
| the fanned cards | cut off straight along the folder's top edge | rise clear of the folder |
| the back's tab | gone: the folder is a rounded platter | the silhouette |
| the frost, on every folder on the page, focused or not | shows nothing through it | shows the cards through it |

The lift draws the whole view as one flat platter clipped to its bounds, so everything that makes
the folder a folder is lost or cut. Traced in the simulator with the lift, both focus clips failed
against the original (the recordings of fayazara's live page that every build is traced
against): the fanned middle card ended at scale 1.146 against 1.000, and x and y were off by about
4% of the folder's width against a 1% limit. The simulator records at about 60 frames
a second, so timing was not judged; where the cards end up was.

**This departs from Apple's default on purpose.** The HIG's focus page says "Rely on
system-provided focus effects" and "Consider creating custom focus effects only if it's absolutely
necessary" (developer.apple.com/design/human-interface-guidelines/focus-and-selection, read 9 Oct
2026). It is necessary here because the lift breaks the component. Keyboard focus already fans the
folder on the Mac, so the fan is the folder's focus signal on every platform. What it gives up is
the scale and shadow every other tvOS control shows when focused; if that is wanted later, the
folder can draw its own outside its clip, on its own spring.

**On Apple TV, as built:**

- the page draws at twice the original's size, so each folder is 552 points wide, and the front's
  and the gallery's text at twice its size;
- the look is frosted, light or dark following the system's appearance, with no picker (only dark
  was seen: the tvOS simulator's runtime cannot change its appearance);
- the gallery's centred card holds focus, and its value names which card is centred; while the
  gallery is open, the open folder takes no focus, and the demo disables the other folders;
- the gallery has no close button, since Back is the platform's close and focus cannot reach a
  button once the centred card holds it;
- with reduced motion, nothing moves, as on every platform.

The private package and demo dropped the lift on 9 Oct 2026, on the Owner's decision in the folder
audit's grill (CC-248); CC-60's measurement of it is kept as its committed recordings. CanonCore's
own folder is built from this record, without it. The first judgement of the folder with a real Siri
Remote is the Apple prototype's (CC-39, ADR 0020).

## What descends from fayazara's code, and its licence

**Licence status, re-checked 9 Oct 2026 with the GitHub API:** `GET
repos/fayazara/portfolio-site-template` returns `"license": null`; `GET .../contents/LICENSE` and
`GET .../license` return 404; the newest commit is still `4ab50de` of 1 Aug 2026; the README still
ends "License: MIT". With no licence text in the repository, the author's verbal permission covers
the Owner alone (ADR 0019). So no code descending from fayazara's enters CanonCore until a LICENSE
file is in fayazara's repository. This record carries words and tokens only.

Descending from fayazara's `Folder.astro`, `Card.astro` and global styles at `4ab50de`, in both
builds:

- the back panel's silhouette and its three shadows;
- the frosted front: its tint, blur and saturation (the tint and text since tuned past the original
  to meet AA);
- the seven springs, the four staggers, and closing in sequence (cards land, then the front shuts);
- the fan's poses: the closed spread and turn, the fanned spread, rise and turn, the single-out and
  the yielding neighbours, the front's tilt and fling;
- the card shapes and how they hang, and the card's matte, corners and shadow;
- the gallery's layout (the unit, the side scale, the gap, the fade, the hashed tilt) and its scrim,
  title, count, close button and arrow hint;
- the page curves and the font stack, and the demo page's layout (a centred column holding a
  two-column grid of folders).

Not descending from it: the spring mapping on Apple (a port of Motion's MIT spring), the look
variants' dark theme and Liquid Glass fronts, the contrast tuning and its tests, the motion study's
tracer, and the placeholder artwork. The Apple build's container and fan layout adapt Apple's MIT
samples (Creating custom container views; Composing custom layouts with SwiftUI), and its Liquid
Glass front follows the Landmarks sample (AML), each notice kept (`apple-sample-code.md`).

No recording, curve image, untitled drawing or fayazara photograph is in this record.
