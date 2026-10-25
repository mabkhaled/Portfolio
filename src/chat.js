// The AI version of Khaled: a chat docked above the comms portrait. Replies come from /api/chat and type
// out like game dialogue while the portrait glows and the suit's energy speeds up.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const GREETING = "Hey, I'm the AI version of Khaled. Ask me about my work, my projects, my skills or how to reach me.";

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Escaped text with URLs and emails turned into links (the model is told to write them in full). */
function linkify(text) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g, (m) => `<a href="mailto:${m}">${m}</a>`);
}

export function chat({ gsap, reduce, avatar }) {
  const panel = $('#chat');
  if (!panel) return;
  const log = $('#chatLog');
  const form = $('#chatForm');
  const input = $('#chatInput');
  const send = $('.chat-send', form);
  const chips = $('#chatChips');
  const comms = $('#comms');
  const history = [];
  let opener = null;
  let busy = false;

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };
  const bubble = (who, html) => {
    const el = document.createElement('div');
    el.className = `msg msg-${who}`;
    el.innerHTML = html;
    log.appendChild(el);
    scrollDown();
    return el;
  };
  const speaking = (on) => {
    comms.classList.toggle('is-speaking', on);
    if (avatar) gsap.to(avatar.state, { talk: on ? 1 : 0, duration: 0.4, overwrite: true });
  };

  /** Types the reply out, then swaps in the linkified version. */
  function typeOut(el, text) {
    return new Promise((done) => {
      speaking(true);
      if (reduce) {
        el.innerHTML = linkify(text);
        speaking(false);
        return done();
      }
      let i = 0;
      const step = Math.max(1, Math.round(text.length / 140)); // long answers type faster
      const timer = setInterval(() => {
        i = Math.min(text.length, i + step);
        el.textContent = text.slice(0, i);
        scrollDown();
        if (i >= text.length) {
          clearInterval(timer);
          el.innerHTML = linkify(text);
          speaking(false);
          done();
        }
      }, 18);
    });
  }

  function open(e) {
    opener = e?.currentTarget || null;
    panel.hidden = false;
    comms.classList.add('is-chatting');
    if (!reduce) gsap.fromTo(panel, { opacity: 0, y: 16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' });
    if (!log.children.length) typeOut(bubble('ai', ''), GREETING);
    input.focus();
  }
  function close() {
    panel.hidden = true;
    comms.classList.remove('is-chatting');
    speaking(false);
    opener?.focus();
  }

  async function ask(text) {
    const q = text.trim().slice(0, 600);
    if (!q || busy) return;
    busy = true;
    send.disabled = true;
    chips.hidden = true;
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
    await typeOut(thinking, reply);
    busy = false;
    send.disabled = false;
    input.focus();
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
