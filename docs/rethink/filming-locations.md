# Filming locations and the map (research, 2026-09-28)

This research was read-only. **F** means checked at the owner or measured this run, and **J** means judgement.

## Data

- **Wikidata P915 is CC0 (F).** 23,451 of 349,542 films carry it.
  - MCU: 25 of 39 films, 112 locations, 108 with coordinates.
  - Inception: 15 of 15.
  - Doctor Who: **only 15 items** (Rose 9, The Unquiet Dead 11, ...), with 42 of 42 locations carrying coordinates.
  - The granularity is mixed. Countries and states sit beside exact sites, so drop anything at or above city level by its P31 type (J).
- **Tardis Fandom (F).** Story pages carry a `=== Filming locations ===` section. 12 of 12 sampled had one; Rose's has 16 places, each with its scene ("Lydstep Flats, Gabalfa, Cardiff (Powell Estate)").
  - The places are names only, with no coordinates, so they need geocoding once.
  - The content is CC BY-SA. There is no filming-location infobox, and `Category:Filming locations` holds 65 pages without coordinates.
- **Ruled out (F):**
  - TMDB has no field for it (only `production_countries`).
  - IMDb datasets hold no locations and are non-commercial.
  - movie-locations.com is all rights reserved.
  - OSM has about 64 tagged objects.
- **Geocoding (F):**
  - Nominatim allows 1 request per second, with a User-Agent, and results must be cached. A one-off server-side batch that is stored fits (J).
  - Photon can be self-hosted.
  - OpenCage's free plan is "testing only", so it is out.

## Maps

- **Mapbox is out (F).**
  - GL JS v2+ is proprietary and tied to an active account.
  - The iOS SDK has no tvOS.
  - Without a card it gives only trial limits (5,000 loads, 100 MAU), so a real free tier needs a card.
  - Every install would need its own account and token.
- **Web: MapLibre GL JS (BSD-3) (F).** Tiles come from **OpenFreeMap** (no key, no limits, funded by donations) to start. A **Protomaps PMTiles** extract served by the install itself is the sustainable default.
- **Apple devices: native MapKit / SwiftUI `Map` (F).** It covers iOS, macOS **and tvOS** and is free in-app. MapLibre Native's tvOS support is unverified.
- **Also out (F):**
  - Stadia's free plan (non-commercial).
  - MapTiler's free plan (non-commercial).
  - OSM's standard tiles (heavy use forbidden).
  - MapKit JS on the web (free per paid Developer Program membership).

## Unverified

- The Reelstreets and sceen-it terms.
- MapLibre Native on tvOS.
- Fandom's coverage beyond the 12 sampled pages.
- OpenFreeMap's long-term funding.
