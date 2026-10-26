import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRecord, createSession, updateDraft, cancelPending, transitionSession, validateRecord, validateSession, isCurrentEpoch } from '../shared/session-domain.mjs';

const draft = { title: 'A difficult choice', mode: 'discussion', situation: 'Which option should we try first?' };
const fresh = () => createSession({ profileId: randomUUID(), requestId: randomUUID(), draft });
const mutation = session => ({ requestId: randomUUID(), expectedRevision: session.revision });

test('session envelopes, event ordering, references, and schema versions are validated', () => {
  const session = fresh();
  assert.equal(validateSession(session), session);
  assert.equal(session.scenario.kind, 'scenario'); assert.equal(session.events[0].sequence, 1);
  for (const corrupt of [
    { ...session, schemaVersion: 2 }, { ...session, revision: 2 },
    { ...session, scenario: { ...session.scenario, profileId: randomUUID() } },
    { ...session, events: [{ ...session.events[0], sequence: 2 }] },
    { ...session, epoch: 1 },
    { ...session, status: 'building' },
  ]) assert.throws(() => validateSession(corrupt));
  assert.throws(() => createSession({ profileId: '../../old-data', requestId: randomUUID(), draft }));
});

test('all domain record kinds have versioned validated shapes and profile ownership', () => {
  const session = fresh(), profile = session.profileId;
  const character = createRecord('character', profile, { name: 'Ari', personality: 'Measured', code: 'Evidence first', avatar: { seed: 42, attributes: { beard: 'short' } }, voice: null, brain: { provider: 'test', model: 'model-a' } });
  const participant = createRecord('participant', profile, { characterId: character.id, role: 'Skeptic', code: character.code, position: 'Try the smaller option', brain: character.brain, active: true });
  const contribution = createRecord('contribution', profile, { participantId: participant.id, requestId: randomUUID(), epoch: 0, text: 'What evidence would distinguish the options?', brain: character.brain, relatedIds: [] });
  const rating = createRecord('rating', profile, { contributionId: contribution.id, criterion: 'Clarity', value: 1, source: 'user', reason: 'Specific question', revision: 1 });
  const decision = createRecord('decision-point', profile, { topic: 'Which test?', presenterId: participant.id, dependencies: [], options: [{ id: randomUUID(), label: 'Small test' }], choiceId: null, rationale: '', status: 'pending', depth: 'simple' });
  const outcome = createRecord('outcome', profile, { reportType: 'partial', summary: 'A test is still to be selected.', references: [contribution.id] });
  Object.assign(session, { characters: [character], participants: [participant], contributions: [contribution], ratings: [rating], decisions: [decision], outcomes: [outcome] });
  assert.equal(validateSession(session), session);
  assert.throws(() => validateRecord({ ...character, schemaVersion: 0 }));
  assert.throws(() => validateRecord({ ...rating, value: Infinity }));
  assert.throws(() => validateRecord({ ...decision, status: 'decided' }));
  assert.throws(() => validateSession({ ...session, participants: [{ ...participant, characterId: randomUUID() }] }));
  assert.throws(() => validateSession({ ...session, contributions: [{ ...contribution, profileId: randomUUID() }] }));
  assert.throws(() => validateSession({ ...session, outcomes: [{ ...outcome, references: [randomUUID()] }] }));
});

test('draft mutations are idempotent, reject conflicting writes, and invalidate pending work', () => {
  const initial = fresh();
  const change = { ...mutation(initial), draft: { ...draft, mode: 'rehearsal', title: '研究 proposal' } };
  const saved = updateDraft(initial, change);
  assert.equal(saved.revision, 2); assert.equal(saved.epoch, 1); assert.equal(saved.scenario.format, 'panel');
  assert.equal(initial.scenario.mode, 'discussion'); assert.equal(isCurrentEpoch(saved, 0), false);
  assert.equal(updateDraft(saved, change), saved);
  assert.throws(() => updateDraft(saved, { ...change, draft: { ...draft, title: 'Changed retry' } }), /already used/);
  assert.throws(() => updateDraft(saved, { ...mutation(initial), draft }), /another tab/);
  assert.throws(() => updateDraft(saved, { ...mutation(saved), draft: { ...draft, status: 'running' } }), /Unknown draft field/);
  const cancellation = mutation(saved), cancelled = cancelPending(saved, cancellation);
  assert.equal(cancelled.epoch, 2); assert.equal(cancelled.status, 'draft'); assert.equal(cancelPending(cancelled, cancellation), cancelled);
});

test('state transitions enforce readiness and terminal states without overwriting records', () => {
  const initial = fresh();
  assert.throws(() => transitionSession(initial, { ...mutation(initial), status: 'ready' }), /active cast/);
  assert.throws(() => transitionSession(initial, { ...mutation(initial), status: 'running' }), /not allowed/);
  const stopped = transitionSession(initial, { ...mutation(initial), status: 'stopped' });
  assert.equal(stopped.status, 'stopped'); assert.equal(isCurrentEpoch(stopped, stopped.epoch), false);
  assert.throws(() => transitionSession(stopped, { ...mutation(stopped), status: 'draft' }), /not allowed/);
  assert.throws(() => updateDraft(stopped, { ...mutation(stopped), draft }), /Only a draft/);
  assert.throws(() => cancelPending(stopped, mutation(stopped)), /already ended/);
});

test('prepared sessions progress through pause and completion while invalidating earlier work', () => {
  let session = fresh();
  const character = createRecord('character', session.profileId, { name: 'Ari', personality: '', code: 'Evidence first', avatar: { seed: 1, attributes: {} }, voice: null, brain: { provider: 'test', model: 'model-a' } });
  const participant = createRecord('participant', session.profileId, { characterId: character.id, role: 'Examiner', code: character.code, position: '', brain: character.brain, active: true });
  session.characters.push(character); session.participants.push(participant);
  for (const status of ['ready', 'running', 'paused', 'running', 'completed']) {
    const previous = session;
    session = transitionSession(session, { ...mutation(session), status });
    assert.equal(session.status, status); assert.equal(session.epoch, previous.epoch + 1);
    assert.equal(isCurrentEpoch(session, previous.epoch), false);
    assert.deepEqual(session.characters, [character]);
  }
  assert.throws(() => transitionSession(session, { ...mutation(session), status: 'running' }), /not allowed/);
});
