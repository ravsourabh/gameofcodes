# S07/S11 action coverage

October 30, 2026. 155 entries, all bound; 140 available and 15 gated as needs-staging. Availability additionally requires the actual rig, facial controls, props and loaded motion pack. Native clips come from the pinned Rocketbox library; authored contacts place a wrist or fingertip with two-bone IK and per-finger curls; stage routes (`shared/studio/stage-paths.mjs`) leave the chair through the gap beside it, use a lane behind the chairs and meet partners halfway. Partnered actions (handshake, high-five, hand-over-note, seat swaps, group dance) add a mirrored part to the partner on the same cue clock. Exits hold the person off-stage until the cue ends; enter and return-sheepishly start off-stage. Some actions share a native clip with different pose/contact/face treatment. Physical/vocal quality acceptance is documented in [the audit](S07_S11_AUDIT.md).

## Expansion QA status (October 30)

155 bound entries describe implementation coverage. The 140 non-stage entries remain available; all 15 stage entries are gated as needs-staging. Historical audit results apply to the earlier catalogue. The local expansion audit and screenshots are saved under ignored `.sovereign/review/animation-qa-20261030/`; they use bundled Node 24, a frozen source snapshot and a local Vite server, with no production changes or provider calls.

Initial full-clock sampling on Business_Male_04 found no non-finite joints, floor penetration, seated wrist/table penetration or microphone-stand drift. It did find contact discontinuities and excessive gait transitions, so acceptance remains incomplete. Fixes include locomotion conflict lanes for partner meetings, waiting for native gait assets, intensity/reduced-motion scaling for authored hands and eyelid closures, continuous fingertip release for kiss/mind-blown gestures, and longer gait blending on short chair sidesteps. The final focused recheck (run-1793313120149/report.json) sampled 7,008 real-rig frames and cleared the kiss, mind-blown, mic-drop and raise-the-roof continuity defects. Twelve stage actions still exceeded continuity bounds, and three others require full-scene acceptance. All 15 stage actions are therefore excluded from CORE_ACTIONS, readiness, writer/director choices, cue validation and saved-cue playback. The remaining 140 entries passed seven-rig structural availability tests; real-rig continuity was checked on Business_Male_04 only.

Scene integration limits: exit and seat-change positions currently last only for the cue and reset afterwards; the single-avatar fixture cannot validate partner-to-partner contact, full-set chair clearance or camera framing. Camera-directed gaze actions also require the studio scene rather than a fixed-camera fixture. Physical Quest, subjective acceptance of every finger shape, and vocal audio were not verified by this expansion pass. The release profile records incomplete motion QA separately from binding counts.

| Action | Disposition | Binding | Mode | Duration | Props |
| --- | --- | --- | --- | --- | --- |
| presence.breathe | bound | existing presence/gaze | seated | 2.8s | — |
| presence.blink | bound | existing presence/gaze | seated | 2.8s | — |
| presence.shift-weight | bound | m_gestic_listen_neutral_01 + pose: settle | seated | 2.8s | — |
| presence.adjust-posture | bound | m_gestic_listen_neutral_01 + pose: settle | seated | 2.8s | — |
| presence.glance-around | bound | m_sit_table_idle_look_around | seated | 2.8s | — |
| presence.straighten-clothes | bound | authored contact: straighten | seated | 3.2s | — |
| presence.adjust-glasses | bound | authored contact: glasses | seated | 2.8s | glasses |
| presence.stretch | bound | authored contact: stretch + pose: stretch | seated | 4.2s | — |
| speaking.open-palms | bound | m_gestic_presentation_left_01 | seated | 2.8s | — |
| speaking.explain-one-hand | bound | m_gestic_talk_relaxed_01 | seated | 2.8s | — |
| speaking.count-on-fingers | bound | authored contact: count | seated | 2.8s | — |
| speaking.emphasise-word | bound | m_gestic_talk_excited_01 | seated | 2.8s | — |
| speaking.point-at-evidence | bound | authored contact: point-down | seated | 2.8s | — |
| speaking.gesture-to-person | bound | m_gestic_presentation_right_01 | seated | 2.8s | — |
| speaking.raise-finger | bound | authored contact: raise-finger | seated | 2.8s | — |
| speaking.spread-arms | bound | m_gestic_presentation_left_01 | seated | 2.8s | — |
| speaking.lean-forward | bound | m_sit_table_gestic_thoughtful | seated | 2.8s | — |
| listening.track-speaker | bound | existing presence/gaze | seated | 2.8s | — |
| listening.attentive-nod | bound | m_gestic_listen_accept_01 | seated | 2.8s | — |
| listening.puzzled-tilt | bound | authored pose/face: tilt | seated | 2.8s | — |
| listening.thoughtful-pause | bound | authored contact: chin-touch + pose: think | seated | 3.2s | — |
| listening.acknowledge-point | bound | m_gestic_listen_accept_01 | seated | 2.8s | — |
| listening.look-between-speakers | bound | m_sit_table_idle_look_around | seated | 2.8s | — |
| listening.prepare-response | bound | m_sit_table_gestic_thoughtful | seated | 2.8s | — |
| response.nod | bound | m_gestic_listen_accept_01 | seated | 2.8s | — |
| response.shake-head | bound | m_gestic_listen_deny_01 | seated | 2.8s | — |
| response.shrug | bound | m_sit_table_gestic_shrug_01 | seated | 2.8s | — |
| response.raise-eyebrow | bound | authored pose/face: expression | seated | 2.8s | — |
| response.sceptical-look | bound | authored pose/face: tilt | seated | 2.8s | — |
| response.concede-point | bound | m_gestic_listen_accept_01 | seated | 2.8s | — |
| response.dismiss-argument | bound | m_gestic_listen_deny_01 | seated | 2.8s | — |
| response.reluctantly-agree | bound | m_gestic_listen_accept_01 | seated | 2.8s | — |
| response.look-to-host | bound | authored pose/face: glance | seated | 2.8s | — |
| expression.smile | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.disgust | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.grin | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.frown | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.surprise | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.confusion | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.concern | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.embarrassment | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.frustration | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.disbelief | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.eye-roll | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.jaw-drop | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.relief | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.wink | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.squint | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.pout | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.eyebrow-flash | bound | authored pose/face: expression | seated | 2.8s | — |
| expression.puppy-eyes | bound | authored pose/face: expression | seated | 2.8s | — |
| comedy.smirk | bound | authored pose/face: expression | seated | 2.8s | — |
| comedy.chuckle | bound | m_gestic_laugh_low + pose: laugh | seated | 2.2s | — |
| comedy.laugh | bound | m_gestic_laugh_loud + pose: laugh | seated | 3.2s | — |
| comedy.belly-laugh | bound | m_gestic_laugh_extreme + pose: laugh | seated | 4s | — |
| comedy.suppress-laughter | bound | authored contact: cover-mouth + pose: laugh | seated | 2.6s | — |
| comedy.facepalm | bound | authored contact: facepalm + pose: drop-head | seated | 2.8s | — |
| comedy.double-facepalm | bound | authored contact: double-facepalm + pose: drop-head | seated | 2.8s | — |
| comedy.double-take | bound | authored pose/face: double-take | seated | 1.8s | — |
| comedy.mock-shock | bound | authored contact: cheeks + pose: expression | seated | 2.8s | — |
| comedy.deadpan-stare | bound | authored pose/face: expression | seated | 2.8s | — |
| comedy.exaggerated-bow | bound | authored pose/face: bow | standing | 4.6s | — |
| comedy.wink-at-camera | bound | authored pose/face: expression | seated | 2.4s | — |
| comedy.slow-clap | bound | authored contact: slow-clap | seated | 4.2s | — |
| comedy.mic-drop | bound | authored contact: mic-drop | seated | 4.4s | microphone |
| comedy.side-eye | bound | authored pose/face: expression | seated | 2.8s | — |
| debate.raise-hand | bound | authored contact: raise-hand | seated | 2.8s | — |
| debate.lean-to-interject | bound | m_sit_table_gestic_thoughtful | seated | 2.8s | — |
| debate.stop-hand | bound | authored contact: stop-hand | seated | 2.8s | — |
| debate.point-to-opponent | bound | authored contact: point + pose: lean-in | seated | 2.8s | — |
| debate.fold-arms | bound | authored contact: fold-arms + pose: lean-back | seated | 2.8s | — |
| debate.push-chair-back | bound | m_sit_stand_up_chair_01 | standing | 4.2s | chair |
| debate.stand-to-object | bound | authored contact: object | standing | 4.6s | — |
| debate.turn-away | bound | authored pose/face: turn | seated | 3.2s | — |
| debate.walk-out | needs-staging | stage route: walk-out | stage | 9.5s | — |
| social.invite-speaker | bound | m_gestic_presentation_right_01 | seated | 2.8s | — |
| social.yield-floor | bound | m_gestic_presentation_left_01 | seated | 2.8s | — |
| social.introduce-guest | bound | m_gestic_presentation_right_01 | seated | 2.8s | — |
| social.reassure | bound | m_gestic_presentation_left_01 | seated | 2.8s | — |
| social.applaud | bound | m_claphands_01 + contact: clap | seated | 3.6s | — |
| social.handshake | needs-staging | stage route: meet | stage | 12.5s | — |
| social.high-five | needs-staging | stage route: meet | stage | 11.5s | — |
| social.offer-help | bound | m_gestic_presentation_right_01 | seated | 2.8s | — |
| social.knowing-glance | bound | authored pose/face: glance | seated | 2.8s | — |
| movement.sit | bound | m_sit_down_chair_01 | sit-transition | 4.4s | chair |
| movement.stand | bound | m_sit_stand_up_chair_01 | standing | 4.4s | — |
| movement.turn | bound | authored pose/face: turn | standing | 4.2s | — |
| movement.walk | needs-staging | stage route: walk | stage | 12s | — |
| movement.approach-person | needs-staging | stage route: approach | stage | 16s | — |
| movement.change-seat | needs-staging | stage route: change-seat | stage | 10.5s | chair |
| movement.enter | needs-staging | stage route: enter | stage | 8s | — |
| movement.exit | needs-staging | stage route: exit | stage | 8.5s | — |
| movement.pace | needs-staging | stage route: pace | stage | 18s | — |
| movement.crouch | bound | m_crouch_in | standing | 4.4s | — |
| movement.jump | bound | authored pose/face: jump | standing | 4.4s | — |
| movement.hop | bound | authored pose/face: jump | standing | 4.4s | — |
| celebration.fist-pump | bound | authored contact: fist | seated | 3.2s | — |
| celebration.victory-pose | bound | authored contact: victory + pose: proud | seated | 3.6s | — |
| celebration.cheer | bound | authored contact: cheer | seated | 3.6s | — |
| celebration.clap-overhead | bound | m_claphands_01 + contact: clap-overhead | standing | 4.4s | — |
| celebration.seated-dance | bound | authored contact: disco + pose: groove | seated | 5.2s | — |
| celebration.shoulder-groove | bound | authored pose/face: groove | seated | 5.2s | — |
| celebration.celebratory-jump | bound | authored contact: victory + pose: jump | standing | 4.4s | — |
| celebration.dance | bound | m_dancing_silly | standing | 6.4s | — |
| celebration.group-dance | needs-staging | stage route: dance + m_dancing_cool | stage | 8s | — |
| celebration.raise-the-roof | bound | authored contact: raise-roof + pose: groove | seated | 4s | — |
| fatigue.yawn | bound | m_sit_table_idle_yawn | seated | 3.6s | — |
| fatigue.slump | bound | authored pose/face: slump | seated | 4s | — |
| fatigue.check-time | bound | authored contact: check-time | seated | 2.8s | watch |
| fatigue.tap-fingers | bound | authored contact: tap-fingers | seated | 3.2s | — |
| fatigue.chin-on-hand | bound | authored contact: chin + pose: lean-in | seated | 2.8s | — |
| fatigue.drooping-eyelids | bound | authored pose/face: expression | seated | 2.8s | — |
| fatigue.nod-off | bound | authored pose/face: slump | seated | 4s | — |
| fatigue.sleep-on-desk | bound | authored contact: sleep + pose: sleep | seated | 6.4s | desk |
| fatigue.startle-awake | bound | authored pose/face: wake | seated | 3.2s | — |
| props.rest-elbows | bound | authored contact: rest-elbows + pose: lean-in | seated | 2.8s | desk |
| props.lean-on-desk | bound | authored contact: lean-on-desk + pose: lean-on-desk | seated | 2.8s | desk |
| props.tap-table | bound | authored contact: tap-table | seated | 1.6s | desk |
| props.read-notes | bound | m_documents_check + contact: notes | seated | 4.2s | notes |
| props.write | bound | m_documents_note + contact: write | seated | 4.2s | notes, pen |
| props.turn-page | bound | m_documents_check + contact: notes | seated | 4.2s | notes |
| props.pick-up-microphone | bound | authored contact: microphone | seated | 3.6s | microphone |
| props.adjust-microphone | bound | authored contact: microphone | seated | 3.6s | microphone |
| props.drink-water | bound | m_drink_drinking + contact: cup | seated | 4.8s | cup |
| props.type-on-laptop | bound | m_work_table + contact: laptop | seated | 4.4s | laptop |
| props.hand-over-note | needs-staging | stage route: meet | stage | 14s | notes |
| drama.freeze-disbelief | bound | authored pose/face: freeze | seated | 2.8s | — |
| drama.slow-turn-to-camera | bound | authored pose/face: turn | seated | 3.2s | — |
| drama.dramatic-pause | bound | authored pose/face: freeze | seated | 2.8s | — |
| drama.exaggerated-sigh | bound | authored pose/face: sigh | seated | 3.2s | — |
| drama.pretend-faint | needs-staging | stage route: faint | stage | 6.7s | — |
| drama.staged-stumble | needs-staging | stage route: stumble | stage | 7s | — |
| drama.awkward-recovery | bound | authored contact: neck-rub + pose: recover | seated | 3.6s | — |
| drama.storm-off | needs-staging | stage route: storm-off | stage | 6.5s | — |
| drama.return-sheepishly | needs-staging | stage route: return | stage | 13s | — |
| drama.hands-on-head | bound | authored contact: hands-on-head + pose: lean-back | seated | 3.2s | — |
| drama.sob | bound | authored contact: double-facepalm + pose: sob | seated | 4.2s | — |
| gesture.heart-hands | bound | authored contact: heart | seated | 3.2s | — |
| gesture.thumbs-up | bound | authored contact: thumbs-up | seated | 2.8s | — |
| gesture.thumbs-down | bound | authored contact: thumbs-down | seated | 2.8s | — |
| gesture.wave | bound | authored contact: wave | seated | 3s | — |
| gesture.blow-kiss | bound | authored contact: blow-kiss | seated | 2.8s | — |
| gesture.namaste | bound | authored contact: namaste + pose: nod-bow | seated | 3.2s | — |
| gesture.salute | bound | authored contact: salute + pose: proud | seated | 2.8s | — |
| gesture.ok-sign | bound | authored contact: ok-sign | seated | 2.8s | — |
| gesture.peace-sign | bound | authored contact: peace-sign | seated | 2.8s | — |
| gesture.finger-guns | bound | authored contact: finger-guns | seated | 2.8s | — |
| gesture.air-quotes | bound | authored contact: air-quotes | seated | 2.8s | — |
| gesture.chef-kiss | bound | authored contact: chef-kiss | seated | 2.6s | — |
| gesture.shush | bound | authored contact: shush | seated | 2.8s | — |
| gesture.mind-blown | bound | authored contact: mind-blown | seated | 3s | — |
| gesture.hand-on-heart | bound | authored contact: hand-on-heart + pose: nod-bow | seated | 3.2s | — |
| gesture.beckon | bound | authored contact: beckon | seated | 3s | — |
| gesture.rub-hands | bound | authored contact: rub-hands + pose: lean-in | seated | 3s | — |
| gesture.call-me | bound | authored contact: call-me | seated | 2.8s | — |
