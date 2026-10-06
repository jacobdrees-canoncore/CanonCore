# Driving the iPhone: can an agent record and study the apps itself

Research note, 30 Sep 2026. Question from Jacob: can an agent on this Mac observe and control his
physical iPhone well enough to do the recording and study work for the SwiftUI recreations
(`swiftui-recreation-feasibility.md`) without him holding the phone? The work needs stills,
screen video with frame timing good enough to measure an animation to the frame, taps, swipes and
typing to navigate, and the accessibility tree. The apps are third-party App Store builds he did
not make: Brink: Podcast Player (6760338948), MD Vinyl (1606306441) and [untitled] (6445854828).
MD Vinyl's recreation was dropped on 3 Oct 2026 (CC-35 canceled); its rows below are kept as measured.

"(measured)" means read on this date on this Mac or from the named source. Everything else carries
a link to its owner, or is listed under "Claims not sourced" at the end. Nothing was run against
the phone except read-only `devicectl device info` queries; no capture, launch or input was sent.

## The short answer

**Yes, for almost all of it, and most of the setup is already done.** Two Apple-supported routes
cover the work between them. `xcrun devicectl device capture` takes screenshots and records the
screen of a paired physical device from the command line (present in Xcode 27's `devicectl`
642.16), and XCUITest, reached through
Appium's WebDriverAgent, launches any installed app by bundle ID, taps, swipes, types and returns
the accessibility tree. Neither needs the app's source.

**The phone is already paired, trusted and in Developer Mode.** `devicectl` reports Jacob's iPhone
16 Pro Max on iOS 27.0 (24A435) as `paired`, `developerModeStatus = enabled`, tunnel `connected`
over `localNetwork`, and the developer disk image services usable at the time of reading (measured,
`devicectl device info details` and `info ddiServices`; the tunnel connects on demand, and a later
read the same day showed it disconnected). What is left for Jacob is small: sign WebDriverAgent
once with his team, and keep the phone unlocked on the desk during a session.

**All three apps are on the phone.** When this note was measured, only [untitled]
(`com.untitledinbrackets.untitled-ios`, 1.21.0; 1.22.0 released 30 Sep 2026, read 3 Oct 2026)
was installed of 160 apps listed (`devicectl
device info apps --include-all-apps`); Jacob installed Brink and MD Vinyl later on 30 Sep
(`plan-2026-09-30.md`).

**None of the three runs on this Mac, and none can run in the simulator.** See the last two routes.

## The phone as the Mac sees it

**Measured on 30 Sep 2026:**

- Mac: macOS 26.6.2 (25G83), Darwin 25.6.0; Xcode 27.0 (27A266a); iOS 27.0 and tvOS 27.0
  simulator runtimes (`sw_vers`, `xcodebuild -version`, `xcrun simctl list runtimes`).
- Phone: iPhone 16 Pro Max (iPhone17,2), iOS 27.0 (its UDID is read with `devicectl list devices` when needed), paired by
  `manualPairing`, connected over the network, not by cable (`devicectl list devices`,
  `device info details`). `system_profiler SPUSBDataType` lists no iPhone.
- Display: 1320 x 2868 px at point scale 3, portrait (`device info displays`).
- Lock: `passcodeRequired: true`, `unlockedSinceBoot: true`, backlight off at the time
  (`device info lockState`, `info displays`).
- Tools present: `/System/Applications/iPhone Mirroring.app`, QuickTime Player, Accessibility
  Inspector and DeviceHub inside Xcode, `ffmpeg` 8.1.2, the `orca` CLI. Absent: `appium`,
  `idevicescreenshot`.

## Route by route

### 1. devicectl capture (present in Xcode 27): the recording route

**Works on a real device, for any app on screen, from the command line.** `devicectl device
capture` has two subcommands (measured, `xcrun devicectl device capture --help`):

- `screenshot --device <id> --destination <path.png>` "Captures a screenshot from the device and
  saves it as a PNG file".
- `screen-record --device <id> --destination <path.mp4> [--codec h264|hevc] [--duration <s>]
  [--mask-policy ignored|premultipliedAlpha|black]` "Records the device's screen to a video file",
  until Ctrl+C or the duration.

**It is a whole-screen capture, not an app capture.** It targets a display (`--display-unique-id`,
default the primary), so the app being third-party does not matter to the command. The same
`devicectl` also launches an app by bundle ID (`device process launch --device <id>
<bundle-identifier-or-path>`, with `--terminate-existing` for a fresh start), rotates the device
(`device orientation`), sets appearance and VoiceOver (`device settings`) and fakes the status bar
(`device simulate statusBar`) (measured, each subcommand's `--help`). Apple documents `devicectl`
as the way to "manage physical and simulated devices ... without running Xcode", and says to
"unlock the device before entering `devicectl` commands"
([Apple, Interacting with devices using the command line](https://developer.apple.com/documentation/xcode/interacting-with-devices-using-the-command-line)).

**What it does not give:** no input (no tap or swipe subcommand exists), no accessibility tree, and
no frame-rate option on `screen-record`. The rate it records at, and whether the phone's 120 Hz
ProMotion survives into the file, is not documented; it must be measured with `ffprobe` on the
first recording (see "Claims not sourced"). The Xcode 27 release notes do not mention the
`capture` subcommand; the local help is the only source.

**Jacob does once:** nothing beyond what is already done (pairing, Developer Mode). Keep the phone
unlocked while it runs.

### 2. XCUITest through WebDriverAgent and Appium: the control route

**Works on a real device against an app you did not build.** Apple's own documentation of
`XCUIApplication(bundleIdentifier:)`: "For iOS and tvOS apps, the system installs the matching app
build onto the device and launches it. If the system can't find the matching app build, it
launches the existing installed app for the requested bundle ID"
([Apple, init(bundleIdentifier:)](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/init(bundleidentifier:))).
So a UI test can drive `gow.ProjectBrink`, `tech.miidii.MDVinyl` and
`com.untitledinbrackets.untitled-ios` (bundle IDs from iTunes Lookup, measured) with the full
XCUIAutomation vocabulary: `tap()`, `doubleTap()`, `press(forDuration:thenDragTo:withVelocity:
thenHoldForDuration:)`, `swipeUp(velocity:)`, `pinch(withScale:velocity:)`, `typeText(_:)`,
`coordinate(withNormalizedOffset:)`, `debugDescription` for the element tree, and
`XCUIScreen.screenshot()` (measured, the XCUIAutomation symbol index on developer.apple.com).

**WebDriverAgent turns that into something an agent can call.** Appium's XCUITest driver installs
"the `WebDriverAgentRunner-Runner` (WDA) application on the device" and talks to it over HTTP
([Appium XCUITest driver, Device setup](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/getting-started/device-setup.md)).
From it the agent gets:

- **Launch and switch apps** by bundle ID: `mobile: launchApp` and `mobile: activateApp`
  ([execute methods](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/execute-methods.md)).
- **The accessibility tree** as XML, JSON, or "description", which is "how XCTest 'sees' the page
  internally" (`mobile: source`, same page). Labels, roles, values and frames; never colours,
  fonts or radii.
- **Input**: taps, drags, swipes, pinches and typing through the W3C actions and `mobile:` gestures.
- **Screenshots** through WDA. Their default format since WDA 5.4.0 is "lossless HEIC with fallback
  to PNG" (`screenshotQuality`,
  [capabilities](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/capabilities.md)).

**Video: two recorders, and only one is fit for frame counting.**

- `mobile: startXCTestScreenRecording` is "based on the native implementation provided by Apple"
  and "provides the best quality for the least performance penalty"; its `fps` is "24 by default",
  with 1 to 60 recommended; "only available since Xcode 15/iOS 17"; on real devices it needs iOS 18+
  and `appium-ios-remotexpc` >= 0.44.0 to delete the video from the phone afterwards; otherwise
  the session must enable the `xctest_screen_record` security flag
  ([execute methods](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/execute-methods.md)).
  Set `fps: 60` for timing work.
- `startRecordingScreen` / `mobile: startScreenRecording` records "using **ffmpeg** and the
  WebDriverAgent **MJPEG** stream". The stream's `mjpegServerFramerate` defaults to `10`, maximum
  60, at JPEG quality `25` by default
  ([MJPEG guide](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/guides/mjpeg.md),
  [settings](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/settings.md)).
  It is a stream of screenshots, so frame spacing is whatever the screenshots managed, not the
  display's refresh. Good for watching; not for measuring a 200 ms crossfade.

**It is current for Xcode 27.** The driver shipped 12.13.3 on 28 Sep 2026 (a WDA bump "for
package creation with Xcode 26+"), WDA itself is at 16.13.5 (30 Sep 2026), and Appium's "Xcode 27 and iOS/tvOS
27 support" issue is closed (measured, GitHub releases and
[appium/appium#22368](https://github.com/appium/appium/issues/22368)). Two Xcode 27 issues about a
*preinstalled* WDA launched through `devicectl` are closed
([#2978](https://github.com/appium/appium-xcuitest-driver/issues/2978),
[#2985](https://github.com/appium/appium-xcuitest-driver/issues/2985)); the ordinary
`xcodebuild`-built WDA path avoids them.

**Jacob does once:** turn on "Settings -> Developer -> Enable UI Automation" and keep Zoom off
(Device setup, above); give his Team ID so WDA can be signed with his paid account, where the
automatic strategy is `appium:xcodeOrgId` plus `appium:xcodeSigningId: "Apple Developer"` and an
`appium:updatedWDABundleId` his profile accepts
([Basic automatic configuration](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/getting-started/provisioning-profile/auto-config.md));
tap Trust for the developer certificate on the phone the first time WDA installs, if asked. Appium
needs installing on the Mac (`npm i -g appium`, `appium driver install xcuitest`); that is the
agent's job. (Revised 6 Oct 2026: installing free tools is pre-approved, `docs/agents/dispatching.md`;
Appium 3.8.0 with the xcuitest 12.15.0 and mac2 4.3.6 drivers is installed.)

### 3. Xcode 27 Device Hub: a live view of the phone, but a GUI

**Works on a real device.** Xcode 27 ships DeviceHub
(`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`, measured), which opens from Manage
Devices… in the run destination menu. After pairing, "a View
Screen button appears in the canvas"
([Apple, Managing your simulated and physical devices in Device Hub](https://developer.apple.com/documentation/xcode/managing-your-simulated-and-physical-devices-in-device-hub)),
and "To interact with the device in Device Hub, select the device in the sidebar and click View
Screen" ([Apple, Interacting with your app in Device Hub](https://developer.apple.com/documentation/xcode/interacting-with-your-app-in-device-hub)).
Its Screenshot button captures "at the full resolution of the simulated or physical device", but
video recording is documented for "simulated devices" only
([Apple, Capturing screenshots and videos from devices](https://developer.apple.com/documentation/xcode/capturing-screenshots-and-videos-from-devices)).
Known limits in Xcode 27: no two-finger touch, and "Input interactions such as keyboard or pointer
are only supported on ... iOS 18.0" and newer
([Xcode 27 release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-27-release-notes)).

**Orca's computer-use could in principle drive it,** since it is an ordinary Mac window: `orca
computer` offers `get-app-state` (accessibility snapshot plus screenshot), `click`, `drag`,
`scroll`, `type-text` by window coordinate (measured, `orca computer --help` and `capabilities`).
But the phone's screen inside it is a video surface, so the Mac accessibility tree would show one
opaque view, not the app's elements. Route 2 does the same job with the phone's real tree.

**Jacob does once:** nothing new.

### 4. iPhone Mirroring: works in the UK, drivable by computer-use, unmeasured for video

**Available here, not in the EU.** Apple: iPhone Mirroring is "currently unavailable in the European
Union"; it needs macOS Sequoia 15 or later on Apple silicon or T2, iOS 18 or later with a passcode,
both devices "signed in to the same Apple Account" with two-factor authentication, Bluetooth and
Wi-Fi on, and the iPhone "locked and near your Mac". "Streaming content providers may have playback
restriction policies", and the iPhone's camera and mic are not available
([Apple Support 120421](https://support.apple.com/en-gb/120421)). The app is installed
(measured).

**What it gives:** a Mac window of the whole phone, clickable and typeable ("click wherever you
would tap", Mac keyboard for typing, same page). Orca's computer-use can click, drag and type into
it by coordinate and take window screenshots. The same caveat as Device Hub applies: the window is
a stream, so no per-element accessibility tree is expected. Swipes become scrolls or drags
(Shift-scroll for sideways); multi-touch is not mentioned on Apple's page.

**Not measured:** whether `screencapture -v` or ScreenCaptureKit records the Mirroring window at
full rate, what frame rate the stream itself runs at, and whether the stream is scaled below the
phone's 1320 x 2868. Apple's page says nothing on any of them. Mirroring also requires the phone to
be locked, so it cannot run alongside routes 1 and 2, which need it unlocked. A frame timing taken
through a wireless mirror adds its own jitter, so it is a navigation fallback, not a measuring tool.

**Jacob does once:** open iPhone Mirroring and approve it on the phone. Launching it was not done
here, since it takes over the phone.

### 5. QuickTime movie recording over a cable

**Works on a real device, for any app, but only with a cable.** Apple: "Connect your device to your
Mac ... Choose File > New Movie Recording", then choose the device from the camera menu; quality is
"High: H.264 video and 44100 Hz AAC audio" or "Maximum: H.264 video and Linear PCM audio", with no
frame-rate setting
([QuickTime Player User Guide, Record a movie](https://support.apple.com/guide/quicktime-player/record-a-movie-qtp356b55534/mac)).

**It can be scripted without QuickTime.** The phone's screen appears as an AVFoundation capture
device through CoreMediaIO. The macOS SDK header says of
`kCMIOHardwarePropertyAllowScreenCaptureDevices`: "1 means that screen capture devices will be
presented to the process ... By default, this property is 1", while the wireless variant "By
default ... is 0" (measured, `CMIOHardwareSystem.h` in the Xcode 27 macOS SDK). FFmpeg's
avfoundation input enumerates "muxed" external devices, which is how that device shows up
(measured, `libavdevice/avfoundation.m`). Today `ffmpeg -f avfoundation -list_devices true` lists
the Mac's cameras, the phone's Continuity Camera and "Capture screen 0", but no iPhone screen,
because the phone is on Wi-Fi, not a cable (measured).

**Superseded by route 1** for this work: same whole-screen video, but `devicectl` needs no cable,
no GUI and no device-selection menu. Keep it as the fallback if `devicectl screen-record` turns out
to drop frames.

**Jacob does once:** plug in a USB-C cable (the 16 Pro Max is USB-C) and tap Trust if asked.

### 6. libimobiledevice `idevicescreenshot`: not on iOS 17 or later

**Does not work as shipped.** It asks lockdown for the `screenshotr` service and fails with
"Remember that you have to mount the Developer disk image"
([idevicescreenshot.c](https://github.com/libimobiledevice/libimobiledevice/blob/master/tools/idevicescreenshot.c)).
Since iOS 17 the disk image is personalised; `ideviceimagemounter` in 1.4.0 (10 Oct 2025) can mount
one, but the issue "idevicescreenshot broken with Xcode 15 + iOS 17" is still open with no fix,
and a contributor notes "the API for the screenshot relay also changed"
([libimobiledevice#1465](https://github.com/libimobiledevice/libimobiledevice/issues/1465), opened
28 Jun 2023, measured open). Route 1 does this natively; do not install it.

### 7. Accessibility Inspector against the phone

**Probably works, documented only loosely.** "The target menu displays a list of connected devices
and apps you can inspect ... select the name of the device on which the app is running, then pick
the app from the processes menu", and it "targets the current foreground app by default"
([Apple, Inspecting the accessibility of the screens in your app](https://developer.apple.com/documentation/accessibility/inspecting-the-accessibility-of-screens)).
Nothing there limits it to your own app, but nothing confirms a third-party App Store app either;
not tested. It is a GUI (at `Xcode.app/Contents/Applications/Accessibility Inspector.app`,
measured), so an agent would read it through computer-use one element at a time. `mobile: source`
in route 2 returns the whole tree in one call and is the better tool.

### 8. Orca's emulator skill: simulators only

**Simulators only.** Its guide: "Drive an Apple Simulator (iOS / iPad / Watch) from within Orca",
wrapping serve-sim, which "captures the real simulator framebuffer (via private SimulatorKit /
IOSurface for low-latency 60fps H.264 or MJPEG)"; its `ax` command is the "serve-sim AX node tree"
(measured, `orca skills get orca-emulator`). `orca emulator devices` lists 24 devices, all simulator
runtimes, and not the paired iPhone (measured). It is the right tool for the *replicas* running in
the iOS 27 simulator, not for the originals on the phone.

### 9. Switch Control and Voice Control

**Not useful.** Switch Control can "control your other Apple devices remotely on the same Wi-Fi
network" with the same Apple Account
([Apple Support 118667](https://support.apple.com/en-us/118667)), but it is a scanning interface
for a person, with no capture and no scriptable surface; Voice Control runs on the phone and listens
to a voice.

### 10. App Store apps in the iOS simulator

**No.** `simctl install` takes a path to a built app (measured, `xcrun simctl help install`), and
the iOS 27 simulator runtime's `AppStore.app` holds only localisation folders and `PlugIns`: no
`Info.plist` and no executable (measured, the runtime root at
`/Library/Developer/CoreSimulator/.../iOS 27.0.simruntime`). App Store downloads are device builds,
not simulator builds (see "Claims not sourced").

### 11. The apps on this Mac (Apple silicon "Designed for iPhone")

**None of the three is offered on the Mac.** For Macs with Apple silicon, developers "deselect 'Make
this app available' to opt out of offering your app on the Mac App Store"
([App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon/)).
iTunes Lookup exposes no Mac field (each has iOS `supportedDevices` and
`isVppDeviceBasedLicensingEnabled: true`; Brink and MD Vinyl list `features: ["iosUniversal"]`,
[untitled] none), but the App Store web page carries each app's
`appPlatforms`, and neighbouring apps that do run on the Mac list `"mac"` there (Peapod, Current,
Sakura Reader). The three read (measured, `apps.apple.com/gb/app/id<id>`):

| App | Bundle ID | `appPlatforms` | On the Mac? |
| --- | --- | --- | --- |
| Brink | `gow.ProjectBrink` | watch, phone, pad | No |
| MD Vinyl | `tech.miidii.MDVinyl` | phone, vision, pad | No |
| [untitled] | `com.untitledinbrackets.untitled-ios` | phone | No |

**One side door: [untitled] has a separate Mac app.** "[untitled] for Desktop"
(`com.untitledinbrackets.untitled-macos`, id 6744922982, 1.6.0, 24 Sep 2026, macOS 14.6+, free)
is on the Mac App Store (measured, iTunes Search `entity=macSoftware`; v1.7.0 released 30 Sep 2026, read 3 Oct 2026).
It is native AppKit plus SwiftUI, not Mac Catalyst (read 6 Oct 2026: `vtool` reports platform
MACOS, it links AppKit and nothing from iOSSupport); its bundle names it "[untitled]", and "for
Desktop" is only its App Store listing name. It is a different design from the iPhone app,
a desktop layout with a sidebar (App Store screenshots), so it does not replace recording the
phone. Since 3 Oct 2026 it is in the untitled app replica's scope (CC-36), recorded and driven on
the Mac; whether computer-use reads its accessibility tree is untested.

## What each route gives

| Route | Real device, third-party app | Stills | Video for frame timing | Input | A11y tree |
| --- | --- | --- | --- | --- | --- |
| `devicectl capture` | Yes | PNG, full res | MP4, h264/hevc, rate unmeasured | No | No |
| XCUITest via WDA/Appium | Yes | HEIC/PNG | XCTest recorder, `fps` up to 60 | Full | Yes |
| Device Hub | Yes | Full res, button | Simulators only | Clicks, no two-finger | No |
| iPhone Mirroring + computer-use | Yes, UK | Window grabs | Unmeasured | Clicks, drags, typing | No |
| QuickTime / ffmpeg | Yes, cable | Frames from video | H.264, rate unmeasured | No | No |
| `idevicescreenshot` | No (iOS 17+) | No | No | No | No |
| Accessibility Inspector | Undocumented | No | No | Inspector only | Yes, GUI |
| Orca emulator | Simulators only | Yes | 60 fps stream | Full | Yes |
| iOS app on Mac | Not offered | | | | |

## Recommendation, ranked

1. **WebDriverAgent for control and the tree, `devicectl` for pixels.** The agent drives the app
   through Appium (launch by bundle ID, navigate, dump `mobile: source` for each screen) and, for a
   transition it wants to time, starts `devicectl device capture screen-record --codec hevc`
   around the gesture it sends, then reads the file with `ffprobe` and the bookmark skill's
   burst view. Stills come from `devicectl device capture screenshot` at the full 1320 x 2868.
   XCTest's own recorder at `fps: 60` is the fallback recorder and the cross-check.
2. **QuickTime/ffmpeg over a cable,** only if the first `devicectl` recording shows dropped or
   uneven frames.
3. **iPhone Mirroring with computer-use,** only for navigation if WDA will not sign.
4. **Device Hub and Accessibility Inspector** for Jacob's own spot checks by eye.
5. Not usable: `idevicescreenshot`, the simulator for App Store apps, the Mac App Store copies,
   Switch or Voice Control. (The iPhone app is not offered on the Mac; the separate Mac app is its
   own design, recorded on the Mac for CC-36's Mac part.)

**First thing to measure:** one 5 s `devicectl` recording of a Brink swipe, then `ffprobe` for
`r_frame_rate`, `avg_frame_rate` and per-frame timestamps. If it holds 60 or 120 fps with even
spacing, route 1 answers the timing question and everything else is only navigation.

## Jacob's one-time checklist

- [x] Pair the iPhone with this Mac and trust it (done: `paired`, measured).
- [x] Developer Mode on (done: `enabled`, measured).
- [x] Install Brink and MD Vinyl from the App Store (done 30 Sep).
- [ ] Sign in to [untitled] (already installed).
- [x] Settings -> Developer -> Enable UI Automation: on (done 30 Sep).
- [ ] Settings -> Accessibility -> Zoom: off.
- [ ] Settings -> Display & Brightness -> Auto-Lock: Never for a session, and Focus on to stop
      notifications appearing in recordings; keep the phone unlocked on the desk and on charge.
- [x] Give the agent his Team ID (developer.apple.com -> Membership) (done 30 Sep).
- [x] Approve installing Appium and the XCUITest driver on this Mac; the agent signs and builds
      WDA (6 Oct 2026: free tools are pre-approved; Appium 3.8.0, xcuitest 12.15.0 and mac2 4.3.6
      are installed).
- [ ] When WDA first installs, approve anything the phone asks (trusting the developer app).
- [ ] Optional: a USB-C cable, for the QuickTime fallback and a steadier link than Wi-Fi.
- [ ] Optional: open iPhone Mirroring once and approve it, as the navigation fallback.

## Claims not sourced

- The frame rate of `devicectl device capture screen-record`, whether it captures ProMotion's
  120 Hz, and whether it differs over Wi-Fi and cable: its help gives no rate and the phone was not
  touched. Measure with `ffprobe` on the first recording.
- That `devicectl capture` and `devicectl process launch` work on a third-party App Store app:
  both are display- and bundle-ID-level commands with no stated restriction, but neither was run.
  Apple's DRM note on iPhone Mirroring suggests protected video may record black.
- The frame spacing of XCTest's native recorder at `fps: 60` on a real device: Appium documents the
  parameter, not the result.
- Whether `screencapture` or ScreenCaptureKit can record the iPhone Mirroring window, and at what
  rate and resolution the Mirroring stream runs: not on Apple's page, not tested.
- That the Device Hub and iPhone Mirroring windows expose no per-element accessibility tree of the
  phone's app to computer-use: expected because they show a video stream, not tested.
- Whether Accessibility Inspector lists third-party App Store apps on a device: not documented, not
  tested.
- That App Store downloads are device-only builds that cannot run in the simulator: consistent with
  `simctl install` taking a built path and with the runtime having no App Store executable, but no
  Apple page stating it was found; the only hits were Apple Developer Forums threads, not used.
- That an `appPlatforms` entry without `"mac"` means the developer opted out of Apple silicon
  availability: inferred from comparison with neighbouring apps on the same pages, not from an
  Apple statement about that field.
- Auto-Lock and Focus in the checklist are practical advice for unattended runs, not from a source;
  the sourced requirement is only "unlock the device before entering `devicectl` commands".
