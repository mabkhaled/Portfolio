// POST /api/speak  { text }  ->  audio/wav spoken in the "Orus" Gemini voice.
// Vercel serverless function (mounted by vite.config.js in dev). The Gemini key stays on the server.
import { createLimiter, clientIp } from './_limit.js';

const VOICE = process.env.GEMINI_VOICE || 'Orus';
const TTS_MODELS = (process.env.GEMINI_TTS_MODELS || 'gemini-3.8-flash-tts,gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview')
  .split(',').map((m) => m.trim()).filter(Boolean);
const MAX_CHARS = 700;
const limited = createLimiter({ max: 80, windowMs: 10 * 60_000 }); // answers are spoken in a few parallel chunks

/** Wraps raw 16-bit little-endian mono PCM in a WAV header so browsers can decode it. */
export function pcmToWav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8_000) throw new Error('too large');
  }
  return JSON.parse(raw || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (limited(clientIp(req))) return json(res, 429, { error: 'Too many voice requests' });
  let text;
  try {
    text = String((await readBody(req)).text || '').trim().slice(0, MAX_CHARS);
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }
  if (!text) return json(res, 400, { error: 'No text' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(res, 503, { error: 'Voice unavailable' });

  const body = JSON.stringify({
    contents: [{ parts: [{ text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
  });
  for (const model of TTS_MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(20_000),
        body,
      });
      if (!r.ok) {
        console.warn('[speak]', model, r.status, (await r.text()).slice(0, 160));
        continue;
      }
      const part = (await r.json()).candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part?.data) continue;
      const raw = Buffer.from(part.data, 'base64');
      const mime = String(part.mimeType || '').toLowerCase();
      const audio = mime.includes('wav') ? raw : pcmToWav(raw, Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(audio);
    } catch (err) {
      console.warn('[speak]', model, 'failed', err?.name || err);
    }
  }
  return json(res, 503, { error: 'Voice unavailable' });
}
