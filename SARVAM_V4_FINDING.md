# Speech decision — Bulbul V4 Flash

Recorded October 27, 2026. Keep pay-as-you-go. Make **`bulbul:v4-flash` the S05 migration target**, retaining V3 as a deliberately selected alternative. S03/S04 do not silently change saved voices or the tested speech runtime.

The [current pricing page](https://docs.sarvam.ai/api/getting-started/pricing) lists ₹1/1,000 characters for V4 Flash and ₹3 for V3, excluding GST. The [launch announcement](https://www.sarvam.ai/blogs/bulbul-v4-flash) lists ₹20/10,000 characters (₹2/1,000). The creator reports a promotional expiry of **12 November 2026** from their dashboard/screenshot; that expiry was not independently confirmed on these public pages. Budget at the ₹2 regular reference and recheck the account's actual rate before rollout. Relative to ₹3, ₹1 is approximately 67% lower and ₹2 approximately 33% lower.

Sarvam's [migration guidance](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/best-practices) requires model-specific persona IDs, rather than V3 short speaker names. Candidate auditions include `anand_hi_news` for the serious host, `ratan_hi_latenight` for dry commentary and a suitable Hinglish persona; none is a verified production casting choice yet. Preserve model and persona together in each voice assignment. Never map a saved V3 voice silently.

S05 must verify supported request parameters against the endpoint actually used, since public guides disagree on some prosody controls; omit disputed optional controls initially. Audition Hindi, Hinglish, names/numbers, pauses, deadpan/comic delivery, interruption and final-audio mouth alignment. Compare latency and character cost with V3, cache accepted audio, and expose an explicit model/persona choice. V4 is a target, not a claimed tested switch.

## S05 integration evidence, October 27

New auto-casts now use explicit V4 persona/model pairs, and the room picker exposes V4 and V3 independently. Existing model-less short speaker IDs still resolve to V3. Real V4 Hindi (`anand_hi_news`), Hinglish (`shubh_enhi_ads`), English (`aparna_en_edtech`) and explicit V3 (`shubh`) calls succeeded, with final WAV audio and local phonetic mouth tracks. See [S05_S07_AUDIT.md](S05_S07_AUDIT.md). Disputed optional pitch/loudness/preprocessing controls are omitted. These are integration auditions; final voice casting, comic delivery and pronunciation still need human pilot review.
