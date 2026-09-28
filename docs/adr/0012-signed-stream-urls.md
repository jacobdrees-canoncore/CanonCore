# Streams use short-lived signed URLs, never Account tokens

A client starts a playback session through the API with its normal bearer token, and the server returns an HLS URL signed for that Item, that session and a few hours, with every segment URL carrying the signature, so a leaked URL expires and grants nothing else, and it works the same in AVPlayer, hls.js and AirPlay. This follows CloudFront and Mux signed URLs, and reconciles the no-token-in-URL rule of old ADR-0108 (canoncore-history) with bearer tokens.

## Considered Options

- Account tokens in stream URLs: rejected, though Plex documents passing `?X-Plex-Token=` and Jellyfin reads `api_key` from the query string (both verified 2026-09-28).
- Cookies everywhere: rejected.
