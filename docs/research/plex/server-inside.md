11 Oct 2026. Plex Media Server **1.43.4.10903-e5521bd8c** for macOS (Info.plist `CFBundleVersion` 1.43.4.10903; the copy installed for CC-287 and CC-288), on macOS 27.0.1. REA **6.4.0** (`npx -y rea-agents@latest --version`), with Ghidra **12.1.4** (Homebrew) and OpenJDK 21.0.12.1 as its native provider, pointed at for each command only through `GHIDRA_INSTALL_DIR`, `JAVA_HOME` and a raised `REA_GHIDRA_STARTUP_TIMEOUT_MS` (no `rea setup`, no saved configuration). Also used: `lipo`, `otool`, `nm`, `strings`, `plutil`, Python 3.14.7 (`hashlib`), sqlite3 3.54.0, ffmpeg 8.1.2, curl 8.7.1 and `rg`. No browser was opened and no Plex account was used (ticket CC-292, ADR 0024).

# Plex Media Server, inside the program

This note takes Plex Media Server's own program apart to answer the questions the two outside notes left open: how Plex fingerprints a file, in what order its scanner and matcher decide, and what its transcode decision weighs. It explains in words what [`server-behaviour.md`](server-behaviour.md) (CC-288) and [`server-api.md`](server-api.md) (CC-287) observed. It describes behaviour in CanonCore's words (`GLOSSARY.md`). Where Plex's own term is needed it is given once in code formatting. Plex's Media row is a **Version** here, its metadata item an **Item**, and its Part row a **file row** (CanonCore's Part is something else).

Each claim carries its evidence:

- **disassembled**: read from REA's Ghidra analysis of the arm64 slice of `Plex Media Scanner` or `Plex Media Server`. Both are stripped of symbols, so functions are named by address. Their C++ type names and log strings survive and anchor the reading.
- **observed**: seen with a standard tool in the app bundle (strings, bundled profiles and resources), in the server's own debug log from the CC-288 run, in a read-only copy of its database, or on the local server during this ticket. Where the program was disassembled and the result was also recomputed or seen in the log, both are given.
- **documented**: stated by Plex, with the URL. Nothing new was fetched for this note. Documented claims are cited through the sibling notes.

## How the program was read

- **observed**: `Contents/MacOS` holds `Plex Media Server` (41 MB universal, 21 MB arm64), `Plex Media Scanner` (11 MB universal), `Plex Transcoder`, `Plex Media Fingerprinter` and helpers. All are universal (x86_64 and arm64). The arm64 slices were extracted with `lipo` into scratch. `nm` finds no defined symbols in any of them. `otool -L` shows the server and scanner link OpenSSL 3 (`libcrypto.3`), SQLite, SOCI, Boost, ICU, FFmpeg 60 and TagLib, all from the bundle.
- **observed**: the server and the scanner share most of their library code: the hash routine, the hash-match messages, the merge and playlist messages and the collection settings appear in both. In 1.43.4 an ordinary scan runs inside the server process, whose log carries the scanner's messages under `Native Scanner` stage names. The separate scanner binary is still used for jobs the server starts (such as on-the-fly media analysis).
- **observed**: `Plex Media Fingerprinter` is Chromaprint's `fpcalc` (its class names and usage text). It makes audio fingerprints for music, and is not the file hash.
- **observed**: the interpreted parts of the bundle are the legacy Python 2.7 scanners (`Scanners.bundle`: Plex Movie Scanner, Plex Series Scanner, Plex Music Scanner and others) and the legacy agent bundles. The current Plex Movie scanner is native code. The Python scanners were not needed for any answer below, and none of their text is reproduced.
- **How REA was used.** `rea trace` found the functions that reference a log string. `rea function` and `rea decompile` gave each function's callers, the strings it references and its decompiled form, all kept in scratch and read there. Ghidra's analysis of the scanner took about two minutes and was reused through a snapshot. The server took ten to twenty minutes per query, because its snapshot did not spare re-analysis. That cost is why some server questions below are settled from strings and logs rather than from the code.

## 1. The file hash

### What it is

- **disassembled** (scanner, the routine at `0x1001f3938`; the same routine is in the server): Plex computes two hashes of a file in one pass, which it calls `BogoHash` (C++ type names `BogoHash`, `BogoHashFile` and `BogoHashNetwork`, observed).
  1. It reads the **first 64 KiB** of the file.
  2. If the file is 64 KiB or larger, it also reads the **last 64 KiB** (the 64 KiB ending at the end of the file). For a file between 64 and 128 KiB the two blocks overlap.
  3. For each block it computes a **SHA-1** through OpenSSL (digest `NID_sha1`, 64; resolved through the bundled `libcrypto.3`, observed) and appends the lowercase hex digest to a text string that starts as the **file size written in decimal**.
  4. The Plex hash (`hash` on the file row) is the **SHA-1 of that text**: decimal size, then the first block's hex SHA-1, then the last block's hex SHA-1. The result is 40 hex characters.
  5. In the same pass it adds every 64-bit little-endian word of both blocks to the file size. That 64-bit sum, printed as 16 hex digits, is `open_subtitle_hash`: the public OpenSubtitles hash, as CC-288 found.
- **Files under 64 KiB** take a shortcut. The routine logs "Computing hash for a tiny file, only using first block". It **skips the final SHA-1**, so the stored `hash` is the decimal size followed by the hex SHA-1 of the whole file (44 characters for a 4,167-byte file, not 40). It leaves `open_subtitle_hash` empty.
- **Files the server reaches over HTTP** use the network variant, which reads the same two blocks with range requests. It refuses a host without range support ("BogoHash cannot hash files hosted on servers without range request support", observed string).

### Recomputed

**observed**: a script in scratch implementing the description above reproduced both hashes exactly for every file tried:

| File | Size | Plex hash | OpenSubtitles hash |
|---|---|---|---|
| CC-287's `Stub One (2001).mp4` | 610,665 | matched (40 hex) | matched |
| CC-287's `Stub Two (2002).mkv` | 197,454 | matched (40 hex) | matched |
| A new 2,993,720-byte MKV | 2,993,720 | matched (40 hex) | matched |
| A new 91,086-byte MP4 (blocks overlap) | 91,086 | matched (40 hex) | matched |
| A new 4,167-byte MP4 | 4,167 | matched: "4167" plus 40 hex | empty, as the server stored it |

The first two were compared with the file rows in a read-only copy of CC-288's database. The other three were scanned into a temporary library on the local server, read back from `/library/metadata/{id}/tree` and compared, and the library was then deleted. The server's log printed "Computing hash for a tiny file, only using first block" for the 4,167-byte file. This is why CC-288 found `hash` was not a plain SHA-1 or MD5 of the file, its ends or the two combined with the size: the size enters as decimal text before the two hex digests, and the whole is hashed a second time.

### What it is used for

- **disassembled, observed in the log**: the scanner first checks whether any file row of the same size exists ("Skipping hash check, no size match for … bytes"). Only then does it look the Plex hash up. The file row's `hash`, `size` and `file` columns are indexed (observed by CC-288). The full order is in section 2.
- **observed** (CC-288): the server sends `hash` to a Custom Metadata Provider in every match request. **disassembled** (server, the "Agent Match" function at `0x1004ad0a0`): the match request the server builds for a film carries the parsed title (`name`), `year`, `hash`, the file name relative to the library, the library's country (default "US") and its adult-content setting.
- **observed**: the server binary also contains `computeHashes`, the `POST /library/file` parameter CC-287 found documented as computing "Plex and OpenSubtitle hashes".
- **Not used**: no other fingerprint of the content was found. The hash covers 128 KiB at most, so two files that share their size, their first 64 KiB and their last 64 KiB have the same Plex hash even if their middles differ. CC-288's ffmpeg stubs did exactly this (section 2).

### Is it documented?

- Plex documents that both hashes exist (CC-287: the `MediaPart` example in the API reference and `computeHashes`). It does not document either algorithm (CC-287, CC-288; nothing found to the contrary here). The OpenSubtitles one is a public algorithm. The Plex one is now known from the program.

## 2. Scanning and matching

### The order of decisions for one file

**disassembled** (scanner: the hash-match function at `0x10029b33c` and the matcher at `0x1002e9dcc`; server: the "Agent Match" function) and **observed** in the server's log for every step:

1. **Skip unchanged folders.** A folder is rescanned only if its file count differs from the database, or a file in it changed size or modification time, appeared, or is marked deleted ("Skipping over directory … as nothing has changed"; "Directory had … files, database had … files, can't skip"). Files matching a `.plexignore` rule are skipped (`PlexIgnore` messages).
2. **Stages.** Each changed file runs through four stages, logged as `Local Metadata`, `Agent Match`, `Add to Database` and `Media Analysis`.
3. **Agent Match.** The library's Metadata Agent (an ordered group of providers, CC-288 section 7) is asked to match the file with the request above. The server **takes the first candidate the agent returns** ("found agent match for file … : 'Clue'"), or logs that it found none. No score threshold is applied at this step. Whether the agent itself drops weak candidates was not traced (it is in the provider code or on Plex's service). The NFO agent is handled as a special case in this step.
4. **Path first.** In `Add to Database`, if a Version with this exact path already exists in the library, it is reused ("Path matched, we're reusing media item …").
5. **Otherwise, size then hash.** The file's hashes are computed. If no file row has the same size, the hash check is skipped. If one does, the Plex hash is looked up among the library's file rows.
6. **A hash match, old file gone.** If the matching file row's file no longer exists, or it is the same file under another path (a filesystem equivalence check, which covers case changes and hard links), Plex treats it as a **rename**: "Part rename detected [old] was renamed [new]". It updates the existing file row's path and keeps the Version (same ids).
7. **A hash match, old file still there.** If the old file still exists, the match is a **duplicate**, logged as a warning and "scanned anyway" as a new file. A match on a DVD `.ifo` or `.bup` file is ignored, because DVD structure files repeat.
8. **The hint check.** After a rename, Plex compares the hints it parsed from the new path with the hints stored on the Version (`media_items.hints`). For a film these are the title (accepted at a similarity of 0.9 or more), the year (exact) and the Edition (similarity 1.0, so exact). For an Episode they are the show title (0.9), season, episode, year, air date, a strong show guid and the show's Edition. For one other library type (13) they are the title, year and date. If any differs ("Hint name didn't match ('Relocated' != 'Blade Runner')"), the Version is split from its Item into a new Item. The old Item is destroyed once it has no Versions left, and **playlists are re-pointed** from the old Item to the new one ("Reconnecting item 4 with item 110 in playlists").
9. **Merge by identity.** When a new Item is given the same online guid as an existing Item in the library, the server merges them: it moves the new Item's Versions onto the existing one and destroys the new Item ("We are merging ID 111 into ID 10 ('Heat'), moving over 1 media items"). The same merge re-points playlists. This is one way Versions form: two files that match the same film become one Item. Whether files in one folder (CC-288's Casablanca) are grouped before this step was not traced.
10. **Media Analysis.** Streams, durations and bitrates are read (by the scanner process the server starts).

**Where the title hint comes from.** **observed**: the film's title and year hints come from the **folder** when the file sits in its own folder, so moving a file into a folder with another name changes its title hint. In this ticket's own test, a file moved into a folder named "Elsewhere" became an Item titled "Elsewhere" in a library with no online agent. The name parser also recognises `{tmdb-…}`, `{imdb-…}` and `{tvdb-…}` hints (a single regular expression with the three sources, observed string), `{edition-…}` with **braces or square brackets** (observed string), and strips release words such as `webrip`, `web-dl`, `proper` and `repack` (observed strings).

### The stub cases, explained

| CC-288 case | What the program did (observed in the CC-288 log, explained by the order above) |
|---|---|
| Rename a file in its folder (Clue) | Hash match, old file gone: rename. The folder and so the hints were unchanged: the same Item, Version and file row. |
| Rename the film's folder (Heat) | **Confounded by the stubs.** Heat's stub had the same size and the same first and last 64 KiB as Amélie's, so it had the same Plex hash. The lookup found Amélie's file, which still existed: a duplicate, with a hint mismatch ('Heat' != 'Amélie'). A new Item was made, matched to Heat's guid, and merged into the existing Heat Item (step 9). This is why the Item survived with a **new** Version and file row; the old Version's file had gone, and it no longer appeared (CC-288). |
| Move a file into a differently named folder (Blade Runner into "Relocated") | Hash match, old file gone: rename. But the folder gave the title hint "Relocated": a hint mismatch, so a new Item, and the old one destroyed. Progress came back because watch state is keyed by account and guid (CC-288), and the new Item matched the same guid. |
| First scans of the CC-288 films | Fargo, Heat, Jaws, Mystery Stub and The Godfather each hash-matched Amélie (identical stub content), were logged as duplicates, failed the title hint, and became their own Items. |
| Remove and restore a film | No hash role. With auto-empty on, the Item is deleted at the scan, and the restored file makes a new Item whose guid finds the old watch state. |

**This ticket's clean test (observed).** Two new files with unique content were scanned, then moved:

- `Big Film (2005)/…mkv` moved into `Big Film (2005) moved/`: the parsed title and year still agreed, so the rename kept the **same Item, Version and file row**.
- `Mid Film (2004)/…mp4` moved into `Elsewhere/`: rename detected, then a title-hint mismatch, so a **new Item** with a new Version, and the old Item destroyed.

So CC-288's question has an answer: **yes, a moved or renamed file is reused by hash**, keeping its Version, provided the old file is gone and the title, year and Edition parsed from the new path still agree. A folder renamed in a way that keeps its title and year keeps the Item. A move that changes the parsed title or year makes a new Item, though watch state still follows the online guid.

### The older matcher (music and legacy agents)

**disassembled** (scanner, `0x1002e9dcc`), **observed** in the log for the music library: the older path asks the server's own `/library/metadata/{id}/matches` for search results, takes the **first** result and accepts it only if its score is **80 or more** ("Score: 100 (Radiohead)"). On acceptance it sets the Item's guid, and if another Item in the library already has that guid it merges the two (as in step 9), otherwise it only changes the Item's identity. For shows, when a guid is set and viewings of that show are already recorded, the show's added date is moved back to the earliest viewing (`addedAtRestored`). CC-288's movie and TV libraries did not use this path; its music library did.

## 3. The transcode decision

The decision is made by the server, not by `Plex Transcoder`, which only carries it out. The server calls this part the media decision engine (`MDE`, in its log strings).

### What the server weighs (observed in the server's strings and bundled profiles; order disassembled for direct play)

- **The client profile.** One of 79 bundled XML profiles in `Resources/Profiles`, chosen by platform and product or named by the client (CC-287). A profile declares:
  - **direct-play profiles**: protocol, container, video codecs, audio codecs and subtitle codecs it can play as is;
  - **transcode targets**: what to convert to, per context (`streaming`, and `static`, for which the server keeps separate transcoder slots; that `static` serves Downloads is likely but unsettled, as in CC-290);
  - **codec limitations**: upper and lower bounds and must-match or must-not-match rules on fields such as video width and height, bitrate, bit depth, level, profile, frame rate, reference frames, anamorphic and interlaced video, audio channels, sampling rate and bitrate, and whether the file is optimised for streaming. A limitation can apply only to transcodes, only to direct play, or be required;
  - **settings**, such as whether the client can pick an audio stream during direct play (`DirectPlayStreamSelection`).
- **The client's augmentations.** `X-Plex-Client-Profile-Extra` can add direct-play profiles, limitations and transcode targets, append or restrict target codecs and change some settings. The server rejects settings a client may not set this way.
- **The request**: whether direct play, direct stream and audio direct stream are allowed; the quality and bitrate asked for (`videoQuality`, `videoBitrate`, `maxVideoBitrate`, `peakBitrate`); the resolution; the protocol; the chosen Version and file (`mediaIndex`, `partIndex`); subtitle mode and size; audio boost, loudness normalisation and dialogue boost; and whether the client wants to adjust quality automatically.
- **The file**: its container, each stream's codec and properties, whether it has several files, embedded or sidecar subtitles, DRM, Dolby Vision profile 5, and video orientation.
- **The server's limits**: the WAN upload rate per stream (`WanPerStreamMaxUploadRate`), the LAN bandwidth setting, the measured or declared bandwidth of the client, the cap on simultaneous transcodes, the setting that forbids transcoding video (`TranscoderCanOnlyRemuxVideo`, CC-288), CPU, memory and disk, and hardware encoders.

### The order

**disassembled** (server, the function at `0x100dfef8c`, by the position of its log calls), then **observed** for the rest from the message set:

1. **Before direct play**: the server checks the file's streams (a video with no video stream, a track with no audio stream) and, for a several-file Version, that the files' streams match. DRM disables playback.
2. **Direct play**: if the profile has **no transcode profile at all, the server direct plays** whatever it is. Otherwise direct play is refused when the client or user disabled it, the container is unknown, several files are selected together, the protocol needs a conversion, the chosen audio stream is not the first and the client cannot select streams, embedded subtitles would have to be taken out, no direct-play profile matches the protocol, container and codecs, or a chosen subtitle must be burned in. Otherwise: direct play.
3. **Direct stream** (a remux): video is copied unless direct streaming is disabled, the codec is not one the target allows, a limitation fails, subtitles are burned in, files are being joined, the video is rotated, the stream is live, or the container and codec pairing is unsafe. Audio is copied unless the same kinds of reason apply, or an audio enhancement is on.
4. **Transcode**: otherwise the server converts to the profile's transcode target for the protocol. If none exists the result is "No conversion profile found for protocol …" (CC-288's `Generic` case, code 4005).
5. **Bandwidth**: if the chosen decision does not fit the bandwidth limit, the server first tries direct play of another Version of the Item, then lowers the quality ("Original decision doesn't fit bandwidth limit … Checking direct play of other media"). It can later change a running session's quality as it measures the client.

The decision text the client reads back ("Direct play OK.", "Direct play not available; Conversion OK.", "App cannot direct play this item. No direct play video profile exists for protocol …") comes from this engine (observed strings), which matches what CC-288 got from `/video/:/transcode/universal/decision`.

## 4. The other open questions

From `server-behaviour.md` section 15 and the "Left to later tickets" line of `server-api.md`:

- **The hash algorithm**: settled (section 1).
- **Whether a move is matched by hash**: settled (section 2).
- **Why the library-wide "Collections" setting did not change the list**: **not settled.** The setting is the library preference `collectionMode` with three values (observed strings), and each collection has its own mode, sort and user filter (observed strings). Where the server applies the library-wide value, if anywhere, is in the server binary, where each query costs ten to twenty minutes, and it was not traced. That the server's list ignores it while a collection's own mode works (CC-288) is consistent with the library value being applied by clients, which is CC-289's to check.
- **Why no NFO agent exists on this build**: **partly settled.** The NFO agents are in this build: types `MetadataAgentNfoMovie` and `MetadataAgentNfoSeries`, identifiers `tv.plex.agents.nfo.movie` and `tv.plex.agents.nfo.series`, names "Plex NFO Movie" and "Plex NFO Series", and the files `movie.nfo`, `tvshow.nfo` and `season.nfo` (observed). **disassembled** (server, the provider registration at `0x10041d804`): the server registers every built-in agent at start-up, but **skips the two NFO agents unless one runtime flag bit is set**, and skips the audiobook agent unless another is. So the absence is a gate, not a missing feature. Which flag sets the bit was not traced. It is not one of the 209 features plex.tv lists for this account (observed). The server also has a feature manager that fetches `/api/v2/features` and caches it, and a `plex.event.featureflag.updated` event (observed), so a feature flag that Plex turns on remotely is the likely source. Following the writes to the flag in a stripped 21 MB binary was too costly here.
- **Whether providers' losing values are kept**: **settled: no, for text.** The server combines providers' responses in memory (type names `MetadataItemResponseCombiner` and per-kind combiners, passed to the movie, show, season, episode, album and track loaders, observed). The database has provider tables only for providers, groups and order, with no per-provider value table, and `external_metadata_items` was empty (observed in the database copy). On disk, each Item's bundle under `Metadata/` holds only images, in a `_combined` folder, one file per kind of image, named after the provider it came from (observed). The legacy agents' combining rules ship as XML files in `Resources` (observed), but no legacy agent was in use here.
- **What `library.new` waits for**: **settled from the log and strings (observed), not from the code.** After a scan, the server queues the library for "new content" and runs the check about 45 seconds later, once its metadata refresh queue has gone quiet. It keeps a high-water mark per library from the newest added date. The **first** pass for a library only records the mark and announces nothing, which is why no first scan sent `library.new`. Later passes count top-level Items whose added date is at or after the mark, per user, and send `library.new` for them ("There are 1 new top level things …", then "Delivering library.new event").
- **The ignore rules**: **the floor is settled; the late start is not.** **disassembled** (server, `0x1007387b0`): a progress report whose time is at or below the hidden setting `MinimumProgressTime` is ignored and logged as premature. The setting's default is 60000 ms (observed in `/:/prefs?includeHidden=1`). That is CC-288's 60-second floor, and it is the Admin's to change. Why a session that starts past the played threshold is ignored was not traced.
- **The numeric timeline `state` values and relation types beyond Extras**: **not settled.** The values were not traced to their enumeration.
- **Whether the hidden MusicBrainz provider is always consulted**: **partly settled.** **disassembled**: it is registered at start-up for the music types with its own agent type (2), unlike Plex Music (0) and Plex Local Media (1). **observed** in the log: during a match, the artist Item took an `mbid://` identity before its `plex://` one. So the music agent uses it to identify the artist. Whether it is consulted for every music match was not traced.
- **CC-287's other items** (`viewOffset` sharing, webhook events, stub scanning) were settled by CC-288. Nothing in the binaries contradicts them, except the playlist point below.

**One correction to CC-288.** Section 2 of `server-behaviour.md` says a playlist that held the old ratingKey is lost when a move makes a new Item. The log shows the server **re-points playlists** from the destroyed Item to the new one, in the merge and in the hint-mismatch path (observed, and the merge function calls the playlist step, disassembled). Collections were not seen to be re-pointed.

## What could not be settled, and why

- **Agent-side match thresholds** in the current pipeline: the server takes the first candidate the agent returns, and any filtering happens inside the provider or on Plex's service, outside this binary.
- **The flag that enables the NFO and audiobook agents**: located as a bit test, but its writer was not traced (cost, as above).
- **The library-wide collection mode**: not traced in the server (cost).
- **The ignore rule for a session starting past the played threshold**, the timeline `state` numbers and the relation types: not traced (cost).
- **Library type 13's hint fields**: the code checks title, year and date for it. Which library kind it is was not looked up.
- **Hint similarity**: the threshold (0.9) and which hints are compared are disassembled. The similarity measure itself was not read.
- **The direct-stream and transcode steps' order**: only the direct-play function was disassembled. The later steps are described from the server's messages, not from the code.

## Verdicts

- **ADR 0015, "neither Plex nor Emby documents its file hash": contradicted as worded for Plex; it holds for the algorithm.** Plex documents that its file rows carry a Plex hash and an OpenSubtitles hash (CC-287, documented). It documents neither algorithm. The program shows the Plex hash is the SHA-1 of the decimal file size followed by the hex SHA-1s of the first and last 64 KiB, with a shortcut under 64 KiB (disassembled, and observed by recomputation on five files). The ADR's own design ("its size plus hashes of a few chunks") is close to what Plex does. Plex differs in two ways ADR 0015's reasoning should know: it reuses a moved file only when the old file is gone and the parsed title, year and Edition agree, and its two-block hash makes files that share size, start and end identical (section 2).
- **CC-2 (Play Rose), the scanner's "neither Plex nor Emby documents its file hash": as for ADR 0015.**
- **ADR 0015's premise that a rename or move should keep the Match, Edition and Progress**: Plex keeps the Version on a rename or move by hash, with the hint check above (disassembled, observed). It keeps Progress in every case by keying it on the online guid (CC-288).
- **ADR 0002, "a local NFO overrides online data" in Plex: CC-288's "contradicted" stands, with a reason.** The NFO agents are compiled in but registered only behind a runtime flag (disassembled), and the default video agents do not read NFO (CC-288, observed).
- **ADR 0004, "Jellyfin and Plex keep only the winner" and "Keep only the winning value, as Plex and Jellyfin do": confirmed for Plex.** Providers' responses are combined in memory before the loaders write one value per field. No per-provider value is stored in the database or on disk, and only the chosen image of each kind is kept (observed, with type names).
- **ADR 0004, source ordering**: nothing here changes CC-288's verdict. Registration shows Plex Movie, Plex Series, Plex Music, Plex Personal Media, Plex Audiobook, the two NFO agents, MusicBrainz and Plex Local Media as the built-in providers (disassembled).
- **ADR 0006, Versions and Editions: confirmed, with the mechanism.** Plex makes Versions by merging Items that match the same guid (disassembled, observed). The Edition is part of a file's identity: a moved file whose Edition hint differs is not kept on its Item, and the `{edition-…}` label is parsed with braces or square brackets (observed).
- **ADR 0013, shared `viewOffset` across Versions and separate Editions: CC-288's "confirmed" stands.** The binaries add no contrary evidence. Progress below 60 s is dropped by the hidden `MinimumProgressTime` setting (disassembled, observed).
- **ADR 0010, "Server transcoding as the fallback every client leans on, as Plex…": confirmed for the server's side, with a nuance.** The server direct plays whatever a client's profile allows, remuxes next and converts last, and converts only when the profile, the request, a subtitle choice, an audio enhancement or the bandwidth rules out direct play (disassembled, observed). A profile with no transcode target is always sent the file as is. How much each client leans on the fallback depends on the profile it declares: Plex's own desktop apps declare broad direct play (CC-290).
- **CC-11 (Playback polish), "Plex uses server transcoding as the fallback": confirmed** (as above).
- **CC-2 stories 51a and 51b, Plex's suffix and `{edition-…}` naming: confirmed**, adding that square brackets also work (observed). **CC-266, `{tmdb-…}` hints and the Extras suffixes: confirmed** from the parser's strings (observed), as CC-288 found.
- **Server-behaviour section 2, "a playlist that held the old ratingKey" is lost on a new Item: contradicted for playlists.** The server re-points them (observed, disassembled).

## What was kept out of the repository

This note is the only file this ticket adds. The arm64 slices, REA's evidence JSON, the Ghidra snapshots, the decompiled text read during the work, the string dumps, the database copy, the test media and the recomputation script are in `/Users/jacobrees/canoncore-scratch/plex-cc292/`, outside every repository. No decompiled code, pseudocode, Plex file, screenshot or frame is in this note. The only Plex text quoted is short identifiers and log messages. The server's local admin token was read inside commands and never printed. The temporary library (CC292 Hash Test) was deleted from the server afterwards; the CC-287 library was not touched.
