// POST /api/chat  { messages: [{ role: "user" | "model", text }] }  ->  { reply, fallback? }
// Vercel serverless function (also mounted by vite.config.js in dev). The Gemini key stays on the server.
import { SYSTEM_PROMPT, FALLBACKS, FALLBACK_DEFAULT } from './_khaled.js';
import { createLimiter, clientIp } from './_limit.js';

// Free-tier models get overloaded (503) or slow: try the next one before giving up.
const MODELS = (process.env.GEMINI_MODELS || 'gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3-flash-preview').split(',').map((m) => m.trim()).filter(Boolean);
const MAX_TURNS = 12;
const MAX_CHARS = 600;
const MAX_BODY = 20_000;
export const rateLimited = createLimiter({ max: 20, windowMs: 10 * 60_000 });

/** Keeps only well-formed, size-capped turns, most recent last, ending on the visitor's message. */
export function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const out = input
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_CHARS) }));
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export function fallbackReply(text) {
  return (FALLBACKS.find((f) => f.match.test(text)) || { reply: FALLBACK_DEFAULT }).reply;
}

function send(res, status, data) {
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
    if (raw.length > MAX_BODY) throw new Error('too large');
  }
  return JSON.parse(raw || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (rateLimited(clientIp(req))) {
    return send(res, 429, { reply: 'That is a lot of questions in a row. Give me a few minutes, or write to me at khaledmabrouk714@gmail.com.', fallback: true });
  }

  let messages;
  try {
    messages = cleanMessages((await readBody(req)).messages);
  } catch {
    return send(res, 400, { error: 'Invalid JSON' });
  }
  if (!messages) return send(res, 400, { error: 'Send at least one user message' });
  const question = messages[messages.length - 1].text;

  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res, 200, { reply: fallbackReply(question), fallback: true });

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
  });
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: AbortSignal.timeout(8_000),
        body,
      });
      if (!r.ok) {
        console.warn('[chat]', model, r.status, (await r.text()).slice(0, 160));
        if (r.status === 429 || r.status >= 500 || r.status === 404) continue; // busy, out of quota or retired: next model
        break;
      }
      const data = await r.json();
      const reply = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (reply) return send(res, 200, { reply });
    } catch (err) {
      console.warn('[chat]', model, 'failed', err?.name || err); // timeout or network: next model
    }
  }
  return send(res, 200, { reply: fallbackReply(question), fallback: true });
}
