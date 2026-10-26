# Game of Codes — Product Requirements Document

Last updated: 2026-10-27

Status: Waves 1–6 implemented and locally verified for the configured cloud mode; Waves 7–12 planned; physical Quest acceptance remains pending

Full first-release target: November 18, 2026 (Asia/Calcutta)

## 1. Product direction and agreed decisions

Game of Codes is a character-led WebXR experience for discussing problems, making decisions, and rehearsing real situations. Users describe what they need in ordinary language. AI recommends a session format and a cast; users choose who participates, direct the interaction, and review the outcome.

The primary interface is a conversation with **Virus, the guide**, or a user-selected assistant. The assistant listens, takes notes, proposes the next step, and brings forward a small contextual choice when needed. Large setup forms are an optional detail/fallback view. The Wave 1 form is temporary infrastructure UI and is not the intended first-release entry experience.

The product retains the Game of Codes name. Sovereign remains an existing internal project/storage identifier where already used.

In the product, a character's **code** means its stated principles and priorities: for example, evidence first, practical feasibility, or protecting a principle. Users can inspect and edit that code independently of the model. **Game** refers to the formats, roles, interventions, and scoring through which those perspectives meet. The plain-language descriptor is **an AI discussion and rehearsal experience in VR**.

| Decision | Requirement |
| --- | --- |
| First release | Both discussion/decision and interview/rehearsal modes ship by November 18. This is the full first release, not a demo-only milestone. |
| Assistant-led entry | Virus greets the user, captures their situation and preferences, reads back a short summary, suggests a room and cast, and saves confirmed notes. Typing a session name or completing a setup form is not a prerequisite. |
| First five to ten minutes | An interactive, skippable introduction teaches gestures and the app through actual actions. Aim for core confidence and a useful exchange within five minutes, with optional deeper orientation through ten minutes. |
| Discussion environment | A grand medieval fantasy throne court. The user is the king or sovereign directing the court. |
| Interview environment | A separate, visibly distinct council chamber. The user approaches and faces the council as the candidate, presenter, or person being questioned. |
| Customisation | Any user-defined situation; templates such as UPSC, investor pitching, research defence, and job interviews are optional starting points. |
| Cast selection | AI suggests relevant new characters when the user has not specified a cast. Previously selected/saved characters appear in the same selection experience and can be added. |
| Character creation | Modular, randomly generated avatars and compatible voices, with manual editing, previews, rerolls, and stable saved identities. |
| Character codes | Each character has visible guiding principles, separate from its temporary position on a question. A code can guide a contribution without forcing disagreement or preventing a change of mind. |
| Brains | Each character has an independently selectable provider/model, separate from appearance, voice, personality, guiding code, and session role. |
| User agency | Users can intervene, question, redirect, pause, rate, make decisions, and participate or observe. |
| Decision presenters | A line of distinct people can bring individual decision points before the sovereign and explain them at the requested depth. |
| Fighting arena | Deferred. Verbal challenge and heated discussion remain within the discussion mode. |

Sections below describe target behaviour unless explicitly labelled as an existing foundation. Retired product requirements are recorded once in section 15 for migration clarity; they are not a future-feature backlog.

## 2. Users, needs, and value

The audience is people who need to explore a problem or prepare to discuss something with other people. The first release supports a general custom scenario rather than requiring membership of one profession or examination category.

| Need | Example | Expected result |
| --- | --- | --- |
| Explore a difficult choice | Which product direction should we pursue? | Options, tradeoffs, open questions, and a recorded user decision. |
| Pressure-test an argument | Where is my research proposal weak? | Specific objections, evidence gaps, and possible revisions. |
| Rehearse an interview | I am preparing for a panel interview. | Responsive questioning, answer-specific feedback, and a next practice step. |
| Practise a pitch or presentation | I need to present a proposal to a committee. | A relevant panel, follow-up questions, and feedback against the agreed goal. |
| Understand a series of choices | Help me make the decisions needed to organise this project. | Clear explanations and a revisitable decision record. |

VR should contribute through presence, spatial speaker identity, embodied attention, and the experience of addressing or facing a group. Desktop must offer an equivalent functional journey. Whether VR improves the experience over desktop remains a validation question.

Success means users gain useful understanding or improve a rehearsal, then return with another situation. Avatar variety, autonomous conversation length, and agreement between models are not sufficient success measures.

### Differentiation to validate

The product combines a reusable cast, independently assigned brains, user-directed embodied discussion, and people who make individual choices understandable. Treat this combination as a product hypothesis rather than a claim of market uniqueness. Validation must establish what users gain from directing this room and whether they prefer VR for the task.

### First meaningful session

Lead first use with Virus and a complete problem-to-outcome journey. With an available model connection, the first five minutes should include point-and-pinch practice, capture/readback of the user's situation, a relevant contribution, a successful user intervention, and a useful question, tradeoff, or practice insight. Integrate the introduction into a complete initial session of about ten minutes rather than placing a compulsory ten-minute tutorial before the real task. Users may skip familiar lessons or spend longer practising.

For a discussion, the signature moment is a character answering a specific objection after the user gives it the floor, followed by a presenter explaining a real choice. For rehearsal, it is a panelist following up on the user's actual answer and giving a specific improvement. A scripted demonstration may explain controls, but must be labelled and cannot stand in for the responsive session.

## 3. Core journey

1. **Meet the assistant and act.** Virus welcomes the user and offers a short point-and-pinch demonstration or a direct start. Teach remaining interactions as they are needed, with captions and selectable alternatives to speech.
2. **Describe the situation.** Say or write a sentence to Virus. He captures the situation, goal, and constraints, asks one relevant follow-up when necessary, and reads back a short editable summary. Notes and a sensible suggested session name are saved without a separate form submission; material interpretations are confirmed by the user.
3. **Receive and choose the proposed session/cast.** Virus suggests discussion or rehearsal, a room, format, relevant characters, and intended outcome. He explains each role while the characters or a few choice cards appear. New/saved characters can be selected, questioned, replaced, rerolled, or edited on request.
4. **Confirm the essentials.** Virus briefly recaps what will happen and waits for an explicit start. Roles, guiding codes, model assignments, duration, context, and criteria remain inspectable/editable through contextual controls or the requested detail view. Users do not have to configure every field.
5. **Enter the appropriate environment.** Discussion places the user on the throne; rehearsal places the user before the council. Virus explains the user's role, demonstrates the next needed control, and hands the floor to the cast. He remains available for help without speaking over the session.
6. **Run the session.** Characters respond to the user and to one another. Users retain immediate pause and intervention controls.
7. **Review and continue.** Save a decision brief or practice report; retry an answer, revisit a choice, resume later, or start a related session with selected context.

### Required example: minimal input

User: "I'm defending my research proposal."

The system proposes an interview/rehearsal session and appropriate characters, such as a supportive examiner, a methodology skeptic, and an applications-focused examiner. These are suggestions, not a fixed three-person rule. The user can choose different roles, add a previously used character, edit a suggestion, and begin.

Users do not need to write character prompts or know which roles would help them. If a material detail is missing, the guide asks a short question with suggested answers while keeping other settings editable.

Example assistant response: "You want to defend your research proposal. I suggest a council with three different interests. Shall we focus on the method, or practise the whole defence?" This is illustrative copy; the actual response must reflect the user's input and available context. Virus proposes a session name, captures the answer, and brings forward the proposed panel without opening a multi-field setup form.

### Connecting the modes

A user can explore a proposal in court and then rehearse defending it before a council. Switching creates a linked session with a fresh role briefing and a user-reviewed context handoff. The earlier transcript and scores remain attached to the original session.

## 4. Session modes and formats

| Mode | User role | Character behaviour | Result |
| --- | --- | --- | --- |
| Discussion / decisions | Sovereign, moderator, participant, or observer | Present perspectives, respond to objections, propose options, and explain decisions. | Argument map, unresolved disagreements, decisions, and next actions. |
| Interview / rehearsal | Candidate, presenter, negotiator, or other user-defined role | Ask relevant questions, listen to answers, probe specifics, and deliver structured feedback. | Practice transcript, answer-specific assessment, and retry opportunities. |

The user's position and relationship to the characters must be evident in each environment. Characters in an interview act as the panel rather than continuing to defer to the user as their king.

### Discussion formats and intensity

- **Roundtable:** collaborative exploration, clarifying questions, and developing proposals.
- **Court hearing:** an explicit proposition with advocates, challengers, optional witnesses, and a user-directed ruling.
- **Adversarial discussion:** competing positions receive direct challenges and timed opportunities to rebut.

Format and intensity are separate settings. Calm, formal, probing, and heated verbal styles can be applied where appropriate. Intensity changes delivery and challenge; it does not require fabricated disagreement or automatic hostility.

### Custom shows, rooms and tone

Users can write or narrate the premise of a conference/show: what is happening, who the characters are, and what they should discuss. The premise may be a personal idea, a fictional situation, comedy, satire or a current news topic. Virus proposes a readback and cast; confirmation still precedes a live exchange. Room and tone can be selected through short choices or inferred in the proposed readback, without a new mandatory form.

| Show room | Behaviour |
| --- | --- |
| Roundtable | Seated, thoughtful discussion, with everyone heard before directed follow-ups dominate. |
| Heated panel | Forceful, short challenges and actual bounded audio cut-ins. At least every third contribution can finish; interruption and quiet controls remain immediate. |
| Comedy room | Playful callbacks, occasional natural laughter/interjections, expressive faces and hands, and responses to the previous character's actual words. |
| Serious newsroom | Sober source-aware reporting and analysis; distinguish reported claims, allegations, interpretations and unknown developments. |

Serious, funny, satire and mixed are independent tone choices. Clearly label satirical contributions as fictional in captions and speech; never pass invented quotations or allegations off as news. Each saved show retains its own premise, room, tone, language, cast and corrections. Switching shows pauses the current session; this release does not schedule several background programmes simultaneously.

Hindi discussion uses natural Devanagari replies and Sarvam Hindi speech, independently of the characters' reasoning models. Preserve existing English voice assignments; the Hindi route selects a stable Sarvam voice or a deliberately selected Sarvam assignment. Missing/failed Sarvam speech is reported without silently selecting another provider. Typed Hindi/Hinglish and recorded speech share the premise/readback path.

Recent Indian news is offered as dated publisher RSS headlines and short excerpts, with source links, publication/retrieval timestamps and explicit review before model use. Do not treat model memory as a current-news feed, imply independent verification, or silently reuse stale material. A selected story can start a new show while preserving the previous record.

### Custom interview and rehearsal scenarios

Templates offer optional examples and defaults. A custom situation is a first-class path.

| Example | Suggested roles | Example feedback criteria |
| --- | --- | --- |
| Research defence | Examiners with methodological, theoretical, and practical interests | Justification, clarity, evidence, and handling limitations. |
| Civil-services preparation | A formal, questioning board | Relevance, clear reasoning, balanced judgement, and handling uncertainty. |
| Investor pitch | A panel with different commercial interests | Problem clarity, support for assumptions, direct answers, and a clear proposal. |
| Job interview | Role-relevant interviewers | Specific examples, answer structure, relevance, and ownership of work. |
| User-defined situation | AI-proposed roles reviewed by the user | Criteria suggested from the user's goal and editable before starting. |

A scenario configures question strategy, goals, roles, interaction rules, and assessment criteria. It is more than a change of backdrop. Presets are practice scenarios; generated scores do not represent official examination marks or predictions of real-world success.

## 5. Character system and reusable library

### Separate identity, code, role, position, and brain

| Layer | Stored information | Persistence |
| --- | --- | --- |
| Character identity | ID, name, appearance, voice, personality, and animation style | Stable across sessions unless explicitly edited. |
| Guiding code | A short statement of principles and priorities, such as "Evidence comes first" | Saved character default with an explicit session override. |
| Session role | Examiner, skeptic, advocate, practical advisor, witness, facilitator, or custom role | Assigned for each session. |
| Current position | Proposal, stance, stated reasons, and subsequent revisions | Session-specific and allowed to change. |
| Brain assignment | Provider, actual model identifier, and verified availability | A character default with a session override. |

Appearance does not establish expertise. A role describes what the character is tasked to examine. A model assignment describes what actually generates its responses.

The code is a user-visible roleplay configuration, not a claim to reveal a model's internal beliefs. Show a short "My code" statement in the character inspector. Keep personality, guiding principles, and the current proposal separately editable. Saving a session override back to the character library is explicit.

### Modular avatar creation

- Build avatars from selectable faces, skin appearance, hair, beards, clothes, colours, and accessories, using a compatible modular asset system.
- Randomly generate a complete coherent character or reroll individual attributes without discarding the attributes the user has kept.
- Allow name, personality, guiding code, appearance, and voice edits before saving.
- Keep an appearance seed and explicit selected attributes so reopening a character reproduces the same result.
- Make simultaneously visible cast members distinguishable through appearance, voice, name, and position. Queued decision presenters also have distinct identities.
- Use reusable components and animation rigs suitable for the headset performance budget. New bitmap or 3D generation for every person is not a prerequisite.

### Voices

- Suggest a voice from the configured available voice pool, with delivery guided by personality and session style.
- Provide previews, manual voice selection, and compatible pacing/style controls.
- Randomisation selects a valid voice; the chosen voice remains attached to the character.
- Support more than one character per available voice where necessary, while using delivery differences and clear labels. Voice-pool limits must be visible rather than promising unlimited unique voices.
- Keep captions available and maintain the same identity when speech temporarily falls back to a supported synthesis route.

### Suggestions and saved characters

- AI recommends a suitable number of participants and explains each role's relevance.
- The cast picker combines new suggestions with a library of previously chosen/saved characters. Reusing a familiar character is possible without generating it again.
- Previously chosen characters are offered as candidates; users choose the active roster.
- Reusing a character preserves its identity and default preferences. Previous private scenario context is carried forward only when selected for the new session.
- Adding an existing character allows the user to assign a new role without overwriting its saved identity.
- Removing a character from a session does not delete it from the library.
- Starter-library characters are editable suggestions; no fixed named cast or profession is required to start a session.

**Initial capacity budget:** support 1–5 active participants plus an optional facilitator. AI recommends a count within the supported limit. The decision-presenter queue may contain additional identities with only a small visible waiting group. This is an implementation/performance budget, not a mandatory cast size.

### Per-character model selection

- Show both provider and actual model when that information is available. Provider logos alone do not claim a specific model was used.
- Retain the existing inspect/open-head interaction as a spatial shortcut to the brain picker, with an equivalent labelled desktop/in-world control. Its model choices, availability, and committed selection must match the ordinary picker.
- Each turn is routed through the selected speaker's actual assigned model. Multiple characters can use the same model.
- Changing a brain preserves identity, voice, guiding code, role, current position, and the session's committed transcript. The new model may subsequently revise the position through an attributed contribution.
- Apply changes at a safe turn boundary; cancel obsolete work and discard late results when necessary.
- Record which model produced each committed contribution.
- Unavailable models show a reason and explicit replacement choices. No silent provider substitution.
- Expose only selections actually supported by the active cloud or local connection. Model-specific selection requires adapter support; a CLI with an opaque default must be labelled honestly.

## 6. Session orchestration and user intervention

### Real interaction between characters

The session controller manages turn-taking, shared context, time, and state. Each speaking character generates its own contribution through its assigned brain.

1. Brief participants on the user's problem, their role and guiding code, the permitted material, and the session rules.
2. Every speaker, including a new participant's first turn, receives the latest actual contribution. Give an independent viewpoint while responding to that claim; a private position note is not a spoken utterance.
3. Run bounded exchanges in which speakers can refer to a specific earlier claim, ask another character a question, answer an objection, or revise their position.
4. Give participants opportunities to respond to direct challenges and prevent one character monopolising the session.
5. Summarise strongest arguments and unresolved disagreements. Agreement is optional.
6. Ask the user for a ruling or next action where the format calls for one.

A single model writing a complete fictional multi-character transcript does not satisfy the per-character brain requirement.

Corrections are durable session memory. Retain exact user statements and version the working topic/goal separately from the original readback and old model replies. Latest direct corrections govern every later speaker and brain assignment; one response consuming an intervention must not erase its meaning. Retired topics must stay retired. Topic changes clear stale current positions and exclude obsolete turns from current argument context while retaining the full historical transcript. A failed or interrupted topic update keeps the user's words and offers an idempotent retry before further inference.

A group has at least two actual cast participants. “Discuss it with others” must invite complementary persistent characters and open per-character turns; a lone Host cannot impersonate a group. Invite without another creation form, use the selected brain/voice as an explicit initial assignment, and allow individual changes afterward. Partial invitation retries preserve the planned identities. A single participant requires explicitly chosen one-to-one coaching.

Each substantive turn must add a proposal, explanation, question, response to a named claim, or explicit revision. Redirect repeated summaries and off-topic exchanges. The moderator may surface unresolved questions or end a repetitive exchange; it must not manufacture disagreement, force consensus, or treat the most persuasive speaker as factually correct.

For rehearsal, the panel follows the candidate's actual answers and probes relevant details. Panelists can build on one another's questions without turning the session into an unrelated debate among themselves.

### User controls

Users can participate or observe and can:

- Pause, resume, stop, request a summary, or change the remaining duration.
- Point/select a character to address them or give them the floor.
- Ask for a direct answer, clarification, simpler language, an example, or supporting evidence.
- Challenge a claim, ask what would change someone's view, or request a change of sides.
- Add or remove a participant at a paused boundary and review the resulting role/turn changes.
- Award or revise a rating, defer a decision, make a ruling, or retry an interview answer.

Voice commands have selectable desktop and in-world equivalents. Destructive or session-ending actions must be distinguishable from ordinary scenario dialogue.

Virus is a guide to application actions, not an unrestricted controller. His suggestions use validated actions through the same session service as selectable controls. Capturing notes must not silently approve a cast, change a brain, start an exchange, or make a decision. The user can say/select "What have you noted?", correct a point, request details, repeat a lesson, or ask him to be quiet. Keep the caption, microphone/listening state, pause/stop/exit, and the current small choice group available; expand full settings only when requested or needed for recovery.

All setup, text entry, character/model selection, intervention, rating, decision, report review, and exit actions must be reachable with Quest hands alone. Microphone use and controller pairing are optional. Provide a hand-selectable keyboard/text path and visible pause control. A raised-hand interruption may be offered as a shortcut; the standard selection control must remain available.

### Timing, interruption, and recovery

- One foreground speaker at a time by default. Listening, thinking, speaking, interrupted, and failed states are visible.
- The explicitly selected heated room can prepare a response/voice while another character speaks and cut the previous audio short when the next reply is ready. Store actual interruption timing and the interrupting contribution; do not claim an interruption when playback already ended. Cloud audio has measured elapsed/total times; device speech records elapsed time without inventing a total duration. Quiet mode and single-step remain sequential, every third contribution is protected, and normal rooms keep the default floor policy.
- Pause/stop and accepted intervention events act locally without waiting for a model or network acknowledgement. Stop current audio, yield the floor, and reject late responses that belong to the interrupted exchange.
- Use bounded turns and a user-configurable session duration; suggest about ten minutes for an initial session. Show the remaining time and let the user end with a partial outcome.
- Enforce limits on turns, per-turn output, concurrent requests, and total session usage. Warn when a known limit is near; continuing beyond a configured session budget requires a user action. Show a cost estimate only when supported by current provider data.
- Automatic turns stop on pause, settings, loss of connection, session end, or the configured usage/time limit.
- A genuinely essential question for the human pauses the turn loop and clock. Offer a reply path and explicit continuation with assumptions. Do not keep automatically asking variants of the same intent question; ordinary exploratory ideas should advance through concrete benefits, risks and tests. Retired-topic drift or repeated clarification permits at most one bounded model repair, then pauses without committing fabricated progress.
- Show actual waiting state without claiming progress that has not occurred.
- Save committed turns and events incrementally. Reconnecting restores the last consistent session without duplicating turns or ratings.
- Failed model/TTS requests offer retry, skip, or a user-chosen available replacement. Partial sessions can still produce a clearly labelled partial report.

## 7. Decision hearings and the line of presenters

Decision hearings are an optional workflow within the throne court. A line of distinct people brings individual choices to the sovereign. Each person owns a decision topic rather than reading arbitrary fragments of one long response.

### Presentation structure

Each presenter explains:

1. The choice being made and why it matters.
2. The available options, including deferral where meaningful.
3. Relevant consequences and tradeoffs.
4. Assumptions, missing evidence, and dependencies.
5. The decision requested from the user.

Users can ask for a simple explanation, a fuller explanation, or an example. Explanation depth changes presentation without hiding material tradeoffs.

The council can discuss or challenge the choice before the user decides. A presenter's assigned perspective is visible; presenting a choice does not grant special authority over it.

### Queue behaviour

- Show the active presenter and a small, distinguishable waiting group, with a browsable list of upcoming topics.
- Bring the next presenter forward when called. Stage character movement while keeping the user's headset camera under user control.
- Support skip, defer, reorder where dependencies permit, recall, and revisit.
- Decisions can change what should come next. Recalculate dependent choices and show why a topic was added, changed, or made irrelevant.
- Record the user's explicit choice and rationale; a generated suggestion or character vote does not silently become the user's decision.
- Reopening an earlier decision marks dependent decisions for review rather than silently preserving incompatible outcomes.

Example: a product-launch hearing might bring choices about audience, scope, demand testing, and success criteria. Other user-defined problems produce their own decision structure.

## 8. Scoring, positions, and feedback

### Discussion: the user rates contributions

- Attribute ratings to a specific contribution and character; aggregate them into a visible session total.
- Offer simple criteria such as clarity, useful challenge, responsiveness, and support from available evidence.
- Make the rubric editable and record the rubric version with the session.
- Show why points were awarded, who awarded them, and any later revision. Users can undo a rating.
- Keep ratings available throughout discussion without interrupting speech. Looking/selecting a character can reveal its contribution history and rating actions. A score change updates the right-hand total and its explanation from the same saved event.
- Keep user-awarded points separate from automated suggestions or moderator assessments.
- Scores describe performance under the rubric. They do not turn popularity, forceful delivery, or model agreement into established fact.

### Rehearsal: the system gives coaching feedback

- Review the candidate's actual answers against the agreed scenario rubric.
- Give specific examples from the transcript, explain a score, and suggest a concrete improvement.
- Offer a retry and comparison against the same criterion.
- Show feedback after a realistic mock session by default; live coaching is an explicit practice option.
- Preserve the distinction between assessing spoken answer content and measuring delivery. Audio, gaze, or gesture metrics require the actual supporting signal and validation.
- Users can rate panel usefulness independently of their own assessment.

### Spatial presentation

| Region | Court discussion | Interview/rehearsal |
| --- | --- | --- |
| Left of the main action | Who each character is, their guiding code, current position, and main reason; show position changes | Optional panel-role/context information; minimised during a realistic mock. |
| Centre | Speaker, other participants, current claim/choice, and shared evidence | Council, current question, and optional user-provided presentation material. |
| Right of the main action | Scores so far and explanations for recent points | Post-session feedback and progress; live only when coaching is enabled. |

Side displays remain available by looking/selecting, with concise default content and accessible expansion. Important controls and current captions stay close to the main action rather than requiring repeated large head turns.

## 9. Environments, presence, and onboarding

### The throne court

The visual reference is the scale and atmosphere of grand medieval political fantasy: monumental stone architecture, tall columns, banners, torchlit accents, an imposing throne dais, and a clear central hearing space.

The user occupies the throne. Characters can face the sovereign and one another. The layout includes a discussion group, an active-presenter position, a visible queue, and restrained information surfaces. Grandeur should come from scale, composition, lighting, and art direction within the rendering budget.

The throne court and council chamber remain the base environments. The court also supports distinct conference/show room presets, with seated characters, a shared conference table, chairs, programme backdrop and room-specific presentation. These presets share the base architecture; they are separate saved show configurations rather than a new mandatory navigation journey.

Desktop TV framing follows committed speaker turns using speaker, two-person and wide shots. Dragging/arrow keys/Home take manual control, and the user can re-enable TV camera. Respect reduced-motion preferences. Automatic TV framing never moves the headset camera. Seated knees, feet and hands use the actual avatar rig; speaking gestures, gaze and listening reactions follow real floor/playback state.

### The council chamber

A separate environment gives the user the experience of approaching a council. It has a distinct layout, candidate position, council table or raised seating, entrance, and composition.

The user has a seated position before the panel rather than on a throne; standing is optional. Panel members direct attention toward the candidate and toward the current questioner. The chamber retains the fantasy-world identity while adapting session material and props to the user's custom situation.

An entrance/approach can be represented through scene staging, user-controlled movement, or comfortable transitions. Immersive VR must not require forced camera travel. Desktop can offer a skippable approach sequence.

### First use and returning users

Virus is present before cast creation. He is a reusable assistant identity with a selectable brain/voice, separate from the discussion participants, and may occupy the facilitator slot when needed. His new role is orientation, note-taking, and session guidance. Reusing his character does not reinstate the retired coding tour or professional cast.

### Interactive first five to ten minutes

The timing below is a pacing target, not a timer that completes steps. Build lessons around the user's actual task wherever practical.

| Target elapsed time | Guide-led action | Evidence of understanding |
| --- | --- | --- |
| 0–1 minute | Meet Virus, enable audio through a user action, explain what the app can help with, and offer quick practice or direct start. | The user chooses how to continue; captions and quiet/exit controls are available. |
| 1–2 minutes | Virus demonstrates pointing and pinching a nearby target, then invites the user to select him or a contextual choice. Desktop teaches the equivalent click. | An actual select event activates the intended target and gives immediate feedback. |
| 2–3 minutes | Speak or write the situation. Virus takes notes, reads back the goal/constraints, suggests a session name, and invites correction. | The user confirms or corrects the captured meaning; failed recognition never counts as a received answer. |
| 3–5 minutes | Virus introduces a suitable cast/room, starts a short relevant exchange after confirmation, and teaches pause/interrupt and giving someone the floor. | A real response relates to the user's situation; the user interrupts/selects and the application yields immediately. |
| 5–7 minutes, optional | Show "My code", brain inspection/swap, and the left positions/right scores using available choices and actual recorded contributions. | The user inspects a character or tries the relevant action. A demonstration never presents an unavailable model as connected. |
| 7–10 minutes, optional | In court, call a presenter, request a simpler explanation, rate or make/defer a choice. In rehearsal, answer a follow-up and inspect/retry feedback. Teach return/resume as the session reaches an outcome. | The user performs the relevant action and can identify the saved choice or practice insight. |

- Virus explains and demonstrates one interaction at a time; the user tries it. Do not replace practice with a long speech, a page of instructions, or another sequence of forms.
- Users can interrupt, repeat, skip, ask for slower/simpler guidance, or start their task immediately. No forced five/ten-minute wait and no compulsory cinematic or camera travel.
- A lesson completes only after the relevant action succeeds, or is explicitly recorded as skipped. Silence, failed tracking, an unavailable model, a timeout, or unfinished narration must not mark it complete.
- Captioned/scripted gesture guidance remains available when inference or speech is unavailable and is labelled as guidance. AI-generated task discussion must not be faked to make the introduction appear successful.
- Speech is optional. Hand-selectable short choices and text input provide the same note-taking/confirmation path. Desktop keeps the assistant-led journey with accessible click/keyboard alternatives.
- Virus autosaves captured notes as drafts through the session service and shows a brief saved/waiting/error cue. He claims a note is saved only after acknowledgement, preserves unsaved input on failure, and accepts corrections without duplicating sessions.
- Tutorial skill progress belongs to the profile and tutorial version; current lesson and scenario notes belong to their session. Save completed/skipped states and resume interrupted guidance without restarting the whole introduction.
- Returning users are greeted with resume/new-situation choices and reusable casts. Do not repeat mastered lessons automatically; individual gesture/app lessons remain callable at any time.
- Settings pause guidance and exchanges. Restart/skip, guide replacement, or room changes must not trigger stale narration, auto-start a session, or discard notes.

## 10. Context, outcomes, and saved state

### Context supplied by the user

Support typed/pasted background and selected local text/PDF context for the first release, with bounded size, visible extraction status, and user review of extracted text. Explain when a file or scanned page cannot be read. Additional rich slide/document formats can follow the first release.

Show which material is available to the panel. Scenario text and document contents are source data rather than instructions capable of changing application controls or model routing.

Distinguish user-provided facts, assumptions, sourced claims, and unverified assertions. If external lookup is unavailable, say what remains unverified. Broader source retrieval is not a prerequisite for running a session.

### Outcomes

| Discussion / decisions | Interview / rehearsal |
| --- | --- |
| Problem and constraints | Scenario, role, and agreed rubric |
| Options and strongest arguments | Questions and actual answers |
| Supporting material and evidence gaps | Answer-specific strengths and improvements |
| Unresolved disagreements | Explained assessments and retries |
| Explicit user decisions and reasons | Recommended next practice steps |
| Deferred choices and next actions | Links to related sessions where selected |

Reports and transcripts can be reopened and exported as readable text/Markdown and structured JSON. The visual experience and voice output must agree with the saved record.

### Proposed domain objects

| Object | Core fields |
| --- | --- |
| Character | Stable ID, name, avatar seed and attributes, personality, guiding code, voice configuration, default brain. |
| Scenario | Goal, situation, mode, format, intensity, context references, duration, and rubric. |
| Participant | Character ID, session role, guiding-code snapshot/override, initial/current position, session brain, and active state. |
| Session | ID, profile, environment, status, scenario, roster snapshot, transcript, and event sequence. |
| Contribution | Speaker, provider/model provenance, text, related claims/questions, position revisions, and timestamp. |
| Rating | Contribution/character, criterion, value, author/source, revision, and timestamp. |
| Decision point | Topic, presenter, options, dependencies, explanation depth, choice, rationale, and status. |
| Outcome | Report type, summary, unresolved items, decisions/feedback, and linked retries. |
| Guide progress and notes | Profile/tutorial version, guide identity, lesson states (pending/completed/skipped), active session/step, captured user statements, proposed interpretations, and confirmed corrections. |

Snapshots preserve what was used in a session even if a library character or model default is edited later. Profiles are existing convenience boundaries; they must not be described as authenticated accounts.

## 11. Existing foundation and implementation changes

The following baseline comes from repository inspection and Waves 1–6 implementation through October 27. It describes source capabilities and local verification; timed unfamiliar-user and physical-headset acceptance remain pending. The wave audit files record delivery and remaining constraints.

| Area | Existing foundation | Pivot work required |
| --- | --- | --- |
| Rendering | Staged throne hall/dais, presenter/waiting areas, separate council greybox, six realistic animated people, adaptive cast layout, gaze/speaker states, native caption/action/left-view/judgement surfaces and hand selection | Final council staging in W08, physical Quest readability/comfort and performance in W10/W11. |
| Characters | Stable Virus guide, saved realistic model identity, actual-model portrait selection, supported tint/accessories, kept rerolls, guiding codes, reusable library, independent roles, real voice/model assignments and mixed saved/new cast suggestions | Compatible art for independent hair/beard/clothing cuts in W11; presenter queue in W07. |
| Guide and introduction | Conversational capture/readback/correction, acknowledged notes, context review, explicit setup approval, action-based selection/input/interruption/brain lessons, group start/pause/help and persisted skip/resume | Connect rehearsal and later optional lessons in W07/W08; complete timed journey validation in W10. |
| Conversation | Direct and spatial cast discussion, referenced objections/answers, left-side views/reasoning, explicit floor assignment, participation scheduling, saved actual-model provenance, cancellation and duration/turn/request budgets | User scoring/presenters in W07 and rehearsal controller in W08. |
| Brain selection | Cloud model catalogues, per-character assignments, safe swaps and head inspection shortcut | Local CLI model selection remains unavailable/unverified; release documentation must retain this limit until validated. |
| Speech | OpenAI speech/transcription, permitted ElevenLabs catalogue/voices, explicit device voice choice, captions, preview, pacing, repeat/quiet and one-speaker group coordination | Physical microphone/tracking checks and final personality-aware delivery. |
| Persistence | Profile-scoped versioned sessions/libraries, guide snapshots/progress, acknowledged notes and corrections, reviewed context, proposal provenance, revisions, ordered events, idempotent saves and cancellation epochs | Decisions/ratings and complete outcome/report journeys. |
| Outcomes | Saved draft list, paused discussion recovery, attributed turn review and honest partial summaries | Decision briefs, rehearsal reports, full transcript review, and export in W09. |
| Hosting | Independent loopback session service, desktop HTTP, headset HTTPS, Docker inputs without a browser dependency | Production/public verification and model/voice integration. |

### Architecture direction

- Reuse the Three.js/WebXR client and the existing Node service.
- Add a session controller for state transitions, roster management, scheduling, bounded model calls, cancellation, and persistence.
- Pass a stable role/code/context brief and the committed relevant transcript to each assigned character model.
- Validate structured responses before committing a turn or changing session state.
- Reuse cloud and local provider adapters, exposing their real capabilities and availability.
- Keep the actual backend mode visible in setup. A preference cannot silently change server execution mode.
- Cloud model access remains server-managed, with local inference available through supported existing adapters. A hosted user must not need developer tooling or a local working directory to run a session.
- Both modes use the session service directly and must start without any retired service running. The retirement boundary is defined in section 15.
- Version new storage schemas. Preserve existing project data and the internal .sovereign directory; migration must not delete or overwrite old artifacts.
- Keep usage/time limits enforced server-side. The orchestration loop must not continue indefinitely after a user stops, disconnects, or reaches a limit.

Specific model IDs, voice availability, connection health, and deployed service state must be checked at implementation time. Provider and voice catalogues describe verified available choices rather than a fixed branded cast.

## 12. Functional acceptance criteria

| ID | Release requirement |
| --- | --- |
| AC-01 | A user can say or write a situation sentence to Virus and receive a useful suggested format and cast without completing a setup form or writing participant specifications. |
| AC-02 | The picker includes new suggestions and previously selected/saved characters; adding either works without forcing the others into the roster. |
| AC-03 | A user can generate, partially reroll, edit, preview, save, and reopen an avatar/voice identity consistently. |
| AC-04 | A character has an inspectable/editable guiding code distinct from personality and current position. Changing role or brain preserves identity/code; reusing it does not silently import old scenario context. |
| AC-05 | At least two available model assignments can be used in one session; each committed response records the actual route and unavailable selections are handled explicitly. |
| AC-06 | A live discussion includes a response to a specific earlier contribution, a direct objection and answer, and a visible position revision when warranted. Repetition is redirected; consensus is optional. |
| AC-07 | Voice and selectable controls can interrupt, pause, resume, redirect, and stop locally without waiting for inference; stale responses cannot restart speech or turns, and usage limits stop scheduling. |
| AC-08 | The throne court presents the user as sovereign, with positions on the left and contribution scores on the right. |
| AC-09 | Distinct queued presenters explain individual choices at simple/full depth; users can defer, revisit, and explicitly decide, with dependent choices updated. |
| AC-10 | A separate council environment presents the user as the candidate/presenter. It supports custom scenarios and responsive follow-up questions. |
| AC-11 | User ratings and model-generated assessments remain distinguishable, explainable, revisable, and linked to actual contributions. |
| AC-12 | Rehearsal produces answer-specific feedback and a retry path; realistic sessions can run without a live scoreboard. |
| AC-13 | Background material can be supplied and reviewed; unreadable/unsupported content and unverified claims are represented truthfully. |
| AC-14 | Both modes save and resume consistent state and export the appropriate transcript and outcome report. |
| AC-15 | A linked transition between modes lets the user review transferred context, reuses selected characters, and preserves the original record. |
| AC-16 | Both complete journeys work on desktop and with Quest hands alone, including text entry, setup, rating, reports, and exit. Controllers and microphone are optional; captions and recovery states remain readable. |
| AC-17 | Both new journeys run independently of retired services. Their onboarding, main navigation, prompts, and outcome controls contain only discussion/rehearsal actions; preserved legacy data remains intact. |
| AC-18 | All first-release requirements in this PRD are delivered by the November 18 target; neither core mode nor assistant-led entry is deferred to a post-demo release. |
| AC-19 | Virus-led setup is the default in desktop and VR: capture/read back/correct notes, suggest room/name/cast, autosave acknowledged drafts, and confirm before starting. Detailed forms are optional; microphone-free alternatives work. |
| AC-20 | The first-use journey teaches point/pinch, input, and pause/intervention through successful actions, with a useful exchange targeted by five minutes and optional deeper practice through ten. Repeat/skip/resume work, progress is scoped/versioned, and failures do not falsely complete lessons. |
| AC-21 | User corrections govern subsequent speakers after consumption, reload, interruption and a brain swap. Group mode includes multiple real persistent participants, referenced objections/answers and concrete progress. Essential human questions pause scheduling; repeated clarification cannot become an automatic loop. Lost acknowledgements and partial invitations retry without duplicate notes or characters. |
| AC-22 | Characters sit around a shared table with moving rigged hands and responsive gaze. Desktop TV shots follow actual turns and can be disabled; VR stays head-controlled. A typed/narrated premise and persisted room/tone choices support serious, funny, satire and mixed shows. Every character hears the latest actual utterance and receives a first turn. |
| AC-23 | Hindi replies play through configured Sarvam voices; failures remain explicit. Current-news excerpts retain source/date/review boundaries. Heated-room cut-ins record actual playback timing while preserving pause, budget and fairness guarantees; normal rooms, quiet mode and single-step remain sequential. |

## 13. Quality, validation, and release evidence

### Comfort and performance targets

- Support seated use on Quest 3/3S and desktop. Keep head movement controlled by the headset and offer comfortable environment transitions.
- Design primary actions within roughly ±25 degrees horizontally, captions/current material within ±30 degrees, and the main speaking group within roughly ±40 degrees where practical. Expand side information on demand.
- Target sustained 72 Hz on supported Quest hardware, with a roughly 13.9 ms frame budget at that refresh rate. These are targets requiring measurement, not current results.
- Keep only the active room and necessary cast/queue detail fully rendered. Budget geometry, materials, lights, shadows, and animation against device measurements.
- Provide captions, speech stop/mute, reduced-motion behaviour, and selectable alternatives to voice/gestures.

### Two required release walkthroughs

Both walkthroughs begin with Virus-led orientation and situation capture, not the Wave 1 setup form. For a first-time user, demonstrate selection and interruption, confirm/correct the guide's notes, and observe the applicable five-to-ten-minute learning journey. Also exercise direct-start/skip and returning-user resume.

| Walkthrough | Required observable evidence |
| --- | --- |
| Court decision | Enter a situation, accept/edit a suggested cast, inspect guiding codes and model assignments, hear a claim-specific exchange, interrupt and redirect a speaker, award/undo a point, call a presenter, change explanation depth, decide/defer/revisit, and reopen/export the decision brief. |
| Council rehearsal | Enter a custom situation, select new/saved panelists, face the seated panel, answer a question, receive a follow-up based on that answer, pause/resume, finish, review transcript-linked feedback, retry an answer, and reopen/export the practice report. |

Run both walkthroughs on desktop and physical Quest with hands alone, including the text-input alternative. Repeat the affected steps with a model failure or interrupted connection, confirm recovery from the saved record, and record any unsupported operations as failures rather than implying coverage. Demonstration scripts are evidence of the responsive product, not substitutes for completing these release journeys.

### Required verification

Before W07, replay the failed offline/mindfulness LeetCode conversation using its five exact corrections and a copied legacy single-Host setup in an isolated store. Verify later turns without re-entering corrections, an explicit brain swap, three real participants with at least two actual providers, a reference to another speaker's argument, and useful design/tradeoff/test content. Inspect the resulting text as well as host assertions. Browser checks must cover failed/lost correction receipts, reload, group invitation, waiting for human input and native hand controls. Keep the original completed conversation byte-identical. A model-written fictional group transcript or interface-only pass does not satisfy this gate.

- Domain tests: stable character identity, code/role/model separation, routing, turn scheduling, cancellation, rating revisions, decision dependencies, persistence, migration compatibility, scoped tutorial progress, and acknowledged note-taking/corrections.
- Browser end-to-end journeys: assistant-led input/readback without mandatory forms, real gesture/selection lessons, skip/repeat/resume, saved-character reuse, both modes, interventions, reports, exports, linked mode switching, and model/speech/tracking failure recovery.
- Physical headset checks: selection accuracy, speech interaction, readability, interruption behaviour, seating/layout, scene transitions, and measured frame time. Desktop XR emulation supports development but does not establish physical comfort.
- Content review: scenario relevance and assessment quality checked with representative users and appropriate subject expertise for specialised presets.
- Hosted checks: both modes through the actual public access path, with no local coding setup required for a cloud user.
- Retirement checks: new navigation and model instructions do not invoke retired workflows; both modes work when retired services are disabled, and migration leaves old records readable in their existing storage.

### Product validation

Use representative discussion and rehearsal tasks, with comparable desktop and VR sessions where feasible. Measure:

- Time from a one-sentence situation to starting a useful session.
- Whether an unfamiliar user reaches a useful exchange and performs selection/interruption within five minutes, with optional deeper gesture/app practice and a useful outcome around ten minutes, without external human assistance. Record setup/connection delays and skipped/repeated lessons separately.
- Whether users can explain what Virus captured, correct a misunderstanding, and proceed without opening the detailed form. Record where a screen or explanation becomes necessary instead of counting spoken narration as successful onboarding.
- Whether users understand why suggested characters were selected and can change them.
- Whether discussion surfaces a useful overlooked tradeoff, evidence gap, or decision.
- Whether rehearsal feedback identifies a specific improvement and helps a retry.
- Interruption/control success, failure recovery, and session completion.
- Voluntary return with another situation and preference for VR versus desktop.

Confidence ratings alone are not evidence of better decisions or improved performance. Record baseline and follow-up observations before claiming improvement.

## 14. Delivery plan — full release by November 18

The twelve waves below take the existing prototype through the complete agreed first release. They are implementation milestones, not twelve separate products. **W01–W06 are implemented and locally verified for the configured cloud mode; W07–W12 are planned. Physical Quest acceptance remains pending.** An existing reusable component does not make its new-product wave complete. Mark a wave complete only when its stated check has been demonstrated and recorded.

Dates are target scheduling windows in Asia/Calcutta, 2026, rather than validated effort estimates. The schedule is aggressive. Wave 1 must check feasibility against the repository and provider/device constraints, and surface any affected requirement and tradeoff. Both modes, both environments, editable reusable characters, brains, interventions, scoring, presenters, and outcome records remain in the first release.

### Wave overview

| Wave | Target window | Deliverable | Depends on |
| --- | --- | --- | --- |
| W01 | October 26–27 | Session foundation, storage boundaries, and retirement of the coding journey | Existing repository |
| W02 | October 28–29 | Virus/guide identity, modular characters, guiding codes, library, and guide-progress foundation | W01 |
| W03 | October 30–31 | Guide/character voices, listening, real model routing, and brain swapping | W01, W02 |
| W04 | November 1–2 | Virus-led note-taking/setup, core gesture introduction, reviewed context, and cast suggestions | W01–W03 |
| W05 | November 3–5 | Character-to-character discussion and immediate user intervention | W03, W04 |
| W06 | November 6–7 | Throne court, spatial staging, and discussion controls | W02, W04, W05 |
| W07 | November 8–9 | Contribution scoring and the decision-presenter queue | W05, W06 |
| W08 | November 10–12 | Council chamber, custom interview/rehearsal, feedback, and retries | W02–W05; shared interaction components from W06 |
| W09 | November 13 | Complete outcome reports, session history/resume, and linked modes | W07, W08; persistence starts in W01 |
| W10 | November 14–15 | Guided-journey validation, returning-user flow, accessibility, and hands-only completion | W04, W06–W09 |
| W11 | November 16–17 | Final art/audio polish, headset performance, and release-candidate verification | W01–W10 |
| W12 | November 18 | Hosted release, user documentation, and submission package | W11 |

Numbering gives the recommended integration order. Independent environment or component work can overlap after its prerequisites exist; no later wave may assume unfinished dependencies are complete. Hands-first controls, persistence, cancellation, and verification are cross-cutting work from their first relevant wave, not postponed until W10 or W11. Both environments begin as usable greyboxes in W01 and receive their final staging in W06 and W08.

**Assistant-led UX is on the early critical path:** W02 supplies Virus before cast creation, W03 enables his real speech/listening and brain, and W04 replaces mandatory forms with guided note-taking and interactive gesture lessons. W05–W09 connect the relevant lessons to real session actions. W10 validates and refines the complete first-five/ten-minute journey; it is not the first implementation of onboarding. The schedule must account for this work within the existing twelve waves.

### W01 — Session foundation and removal of the coding journey

- Audit the existing scene, setup, speech, provider adapters, profiles, storage, and hosting; record reuse decisions, unavailable capabilities, and schedule risks.
- Introduce versioned Character, Scenario, Participant, Session, Contribution, Rating, Decision point, and Outcome records. Define event ordering, session states, cancellation identifiers, and profile/session boundaries.
- Establish session create/load/save services, incremental persistence, and compatibility handling that preserves existing records and artifacts without treating them as new sessions.
- Replace the default coding entry/setup with the new session shell. Isolate retired routes, instructions, navigation, and preview-service dependencies; do not delete saved data.
- Establish seated greybox layouts for the throne court and council chamber and a basic desktop/Quest hand-selection path. Identify any provider/device access needed for subsequent validation.

**Completion check:** The new shell opens and saves/reloads a correctly scoped session with the retired preview/build services disabled. Old data is preserved, states/events are validated, and the implementation audit identifies the remaining work and constraints. No live discussion is claimed complete at this point.

**Status — completed locally, October 26:** The independent shell/service, versioned domain, scoped save/reload, revision/idempotency/cancellation rules, preserved-data boundary, and both greyboxes are implemented. Unit/service tests, browser save/recovery journeys, the production build, and emulated Quest hand selection/save/exit pass. Physical comfort, live model/voice access, and public deployment remain unverified and are not Wave 1 completion claims. See [WAVE_1_AUDIT.md](WAVE_1_AUDIT.md).

**UX follow-up:** The implemented Wave 1 form proves the storage/setup boundary only. It is temporary scaffolding to be replaced as the default by Virus-led entry in W04; Wave 1 completion does not approve a form-heavy final interface.

### W02 — Character generation and reusable cast library

- Establish Virus as a visible bootstrap guide before any cast-selection requirement, with a stable saved identity and defaults that can later be replaced by the user's chosen assistant. Scaffold profile/version-scoped tutorial progress and session-scoped notes/lesson state without recording lessons as completed automatically.
- Refactor fixed role-based characters into stable character identities with independent session roles, guiding codes, and positions.
- Implement compatible modular faces, skin appearance, hair, beards, clothes, colours, accessories, and reusable animations. Support a complete random character and per-attribute rerolls with kept attributes.
- Add name/personality/"My code" editing, appearance previews, deterministic seeds, and saved explicit attributes. Store voice preferences for connection to the actual voice pool in W03.
- Add a profile-scoped character library with save, edit, reopen, reuse, and remove-from-session behaviour. Session overrides and library edits must remain distinct.
- Support the documented active-cast budget, distinguishable appearances, dynamic character spawning/removal, and lightweight representations for later queued presenters.

**Completion check:** Virus is visible and selectable on entry without requiring a completed cast. A user creates/edits a character, rerolls one attribute while keeping others, saves/reloads it consistently, and reuses it under a new role without importing prior context. Multiple characters render/animate in the greybox; guide identity/progress records remain scoped and persistent. Live guide conversation follows in W03–W04.

**Status — completed locally, October 26:** Virus, the optional modular character editor, deterministic appearances, kept/individual rerolls, library persistence, voice preferences, default-guide selection, one-to-five participant roster budget, independent roles and session snapshots are implemented. Profile/tutorial-version progress and session notes/current-lesson envelopes are scaffolded; lessons remain pending. Browser and emulated Quest checks cover selection, saved-character reuse and recovery. The large setup form is now an optional detail view. Actual guide conversation, acknowledged note capture and the interactive five/ten-minute introduction remain W03–W04 work; physical Quest performance remains unverified. See [WAVE_2_AUDIT.md](WAVE_2_AUDIT.md).

### W03 — Voices, per-character brains, and model routing

- **W06 show follow-up:** add and live-test Sarvam Hindi speech, stable supported voice choices, previews and explicit failures without changing reasoning brains or saved English voice choices.

- Incorporate the avatar-workshop correction: no mandatory dropdown grid, long scroll or repeated manual saves. Direct feature selection, visual options, temporary previews, AI descriptions and one-action join must work through shared desktop/hand controls. Keep detailed identity edits optional and use paged in-world choices/captions/text input.

- Wire the guide's distinct voice, captions, visible listening/thinking states, microphone-free input, quiet/repeat, and immediate interruption before requiring any additional participant. Preserve one-speaker coordination when the guide hands off to a cast member.
- Audit the real capabilities of each existing local/cloud adapter. Expose available providers/models and connection status without promising unavailable model selection.
- Route each character's contribution through its own assignment and record actual provider/model provenance. Demonstrate at least two supported model assignments within one session.
- Connect the configured voice pool, valid random voice selection, preview, pacing/style controls where supported, captions, and synthesis fallback. Preserve the saved voice identity.
- Generalise the ordinary picker and inspect/open-head shortcut to dynamic characters. Apply a brain change at a safe boundary while preserving identity, code, role, position, and committed history.
- Integrate transcription, typed input, coordinated speech playback, cancellation, usage limits, and explicit retry/skip/replacement states. Provider failures must not silently change a brain.

**Completion check:** Virus can hear/read input, give a real attributed reply, and be interrupted/repeated/quieted, with captions and supported alternatives when voice fails. Two characters produce replies through verified assignments with their own speech/captions. Voice preview/reload and brain swapping preserve identity; late results cannot restart cancelled audio or speak as the wrong character.

**Status — completed locally for cloud mode, October 26:** The workshop correction, real guide/character replies, provider/model catalogues, actual response provenance, saved assignments, cloud speech/transcription, voice preview/pacing, captions, quiet/repeat/interruption and in-world text input are implemented. Live service checks used OpenAI and Claude for different characters in one saved session, validated an AI avatar proposal, and completed speech/transcription. Automated checks cover stale replies, safe swaps, retry, scoped persistence and server budgets. The supplied ElevenLabs key is permission-limited (`voices_read`); OpenAI/device voices remain explicit alternatives. Local CLI model selection, physical Quest microphone/comfort/frame rate and public deployment are unverified. W04 still owns acknowledged setup notes and the full action-based five/ten-minute introduction. See [WAVE_3_AUDIT.md](WAVE_3_AUDIT.md).

### W04 — Virus-led setup, note-taking, and core gesture introduction

- **W06 show follow-up:** typed/narrated premises, short room/tone choices, proposed genre confirmation and reviewed dated-news excerpts share the same capture/readback flow. Hindi capture and readback must preserve the user’s words.

- Keep one current choice group beside the guide, page long readbacks/context, and surface saved/waiting/error receipts. Direct UI commands and interruption must stay available during setup. Label the current realistic-room/stylised-editor prototype honestly; an appearance preview is not proof of realistic cosmetic support.
- Replace the default room/title/situation form with a conversation led by Virus. Accept one sentence or an optional template, ask one necessary question at a time, infer sensible defaults, suggest a name/room, and show only the current contextual choice. Retain detail forms as an explicit edit/fallback view.
- Implement capture/readback/correction of situation, goal, and constraints, draft autosave with receipt/error handling, and explicit user confirmation before starting. Notes must retain the distinction between user statements and proposed interpretations.
- Implement the early interactive introduction: meet/enable audio, point-and-pinch practice, spoken/selectable/text input, and pause/interrupt/give-floor practice with the guide. Offer direct start, skip, repeat, help, and slower/simpler explanation; require actual action success or explicit skip for lesson progress.
- Add bounded pasted/text/PDF context, visible extraction status, unreadable-content handling, and user review of the material available to the participants.
- Generate a proposed mode, format, intensity, goal, duration, rubric, and relevant cast, with short explanations of why each role helps.
- Combine newly suggested characters and saved characters in one cast picker. Support add, remove, replace, reroll, edit, and user-specified rosters without forcing a fixed cast size.
- Have Virus recap the essential setup and obtain a start action. Keep guiding codes, context, model readiness, duration, and limits inspectable without requiring users to visit every setting. Persist/resume the lesson step and confirmed notes across reload and recover from failed input or unavailable inference without fabricating progress.

**Completion check:** A new user meets Virus, selects a real tutorial target, describes "I'm defending my research proposal", corrects/confirms his notes, mixes saved/new cast suggestions, and reaches an explicitly confirmed setup without a mandatory multi-field form or manual save step. Guide interruption, skip/repeat/resume, microphone-free input, and save failure/retry are demonstrated. W05 and W08 then connect the learned actions to complete live discussion/rehearsal; W10 validates the full timed journey.

**Status — completed locally for cloud mode, October 26:** Guide-led capture/readback/correction, acknowledged raw/interpretation notes, bounded reviewed text/PDF context, model-attributed setup proposals, mixed saved/new cast selection, explicit readiness approval and action-based core practice are implemented. All 54 unit/service checks and 23 distinct browser checks pass, including emulated native hand/keyboard setup, late cancellation, short viewport and lost note/lesson receipt recovery. One live setup inference saved an unconfirmed research-defence readback and three suggested roles. Group scheduling, complete optional lessons, measured five/ten-minute pacing, physical Quest verification and public deployment remain later-wave work. See [WAVE_4_AUDIT.md](WAVE_4_AUDIT.md).

### W05 — Real discussion and user intervention

- **W06 show follow-up:** include the actual latest utterance for every new voice; protect the first-round opportunity for all participants. Add opt-in heated cut-ins with real playback timing, protected turns and the existing immediate pause/cancellation semantics.

- Implement the session scheduler, shared committed context, independent initial views where practical, bounded turns, and claim/question references between speakers.
- Consume only the user's confirmed setup and reviewed excerpts from W04. Preserve their source/excerpt limits, never treat document text as application commands, and stop pending guide work before handing the floor to the scheduler.
- Deliver roundtable, court-hearing, and adversarial verbal formats, with intensity independent of format. Characters answer actual objections and may visibly revise a position.
- Give direct challenges a response opportunity, balance participation, detect repetitive/off-topic exchanges, and retain unresolved disagreement without forcing consensus.
- Implement immediate local pause, resume, stop, address/give-floor, clarify, simplify, request-example/evidence, challenge, switch-sides, and summary actions. Use the same action semantics for desktop, in-world selection, and recognised voice commands.
- Handle roster changes at paused boundaries, request cancellation, stale results, connection loss, remaining duration, request/output budgets, and partial-session summaries.
- Connect Virus's interruption/give-floor lesson and validated action suggestions to this controller. A request for help yields the floor to the guide and resumes the appropriate task only on the user's action; the guide and participants must not talk over one another.

**Completion check:** Assigned models exchange a claim-specific objection and answer; the user interrupts and redirects the next contribution. Pause/stop work during inference or speech, no stale result restarts the exchange, and a usage limit or lost connection stops automatic scheduling with a recoverable state.

**Status — completed locally for cloud mode, October 27:** Six realistic people now replace the prototype avatars throughout the room, studio, saved sessions and native VR. The discussion controller implements bounded multi-model turns, claim references, positions, floor assignment, saved interventions, pause/resume/stop and partial summaries. All 66 unit/service checks pass, TypeScript and the production build pass, and browser checks cover inference/playback interruption, recovery and emulated native controls. A bounded live OpenAI/Claude exchange saved four referenced turns and two user directions without substituting providers. Physical Quest performance, complete spatial staging, independent modular realistic art and live Gemini group output remain unverified/later work. See [WAVE_5_AUDIT.md](WAVE_5_AUDIT.md).

### W06 — Throne court and spatial discussion interface

- **Pulled forward before W05, per user feedback:** realistic people are now the default in the room, studio and VR; six complete models, saved/legacy-derived identity, supported tint/accessories, actual-model portraits and explicit load retry replace the cartoon/prototype switch. This completes the initial consistency correction, while independent modular realistic art, final staging and physical performance checks remain below.
- Integrate realistic avatars with the workshop: maintain the same visible identity in the room and editor, persist model/asset identity per character rather than assigning bodies by seat, and preserve it through reorder, reload, guide replacement and reuse. Add model loading/failure/retry states and an explicit fallback choice.
- Make appearance controls capability-aware. Show only edits the preview can actually render; real modular hair, beards, clothing and face variants need compatible rigged assets and persisted selections. Never silently replace a realistic person with a cartoon on workshop entry. Keep direct body-part selection and AI descriptions tied to supported edits.
- Complete the grand medieval throne-court layout: seated sovereign position, discussion group, active-presenter space, short waiting area, and restrained information surfaces.
- Stage character gaze, orientation, listening/thinking/speaking/error states, gestures, and speaker emphasis around the actual conversation events.
- Place identity, guiding code, current position, reasons, and position changes on the left; keep the speaker and current material central; provide the right-hand score surface for W07.
- Integrate comfortable hand selection, captions, text-entry surfaces, brain inspection, and the discussion controls. Keep critical actions within a comfortable glance.
- Match the functional desktop journey and keep headset camera motion user-controlled. Cull inactive environment/cast detail and measure frame time during integration.
- Stage Virus beside the user/task at an appropriate distance, point his demonstrations toward actual targets, and replace the large setup overlay as the default spatial interface. Keep captions and small contextual controls accessible; reveal detailed panels on request.

**Completion check:** A live discussion runs from the throne using the W05 controller. The user can identify the speaker, inspect a character's position/code, select a participant, interrupt, and read captions while seated on Quest. The staged presenter area and score surface are ready for W07.

**Status — implemented and locally verified, October 27:** The architectural throne court, centred cast, speaker/listener states, guide staging, paged left-side views/reasoning, honest right-side judgement surface and compact native controls are implemented. Selecting a person inspects without interrupting; explicit floor assignment/brain inspection use the W05 pause semantics. Guide choices share the caption dock, detailed panels open on request, and panel spacing follows caption height. All 68 unit/service checks and 35 production browser journeys pass, including emulated hands, keyboard/studio transitions, selection through non-interactive caption areas and asset retry. A six-model desktop capture reports 83 draw calls/62,384 triangles and p95 frame cadence 33.4 ms at the 30 Hz desktop cap. Physical Quest readability, comfort, GPU/thermal performance and unfamiliar-user timing remain acceptance work in W10/W11. Compatible modular hair/clothing art remains in W11; no unsupported controls are offered. See [WAVE_6_AUDIT.md](WAVE_6_AUDIT.md).

**W06 show follow-up:** implemented and locally verified with 84 unit/service checks, 44 production browser journeys and a bounded live Hindi/news run using three actual OpenAI/Claude participants and three Sarvam voices. See [SHOW_ROOMS_AUDIT.md](SHOW_ROOMS_AUDIT.md).

**W06 recovery requirement:** closing the character studio must immediately restore paused-discussion controls. Whole-utterance Start/Continue commands in English and Hindi must route to approved start/resume actions rather than becoming saved topic directions. Filter provider-reported shutdown dates before offering models, retain future shutdown choices, and identify the affected character when a saved model becomes unavailable. Preserve history and require the user's replacement choice; never silently substitute a brain.

### W07 — Scores, courtroom decisions, and presenters

- **Additional W06 follow-up before scores:** seated roundtable rigs/hand gestures, desktop TV shots with manual override, heard-first speaker context, custom narrated/written show premises, independent room/tone choices, Hindi/Sarvam and reviewed Indian-news topics implement AC-22/AC-23. Verify actual voices, sourced discussion and real audio cut-ins before building scoring/presenters. Physical headset comfort and performance remain W10/W11 validation, and multi-room background scheduling is deferred.

- **Prerequisite from the October 27 conversation failure:** complete the W05/W06 correction-memory, clarification-loop and real-cast repair (AC-21), review a live replay of the user's offline/mindfulness idea, and deploy that fix before starting scores/presenters. Future presenter and decision generation must use the current corrected brief rather than the original misheard setup. This repair does not count as starting W07.

**Repair evidence — October 27:** durable working briefs, real group invitations, bounded drift/clarification recovery and pause-for-human behaviour are implemented. All 76 unit/service checks and 39 production browser journeys pass, including exact corrections, lost receipts, reload and native hand invitation/exit. A local live replay retained all five corrections across a Nano-to-Mini change and produced a three-person OpenAI/Claude discussion with referenced objections and concrete tests. [CONVERSATION_REPAIR_AUDIT.md](CONVERSATION_REPAIR_AUDIT.md) records the case and separate hosted verification procedure. W07 implementation remains unstarted.

- Attach user ratings to actual contributions and criteria; record author, reason, rubric version, revisions, and undo. Keep user points distinct from automated assessments.
- Update character totals and recent explanations on the right from the saved rating events. Permit rating without disrupting the active speaker.
- Generate individual decision points with options, tradeoffs, dependencies, assumptions, and a named presenter; generate distinct persistent presenter identities through the character system.
- Stage the active presenter and a small waiting group. Implement call-forward, simple/full explanation, examples, council challenge, skip, defer, recall, and dependency-safe reordering.
- Record explicit user decisions and rationale. Revisiting a decision updates the relevant future topics and marks affected prior decisions for review.
- Add the optional five-to-ten-minute lessons for left/right information, rating an actual contribution, calling a presenter, and choosing explanation depth. Virus teaches each action in context and then yields the floor.

**Completion check:** During a real court session the user awards and undoes a point, calls a distinct presenter forward, asks for a simpler explanation, decides or defers, and revisits an earlier choice. Scores survive reload, and affected decision dependencies change visibly and consistently.

### W08 — Council chamber and interview/rehearsal mode

- Reuse the stable realistic identity/editor integration and verify model loading, gaze, lip-sync and selection in council staging as well as the throne room.
- Complete the visibly distinct council chamber with a seated candidate/presenter position, panel arrangement, scene staging, and comfortable entry/exit.
- Implement custom panel goals, question strategy, turn-taking, and relevant follow-ups based on the user's actual answers. Panelists behave as examiners rather than subjects deferring to the sovereign.
- Add optional research-defence, civil-services, investor-pitch, and job-interview templates with editable roles and rubrics; preserve a fully custom path.
- Provide a realistic mock session with feedback afterward and an explicit live-coaching option. Evaluate only supported signals and keep panel-usefulness ratings separate from candidate assessment.
- Produce transcript-linked strengths, explained assessments, concrete improvements, and an answer retry compared against the same criterion. Keep retries and original answers in the record.
- Give first-time rehearsal users the same core selection/input/interruption orientation, followed by a short council-role briefing. Virus introduces question/answer, feedback/retry, and exit/resume in context, without forcing a separate courtroom tutorial first.

**Completion check:** The user starts a custom rehearsal, receives a follow-up tied to an actual answer, pauses/resumes, and finishes with specific explained feedback. A retry is retained and compared against the same criterion; a realistic session completes with no compulsory live scoreboard.

### W09 — Reports, session history, recovery, and linked modes

- Include saved show room/tone/language and reviewed news source/date metadata in history and exports. Mark audio cut-offs and their interrupting contributions; distinguish the complete intended argument from the portion actually performed. Do not infer that every saved word was heard.

- Finish the user-facing session history, consistent resume, character/scenario snapshots, event reconciliation, and readable partial-session outcomes on top of W01 persistence.
- Produce decision briefs with options, strongest arguments, evidence gaps, dissent, explicit rulings, deferred choices, and next actions.
- Produce rehearsal reports with questions/answers, transcript-linked feedback, assessments, retries, and next practice steps.
- Support readable text/Markdown and structured JSON export, in-world report review, and the equivalent desktop controls.
- Link discussion and rehearsal through a user-reviewed context handoff and selected cast reuse. Preserve original transcripts, scores, and boundaries; avoid carrying unselected prior context into a new session.
- Let Virus recall confirmed notes, the current lesson, and unfinished tasks, then offer resume/new-situation choices. Preserve note corrections and completed/skipped tutorial states across sessions without carrying private scenario material into unrelated ones.

**Completion check:** Both modes can be finished, closed, resumed/reopened, reviewed, and exported with no duplicate events or lost ratings/choices. A court-to-council transition creates a linked record containing only reviewed context and leaves the original session intact.

### W10 — Guided-journey validation, accessibility, and hands-only completion

- Include native room/tone selection, Hindi mode, narrated premise correction, news excerpt review, TV/manual desktop control and headset-stationary presentation in the new-user and failure-recovery walkthroughs.

- Verify realistic/classic appearance selection, capability-aware editing, body-part targets, saved identity, paged readback/context, and setup confirmation without scrolling. Test short desktop viewports and reload during each guide step; buttons must not overlap the character, captions or exit controls.
- Integrate and refine the assistant-led entry and gesture lessons already delivered in W02–W04 with both finished session modes. Verify the full pacing in section 9; a ten-minute narration or re-skinned form does not satisfy the introduction.
- Verify the entire hands-only path: situation/text entry, context review, cast/voice/model setup, discussion/rehearsal controls, scores, decisions, reports, pause, and exit. Supply a hand-selectable text alternative to microphone use.
- Complete caption readability, speaker labels, mute/stop, reduced-motion transitions, expanded side information, and selectable alternatives to voice or shortcut gestures.
- Make settings, tour restart/skip, model failures, disabled choices, and reconnection understandable without accidentally starting or resuming the exchange.
- Run unfamiliar-user checks for actual selection/input/interruption and a useful exchange within five minutes, with optional app/gesture practice and an outcome around ten. Record waiting, skipped/repeated lessons, misunderstandings corrected, and external human assistance. Include returning profiles, microphone-off, speech failure, and interrupted/reloaded tutorials.

**Completion check:** An unfamiliar user can learn and complete each release walkthrough through Virus while seated, without opening the detail form or requiring a developer to explain the next step. Quest hands work without a controller/microphone; desktop follows the same guide-led journey. Timed observations, action-based lesson progress, note readback/corrections, direct start/skip/repeat/resume, and failure recovery provide evidence for AC-19/AC-20.

### W11 — Final polish, device performance, and release candidate

- Measure the seated six-person rigs, hand/forearm gestures, news backdrop, Hindi audio and cut-in cancellation on physical Quest. Refine voice acting/laughter and room art from actual listening/device observations; emulation is insufficient.

- Finish and license the compatible realistic appearance asset set, with fallback/loading previews, distinct silhouettes, facial expressions and measured speech animation. Verify texture/morph/rig budgets for the full cast on physical Quest; the current six complete Rocketbox people and facial morphs do not supply modular hair/clothing by themselves.
- Finish coherent environmental art, avatar variations, animation transitions, lighting, spatial/audio feedback, and voice/caption timing without obscuring the active speaker or controls.
- Measure Quest 3/3S performance at the supported cast/queue budget during listening, inference waits, speech, model changes, panel use, and environment transitions. Optimise geometry/materials, shadows, textures, animation, and inactive-room culling toward sustained 72 Hz.
- Run the domain checks, browser journeys, physical-headset walkthroughs, hosted-path checks, and migration/retirement checks required in section 13. Use controlled failures for repeatable recovery checks and real supported connections for live routing/speech validation.
- Review discussion relevance and rehearsal feedback with representative users; obtain appropriate subject review for specialised templates. Record limitations instead of reporting unmeasured improvement.
- Fix acceptance failures and replay affected journeys. Produce a release-candidate checklist with evidence for AC-01 through AC-17 and AC-19 through AC-23, device measurements, known limitations, and deployment readiness; AC-18 is confirmed at release.

**Completion check:** Both complete release walkthroughs pass on desktop and physical Quest, every functional criterion has evidence, and no unresolved defect blocks a required journey. Record measured performance against the 72 Hz goal and competition's published 60 fps minimum; a miss is a release risk requiring resolution, not a passed check.

### W12 — Hosted release, documentation, and submission

- Publish the verified build through the supported hosting path with working HTTPS/WebXR, correct environment configuration, real provider/voice availability, and enforced session limits. Keep deployment recovery available.
- Verify the release at the actual public URL on a headset and desktop, including new/returning sessions, both modes, interruption, reports, and recovery. Confirm the new experience does not depend on retired services.
- Rewrite the README/help for the delivered discussion and rehearsal product, supported devices, model/voice setup, usage limits, data/storage boundaries, and measured limitations. Remove instructions that present retired coding workflows as the current product.
- Record the full first-release acceptance result and remaining non-blocking limitations. Confirm users can reach the app and complete its actual journeys without a development checkout.
- Complete the competition access/eligibility checks, correct division/track, public video under three minutes, screenshots, description, and submission form. Submit through the authorised account workflow, verify judge access, and retain the unchanged submitted version during judging.

**Completion check:** The agreed app is released at a verified usable URL with current documentation, assistant-led entry, both full journeys, and evidence for AC-01 through AC-23. The competition package is complete and, when entered, its submission/access are confirmed before the official cutoff. A finished video or submitted form alone does not complete the app.

### Acceptance coverage and wave completion rules

| PRD criterion | Owning wave(s) |
| --- | --- |
| AC-01 — Minimal-input session suggestion | W04 |
| AC-02 — New and saved characters in the cast picker | W02, W04 |
| AC-03 — Stable editable avatar and voice | W02, W03 |
| AC-04 — Identity, guiding code, role, and brain separation | W02, W03 |
| AC-05 — Actual multi-model routing and provenance | W03, W05 |
| AC-06 — Claim-specific discussion and visible revisions | W05 |
| AC-07 — Immediate intervention, cancellation, and limits | W01, W03, W05 |
| AC-08 — Throne, left positions, right scores | W06, W07 |
| AC-09 — Decision-presenter queue and dependencies | W07 |
| AC-10 — Custom rehearsal in the separate council chamber | W08 |
| AC-11 — Explained, distinguishable, revisable assessments | W07, W08 |
| AC-12 — Answer-specific feedback and retries | W08 |
| AC-13 — Reviewed context and truthful evidence status | W04, W05, W08 |
| AC-14 — Save/resume and outcome export | W01, W09 |
| AC-15 — Reviewed linked-mode handoff | W09 |
| AC-16 — Complete desktop and hands-only journeys | W06, W08, W10, W11 |
| AC-17 — Retirement boundary and preserved legacy data | W01, W11, W12 |
| AC-18 — Full first release by the agreed target | W12 |
| AC-19 — Assistant-led capture/readback/correction and form-optional setup | W02, W03, W04, W06, W10 |
| AC-20 — Action-based five/ten-minute gesture/app introduction | W04, W05, W07, W08, W10, W11 |
| AC-21 — Durable corrections, real group discussion and clarification recovery | W05/W06 repair before W07; regression in W08–W12 |
| AC-22 — Seated responsive shows, TV framing and custom premises | W06 follow-up; physical validation in W10/W11 |
| AC-23 — Hindi/Sarvam, sourced news and bounded heated cut-ins | W03/W05/W06 follow-up; regression and hosted verification in W10–W12 |

At each wave, record delivered behaviour, relevant verification, remaining dependencies, and material risks. Reuse suitable existing checks and add checks for new state/routing behaviour; a successful compile or mocked conversation alone is insufficient evidence of live AI interaction or physical headset comfort. All applicable release criteria are rechecked in W11 and against the hosted release in W12. Physical combat, human multiplayer, and other section-15 exclusions are not required to complete these waves.

### Competition submission requirements

November 18 remains the product release target in Asia/Calcutta. The official competition deadline is November 18, 2026 at 12:00 noon PST, which is November 19 at 01:30 IST. The release target deliberately precedes that cutoff. The following requirements were checked against official sources on October 26, 2026:

- The submitting representative must have Meta VR Start membership and the required developer access. Confirm entrant eligibility and the correct New or Adapted/Significantly Updated division from project history; do not assume a division from the product name or pivot.
- Submit an accessible playable WebXR URL, the completed submission form, and a public demonstration video under three minutes. Verify access on a headset. Keep the submitted version available throughout judging and unchanged after the cutoff.
- Hands-only usability is required end-to-end. Seated use, quick entry/exit, and a satisfying session within ten minutes align with the published design guidance.
- Judging gives equal weight to innovation/creativity, experience design, technical implementation, and polish/presentation. The published Quest performance minimum is 60 fps; the product's 72 Hz target remains the engineering goal.
- Productivity is the intended primary track. Agentic Interaction and First Five Minutes are relevant award opportunities, not predicted wins. Originality claims must describe what spatial presence contributes without claiming the functional desktop journey is impossible.

Sources: [official competition requirements](https://start-developer-competition-26.devpost.com/), [judging criteria](https://start-developer-competition-26.devpost.com/details/judging), [special awards](https://start-developer-competition-26.devpost.com/details/special-awards), and [official rules](https://start-developer-competition-26.devpost.com/rules). Recheck for updates before submitting.

## 15. Scope exclusions and retired requirements

### Deferred extensions

| Item | Status |
| --- | --- |
| Fighting arena, physical combat, and combat scoring | Explicitly deferred by the user. |
| Multiplayer with other human participants | Outside the first-release scope. |
| Native Quest application and mobile-specific clients | WebXR and desktop remain the first-release targets. |
| Photorealistic capture, voice cloning, or unlimited generated 3D assets | Modular characters and configured voice pools serve the first release. |
| Rich slide-authoring tools, arbitrary document formats, and unrestricted external browsing | Later extensions; bounded reviewed context is included now. |
| Autonomous actions in external applications | Outside the first-release discussion/rehearsal scope. |
| Subscription billing, account-system redesign, and cross-device cloud-library sync | Separate product work; current profile/storage boundaries remain explicit. |

### Retired product requirements

Remove the following from the active roadmap and from the new journeys' navigation, setup, onboarding, prompts, and outputs:

- Software/app generation, build proposals and approvals, generated HTML/CSS/JavaScript delivery, code inspection, startup-check reports, and source ZIP export.
- Fixed architect/builder/inspector/artiste jobs, mandatory coding workspaces or repository-folder selection, and milestones defined by completed application builds.
- Browser-streamed application review, the app-preview service as a session dependency, build-delivery theatre, the personal coding desk, the app-review room, and the achievement/Wall of Fame gallery.
- The compulsory garden-to-coding-team tour, four-zone layout, fixed provider-to-character assignments, fixed British voices, and an asset-generation character as a release requirement.

These are retired requirements, not postponed launch features. Preserve existing source and saved artifacts during migration; this PRD review does not delete runtime files or user data. Future removal of unused implementation code must follow dependency and migration checks. Rendering, speech, provider connections, hand input, hosting, and storage remain reusable foundations for the new product.

## 16. Pivot record

On October 26, 2026, the user approved:

- Keeping Game of Codes as the product name.
- Pivoting the core experience from software development to custom discussion/decisions and interview/rehearsal.
- Shipping both modes in the full first release by the existing November 18 target.
- A grand fantasy throne court for sovereign-led discussion and a distinct council environment for preparation.
- AI-assisted character suggestions from a minimal situation description, with previously chosen characters available alongside new suggestions.
- Random/editable avatars and voices, reusable identities, independently swappable brains, user intervention and scoring, and decision presenters.
- Deferring the fighting arena.
- Making Virus or a chosen assistant the primary interface for taking notes and setting up sessions, with forms as optional detail/fallback views and an interactive first-five/ten-minute gesture/app introduction delivered from the early waves.

Waves 1–6 are implemented and locally verified for the configured cloud mode. Waves 7–12 and physical-headset acceptance must be completed and verified against this PRD.

The requirements review preserved those release commitments, made guiding codes explicit, strengthened hands-only and interruption acceptance, added two complete release walkthroughs, and removed superseded requirements from the active roadmap. Wave status above records subsequent implementation evidence and the remaining requirements for Waves 7–12.
