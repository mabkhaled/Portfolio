// Projects "quest select": accessible tabs (click, arrows, Home/End) that swap the showcase stage with a
// wipe, screenshot galleries that cycle on their own while visible, and a 3D tilt with glare on the media.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SHOT_MS = 4200;

/** One gallery per panel that has screenshots. */
function gallery(panel, reduce) {
  const imgs = $$('.browser-view img', panel);
  const shots = $$('.shot', panel);
  const strip = $('.shots', panel);
  if (!imgs.length) return null;
  let index = 0;
  let timer = 0;
  let running = false;
  let hovered = false;

  const show = (n) => {
    index = (n + imgs.length) % imgs.length;
    imgs.forEach((im, k) => im.classList.toggle('is-active', k === index));
    shots.forEach((s, k) => {
      s.classList.toggle('is-active', k === index);
      s.setAttribute('aria-pressed', String(k === index));
    });
    // Restart the thin timer bar on the active thumbnail.
    const active = shots[index];
    if (active) { active.classList.remove('is-active'); void active.offsetWidth; active.classList.add('is-active'); }
  };
  const schedule = () => {
    clearTimeout(timer);
    if (!running || hovered || reduce) return;
    timer = setTimeout(() => { show(index + 1); schedule(); }, SHOT_MS);
  };
  strip?.style.setProperty('--shot-ms', SHOT_MS + 'ms');
  shots.forEach((s, k) => s.addEventListener('click', () => { show(k); schedule(); }));
  const media = $('.quest-media', panel);
  media.addEventListener('pointerenter', () => { hovered = true; strip?.classList.add('is-paused'); clearTimeout(timer); });
  media.addEventListener('pointerleave', () => { hovered = false; strip?.classList.remove('is-paused'); show(index); schedule(); });

  return {
    start() { running = true; show(index); schedule(); },
    stop() { running = false; clearTimeout(timer); },
  };
}

/** Pointer-driven 3D tilt plus a moving glare. */
function tilt(el, gsap) {
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry((px - 0.5) * 9);
    rx((0.5 - py) * 7);
    el.style.setProperty('--gx', px * 100 + '%');
    el.style.setProperty('--gy', py * 100 + '%');
  });
  el.addEventListener('pointerleave', () => { rx(0); ry(0); });
}

export function quests({ gsap, reduce, fine }) {
  const list = $('.quest-list');
  if (!list) return;
  const tabs = $$('.quest-tab', list);
  const marker = $('.quest-marker', list);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const galleries = panels.map((p) => gallery(p, reduce));
  let current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  if (current < 0) current = 0;
  let tl = null;
  let inView = false;

  const moveMarker = (instant) => {
    const t = tabs[current];
    const props = { x: t.offsetLeft, width: t.offsetWidth };
    if (instant || reduce) gsap.set(marker, props);
    else gsap.to(marker, { ...props, duration: 0.6, ease: 'expo.out' });
  };

  function select(i, focus) {
    if (focus) tabs[i].focus();
    if (i === current) return;
    tl?.progress(1); // finish any wipe still running before starting the next
    const from = panels[current];
    const to = panels[i];
    galleries[current]?.stop();
    tabs[current].setAttribute('aria-selected', 'false');
    tabs[current].tabIndex = -1;
    tabs[i].setAttribute('aria-selected', 'true');
    tabs[i].tabIndex = 0;
    current = i;
    moveMarker();
    if (reduce) {
      from.hidden = true;
      to.hidden = false;
      if (inView) galleries[i]?.start();
      return;
    }
    tl = gsap.timeline({ onComplete: () => { if (inView) galleries[i]?.start(); } })
      .to(from, { opacity: 0, y: 14, duration: 0.2, ease: 'power2.in' })
      .add(() => {
        from.hidden = true;
        gsap.set(from, { clearProps: 'opacity,transform' });
        to.hidden = false;
      })
      // The new quest "loads in": its media wipes open left to right, then the details rise.
      .fromTo($('.quest-media', to), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'expo.out', clearProps: 'clipPath' })
      .from($$('.quest-info > *', to), { y: 20, opacity: 0, duration: 0.55, stagger: 0.05, ease: 'expo.out', clearProps: 'opacity,transform' }, '<0.08');
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i, false)));
  list.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in keys) { e.preventDefault(); select((current + keys[e.key] + tabs.length) % tabs.length, true); }
    else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
    else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
  });

  // Galleries only cycle while the section is on screen.
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) galleries[current]?.start();
    else galleries.forEach((g) => g?.stop());
  }, { threshold: 0.25 }).observe($('.quest-stage'));

  if (fine && !reduce) $$('[data-tilt]').forEach((el) => tilt(el, gsap));
  moveMarker(true);
  addEventListener('resize', () => moveMarker(true));
  document.fonts?.ready.then(() => moveMarker(true));
}
