# Audit: decisions 1 to 13 (2026-09-28)

Each decision was checked against competitors and verified at its owner: whatbox.ca, Apple's HLS Authoring Spec, hls.js, Plex support, the Jellyfin docs, and the Swiftfin, Audiobookshelf, Kavita and Komga repos.

## At risk: to be re-decided by the Owner

- **10 and 13: Whatbox's AUP.**
  - The AUP forbids "VOD hosting, VOD sharing" with no "public" qualifier (whatbox.ca/policies/acceptable_use). No Whatbox text allows a private, invited library.
  - Circumstantial precedent: Whatbox offers one-click Plex and Jellyfin, which share with friends.
  - Next step: get written approval from Whatbox support for a private, invite-only server (Terms 13.2 accepts email consent).
- **2 against 7: "plays everything" versus "no video transcode".**
  - The HLS spec takes video as H.264 (up to High), HEVC, Dolby Vision or AV1, requires deinterlacing, and takes subtitles as WebVTT or IMSC1 text.
  - So VC-1, MPEG-2, MPEG-4 ASP, VP9, 10-bit H.264, interlaced sources and PGS/VobSub subtitles need a video transcode or burn-in.
  - DTS and TrueHD need audio conversion.
  - Precedent for getting it back: Infuse decodes on the device, and Swiftfin offers VLCKit.

## Corrections: applied in the sentence they correct

- **2:** "remuxes or transcodes ... so it plays everything" now reads: remuxes and converts audio, and flags anything that needs a video transcode or subtitle burn-in.
- **3:**
  - The upload allowance is per plan (10 to 40 TB on HDD, 50 TB+ on NVMe), then 100 Mbps unmetered.
  - /policies/traffic says logged-in traffic may not count.
  - "Containers may stop working" comes from /wiki/Bookshelf, not the FAQ.
  - The wildcard certificate, the 10m timeout and "no body cap" are measurements, not published rules.
- **4:** HEVC plays in Safari, Chrome and Edge with hardware decode, and is flagged elsewhere (Firefox).
- **6:** invited people are external TestFlight testers. That needs Beta App Review, and each build lasts 90 days.
- **7:** the flagged list adds bitmap subtitles and codecs outside the HLS spec.
- **11:** the TV match rate is 70 to 100% (lowest: the Fifteenth Doctor, 16 of 23), not 55 to 100%.
- **13:** "RFC 8628" was wrong as precedent. Plex uses its own PIN API and Jellyfin its Quick Connect. We use a device-code flow like theirs, built to RFC 8628.

## Holds

- **1:** no competitor shows several orders side by side.
- **5:** swift-openapi-generator 1.13.1 was released 2026-09-01. Jellyfin's Swift SDK and Audiobookshelf both generate from OpenAPI.
- **9:** holds.
- **12:** no single server does video, audio, EPUB and CBZ well together. That makes it unprecedented, not contradicted.
- **ETHOS and criteria:** nothing surveyed ships one native app for Mac, iPhone and Apple TV, since Swiftfin has no Mac build.
