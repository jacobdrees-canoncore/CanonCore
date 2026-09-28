# Odd codecs decode on the device, and transcoding is optional

Codecs are handled both ways, as Swiftfin does: the server remuxes to HLS and converts audio (DTS and TrueHD are not in Apple's HLS spec) with no video transcode, and the Apple app plays everything else with a built-in software player (VLCKit or MPVKit) on the device, covering VC-1, MPEG-2, VP9, 10-bit H.264, interlaced video and PGS/VobSub. Server transcoding with ffmpeg is a capability each install turns on only where its host allows it, because the first host bans 4K HEVC transcoding and has a "burdening the server" clause on a shared CPU. Text subtitles (SRT, ASS) become WebVTT in the stream on every client, while image subtitles play in the Apple app's on-device player, or are burned in where transcoding is on.

## Considered Options

- Server transcoding as the only path, as in Plex, Jellyfin and Emby: rejected, it fails on a host that forbids it.
- Decoding on the device only, as Infuse does: rejected, the web client cannot.

## Consequences

- Where transcoding is off, a file the browser cannot decode (HEVC in Firefox, image subtitles) shows "open in the app" with the reason, rather than playing.
