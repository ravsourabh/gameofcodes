import test from 'node:test';
import assert from 'node:assert/strict';
import { isProjectId, parseInput, validPreviewOrigin } from '../server/protocol.mjs';

test('project IDs cannot become storage paths', () => {
  assert.equal(isProjectId('ab233e12-2cab-4de6-88a1-12c435d29211'), true);
  for (const id of ['../private', 'x'.repeat(36), null, 'ab233e12-2cab-0de6-88a1-12c435d29211']) assert.equal(isProjectId(id), false);
});
test('only bounded preview actions can cross the browser bridge', () => {
  assert.deepEqual(parseInput('{"type":"click","x":-30,"y":9999}'), { type: 'click', x: 0, y: 799 });
  for (const input of ['null', 'not json', '{"type":"navigate","url":"http://private"}', '{"type":"key","key":"Control+L"}', JSON.stringify({ type: 'text', text: 'x'.repeat(241) })]) assert.equal(parseInput(input), null);
  assert.deepEqual(parseInput('{"type":"text","text":"New idea"}'), { type: 'text', text: 'New idea' });
});

test('preview accepts the public proxy origin and still rejects other websites', () => {
  assert.equal(validPreviewOrigin({origin:'https://gameofcodes.si',host:'127.0.0.1:5443','x-forwarded-host':'gameofcodes.si'}),true);
  assert.equal(validPreviewOrigin({origin:'http://localhost:5173',host:'localhost:5173'}),true);
  assert.equal(validPreviewOrigin({origin:'https://other.example',host:'127.0.0.1:5443','x-forwarded-host':'gameofcodes.si'}),false);
  assert.equal(validPreviewOrigin({origin:'null',host:'localhost:5173'}),false);
  assert.equal(validPreviewOrigin({host:'localhost:5173'}),false);
});
