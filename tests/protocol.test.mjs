import test from 'node:test';
import assert from 'node:assert/strict';
import { isProjectId, parseInput } from '../server/protocol.mjs';

test('project IDs cannot become storage paths', () => {
  assert.equal(isProjectId('ab233e12-2cab-4de6-88a1-12c435d29211'), true);
  for (const id of ['../private', 'x'.repeat(36), null, 'ab233e12-2cab-0de6-88a1-12c435d29211']) assert.equal(isProjectId(id), false);
});
test('only bounded preview actions can cross the browser bridge', () => {
  assert.deepEqual(parseInput('{"type":"click","x":-30,"y":9999}'), { type: 'click', x: 0, y: 799 });
  for (const input of ['null', 'not json', '{"type":"navigate","url":"http://private"}', '{"type":"key","key":"Control+L"}', JSON.stringify({ type: 'text', text: 'x'.repeat(241) })]) assert.equal(parseInput(input), null);
  assert.deepEqual(parseInput('{"type":"text","text":"New idea"}'), { type: 'text', text: 'New idea' });
});
