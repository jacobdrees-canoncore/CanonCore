Observed 11 Oct 2026 on Plex Media Server 1.43.4.10903-e5521bd8c (API version 1.2.3, bundled Plex Web 4.160.0), macOS 27.0.1, REA 6.4.0 (`npx -y rea-agents@latest`), with curl 8.7.1, mitmproxy 12.2.3, Python 3.14 and ffmpeg 8.1.2.

# Plex Media Server's API, from outside

This note records what Plex Media Server's HTTP API does when it is called from outside, and what Plex says about it. It was written for CC-287, the first ticket of the Plex sweep (ADR 0024). It describes behaviour in CanonCore's own words. No Plex payload, file or code is copied here, and every capture stayed outside the repository.

Each claim carries its evidence:

- **observed**: seen in a request made to this server or to plex.tv on the date above, or read from the static JavaScript of the Plex Web build bundled with this server.
- **documented**: stated by Plex, with the URL given.
- **disassembled**: not used in this note. Native analysis belongs to CC-292.

## Sources

- **Plex's own API reference**: <https://developer.plex.tv/pms/>. This is the first-party source. The page embeds an OpenAPI 3.1 document titled "Plex Media Server", version 1.2.3, which lists 207 paths (260 operations) in 24 tags. Its introduction covers headers, auth, keys, pagination, versioning (`X-Plex-Pms-Api-Version`, where 1.0.0 was the public release with PMS 1.41.9 and 1.2.3 needs PMS 1.43.4) and two ways of signing in: JWT, which it recommends, and the older token. Below, "documented" with no other URL means this reference.
- **plexapi.dev**: a community site that describes itself as "community-driven", with docs in the `plex-mintlify-docs` repository. It is not first-party and is not cited as Plex here.
- **Plex support articles**: [Finding an authentication token / X-Plex-Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) and [Webhooks](https://support.plex.tv/articles/115002267687-webhooks/).
- **Plex's Docker image**: [plexinc/pms-docker](https://github.com/plexinc/pms-docker). Its README and `root/etc/cont-init.d/40-plex-first-run` script document how the image claims a server without a browser.
- **Observation**: about 300 requests made with curl and Python against `127.0.0.1:32400`, the LAN address, `plex.tv` and `clients.plex.tv`. 102 of them went through mitmdump, which ran as a reverse proxy on `127.0.0.1:32499` in front of the server and saved a HAR. Event streams went straight to the server, because mitmdump buffers a streamed body.
- **Plex Web bundle**: the static JavaScript in the app bundle's `WebClient.bundle` (Plex Web 4.160.0), read only to list the endpoints and `X-Plex-*` names a client uses. It contains 244 path literals and 32 `X-Plex-*` names. Plex Web in depth belongs to CC-289.

### REA and the capture

REA 6.4.0 reads captures. Its `inspect-web-network-capture <path> har|mitmproxy` command takes a HAR or mitmproxy's native flow file, never fetches the recorded URLs, and returns a normalised record for each request (method, URL, headers, status, timings). REA read the 102-entry HAR into 102 records (observed). It does not treat `X-Plex-Token` as a credential on its own: it only redacts the header named `Authorization` and cookies ("transport-credential", 8 redactions here). The token was hidden only because it was passed as `--sensitive-value`, which redacted 99 values, including the two URLs that carried it in their query. **Later tickets must always pass the token as `--sensitive-value`.** REA needed no Ghidra for this, so none was configured.

## How Plex's API is shaped (observed, documented)

- **Encoding.** Every response is a `MediaContainer` with attributes. XML is the default and JSON is returned for `Accept: application/json` (documented, observed). In JSON, child elements become arrays named after the element, such as `Directory`, `Metadata`, `Hub`, `Setting`, `Account`, `Device` and `MediaProvider`. A few roots are not `MediaContainer`: `/butler` returns `ButlerTasks` and `/myplex/account` returns `MyPlex` (observed). `/system` answers in XML even when JSON is asked for (observed).
- **Keys.** Items carry a `key` that resolves like a relative URL against the path that returned it. Walking keys from `/` is how a client finds the API (documented, observed). Plex warns that a path found only by walking keys is not part of the contract (documented).
- **Media providers.** `GET /media/providers` lists each provider with its `Feature` list, and every feature names the path that serves it. The library provider `com.plexapp.plugins.library` offers content (`/library/sections`, `/hubs`), search (`/hubs/search`), match, metadata (`/library/metadata`), rate (`/:/rate`), image transcoding (`/photo/:/transcode`), promoted, continue watching, actions, playlists, play queues, collections, timeline (`/:/timeline`), manage, query parser, subscribe and universal search (`/library/search`), with protocols `stream,download` (observed). Plex asks clients to read paths from here and not hard-code them (documented).
- **Paging.** Paging uses the `X-Plex-Container-Start` and `X-Plex-Container-Size` request headers. Responses carry `X-Plex-Container-Start` and `X-Plex-Container-Total-Size` (observed on `/library/sections/1/all`), and the body carries `offset`, `size` and `totalSize`. `X-Plex-Container-Focus-Key` centres a page on an item, `limit` caps a query, and some endpoints force paging (documented).
- **Trimming.** `includeFields`, `excludeFields`, `includeElements`, `excludeElements`, `includeOptionalFields` and `includeOptionalElements` trim or extend a response (documented).
- **Media queries.** Lists such as `/library/sections/{id}/all` and `/library/all` take a query-string filter language with typed operators. Dates are epoch seconds and also accept relative values such as `-1h` (documented). `GET /library/all?type=1&updatedAt>>=<epoch>` returned only the items changed after that time (observed), so a changed-since fetch exists.
- **Every response** carries the header `X-Plex-Protocol: 1.0` (observed).
- **Units.** Times are in milliseconds (`duration`, `viewOffset`, and `time` on `/:/timeline`) and dates are epoch seconds (`addedAt`, `updatedAt`) (observed, and documented for `/:/timeline`'s `time` and `duration`).

## Endpoints

In the tables, "Doc" means listed in Plex's OpenAPI reference, and "obs" means observed only. A status in brackets was observed with an account or server token unless it says otherwise.

### Server identity and directory

| Method | Path | Parameters | Response shape | Doc |
|---|---|---|---|---|
| GET | `/identity` | none | `MediaContainer` with `claimed`, `machineIdentifier`, `version`, `apiVersion`, and `startState` while starting. **Needs no token** (200 unauthenticated). | Doc |
| GET | `/` | none | Server capabilities as attributes (`friendlyName`, `machineIdentifier`, `myPlex`, `myPlexSigninState`, `myPlexMappingState`, `myPlexSubscription`, `myPlexUsername`, `ownerFeatures`, `eventStream`, `hubSearch`, `mediaProviders`, `transcoder*`, `platform`, `version`, and more), plus 25 `Directory` children whose keys are: actions, activities, butler, channels, clients, devices, diagnostics, downloadQueue, hubs, library, livetv, media, neighborhood, playQueues, playlists, resources, search, server, servers, service, statistics, system, transcode, updater, user. | Doc |
| GET | `/servers`, `/server` | none | One `Server` (`name`, `host`, `address`, `port`, `machineIdentifier`, `version`). | obs |
| GET | `/media/providers` | none | Root attributes plus `MediaProvider` (`identifier`, `title`, `types`, `protocols`, `Feature[]`). | Doc |
| GET | `/system` | none | XML, with two `Directory` entries and a `com.plexapp.system` cookie. | obs |

All ten `/service/*` keys that the root lists (browse, clustering, codecs, defaultLibraries, iva, lyricfind, songkick, thetvdb, tmdb, ultrablur) returned 404 when fetched, and so did `/server/servers` (observed).

### Library

| Method | Path | Parameters | Response shape | Doc |
|---|---|---|---|---|
| GET | `/library` | none | Three `Directory` entries (sections, recentlyAdded, onDeck). | obs |
| GET | `/library/sections` and `/library/sections/all` | none | `Directory` per section: `key`, `type`, `title`, `agent`, `scanner`, `language`, `uuid`, `scannedAt`, `refreshing`, `Location[]` (`id`, `path`). The bare path is not in the reference; `/all` is. | Doc (`/all`) |
| POST | `/library/sections` | `name`, `type`, `agent`, `scanner`, `language`, `location` | 201, with `Location` header `/library/sections/{id}` and the new section. The reference lists the method under `/library/sections/all`. | Doc (`/all`) |
| GET | `/library/sections/{id}` | `includeDetails=1` | 20 `Directory` browse pivots (all, unwatched, newest, by genre and so on). With `includeDetails`, it adds `Type` entries carrying `Filter`, `Sort` and `Field` lists. | Doc |
| GET | `/library/sections/{id}/all` | media query, paging | `Metadata[]` with `Media[]`, `Part[]` and `Image[]`. | Doc |
| GET | `/library/all` | media query (`type`, field operators) | The same, across sections. | Doc |
| GET | `/library/recentlyAdded`, `/library/onDeck` | none | `Metadata[]`. | obs |
| POST | `/library/sections/{id}/refresh` | `force` | 200, then scan activity on the event stream. | Doc |
| DELETE | `/library/sections/{id}`, plus `analyze`, `emptyTrash`, `prefs`, `filters`, `sorts`, `firstCharacters`, `collections`, `location` and more | | Listed in the reference; not exercised. | Doc |

### Metadata

| Method | Path | Parameters | Response shape | Doc |
|---|---|---|---|---|
| GET | `/library/metadata/{ratingKey}` | `checkFiles`, `includeChapters`, `includeMarkers`, `includeExtras`, `includeOnDeck`, `includeRelated`, `asyncAugmentMetadata` | One `Metadata` (`ratingKey`, `key`, `guid`, `type`, `title`, `year`, `duration`, `viewOffset`, `viewCount`, `lastViewedAt`, `addedAt`, `updatedAt`, `thumb`, `art`), then `Media` (`id`, `duration`, `bitrate`, `width`, `height`, `container`, `videoCodec`, `audioCodec`, `audioChannels`, `videoResolution`, `optimizedForStreaming`), then `Part` (`id`, `key`, `file`, `size`, `duration`, `container`, plus `accessible` and `exists` with `checkFiles`), then `Stream` (`streamType` 1 video, 2 audio, 3 subtitle; `codec`, `index`, `bitrate`, `default`, `selected`, `displayTitle`, and so on). **Part has no hash field here.** | Doc |
| GET | `/library/metadata/{ratingKey}/tree` | none | A tree of `MetadataItem`, `MediaItem` and `MediaPart` entries, where **`MediaPart` carries `hash` (40 hex characters) and `openSubtitleHash` (16 hex characters)** as well as `file`, `size` and `duration`. | Doc (the reference's example shows both fields) |
| GET | `/library/metadata/{id}/children`, `/grandchildren`, `/allLeaves`, `/related`, `/similar`, `/extras`, `/nearest`, `/users/top`; PUT `match`, `unmatch`, `refresh`, `analyze`, `split`, `merge`, `prefs`; POST and DELETE `marker` | | Listed in the reference; not exercised beyond the first row. | Doc |
| GET | `/library/metadata/{id}/thumb/{ts}`, `/art/{ts}` | | Images. | Doc (as `/{element}/{timestamp}`) |
| GET | `/library/metadata/{id}/userState` | | 404 on this server, although Plex Web references it. | obs |
| POST | `/library/file` | `url`, `computeHashes` | Plex describes `computeHashes` as "Whether or not to compute Plex and OpenSubtitle hashes for the file". Not exercised. | Doc |

### Hubs and search (the per-screen surface)

| Method | Path | Parameters | Response shape | Doc |
|---|---|---|---|---|
| GET | `/hubs` | `count`, `onlyTransient`, `identifier` | 8 `Hub` entries (`key`, `hubKey`, `title`, `type`, `hubIdentifier`, `context`, `size`, `more`, `style`, `promoted`), each holding a few `Metadata`. | Doc |
| GET | `/hubs/promoted`, `/hubs/continueWatching`, `/hubs/sections/{id}`, `/hubs/metadata/{id}/related`, `/hubs/metadata/{id}/postplay`, `/hubs/items` | | `Hub[]`. A section returned five hubs, the first being Continue Watching, and each hub's `key` points to its own items list. | Doc |
| GET | `/hubs/home/continueWatching`, `/hubs/home/onDeck` | | `Hub` lists. | obs |
| GET | `/hubs/search` | `query`, `limit`, `sectionId` | 17 `Hub` entries, one per result type (movie, show, person and so on), whose `Metadata` carries a `score`. | Doc |
| GET | `/search` | `query` | Flat `Metadata[]`. Returns 400 with no query. | obs |

### Playback: streams, transcode, timeline, scrobble

| Method | Path | Parameters | Response shape | Doc |
|---|---|---|---|---|
| GET | `/library/parts/{partId}/{changestamp}/file.{ext}` | `download` | The original file, `Accept-Ranges: bytes`, 206 for a range. 401 with no token; 200 with the token as header **or** as `?X-Plex-Token=`. | Doc |
| GET | `/{video,music,photo}/:/transcode/universal/decision` | `path=/library/metadata/{id}`, `mediaIndex`, `partIndex`, `protocol` (`hls`, `dash`, `http`), `directPlay`, `directStream`, `directStreamAudio`, `videoQuality`, `videoBitrate`, `videoResolution`, `offset` (seconds), `session`, `subtitles`, and more | `MediaContainer` carrying `generalDecisionCode` and `Text`, `directPlayDecisionCode` and `Text`, `transcodeDecisionCode` and `Text`, and `resourceSession`, with the chosen `Metadata`, `Media`, `Part` (`decision`) and `Stream`. **Needs a client profile**: the server picks a profile from `X-Plex-Platform` and `X-Plex-Product`, or from `X-Plex-Client-Profile-Name`. With an unknown platform it returned 400 and logged "unable to find a matching profile". With `Generic` it decided "no conversion profile". With platform `Chrome` it decided "Direct play not available; Conversion OK". Codes seen: 1001, 2000, 3000 and 4005. | Doc |
| GET | `/video/:/transcode/universal/start.m3u8` | the same as decision | An HLS master playlist (`application/vnd.apple.mpegurl`) with one variant at the relative URL `session/{session}/base/index.m3u8`. 403 with no token. | Doc (`start.*`) |
| GET | `/video/:/transcode/universal/session/{session}/base/index.m3u8` and `.../{n}.ts` | none | The media playlist and MPEG-TS segments. **Served with no token at all**, from loopback and from the LAN address; an unknown session id returns 404. Segment URLs in the playlist are bare relative names (`00000.ts`) with no query string. | obs |
| GET | `/video/:/transcode/universal/stop` | `session` | 200. | obs (Plex Web uses it) |
| GET | `/transcode/sessions` | none | `TranscodeSession` (`key` is the session id, plus `videoDecision`, `audioDecision`, `protocol`, `container`, `progress`, `speed`, `complete`, and so on). | obs |
| POST | `/:/timeline` | `ratingKey`, `key`, `state` (`playing`, `paused`, `stopped`, `buffering`), `time` (ms), `duration` (ms), `playQueueItemID`, `continuing`, `offline`, `updated`, buffer and bandwidth hints; headers `X-Plex-Client-Identifier` (required) and `X-Plex-Session-Identifier` | `MediaContainer` with `playbackState`, `viewOffset`, `viewCount` and `skipCount`. Plex says to send it on every state change and otherwise about every 10 s on a LAN or WAN and every 20 s on cellular (documented). On a 6 s stub it answered `playbackState=ignore`, and the offset was not stored on the item (observed). | Doc |
| GET | `/status/sessions` | none | Live sessions as `Metadata` carrying `viewOffset` (the last `time` reported, in ms), `sessionKey`, `User` (`id`, `title`, `thumb`) and `Player` (`machineIdentifier` is the client's `X-Plex-Client-Identifier`, plus `product`, `platform`, `title`, `version`, `profile`, `state`, `address`, `local`, `relayed`, `secure`). | Doc |
| GET | `/status/sessions/history/all`, `/status/sessions/background`; POST `/status/sessions/terminate` | | `Metadata[]` of history, and background tasks. | Doc |
| PUT (GET also works) | `/:/scrobble`, `/:/unscrobble` | `identifier=com.plexapp.plugins.library`, `key` (ratingKey) or `uri` | Empty 200; `viewCount` goes up, as checked afterwards. | Doc |
| GET | `/:/progress` | `key`, `identifier`, `time`, `state` | Empty 200. | obs (an older progress call, not in the reference) |
| PUT | `/:/rate` | `identifier`, `key`, `rating` | Not exercised. | Doc |
| POST, GET, PUT, DELETE | `/playQueues`, `/playQueues/{id}`, `/playlists`, `/playlists/{id}/items` | | Empty lists on this server. | Doc |
| GET | `/library/parts/{partId}/indexes/{index}` and `/{offset}` | | BIF trick-play thumbnails. Not exercised. | Doc |
| GET | `/photo/:/transcode` | `url`, `width`, `height`, and more | Image resize. Not exercised. | Doc |
| GET, POST | `/downloadQueue...` | | The server-side download queue for offline copies. Empty here. | Doc |
| GET | `/clients/profiles` | none | 78 `Profile` entries (the bundled client profiles). | obs |

### Users: server-side accounts, and plex.tv

Server side:

| Method | Path | Response | Doc |
|---|---|---|---|
| GET | `/accounts`, `/accounts/{id}` | `Account` (`id`, `key`, `name`, `defaultAudioLanguage`, `defaultSubtitleLanguage`, `subtitleMode`, `autoSelectAudio`, `thumb`). There are 2 here, the owner (id 1) and one more. | obs |
| GET | `/devices` | `Device` (`id`, `name`, `platform`, `clientIdentifier`, `createdAt`), growing as clients call in. | obs |
| GET | `/clients` | Advertised players. Empty here. | obs |
| GET | `/myplex/account` | `MyPlex` (`username`, `signInState`, `mappingState`, `mappingError`, `subscriptionActive`, `subscriptionState`, `subscriptionFeatures`, public and private address and port). | obs |
| DELETE | `/myplex/account` | Signs the server out of plex.tv, after which `/identity` shows `claimed=false`. | obs |
| POST | `/myplex/claim?token=claim-…` | Claims the server (see "How to reach this server" below). Returns `MyPlex`. | obs (Plex Web uses it) |
| GET | `/statistics/bandwidth`, `/statistics/media`, `/statistics/resources` | Empty `MediaContainer`s here. | obs |

plex.tv side (`plex.tv` and `clients.plex.tv` answered the same; observed unless marked):

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v2/users/signin` | Form fields `login` and `password`, with `X-Plex-Client-Identifier` and `X-Plex-Product`. Returns 201 with the user object, whose `authToken` is a 20-character legacy token, not a JWT, and `subscription` (`active`, `status`, `plan`, `features[]`), `roles`, `home`, `homeAdmin`, `uuid`, `username`. Not in the PMS reference. Plex Web uses it. |
| GET | `/api/v2/user` | The same user object. 200 for a valid token and 401 for an invalid one (documented, under "Traditional Token Authentication"). |
| POST | `/api/v2/pins` (`strong=true`) | Creates a PIN: 201 with `id`, `code`, `expiresIn`, `expiresAt`, `authToken` (null), `qr`, `trusted`, and a `location` block with the caller's geo-IP. A strong PIN had a 25-character code and lasted 1800 s. A plain PIN had a 4-character code and lasted 900 s (observed). Plex documents the flow: send the user's browser to `https://app.plex.tv/auth#?clientID=…&code=…&context[device][product]=…&forwardUrl=…`, or for a 4-character PIN to `https://plex.tv/link/?pin=…`, then poll about once a second (documented). The JWT variant posts a public key (`jwk`) with the PIN and reads the token with `?deviceJWT=` (documented). |
| GET | `/api/v2/pins/{id}` | Polling returned `authToken: null` until approved. **Approval needs a signed-in browser**, so it was not completed here. |
| GET | `/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1` | One entry per device: `name`, `product`, `clientIdentifier`, `provides`, `owned`, `home`, `presence`, `publicAddress`, `httpsRequired`, `dnsRebindingProtection`, **`accessToken`**, and `connections[]` (`protocol`, `address`, `port`, `uri` on `*.plex.direct`, `local`, `relay`, `IPv6`) (documented, observed). **For an owned server, `accessToken` equalled the account token** (observed). |
| GET | `/api/v2/home`, `/api/v2/home/users` | The Home and its users (`id`, `uuid`, `title`, `username`, `admin`, `guest`, `restricted`, `restrictionProfile`, `protected`, `hasPassword`). This account is in no Home, so it lists only itself. The older `/api/home/users` returns XML. |
| POST | `/api/v2/home/users/{uuid}/switch` (optional `pin`) | 201 with the switched-to user object and its `authToken`. Switching to the account's own user returned the same token. Switching to a managed or other Home user was not possible, because there is none. Plex Web builds this call as `/api/v2/home/users/` + uuid + `/switch`. |
| GET, POST | `/api/v2/user/webhooks` | The account's webhook list (`[{url}]`). Set with `urls[]=…` (201), and cleared with an empty `urls[]=` (201). |
| GET | `/api/claim/token.json` | `{token: "claim-…"}` (26 characters). |
| POST | `/api/claim/exchange?token=claim-…` | Exchanges a claim token for a server token, sending `X-Plex-Provides: server` and the server's client identifier. Documented by Plex's Docker image script; not called here. |
| Others seen in Plex Web | `/api/v2/shared_servers…`, `/api/v2/shared_sources…`, `/api/v2/sharings/{}`, `/api/v2/friends` (410 here), `/api/v2/home/users/restricted…`, `/api/v2/user/privacy`, `/api/v2/user/two_factor…`, `/api/v2/features`, `/api/v2/devices`, `/api/v2/ping`, `/api/invites/…`, `/api/servers/…` | Listed for CC-4. Only the GETs in this table were made. |

### Settings: prefs, butler, updater, system

| Method | Path | Response | Doc |
|---|---|---|---|
| GET | `/:/prefs` | 181 `Setting` entries (`id`, `label`, `summary`, `type`, `default`, `value`, `hidden`, `advanced`, `group`, `enumValues`). Includes `allowedNetworks` ("List of IP addresses and networks that are allowed without auth", empty by default), `secureConnections` (default 1, preferred), `WebHooksEnabled` (default on), `PushNotificationsEnabled`, `customConnections`, `LanNetworksBandwidth` and `TreatWanIpAsLocal`. | Doc |
| GET | `/:/prefs/get?id=…` | One `Setting`. | Doc |
| PUT | `/:/prefs?{id}={value}` | Not exercised. | Doc |
| GET, POST, DELETE | `/butler`, `/butler/{task}` | `ButlerTasks` holding 23 `ButlerTask` entries (`name`, `title`, `description`, `interval`, `enabled`, `scheduleRandomized`). | Doc |
| GET, PUT | `/updater/status`, `/updater/check`, `/updater/apply` | Status attributes (`canInstall`, `checkedAt`, `status`, `autoUpdateVersion`). | Doc |
| GET | `/diagnostics`, `/diagnostics/logs`, `/diagnostics/databases` | Directory, plus log and database downloads (not fetched). | obs |
| PUT, POST | `/log` | Writes a line to the server log. | Doc |

### Events: notifications, activities, webhooks

| Method | Path | Behaviour | Doc |
|---|---|---|---|
| GET | `/:/eventsource/notifications` | Server-Sent Events (`text/event-stream`, chunked, `Keep-Alive: timeout=20`). Named events seen: `activity` (`ActivityNotification`: `event` started, updated or ended, `uuid`, and `Activity` with `type`, `title`, `progress`, `cancellable`, `userID`), `timeline` (`TimelineEntry`: `itemID`, `sectionID`, `type`, `state`, `metadataState` going queued, loading, matching, processing, `updatedAt`), `progress`, `status` and `ping`. A `filter` parameter opts event types in or out, and log events are off by default (documented). | Doc |
| GET (WebSocket) | `/:/websockets/notifications` | Upgrades to WebSocket (101) with the token as a header **or** `?X-Plex-Token=`, and returns 401 without one. Each frame is JSON `NotificationContainer` with `type` (activity, progress, status, timeline) and the same child objects as above. **Plex's reference documents the path as `/:/websocket/notifications` (singular), which returns 404 on this server.** Plex Web uses the plural path and attaches the token to the URL. | obs; the documented path is wrong |
| GET, DELETE | `/activities`, `/activities/{uuid}` | Running activities. Plex says replies that start one carry an `X-Plex-Activity` header with its uuid (documented). Not seen on a section refresh (observed). | Doc |
| Webhooks | account setting on plex.tv (`/api/v2/user/webhooks`) | Plex Pass only, per account; the server sends them, not plex.tv (documented in the support article). Observed: after the URL list changed, plex.tv pushed a `notifyWebhooks` message to the server over its pubsub connection. The server re-read the list from `servers.plex.tv/api/v2/server/webhooks` and then POSTed `multipart/form-data` to a receiver on `127.0.0.1`, with user agent `PlexMediaServer/<version>` and one part named `payload` holding JSON with `event`, `user`, `owner`, `Account`, `Server`, `Player` and `Metadata`. Only `media.scrobble` arrived. Timeline-driven play, pause and stop on the 6 s stub produced no `media.play`, `media.pause` or `media.stop`. The hook was removed afterwards. | Documented and observed |

## X-Plex-* headers

Plex documents that "all `X-Plex-` headers can also be sent as query string arguments" (documented, in the reference's Headers section). This was confirmed for identity headers: with values sent only in the query, the session's `Player` showed exactly the `X-Plex-Client-Identifier`, `X-Plex-Product`, `X-Plex-Platform`, `X-Plex-Device-Name` and `X-Plex-Version` that were sent (observed). When the same name is sent both as a header and in the query, the header won (observed). Header names are case-insensitive (`x-plex-token` worked as a header), but **the query parameter name is case-sensitive**: `?x-plex-token=` returned 401 (observed). Non-ASCII values need care: the server logged "invalid 'X-Plex-Device-Name' header value" for a name containing a curly apostrophe (observed), and Plex advises UTF-8 (documented).

| Header | What it does | Evidence |
|---|---|---|
| `X-Plex-Client-Identifier` | A stable id for one client install. It becomes `Player.machineIdentifier`, keys `/devices`, identifies a PIN's client and is required on timeline and transcode calls. | Doc, obs |
| `X-Plex-Token` | Authentication (see Tokens). | Doc, obs |
| `X-Plex-Product`, `X-Plex-Version` | App name and version. The product name appears in the user's authorised devices. Together with the platform it selects the transcode profile. | Doc, obs |
| `X-Plex-Platform`, `X-Plex-Platform-Version` | Client platform. It selects the client profile: `Chrome` maps to the bundled `Chrome.xml` and the `Web` profile, and an unknown value fails the decision. | Doc, obs |
| `X-Plex-Device`, `X-Plex-Model`, `X-Plex-Device-Vendor` | Device descriptors, also used in profile matching. | Doc, obs (in the server log) |
| `X-Plex-Device-Name` | A friendly name. It becomes `Player.title`. | Doc, obs |
| `X-Plex-Marketplace` | App store of origin. | Doc |
| `X-Plex-Session-Identifier` | One playback session per client, for clients that play several items at once. Used on timeline and transcode. | Doc |
| `X-Plex-Client-Profile-Name`, `X-Plex-Client-Profile-Extra` | Force a built-in profile such as `Generic`, or add profile augmentations (extra direct-play or transcode targets and limits). | Doc, obs |
| `X-Plex-Container-Start`, `-Size`, `-Focus-Key`, `-Total-Size` | Paging. | Doc, obs |
| `X-Plex-Pms-Api-Version` | Requests a published API version. Without it, the server assumes 0.0. | Doc |
| `X-Plex-Language`, `X-Plex-Country` | Localisation, and the country used for certifications and release dates (documented for metadata providers). | Doc |
| `X-Plex-Activity` | Response header carrying the uuid of the activity a request started. | Doc |
| `X-Plex-Protocol` | Response header, always `1.0`. | obs |
| `X-Plex-Provides` | What a device offers (`server`, `player`, and so on). Plex's Docker script sends `server` on the claim exchange, and plex.tv's resources echo it as `provides`. Plex Web does not send it. | Documented (pms-docker), obs |
| Also in Plex Web 4.160.0 | `X-Plex-Features`, `X-Plex-Drm`, `X-Plex-Text-Format`, `X-Plex-Chunked`, `X-Plex-Incomplete-Segments`, `X-Plex-Playback-Session-Id`, `X-Plex-Playback-Id`, `X-Plex-Session-Id`, `X-Plex-Restriction-Profile`, `X-Plex-Target-Client-Identifier` (remote control), `X-Plex-Account-ID`, `X-Plex-Username`, `X-Plex-Device-Screen-Resolution`, `X-Plex-Provider-Version`, `X-Plex-Neuter-Redirect`, `X-Plex-Row`. What each one does is CC-289's. | obs (names only) |

## Tokens

**How a token is obtained:**

1. **Password sign-in.** `POST plex.tv/api/v2/users/signin` returns the account token (`authToken`, 20 characters, legacy). It worked for this account, which was created through Google but has a password (`hasPassword: true`) (observed). This call is not in the PMS reference.
2. **PIN flow.** Create a PIN, send the user to app.plex.tv/auth or plex.tv/link, then poll the PIN until `authToken` is filled (documented). Creating and polling a PIN worked browserless. Completing it needs a person in a signed-in browser (observed).
3. **JWT.** Plex now recommends Ed25519 device keys. A client registers a JWK, either with a PIN or with an existing token at `/api/v2/auth/jwk`, then trades a signed nonce at `/api/v2/auth/nonce` and `/api/v2/auth/token` for a 7-day JWT, which is sent in `X-Plex-Token` exactly like the old token. Registering a key expires the legacy token (documented). Not exercised.
4. **Server access token.** `GET clients.plex.tv/api/v2/resources` returns `accessToken` per server (documented). For the owner's own server it equals the account token (observed). For shared servers it would differ; that is not observable with one account.
5. **Transient token.** `POST /security/token?type=delegation&scope=all` on the server (GET also works) returns a 46-character token prefixed `transient-` (observed). Plex says it carries the same access as the caller's token, lasts up to 48 hours and dies when the server restarts (documented). Observed: it opened owner-only endpoints (`/:/prefs`, `/accounts`, `/status/sessions`) by header or query, but **plex.tv rejected it (401)** and it **could not mint another transient token (403)**. Without `type` and `scope` the call returned 400.
6. **Claim token.** `GET plex.tv/api/claim/token.json` returns a short-lived `claim-…` token that binds a server to the account (see "How to reach this server").
7. **Local admin token.** The server writes `.LocalAdminToken` (mode 600) in `~/Library/Application Support/Plex Media Server/`. Its value opens the server locally, for example `/library/sections` returns 200, and it is what the claim below needed (observed).

**How a token is sent.** On the server and on plex.tv alike, the token works as the `X-Plex-Token` header **and** as the `?X-Plex-Token=` query parameter (observed: `/library/sections`, `/:/prefs`, part URLs, WebSocket, and `plex.tv` and `clients.plex.tv` `/api/v2/user`, all 200 both ways). `Authorization: Bearer` is **not** accepted (401). The server itself calls plex.tv with `?X-Plex-Token=` and `?auth_token=` in the query, as its own log shows with the values masked (observed).

**What an unauthenticated request gets.** Every path except `/identity` (200) and the `/web` client files returns 401, from loopback and from the LAN address alike, even on an unclaimed server (observed). Starting a transcode returns 403. Unauthenticated LAN access exists only if `allowedNetworks` lists the network, and it is empty by default (observed).

**What stream URLs carry.** A direct file URL (`/library/parts/{id}/{changestamp}/file.ext`) needs the token, and players carry it in the query: Plex Web builds download, image and WebSocket URLs by joining `X-Plex-Token` into the query string (observed in the Plex Web bundle). For HLS, `start.m3u8` needs the token, but the media playlist and the segments under `.../session/{session}/...` are served with **no token**: the playlist's segment URLs are bare relative names, and the session id in the path is the only key (observed). An unknown session id returns 404. How long a session stays reachable after `stop` or after it goes idle was not measured.

**Verdict on ADR 0012, "Plex documents passing `?X-Plex-Token=`": confirmed.** Plex documents it twice. The support article says "If you're accessing via a URL, you'll need to pass it as a URL parameter" and shows `?X-Plex-Token=` on `/`, `/library/sections/1` and `/library/metadata/147`. The API reference says every `X-Plex-` header may be sent as a query argument, and it lists `X-Plex-Token` among those headers. The server and plex.tv both accept it (observed). One addition for ADR 0012's reasoning: Plex's HLS segments carry no token and no signature at all. The unguessable session id in the path stands in for both, which is weaker than the signed segment URLs ADR 0012 chooses.

## Verdicts

- **ADR 0012, "Plex documents passing `?X-Plex-Token=`"**: **confirmed**. See Tokens: the support article and the API reference both document it, and it works on the server and on plex.tv.
- **ADR 0014, "Fetching per screen, as Plex and Jellyfin do"**: **unsettled; the API allows both ways**. The API is built for per-screen fetching: `/hubs`, `/hubs/sections/{id}`, `/hubs/promoted`, `/hubs/continueWatching` and `/hubs/metadata/{id}/related` and `/postplay` each serve one screen's shelves, and lists are paged with `X-Plex-Container-*` (documented, observed). Plex's provider guide also tells clients to use `/library/sections/X?includeDetails=1` and the hub keys (documented). But the API also allows a bulk copy: `/library/all` and `/library/sections/{id}/all` return whole sections with paging, and `updatedAt>>=<epoch>` returns only what changed since a time (observed), so the API shape alone does not show that Plex's clients fetch per screen. What Plex's clients actually do is left to CC-289.
- **CC-4, "The device-code flow is user-visible like Plex's"**: **confirmed for the flow's shape**. A client creates a PIN (a 4-character code lasting 15 minutes, or a 25-character strong code lasting 30 minutes), shows the code or a link (`plex.tv/link`, or `app.plex.tv/auth#?clientID=…&code=…`), and polls (observed, documented). The user must approve it in a signed-in browser, which is the user-visible step; it was not completed here.
- **CC-4, "Plex Home user switching endpoints exist"**: **confirmed**. `GET /api/v2/home/users` lists Home users, and `POST /api/v2/home/users/{uuid}/switch` (with `pin` for a protected user) returns that user's token (observed, and used by Plex Web). Neither is in Plex's PMS reference. Switching to another real user was not possible with a one-user account.
- **CC-8, webhooks and notifications**: **confirmed with a scope note**. Webhooks are an account-level, Plex Pass setting (`/api/v2/user/webhooks`) that the server delivers as a multipart POST with a JSON `payload` part (documented, observed for `media.scrobble`). The server exposes two live event streams, SSE at `/:/eventsource/notifications` and WebSocket at `/:/websockets/notifications`, carrying activity, timeline, progress and status events (observed). The WebSocket path in Plex's reference is wrong (singular, 404). The other webhook events (`media.play`, `library.new` and the rest) were not produced on stub media; see Not settled.
- **ADR 0013, "Plex shares one offset in milliseconds (`viewOffset`)"**: **the unit is confirmed; sharing is left to CC-288**. `viewOffset` and `duration` are in milliseconds, and `/:/timeline` takes `time` and `duration` in ms (documented, observed: a reported `time=2000` appeared as `viewOffset=2000` in `/status/sessions`). The `offset` parameter on transcode calls is in seconds (documented). Whether one offset is shared across the versions of an item is CC-288's.
- **ADR 0015, "neither Plex nor Emby documents its file hash"**: **contradicted as worded for Plex, but it holds for the algorithm**. Plex's own reference shows `hash` and `openSubtitleHash` on `MediaPart` in its `/library/metadata/{id}/tree` example, and describes `computeHashes` on `POST /library/file` as computing "Plex and OpenSubtitle hashes" (documented). The server returns both fields on `/tree` (observed: 40 and 16 hex characters), but not on the ordinary `/library/metadata/{id}` Part. Plex documents no algorithm for either. Working out the algorithm is CC-288's and CC-292's. The ADR sentence should go to the Owner, reworded to "documents no algorithm for its file hash".

**Left to later tickets:** sharing of `viewOffset` across versions and Editions, the file hash algorithm, stub-media scanner, matching and webhook-event behaviour (CC-288); Plex Web's own call order, caching and per-screen fetching, and the meaning of the remaining `X-Plex-*` names (CC-289); anything native in the server or apps (CC-292).

## How to reach this server

- **Address**: `http://127.0.0.1:32400` and, on the LAN, `http://192.168.0.109:32400`. plex.tv also advertises an `https://…plex.direct:32400` connection. Secure connections are "preferred", not required.
- **Name**: "Jacob's MacBook Pro" (`friendlyName`, with a curly apostrophe). `machineIdentifier` `1209aee0da285b5a8694378a61879b4b299f426a`. Platform MacOSX 27.0.1.
- **State on 11 Oct 2026**: installed with `brew install --cask plex-media-server` (1.43.4.10903, set to update itself), running, claimed by the agents' Plex account (`myPlexSigninState=ok`, `myPlexMappingState=mapped`, `myPlexSubscription=1`). The account carries Plex Pass: `subscription.active` true, `status` "Canceled", `plan` monthly, `roles` include `plexpass`. It lapses about 11 Nov 2026, after which webhooks stop.
- **Getting a token** (never write it anywhere): source `~/.config/canoncore/plex.env` inside the command, `POST https://plex.tv/api/v2/users/signin` with `login`, `password`, `X-Plex-Client-Identifier` and `X-Plex-Product`, and keep `authToken` in a mode-600 file outside the repository. Then `GET https://clients.plex.tv/api/v2/resources` and take the entry with this `machineIdentifier`. Its `accessToken` is the server token, the same value as the account token for this owned server.
- **How it was claimed.** On first launch (`open -a "Plex Media Server"`), the app's local helper requested `/myplex/launch`. The server redirected that to `app.plex.tv/auth` with its own PIN, which evidently opened the default browser, whose existing plex.tv session approved the PIN; the log shows "got a token from PIN auth" 6 s later. So the first claim was made through a browser the app opened by itself, not through the API. To test a claim without a browser, the server was signed out (`DELETE /myplex/account`) and claimed again:
  1. `GET https://plex.tv/api/claim/token.json` with the account token.
  2. `POST http://127.0.0.1:32400/myplex/claim?token=claim-…` with `X-Plex-Token` set to the value of `~/Library/Application Support/Plex Media Server/.LocalAdminToken`.

  It returned 200, and `/identity` showed `claimed=true`. The same POST with no token, or with the account token, returned 401 while the server was unclaimed. Plex's Docker image takes another route: it trades the claim token at `plex.tv/api/claim/exchange` and writes the result into the server's `PlexOnlineToken` preference before the server starts (documented).

  **Later tickets: a fresh install's first launch will try to open a browser.** Expect it, or claim the server before the app first starts.
- **Test library** (CC-288 owns stub-media behaviour): section 1, "CC287 Stub Movies", type movie, agent `tv.plex.agents.movie`, scanner "Plex Movie", at `/Users/jacobrees/canoncore-scratch/plex-cc287/library/movies/`. It holds two ffmpeg test-pattern files: `Stub One (2001)/Stub One (2001).mp4` (6 s, 640×360 H.264 and AAC, ratingKey 1, part 1) and `Stub Two (2002)/Stub Two (2002).mkv` (8 s, 1280×720 H.264 and AC-3, ratingKey 2, part 2). Both matched only locally (`guid` `local://1` and `local://2`). Stub Two has been scrobbled (`viewCount` 2) and Stub One unscrobbled.
- **Scratch** (never committed): `/Users/jacobrees/canoncore-scratch/plex-cc287/` holds the HAR and mitmproxy flows (`capture/`), REA's output (`rea-har.json`), the extracted OpenAPI document (`pms-openapi.json`) and the probe scripts (`tools/`). The token files there are mode 600.

## Not settled

- **Shared-server and managed-user tokens.** There is only one account, so how a shared or managed user's `accessToken` differs from the owner's, and what such a user may reach, was not observable.
- **JWT sign-in.** The Ed25519 flow was read from Plex's docs, not run, because registering a key would expire the legacy token the other tickets use.
- **Completing a PIN.** It needs a signed-in browser, and this ticket opens none.
- **Webhook events other than `media.scrobble`.** Play, pause, resume, stop and `library.new` did not fire from timeline calls and scans on 6 to 8 s stubs. Whether they need a real streaming session, a longer item or a matched item is CC-288's to find with real stub media.
- **Offset persistence.** `/:/timeline` answered `playbackState=ignore` and stored no `viewOffset` for a 6 s item, so the threshold rules (minimum length, start and end margins) are unknown.
- **Transcode session lifetime.** How long `session/{id}/…` segment URLs stay reachable without a token after stop or idle was not measured.
- **`X-Plex-Activity`.** Documented as a response header, but not seen on a section refresh.
- **Undocumented paths.** `/:/progress`, `/hubs/home/*`, `/library/recentlyAdded`, `/library/onDeck`, `/accounts`, `/devices`, `/clients`, `/servers`, `/myplex/*`, `/transcode/sessions`, `/search` and `/:/websockets/notifications` are observed only. Plex's reference says such paths are not part of its contract.
- **The meaning of most Plex-Web-only `X-Plex-*` names** (CC-289).
