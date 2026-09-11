---
status: proposed
---

# The player is native Swift, and the web client shares no code with the native ones

Direct play only makes client codec coverage load-bearing, and expo-video wraps AVPlayer with no
MKV, no DTS or TrueHD and no PGS subtitles. Streamyfin, the flagship Expo Jellyfin client, wrote 74KB of Swift around MPVKit the day it landed
in January 2026, reaching 144KB by July. At `develop` on 2026-09-09 it carries 537,748 bytes of
Swift and 634,101 of Kotlin.

The web half is settled separately: react-native-web has been frozen since October 2025, Expo
Router's architect left in May 2026, Solito v5 dropped react-native-web entirely, and Expo's own
website runs Next.js.

Related refusals for the same reason: Unistyles, whose podspec is iOS-only and cannot install on
tvOS; and a second Expo app for TV, which drags the phone binary onto the TV fork.

## Evidence

Verified against source on 2026-09-10; corrections applied. Working in `docs/research/verify-adr-jellyfin.md`, `docs/research/verify-adr-products.md`.
