# P01 channel identity and publishing assets

October 30, 2026 · Asia/Calcutta.

**Scope:** prepare local publishing assets and editable sources. Channel identity is confirmed; final visual acceptance is pending the creator's review. No account connection, public upload, live-site change or commit is part of this wave.

## Identity and character decisions

- Dedicated channel: **बात का बवाल / Baat Ka Bawaal**.
- Exact publisher credit: **Game of Codes Production**.
- Featured host: **Chhola Bhatura**, using the saved `Male_Adult_05` tan-vest appearance. The creator corrected the initial Chintu-heavy sample; default banner, thumbnail and portrait cover now feature the host.
- Chintu's `Business_Male_02` appearance is retained as a separately labelled supporting episode example. The reserved `Host_Anchor_01` rig is not silently substituted for the saved host.
- Public contact, accounts, handles and posting times remain unset. No availability or ownership claim is made for suggested handles. The private studio URL is not a public audience call to action.

## Deliverables

The [review gallery](publishing/baat-ka-bawaal/v1/index.html) groups the following downloadable outputs and sources:

- Profile badge, circular crop and 98 px readability preview.
- YouTube banner, clean mobile crop and guide-only crop check.
- Host-led episode and show thumbnails, plus a supporting Chintu example.
- Host-led portrait cover and centre-crop preview.
- Transparent landscape/portrait phrase-caption and nameplate overlays, and a small video watermark.
- Seven actual shipped rig identities, each with neutral, smile and surprised transparent cutouts; per-rig JSON records the expression weights.
- Landscape/portrait intro MP4s at 2.5 seconds and ending cards at 4 seconds, with audio. Editable HTML/CSS retains the source layouts.
- Intro/outro WAV masters and a quiet 20-second dialogue-bed mix preview. The bed is not advertised as a seamless loop or integrated runtime ducking.
- Hindi/Hinglish channel About copy, Instagram bio, episode/clip metadata templates, credits, provenance and MIT/OFL notices.

The built-in image tool generated the profile badge from the original show logo. The original output, exact prompt and edit target are retained. Other compositions use native HTML/CSS and original imagery; cast cutouts use Blender 4.5 CPU renders. Existing runtime logo, banner, avatars and soundtrack are unchanged.

## Verification and reproducibility

**Final local result:** 48 exported assets, including 21 cast cutouts, 20 artwork/preview PNGs, four H.264/AAC MP4s and three WAV masters. All manifest hashes/dimensions passed; all seven media files passed codec/duration checks; 27 images passed the transparency checks. The banner is below YouTube's 6 MB budget. Desktop/390 px gallery layouts passed overflow and image-loading checks, and both intro videos have visibly different decoded opening/settled frames.

Measured integrated loudness / true peak: intro −15.56 LUFS / −2.76 dBTP; outro −16.50 LUFS / −4.46 dBTP; dialogue-bed preview −28.60 LUFS / −15.43 dBTP. Technical measurements do not substitute for the creator's listening preference or final episode mix review.

- `scripts/render-publishing-cast.py` recreates the 21 cutouts from shipped GLBs. It uses anatomical joint directions to lower arms and the studio's alpha threshold for hair cards; no painted replacement faces are used.
- `scripts/build-publishing-kit.mjs` renders actual artwork, checks text overflow, masters source music excerpts, encodes H.264/AAC at 24 fps and writes hashes/dimensions to the asset manifest. It does not call inference, speech or publishing APIs.
- `scripts/verify-publishing-kit.mjs` checks file hashes, PNG sizes, real alpha/head margins, the banner size budget, video/audio codecs and durations, measured audio headroom, decoded intro frame changes, media loading and the gallery's desktop/phone layout.
- The final [machine-readable report](publishing/baat-ka-bawaal/v1/verification.json) records the verification timestamp, individual results and audio measurements. Gallery inspection images are retained under `.sovereign/review/p01/`.
- An early off-screen browser seek check reported a static intro despite different actual decoded frames. Motion verification now compares decoded video pixels directly, independently of off-screen browser painting. An intro tagline overlap found during frame inspection was corrected before final rendering.

## Remaining acceptance and later work

The creator still reviews and accepts the artwork and audio choices. P02 owns actual channel/account selection, handles, developer applications and authorization. P03–P09 own durable rendering/upload/scheduling and public-release acceptance; these features are not delivered by an asset gallery.

Base cutouts use original clothing and no episode-specific accessories. Before public use, match the accepted take's tint/accessories and verify actual platform crop previews. Third-party episode media and generated dialogue are reviewed per package rather than being cleared by this brand kit. Every derivative containing the Kevin MacLeod music retains the full attribution, source, CC BY 4.0 link and change statement.
