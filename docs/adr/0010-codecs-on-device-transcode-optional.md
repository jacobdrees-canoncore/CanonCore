# Odd codecs decode on the device, and transcoding is optional

Codecs are handled both ways, as Swiftfin does: the server remuxes to HLS and converts audio (DTS and TrueHD are not in Apple's HLS spec) with no video transcode, and the Apple app plays everything else with a built-in software player (VLCKit or MPVKit) on the device, covering VC-1, MPEG-2, VP9, 10-bit H.264, interlaced video and PGS/VobSub. Server transcoding with ffmpeg is a capability each install turns on only where its host allows it, because the first host bans 4K HEVC transcoding and has a "burdening the server" clause on a shared CPU. Text subtitles (SRT, ASS) become WebVTT in the stream on every client, while image subtitles play in the Apple app's on-device player, or are burned in where transcoding is on.

## Considered Options

- Server transcoding as the fallback every client leans on, as Plex, Jellyfin and Emby's web and many TV clients do: rejected as the only path, because it fails on a host that forbids it. Their own first-party apps also decode on the device (Swiftfin with VLCKit, Plex HTPC with mpv), which is the half this record keeps.
- Decoding on the device only, as a client app like Infuse leans on: rejected as the only path, because the web client cannot.

## Consequences

- Where transcoding is off, a file the browser cannot decode (one the browser declares it cannot decode through MediaCapabilities, such as HEVC on a machine with no platform decoder, or image subtitles) shows "open in the app" with the reason, rather than playing.
