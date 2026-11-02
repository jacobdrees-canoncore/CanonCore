# Odd codecs decode on the device, and transcoding is optional

Codecs are handled both ways: the server remuxes to HLS and converts audio (DTS and TrueHD are not in Apple's HLS spec) with no video transcode, and the Apple app plays everything else with a built-in software player on the device, libvlc (VLCKit's engine, LGPL-2.1, on the App Store as VLC since 2013; verified 2026-09-29) through a Swift wrapper, covering VC-1, MPEG-2, VP9, 10-bit H.264, interlaced video and PGS/VobSub. Server transcoding with ffmpeg is a capability each install turns on only where its host allows it, because the first host bans 4K HEVC transcoding and has a "burdening the server" clause on a shared CPU. Text subtitles (SRT, ASS) become WebVTT in the stream on every client, while image subtitles play in the Apple app's on-device player, or are burned in where transcoding is on.

## Considered Options

- Server transcoding as the fallback every client leans on, as Plex, Jellyfin and Emby's web and many TV clients do: rejected as the only path, because it fails on a host that forbids it. Their own first-party apps also decode on the device (Swiftfin with MPV, Plex HTPC with mpv), which is the half this record keeps.
- Decoding on the device only, as a client app like Infuse leans on: rejected as the only path, because the web client cannot.

## Consequences

- Where transcoding is off, a file the browser cannot decode (one the browser declares it cannot decode through MediaCapabilities, such as HEVC on a machine with no platform decoder, or image subtitles) shows "open in the app" with the reason, rather than playing.
- Swiftfin offers two player engines, MPV and AVPlayer, with MPV the default (github.com/jellyfin/Swiftfin, `Documentation/players.md`, read 2 Nov 2026); it no longer plays through VLCKit. Which engine the Apple app plays through, on-device decoding or AVPlayer plus a server remux, is reopened at Play Rose's grill (CC-2), with image subtitles on the web (the Owner, 2 Nov 2026).
