// node --test api/
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessages, fallbackReply, rateLimited } from './chat.js';

test('cleanMessages keeps valid turns and requires a final user message', () => {
  assert.equal(cleanMessages('nope'), null);
  assert.equal(cleanMessages([{ role: 'model', text: 'hi' }]), null);
  const out = cleanMessages([{ role: 'system', text: 'x' }, { role: 'user', text: '  hello  ' }]);
  assert.deepEqual(out, [{ role: 'user', text: 'hello' }]);
  assert.equal(cleanMessages([{ role: 'user', text: 'a'.repeat(5000) }])[0].text.length, 600);
  assert.equal(cleanMessages(Array.from({ length: 30 }, () => ({ role: 'user', text: 'q' }))).length, 12);
});

test('fallbackReply never gives a salary and shares contacts', () => {
  assert.match(fallbackReply('What is your salary expectation?'), /directly/);
  assert.doesNotMatch(fallbackReply('salaire ?'), /\d+\s?k/i);
  assert.match(fallbackReply('How can I contact you?'), /khaledmabrouk714@gmail\.com/);
  assert.match(fallbackReply('something else'), /khaledmabrouk714@gmail\.com/);
});

test('rateLimited trips after 20 requests in the window', () => {
  const t = Date.now();
  for (let i = 0; i < 20; i++) assert.equal(rateLimited('1.2.3.4', t + i), false);
  assert.equal(rateLimited('1.2.3.4', t + 21), true);
  assert.equal(rateLimited('1.2.3.4', t + 11 * 60_000), false);
});
