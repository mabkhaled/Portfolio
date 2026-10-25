// The AI version of Khaled: a chat docked above the comms portrait. Replies come from /api/chat, type out like
// game dialogue and are spoken in the "Orus" voice (/api/speak). Visitors can also ask out loud (mic button).
// While he speaks, the portrait glow and the suit's energy follow the loudness of the voice.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const GREETING = "Hey, I'm the AI version of Khaled. Ask me about my work, my projects, my skills or how to reach me.";
const VOICE_KEY = 'khaled.voice';
const OPTIN_KEY = 'khaled.voiceOptIn';

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Escaped text with URLs and emails turned into links (the model is told to write them in full). */
function linkify(text) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g, (m) => `<a href="mailto:${m}">${m}</a>`);
}
/** What gets read aloud: links are on screen, so the voice skips them. */
function speakable(text) {
  return text.replace(/https?:\/\/\S+/g, '').replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ---------- Voice output (Web Audio, so it also works on Safari after the first tap) ---------- */
let speechSeq = 0;
const voice = { on: store.get(VOICE_KEY, true), ctx: null, source: null, analyser: null, raf: 0, onLevel: null, onEnd: null };

function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  voice.ctx ||= new AC();
  if (voice.ctx.state === 'suspended') voice.ctx.resume();
}
/** Stops the sound playing right now. */
function haltSource() {
  cancelAnimationFrame(voice.raf);
  try { voice.source?.stop(); } catch { /* already stopped */ }
  voice.source = null;
  voice.onLevel?.(0);
}
/** Stops everything, including answer parts still on their way. */
function stopVoice() {
  speechSeq++;
  haltSource();
}
async function playBuffer(arrayBuffer) {
  if (!voice.ctx) return;
  const buffer = await voice.ctx.decodeAudioData(arrayBuffer);
  haltSource();
  const src = voice.ctx.createBufferSource();
  const analyser = voice.ctx.createAnalyser();
  analyser.fftSize = 512;
  src.buffer = buffer;
  src.connect(analyser).connect(voice.ctx.destination);
  voice.source = src;
  const data = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += (v - 128) * (v - 128);
    voice.onLevel?.(Math.min(1, Math.sqrt(sum / data.length) / 28)); // RMS -> 0..1
    voice.raf = requestAnimationFrame(tick);
  };
  return new Promise((done) => {
    src.onended = () => {
      if (voice.source === src) haltSource();
      voice.onEnd?.();
      done();
    };
    src.start();
    tick();
  });
}
/**
 * Speech is synthesised per chunk, all in parallel: the first sentence alone so the voice starts quickly,
 * then chunks of about two sentences so each part is ready before the previous one ends.
 */
export function splitForSpeech(text) {
  if (text.length < 120) return [text];
  const sentences = text
    .split(/(?<=[.!?])\s+/) // "Node.js" has no space after its dot, so it stays whole
    .flatMap((s) => (s.length > 150 ? s.split(/(?<=,)\s+/) : [s])) // very long sentences break at commas
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = [sentences.shift()];
  let current = '';
  for (const s of sentences) {
    if (current && current.length + s.length > 180) {
      chunks.push(current);
      current = s;
    } else current = current ? `${current} ${s}` : s;
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 4).concat(chunks.length > 4 ? [chunks.slice(4).join(' ')] : []);
}
async function speakText(text) {
  const say = speakable(text);
  if (!voice.on || !voice.ctx || !say) return;
  const seq = ++speechSeq;
  // Both parts are requested at once; they play in order as soon as each is ready.
  const parts = splitForSpeech(say).map((part) =>
    fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part }) })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
  );
  for (const pending of parts) {
    const audio = await pending;
    if (seq !== speechSeq || !voice.on) return; // a newer question or mute cancels the rest
    if (audio) await playBuffer(audio).catch(() => {});
  }
}

/** Plays one of the pre-recorded comms lines, only for visitors who opened the chat and kept the voice on. */
export async function playLine(id) {
  if (!voice.on || !voice.ctx || !store.get(OPTIN_KEY, false)) return;
  try {
    const r = await fetch(`/media/voice/${id}.mp3`);
    if (r.ok) await playBuffer(await r.arrayBuffer());
  } catch { /* missing clip: stay silent */ }
}

export function chat({ gsap, reduce, avatar }) {
  const panel = $('#chat');
  if (!panel) return;
  const log = $('#chatLog');
  const form = $('#chatForm');
  const input = $('#chatInput');
  const send = $('.chat-send', form);
  const mic = $('#chatMic');
  const sound = $('#chatSound');
  const chips = $('#chatChips');
  const comms = $('#comms');
  const history = [];
  let opener = null;
  let busy = false;

  // The voice drives the glow: louder syllables, brighter energy.
  voice.onLevel = (level) => {
    comms.classList.toggle('is-speaking', level > 0.02);
    if (avatar) avatar.state.talk = level;
  };

  const renderSound = () => {
    sound.setAttribute('aria-pressed', String(voice.on));
    sound.setAttribute('aria-label', voice.on ? 'Mute voice' : 'Turn voice on');
    $('i', sound).className = `ph ${voice.on ? 'ph-speaker-high' : 'ph-speaker-slash'}`;
  };
  renderSound();
  sound.addEventListener('click', () => {
    voice.on = !voice.on;
    store.set(VOICE_KEY, voice.on);
    if (!voice.on) stopVoice();
    else unlockAudio();
    renderSound();
  });

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, html) => {
    const el = document.createElement('div');
    el.className = `msg msg-${who}`;
    el.innerHTML = html;
    log.appendChild(el);
    scrollDown();
    return el;
  };
  const glow = (on) => {
    comms.classList.toggle('is-speaking', on);
    if (avatar) gsap.to(avatar.state, { talk: on ? 0.6 : 0, duration: 0.4, overwrite: "auto" }); // "auto": never kill the scroll-driven hud tween
  };

  /** Types the reply out (glowing while it types), then swaps in the linkified version. */
  function typeOut(el, text) {
    return new Promise((done) => {
      glow(true);
      const finish = () => {
        el.innerHTML = linkify(text);
        if (!voice.source) glow(false);
        done();
      };
      if (reduce) return finish();
      let i = 0;
      const step = Math.max(1, Math.round(text.length / 140)); // long answers type faster
      const timer = setInterval(() => {
        i = Math.min(text.length, i + step);
        el.textContent = text.slice(0, i);
        scrollDown();
        if (i >= text.length) {
          clearInterval(timer);
          finish();
        }
      }, 18);
    });
  }

  function open(e) {
    opener = e?.currentTarget || null;
    unlockAudio(); // this click is the user gesture browsers need before any sound
    store.set(OPTIN_KEY, true);
    panel.hidden = false;
    comms.classList.add('is-chatting');
    if (!reduce) gsap.fromTo(panel, { opacity: 0, y: 16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' });
    if (!log.children.length) {
      typeOut(bubble('ai', ''), GREETING);
      playLine('greeting');
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    comms.classList.remove('is-chatting');
    stopVoice();
    glow(false);
    listening?.abort();
    opener?.focus();
  }

  async function ask(text) {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    busy = true;
    send.disabled = true;
    chips.hidden = true;
    unlockAudio();
    stopVoice();
    bubble('me', escapeHtml(q));
    history.push({ role: 'user', text: q });
    const thinking = bubble('ai', '<span class="msg-typing" aria-label="Typing"><span></span><span></span><span></span></span>');
    let reply;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-12) }),
      });
      reply = (await r.json()).reply;
    } catch {
      /* offline or no API: fall through to the default line */
    }
    reply = reply || 'My comms link dropped. Try again, or write to me at khaledmabrouk714@gmail.com.';
    history.push({ role: 'model', text: reply });
    speakText(reply); // the voice arrives a moment later and plays over the typing
    await typeOut(thinking, reply);
    busy = false;
    send.disabled = false;
    input.focus();
  }

  /* ---------- Voice input: the browser's own speech recognition (Chrome, Edge, Safari) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let listening = null;
  if (!SR) mic.hidden = true;
  else {
    mic.addEventListener('click', () => {
      if (listening) return listening.stop();
      unlockAudio();
      stopVoice();
      const rec = new SR();
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      listening = rec;
      mic.classList.add('is-listening');
      mic.setAttribute('aria-pressed', 'true');
      input.placeholder = 'Listening...';
      let finalText = '';
      rec.onresult = (e) => {
        const res = [...e.results];
        input.value = res.map((r) => r[0].transcript).join('');
        finalText = res.filter((r) => r.isFinal).map((r) => r[0].transcript).join('');
      };
      rec.onend = () => {
        listening = null;
        mic.classList.remove('is-listening');
        mic.setAttribute('aria-pressed', 'false');
        input.placeholder = 'Ask about my work, skills, projects...';
        const said = (finalText || input.value).trim();
        if (said) {
          input.value = '';
          ask(said);
        }
      };
      rec.onerror = () => rec.abort();
      rec.start();
    });
  }

  $$('[data-chat-open]').forEach((b) => b.addEventListener('click', open));
  $('#chatClose').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    ask(text);
  });
  $$('.chat-chip', chips).forEach((c) => c.addEventListener('click', () => ask(c.textContent)));
}
