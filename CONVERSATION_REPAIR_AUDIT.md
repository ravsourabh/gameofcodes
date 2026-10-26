# Conversation repair before Wave 7

October 27, 2026. W07 scores and presenters remain unstarted.

## What failed

The latest completed public session repeatedly misread the user's offline/mindfulness LeetCode idea as a task of reconciling obsolete transcription fragments. It contained only one real participant, Host. “Discuss it with others” did not add anyone. Switching Host's model did not fix the stale task context.

The controller sent unconsumed interventions once, then dropped them from later requests while continuing to send the original erroneous scenario. Exact-string repetition checks did not catch paraphrased requests to clarify intent. The automatic loop continued after questions that needed a human answer. Earlier mechanical/interface tests did not establish conversation usefulness; the original W05/W06 pass counts should not be read as evidence of this case working.

## Changes

- Save exact interventions first, then compile and validate a separate working brief with source IDs, explicit assumptions, retired topics, actual model provenance and a scope version. Every later model request receives the corrected task and persistent user directions. Original setup and full transcript remain unchanged.
- Ground exclusive-scope corrections such as “I only mean…” in literal user words. The rule is generic; production code contains no LeetCode special case. Retired topics cannot include the active subject. Old positions and obsolete-scope argument context stop governing new turns.
- Reject retired-topic output and repeated intent questions. Allow one bounded repair by the selected model, then pause if it still fails. An essential human question pauses the clock and scheduler; the user can answer or explicitly continue under assumptions.
- Require multiple actual participants for group mode. A direct invitation creates two complementary, distinct saved characters with inherited selected assignments and separate model calls. Stable invitation IDs and a durable plan prevent duplicates after partial writes/restart. Solo coaching is an explicit choice.
- Keep the compact desktop/native choice flow. Saved corrections can be retried after failures or lost acknowledgements, and pending work cannot commit after an interrupt. Reload stays paused.

## Evidence

The isolated fixture reproduces the five setup fragments, legacy bad readback and single Host without copying real profile/session IDs. The replay applies all five exact corrections from “I only mean offline leetcode” through “offline leet code, mindfulness leetcode”, takes later turns without restating the correction, swaps Host from OpenAI Nano to Mini and invites two real characters. One participant is explicitly assigned Claude. No original session is modified.

The local live replay passed with actual OpenAI and Claude calls. Three people took distinct turns: Host proposed offline practice with a brief reset, Design Skeptic challenged setup friction and proposed measurements, Learning Psychologist proposed a fixed reset and recovery measures, and Host responded with a reset triggered by mistakes/fatigue. The four group contributions referenced actual committed arguments and stayed on the corrected idea. The first live attempt exposed an additional anchoring failure in the brief planner; grounding the active task fixed that failure before the passing replay.

Automated service coverage includes correction consumption/restart/model swap, distinct reusable cast identities, partial invitation recovery, late-interpretation rejection, essential-question pausing, paraphrased-loop rejection, actual adapter payloads and bounded repair, and generic scope grounding. Browser coverage adds the exact five corrections, failed/lost receipts, reload, real group turns and native hand invitation/exit.

The final local verification passes all 76 unit/service checks, all 39 production browser journeys, TypeScript and the production build. The native repair journey selects the actual rendered hand surface, invites real saved participants, gives all three a turn and verifies that leaving VR pauses the session. Public activation and the live replay inside the deployed container are separate post-deployment checks.

Run `npm run test:unit`, `npm run build` and `GOC_TEST_PRODUCTION=1 npm test` with Node 22.13+ or Node 24. `node scripts/verify-offline-leetcode.mjs` performs the bounded live replay using configured server keys: at most 22 model requests, no audio and an isolated temporary data store. It writes a private review report to `.sovereign/review/offline-leetcode-live.json`; set `GOC_REPLAY_REPORT` to change that destination. Inspect its transcript, not only its pass flag. The deployed image is tested with the same script after revision and data-preservation verification.

## Limits and release verification

Clarification/repetition and exclusive-scope detection use bounded heuristics plus model interpretation; they do not guarantee semantic novelty or factual correctness for every future conversation. Some early one-person turns in the local replay still proposed similar cache/test-harness ideas. The group exchange added distinct objections and tests; continuing product evaluation should examine usefulness rather than merely count turns. No synthetic scores, decision or consensus is inferred.

Browser AI fixtures verify orchestration/persistence; the separate live replay verifies actual model behaviour on this case. Native XR is hand emulation, not physical Quest comfort/performance evidence. The original completed user session and all pre-deployment saved files are hash-checked around deployment. Deployment uses the existing backed-up, revision-verified GitHub main workflow. Public revision/capability/assets and browser/VR entry/exit are checked afterward, with reports kept under the ignored private review directory.
