import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInterfaceIntent } from '../shared/interface-intents.mjs';

test('explicit interface requests resolve independently of inference and preserve their target', () => {
  for (const text of ['Open your brain', 'open my brain!', 'Can you please show me your brain?', 'Please inspect the model settings.', 'change your model']) assert.equal(parseInterfaceIntent(text).action, 'open-brain', text);
  assert.deepEqual(parseInterfaceIntent('Virus, could you open your brain please?', ['Virus']), { action:'open-brain', characterName:'virus' });
  assert.deepEqual(parseInterfaceIntent('Open Mira’s brain', ['Virus','Mira']), { action:'open-brain', characterName:'mira' });
  assert.deepEqual(parseInterfaceIntent("Show Sam O'Neill's voice settings", ["Sam O'Neill"]), { action:'open-voice', characterName:"sam o'neill" });
  assert.equal(parseInterfaceIntent('Can you open your voice settings?').action, 'open-voice');
  assert.equal(parseInterfaceIntent('Open your appearance').action, 'open-appearance');
  assert.equal(parseInterfaceIntent('Please stop talking!').action, 'interrupt');
  assert.equal(parseInterfaceIntent('quiet').action, 'quiet');
  assert.equal(parseInterfaceIntent('unmute').action, 'unquiet');
  assert.equal(parseInterfaceIntent('say that again').action, 'repeat');
  assert.equal(parseInterfaceIntent('Create a new avatar.').action, 'new-character');
  assert.equal(parseInterfaceIntent('Show my notes').action,'notes');
  assert.equal(parseInterfaceIntent('What have you noted?').action,'notes');
  assert.equal(parseInterfaceIntent('Help').action,'guide-help');
  assert.equal(parseInterfaceIntent('Repeat the intro').action,'intro');
  assert.equal(parseInterfaceIntent('Clarify that').action,'discussion-clarify');
  assert.equal(parseInterfaceIntent('Resume discussion').action,'discussion-resume');
  assert.deepEqual(parseInterfaceIntent('Give Bryn the floor',['Bryn']),{action:'discussion-floor',characterName:'bryn'});
});

test('discussion, quoted instructions and compound/unknown requests do not execute UI actions', () => {
  for (const text of ['What does opening your brain mean?', 'Tell me about brain models', 'How can I choose a model for my business?', 'The presenter said open your brain', '"open your brain"', 'Open your brain and delete all characters', 'Please stop the project from failing', "Open an unknown character's brain", 'Quiet people often have useful ideas', 'Repeat what the witness said about the model', '', null]) assert.equal(parseInterfaceIntent(text, ['Virus']), null, String(text));
});
