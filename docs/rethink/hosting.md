# Hosting options compared with Whatbox (research, 2026-09-28)

**Verify result:** 0 contradicted, 5 unfounded, 7 judgement, 20 confirmed. Prices were read from the vendors' pages on 2026-09-28.

| Option | £/mo | Storage | Upload | Custom app / invited friends | Transcode | Setup |
|---|---|---|---|---|---|---|
| **Whatbox HDD (the Owner's)** | £11 / £16 / £27 | 3.9 / 5.9 / 9.9 TB | 10 / 15 / 20 TB, then 100 Mbps unmetered | Yes / **allowed for the Owner** (decision 10a) | shared CPU, no 4K HEVC | done |
| Ultra.cc | €6.50 / €10.95 / €13.95 | 1 / 2 / 4 TB | 2 / 4 / 10 TB | unofficial apps allowed / ToS allows "private streaming … limited, authenticated, non-commercial" | shared CPU | low |
| Bytesized AppBox | €5 / €11 / €14 | 0.5 / 1 / 3 TB | unmetered | one-click apps only | 2 to 4 "transcodes", GPU advertised | low |
| Feral, Pulsed Media, Seedhost | €5 to £20 | 1 to 12 TB | varies | policy not found | not stated | low |
| Hetzner auction | €61 + €1.70 IPv4 | 2×4 TB | unlimited, 1 Gbit | root / yes | full CPU; the i7 iGPU is unverified | high |
| Hetzner Storage Box + VPS | €3.20 to €10.90 + €5.99 | 1 or 5 TB | unlimited / 20 TB | yes / yes | weak | medium to high |
| Kimsufi KS-1 | £18.23 inc VAT | 2×2 TB | unlimited, 500 Mbps | root / yes | no iGPU | high |
| Oracle Always Free | £0 | **200 GB** (too small) | 10 TB | yes / yes | 2 OCPU | medium; idle instances are reclaimed |
| Home N100 mini PC | ~£2 power (J) | your disk | your broadband | yes / yes | **Quick Sync, 4K HEVC** | medium |
| Home Mac | ~£1 to £2 power (J) | local + USB | your broadband | yes / yes | VideoToolbox | low |

## Notes

- **Home costs:** the Ofgem cap is 26.32p/kWh from 1 Oct 2026.
- **Home upload (J):** about 10 to 20 Mbps per 1080p direct-play stream.
- **Tailscale Personal** is free for 6 users and has a tvOS app.
- **Cloudflare Tunnel for video** is treated as against the CDN terms (J).

## Recommendation (J)

- **Stay on Whatbox.** Nothing hosted beats £11 to £27 for 4 to 10 TB, and the Owner already has permission.
- **After the London move:** a home N100 with Quick Sync is the best experience per pound, provided the flat's upload is enough.
- **Ultra.cc** is the fallback seedbox, because its terms explicitly allow this use.
