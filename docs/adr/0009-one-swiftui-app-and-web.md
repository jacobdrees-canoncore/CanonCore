# One SwiftUI app for every Apple device, plus a full web client

The clients are one SwiftUI multiplatform app for Apple TV, iPhone, iPad and Mac (iPad added 2026-09-30, with an adaptive layout of its own; visionOS and watchOS are not clients), playing through AVPlayer, and a full web client with playback from the start, and each of them browses, plays and curates ("all need all") against one API whose typed contract is checked in CI. The first criterion is the best access on Mac, iPhone, Apple TV and the web, so curation on Apple TV gets a design made for a remote rather than being left to another client. Every medium plays on every client (video, audio, an ebook reader and a comic reader), phased video first, with one exception: ebooks are not read on Apple TV, which has no web view for the reader and suits reading poorly; comics are.

## Considered Options

- A Jellyfin-compatible adapter, so existing Jellyfin clients (Infuse, Swiftfin) could connect: rejected because Jellyfin is a competitor. CanonCore is its own product: imitating a competitor's API would bind CanonCore's shape to theirs and hand the experience to their ecosystem's apps. Every client speaks CanonCore's own API.
- Some clients as viewers only: rejected, every client does everything.
