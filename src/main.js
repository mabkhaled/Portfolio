// Static Unbounded: the variable build shows hairline seams where glyph contours overlap.
import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/700.css";
import "@fontsource/unbounded/800.css";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "@phosphor-icons/web/regular";
import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(pointer: fine)").matches;

/* ---------- Smooth scroll ---------- */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) =>
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else if (target === 0) scrollTo(0, 0);
    else target.scrollIntoView();
  })
);

/* ---------- Tech marquee ---------- */
const TECH = [
  ["nodedotjs", "Node.js"], ["typescript", "TypeScript"], ["react", "React"], ["angular", "Angular"],
  ["flutter", "Flutter"], ["dart", "Dart"], ["kotlin", "Kotlin"], ["springboot", "Spring Boot"],
  ["dotnet", ".NET"], ["googlecloud", "Google Cloud"], ["docker", "Docker"], ["kubernetes", "Kubernetes"],
  ["terraform", "Terraform"], ["githubactions", "GitHub Actions"], ["gitlab", "GitLab"],
  ["postgresql", "PostgreSQL"], ["mysql", "MySQL"], ["mongodb", "MongoDB"], ["redis", "Redis"],
  ["anthropic", "Anthropic"], ["mistralai", "Mistral AI"], ["stripe", "Stripe"], ["python", "Python"],
  ["express", "Express"], ["prisma", "Prisma"],
];
const logos = TECH.map(
  ([slug, name]) =>
    `<img src="https://cdn.simpleicons.org/${slug}/8ea2a8" alt="${name}" title="${name}" width="30" height="30" loading="lazy">`
).join("");
$("#marqueeTrack").innerHTML =
  `<div class="marquee-group">${logos}</div><div class="marquee-group" aria-hidden="true">${logos}</div>`;

/* ---------- Text scramble (game-style decode) ---------- */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*<>/";
function scramble(el, speed = 2.4) {
  const final = el.dataset.text;
  let frame = 0;
  const step = () => {
    frame++;
    let out = "";
    for (let i = 0; i < final.length; i++) {
      const c = final[i];
      if (c === " " || frame > i * speed + 8) out += c;
      else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (out !== final) requestAnimationFrame(step);
  };
  step();
}

/* ---------- Hero: pointer, light, head-turn video ---------- */
const hero = $("#hero");
const figure = $("#figure");
const light = $("#figureLight");
const video = $("#figureVideo");
const pointer = { x: 0.5, y: 0.45, moved: 0 };
const lightPos = { x: 46, y: 26 };
let heroVisible = true;
new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe(hero);

if (fine && !reduce) {
  const layers = $$("[data-depth]", hero).map((el) => ({
    x: gsap.quickTo(el, "x", { duration: 1, ease: "power3" }),
    y: gsap.quickTo(el, "y", { duration: 1, ease: "power3" }),
    d: +el.dataset.depth,
  }));
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width;
    pointer.y = (e.clientY - r.top) / r.height;
    pointer.moved = performance.now();
    layers.forEach((l) => {
      l.x((pointer.x - 0.5) * 70 * l.d);
      l.y((pointer.y - 0.5) * 36 * l.d);
    });
  });
}

// Optional head-turn clip: drop public/media/head-turn.mp4 in and the cursor scrubs it.
let videoReady = false;
let shownT = 0.5;
async function loadHeadTurn() {
  if (reduce) return;
  try {
    const res = await fetch("/media/head-turn.mp4");
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("video")) return;
    // Whole clip as a blob so every seek is instant instead of waiting on the network.
    video.src = URL.createObjectURL(await res.blob());
    await new Promise((ok, ko) => {
      video.onloadeddata = ok;
      video.onerror = ko;
    });
    videoReady = true;
    video.classList.add("is-ready");
  } catch {
    /* no clip: the still image stays */
  }
}

gsap.ticker.add((time) => {
  if (!heroVisible || reduce) return;
  const idle = !fine || performance.now() - pointer.moved > 3500;
  // Light follows the cursor; when idle it orbits slowly over the face and chest.
  const fr = figure.getBoundingClientRect();
  let tx, ty;
  if (idle) {
    tx = 50 + Math.sin(time * 0.5) * 9;
    ty = 30 + Math.cos(time * 0.37) * 10;
  } else {
    tx = ((pointer.x * hero.clientWidth - (fr.left - hero.getBoundingClientRect().left)) / fr.width) * 100;
    ty = ((pointer.y * hero.clientHeight - (fr.top - hero.getBoundingClientRect().top)) / fr.height) * 100;
  }
  lightPos.x += (tx - lightPos.x) * 0.08;
  lightPos.y += (ty - lightPos.y) * 0.08;
  light.style.setProperty("--lx", lightPos.x.toFixed(2) + "%");
  light.style.setProperty("--ly", lightPos.y.toFixed(2) + "%");

  if (videoReady && video.duration) {
    // Pointer x across 14%..86% of the hero maps to the clip start..end; idle drifts around the middle.
    const target = idle
      ? 0.5 + Math.sin(time * 0.45) * 0.32
      : gsap.utils.clamp(0, 1, (pointer.x - 0.14) / 0.72);
    shownT += (target - shownT) * 0.14;
    const t = shownT * (video.duration - 0.05);
    if (!video.seeking && Math.abs(video.currentTime - t) > 0.02) video.currentTime = t;
  }
});

/* ---------- Ambient dust with depth ---------- */
function startDust() {
  const c = $("#dust");
  const ctx = c.getContext("2d");
  let w = 0, h = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.clientWidth;
    h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener("resize", resize);
  const n = Math.round(Math.min(150, (w * h) / 8000));
  const parts = Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    z: Math.random(),
    vy: 0.12 + Math.random() * 0.3,
    ph: Math.random() * 6.283,
    warm: Math.random() < 0.2,
  }));
  gsap.ticker.add((time) => {
    if (!heroVisible) return;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.y -= p.vy * (0.35 + p.z);
      p.x += Math.sin(time * 0.6 + p.ph) * 0.18 * p.z;
      if (p.y < -20) {
        p.y = h + 20;
        p.x = Math.random() * w;
      }
      const ox = (pointer.x - 0.5) * -60 * p.z;
      const oy = (pointer.y - 0.5) * -30 * p.z;
      // Nearest motes render as soft out-of-focus bokeh.
      const rgb = p.warm ? "242,163,94" : "150,232,242";
      const x = p.x + ox;
      const y = p.y + oy;
      ctx.beginPath();
      if (p.z > 0.93) {
        const r = 8 + (p.z - 0.93) * 220;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},0.09)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.arc(x, y, r, 0, 6.283);
      } else {
        ctx.fillStyle = `rgba(${rgb},${0.12 + p.z * 0.5})`;
        ctx.arc(x, y, 0.4 + p.z * 1.6, 0, 6.283);
      }
      ctx.fill();
    }
  });
}

/* ---------- Boot sequence, then hero entrance ---------- */
async function boot() {
  const bootEl = $("#boot");
  const ready = Promise.all([$("#figureImg").decode().catch(() => {}), document.fonts.ready]);
  if (reduce) {
    await ready;
    bootEl.remove();
    return;
  }
  document.documentElement.classList.add("is-booting");
  lenis?.stop();
  const count = $("#bootCount");
  const bar = $("#bootBar");
  const p = { v: 0 };
  const paint = () => {
    count.textContent = String(Math.round(p.v)).padStart(2, "0");
    bar.style.transform = `scaleX(${p.v / 100})`;
  };
  await Promise.all([ready, gsap.to(p, { v: 88, duration: 1.1, ease: "power2.out", onUpdate: paint })]);
  await gsap.to(p, { v: 100, duration: 0.25, ease: "none", onUpdate: paint });
  heroIntro();
  await gsap.to(bootEl, { clipPath: "inset(0 0 100% 0)", duration: 0.9, ease: "expo.inOut" });
  bootEl.remove();
  document.documentElement.classList.remove("is-booting");
  lenis?.start();
}

function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.35 });
  // Character "spawns": a scan line sweeps up and materialises him from a white-hot silhouette.
  tl.fromTo(".figure-fade", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "power3.inOut" }, 0)
    .fromTo(".figure-scan", { top: "100%", opacity: 1 }, { top: "0%", duration: 1.6, ease: "power3.inOut" }, 0)
    .to(".figure-scan", { opacity: 0, duration: 0.4 }, 1.45)
    .from(".figure-img", { filter: "brightness(2.6) saturate(0) contrast(1.2)", duration: 2, ease: "power2.out" }, 0.15)
    .from(".nav", { yPercent: -100, opacity: 0, duration: 1 }, 0.3)
    .from(".hero-eyebrow", { opacity: 0, x: -24, duration: 0.9 }, 0.5)
    .from(".hero-name .line > span", { yPercent: 105, duration: 1.2, stagger: 0.12 }, 0.55)
    .add(() => $$(".hero-name .scramble").forEach((el, i) => setTimeout(() => scramble(el), i * 140)), 0.55)
    .from([".hero-sub", ".hero-ctas"], { y: 26, opacity: 0, duration: 1, stagger: 0.12 }, 1)
    .from(".hero-hud > div", { x: 26, opacity: 0, duration: 0.9, stagger: 0.1 }, 1.2);
}

/* ---------- Scroll choreography ---------- */
function scrollScenes() {
  // Nav gets a backdrop once you leave the top.
  ScrollTrigger.create({
    trigger: hero,
    start: "top+=80 top",
    endTrigger: "body",
    end: "bottom bottom",
    toggleClass: { targets: "#nav", className: "is-scrolled" },
  });

  if (reduce) return;

  // Camera push: the character steps closer while the title lifts away.
  gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
    .to(".figure", { yPercent: 10, scale: 1.12, ease: "none" }, 0)
    .to(".hero-copy", { yPercent: -40, opacity: 0, ease: "none" }, 0)
    .to(".hero-hud", { yPercent: -60, opacity: 0, ease: "none" }, 0)
    .to(".hero-glow", { opacity: 0.25, ease: "none" }, 0);

  $$(".reveal").forEach((el) =>
    gsap.from(el, {
      y: 48,
      opacity: 0,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    })
  );

  // Stats count up when they enter.
  $$(".stat-num").forEach((el) => {
    const to = +el.dataset.to;
    const dec = +(el.dataset.dec || 0);
    const pre = el.dataset.prefix || "";
    const suf = el.dataset.suffix || "";
    const o = { v: to > 1 ? 0 : to };
    gsap.from(el.parentElement, { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    if (to <= 1) return;
    gsap.to(o, {
      v: to,
      duration: 1.8,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
      onUpdate: () => (el.textContent = pre + o.v.toFixed(dec) + suf),
    });
  });

  // Missions: vertical scroll drives a horizontal pan on wide screens.
  gsap.matchMedia().add("(min-width: 768px)", () => {
    const sec = $("#missions");
    const track = $("#missionsTrack");
    const dist = () => Math.max(0, track.scrollWidth - sec.clientWidth);
    const pan = gsap.to(track, {
      x: () => -dist(),
      ease: "none",
      scrollTrigger: {
        trigger: sec,
        start: "top top",
        end: () => "+=" + dist(),
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    $$(".mission", track).forEach((card) =>
      gsap.from(card, {
        rotateY: -24,
        scale: 0.9,
        opacity: 0.25,
        transformOrigin: "0% 50%",
        ease: "none",
        scrollTrigger: { trigger: card, containerAnimation: pan, start: "left 100%", end: "left 45%", scrub: true },
      })
    );
  });

  // Loadout slots assemble in a staggered wave.
  gsap.from(".slot", {
    y: 60,
    opacity: 0,
    duration: 1,
    ease: "expo.out",
    stagger: { each: 0.07, from: "start" },
    scrollTrigger: { trigger: ".bento", start: "top 82%", once: true },
  });

  // Achievements pop in one by one, each with a shine sweep.
  const ach = gsap.timeline({ scrollTrigger: { trigger: ".ach-list", start: "top 80%", once: true } });
  $$(".ach").forEach((el, i) => {
    ach.from(el, { scale: 0.8, y: 30, opacity: 0, duration: 0.7, ease: "back.out(1.8)" }, i * 0.11)
      .add(() => el.classList.add("is-unlocked"), i * 0.11 + 0.25);
  });

  // Contact title decodes like the hero name.
  const ct = $("#contactTitle");
  ct.dataset.text = ct.textContent;
  ScrollTrigger.create({ trigger: ct, start: "top 85%", once: true, onEnter: () => scramble(ct, 1.2) });
}

/* ---------- Micro-interactions ---------- */
function interactions() {
  document.addEventListener(
    "pointermove",
    (e) => {
      const p = e.target.closest?.(".panel");
      if (!p) return;
      const r = p.getBoundingClientRect();
      p.style.setProperty("--mx", e.clientX - r.left + "px");
      p.style.setProperty("--my", e.clientY - r.top + "px");
    },
    { passive: true }
  );
  if (!fine || reduce) return;
  $$(".btn, .icon-link").forEach((b) => {
    const xTo = gsap.quickTo(b, "x", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(b, "y", { duration: 0.5, ease: "power3" });
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.22);
      yTo((e.clientY - r.top - r.height / 2) * 0.3);
    });
    b.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

if (!reduce) startDust();
interactions();
scrollScenes();
boot().then(() => ScrollTrigger.refresh());
loadHeadTurn();
