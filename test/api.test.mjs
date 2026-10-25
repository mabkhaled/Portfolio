// npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessages, fallbackReply, rateLimited } from '../api/chat.js';

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

import { pcmToWav } from '../api/speak.js';

test('pcmToWav writes a valid 44-byte header around the PCM', () => {
  const pcm = Buffer.alloc(4800);
  const wav = pcmToWav(pcm, 24000);
  assert.equal(wav.length, 44 + 4800);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt32LE(40), 4800);
});

import { splitForSpeech } from '../src/chat.js';

test('splitForSpeech speaks the first sentence alone when the answer is long', () => {
  assert.deepEqual(splitForSpeech('Short answer.'), ['Short answer.']);
  const long = 'I lead backend and cloud at ZCE Group. ' + 'I built the charge point platform on GCP with Node.js and a lot more. '.repeat(3);
  const chunks = splitForSpeech(long.trim());
  assert.equal(chunks[0], 'I lead backend and cloud at ZCE Group.');
  assert.ok(chunks[1].startsWith('I built'));
  assert.ok(chunks.length >= 2 && chunks.length <= 5);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), long.trim().replace(/\s+/g, ' '));
});
