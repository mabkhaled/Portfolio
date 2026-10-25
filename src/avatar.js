// Living avatar: one photo + an AI depth map, rendered with two shaders.
// The photo is never warped. The cursor relights him in 3D, energy runs through the suit's
// seams, and moving over him breaks his pixels into hologram particles that drift away and
// snap back. On scroll he beams down into a corner comms portrait.

const IMG_W = 892;
const IMG_H = 1200;
const HEAD = [452, 235];
// Source windows: hero shows him past the belt (keeps the wrist hologram), comms shows a square head crop.
const CROP_HERO = [0, 0, 1, 0.92];
const CROP_HEAD = [302 / IMG_W, 92 / IMG_H, 602 / IMG_W, 392 / IMG_H];
const TRAIL_MAX = 16;
const GRID = 3; // one particle every 3 image pixels

const SHARED = `
precision highp float;
const vec3 CYAN = vec3(0.31, 0.88, 0.95);
uniform vec2 u_res;
uniform float u_dpr;
uniform vec4 u_rect;
uniform vec4 u_crop;
uniform float u_time;
uniform vec4 u_trail[${TRAIL_MAX}];
float hash(float n) { return fract(sin(n) * 43758.5453); }
// How strongly the cursor trail is disturbing this screen point (0..1).
float disturb(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < ${TRAIL_MAX}; i++) {
    vec4 t = u_trail[i];
    if (t.z <= 0.0) continue;
    vec2 d = p - t.xy;
    f += exp(-dot(d, d) / (t.w * t.w)) * t.z;
  }
  return clamp(f, 0.0, 1.0);
}
`;

const PHOTO_VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const PHOTO_FRAG = `${SHARED}
uniform sampler2D u_tex;
uniform sampler2D u_depth;
uniform vec2 u_light;
uniform float u_hud;
uniform float u_intro;
uniform float u_fade;
float depthAt(vec2 uv) { return texture2D(u_depth, uv).r; }

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 local = (p - u_rect.xy) / u_rect.zw;
  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) discard;

  // Transmission glitch while beaming between hero and comms.
  float glitch = sin(clamp(u_hud, 0.0, 1.0) * 3.14159);
  float row = floor(local.y * 48.0);
  float tear = (hash(row + floor(u_time * 24.0)) - 0.5) * step(0.7, hash(row * 1.73 + floor(u_time * 17.0)));
  local.x += tear * 0.09 * glitch;

  vec2 s = mix(u_crop.xy, u_crop.zw, local);
  vec3 base = texture2D(u_tex, s).rgb;
  vec3 c = base;
  if (glitch > 0.01) {
    c.r = texture2D(u_tex, s + vec2(0.007 * glitch, 0.0)).r;
    c.b = texture2D(u_tex, s - vec2(0.007 * glitch, 0.0)).b;
  }

  float d = depthAt(s);
  float subj = smoothstep(0.34, 0.54, d);

  // Normals from the depth map, lit by the cursor.
  vec2 px = 1.5 / vec2(${IMG_W}.0, ${IMG_H}.0);
  float dx = depthAt(s + vec2(px.x, 0.0)) - depthAt(s - vec2(px.x, 0.0));
  float dy = depthAt(s + vec2(0.0, px.y)) - depthAt(s - vec2(0.0, px.y));
  vec3 N = normalize(vec3(-dx * 16.0, -dy * 16.0, 1.0));
  vec2 toL = (u_light - s) * vec2(${IMG_W}.0 / ${IMG_H}.0, 1.0);
  vec3 L = normalize(vec3(toL, 0.3));
  float fall = 1.0 / (1.0 + dot(toL, toL) * 18.0);
  float diff = max(dot(N, L), 0.0);
  float rim = pow(1.0 - N.z, 1.4) * max(dot(normalize(N.xy + 1e-5), normalize(toL + 1e-5)), 0.0);
  c += c * CYAN * diff * fall * 0.55 * subj;
  c += CYAN * rim * fall * 0.5 * subj;

  // Energy pulses running through the cyan seams; the wrist hologram flickers.
  float cyanMask = smoothstep(0.05, 0.18, (base.g + base.b) * 0.5 - base.r) * smoothstep(0.32, 0.55, max(base.g, base.b));
  float wave = pow(0.5 + 0.5 * sin(s.y * 28.0 - u_time * 2.8 + s.x * 7.0), 12.0);
  float holo = step(0.84, s.x) * step(0.66, s.y) * step(s.y, 0.82);
  float flick = mix(1.0, 0.75 + 0.35 * hash(floor(u_time * 13.0)), holo);
  c += CYAN * cyanMask * (0.22 + 1.5 * wave) * flick * 0.75;

  // Alpha: keep the character, let a little smoke breathe around him, dissolve the cut at the belt.
  float vign = (1.0 - smoothstep(0.12, 0.6, length((local - vec2(0.5, 0.4)) * vec2(1.0, 0.7))))
    * smoothstep(0.0, 0.2, local.x) * smoothstep(1.0, 0.8, local.x) * smoothstep(0.0, 0.15, local.y);
  float a = max(subj, 0.3 * vign);
  a *= 1.0 - smoothstep(0.84, 0.995, local.y) * (1.0 - u_hud);
  a = mix(a, 1.0, u_hud);

  // Where the cursor disturbs him, the photo opens up (the particle pass fills the gap) with a hot rim.
  float hole = pow(disturb(p), 1.4) * 0.85 * subj * (1.0 - u_hud);
  c += CYAN * smoothstep(0.0, 0.35, hole) * (1.0 - hole) * 0.6;
  a *= 1.0 - hole;

  // Comms look: scanlines and a cold tint.
  float scan = 0.84 + 0.16 * sin(p.y * 2.4);
  c = mix(c, c * scan * vec3(0.85, 1.05, 1.12) + vec3(0.0, 0.03, 0.05), u_hud);

  // Spawn: a scanner sweeps up, drawing depth contours before the photo resolves.
  float edge = 1.04 - u_intro * 1.12;
  float reveal = smoothstep(edge - 0.004, edge + 0.004, local.y);
  float band = smoothstep(edge - 0.22, edge, local.y) * (1.0 - reveal);
  float contour = smoothstep(0.38, 0.5, abs(fract(d * 34.0 - u_time * 0.4) - 0.5));
  float holoA = band * subj * (0.25 + 0.75 * contour);
  float beam = exp(-abs(local.y - edge) * 90.0) * step(u_intro, 0.999) * max(subj, 0.25);

  vec3 col = mix(CYAN * 1.2, c, reveal) + CYAN * beam * 1.5;
  float alpha = clamp(a * reveal + holoA * 0.9 + beam, 0.0, 1.0);
  alpha *= u_fade;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

// One point per photo cell; only cells disturbed by the cursor become visible and fly off.
const DUST_VERT = `${SHARED}
attribute vec2 a_uv;
attribute float a_rand;
uniform float u_size;
varying vec2 v_uv;
varying float v_f;
void main() {
  vec2 local = (a_uv - u_crop.xy) / (u_crop.zw - u_crop.xy);
  vec2 home = u_rect.xy + local * u_rect.zw;
  vec2 push = vec2(0.0);
  float f = 0.0;
  for (int i = 0; i < ${TRAIL_MAX}; i++) {
    vec4 t = u_trail[i];
    if (t.z <= 0.0) continue;
    vec2 d = home - t.xy;
    float g = exp(-dot(d, d) / (t.w * t.w)) * t.z;
    vec2 n = normalize(d + 0.001);
    push += (n + vec2(-n.y, n.x) * (a_rand - 0.5) * 2.4) * g * t.w / 64.0;
    f += g;
  }
  f = clamp(f, 0.0, 1.0);
  v_uv = a_uv;
  v_f = f;
  if (f < 0.003) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 0.0; return; }
  float amp = 14.0 + 48.0 * a_rand;
  vec2 drift = vec2(sin(u_time * 2.0 + a_rand * 40.0) * 8.0, -16.0 * (0.3 + a_rand));
  vec2 pos = home + push * amp + drift * f * f;
  vec2 clip = pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = u_size * u_dpr * (1.0 + 0.6 * f * a_rand);
}
`;

const DUST_FRAG = `${SHARED}
uniform sampler2D u_tex;
varying vec2 v_uv;
varying float v_f;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  vec3 col = texture2D(u_tex, v_uv).rgb;
  col = mix(col, CYAN, 0.22 * v_f) * (1.0 + 0.5 * v_f); // keep his real colours, just a cyan edge
  float a = v_f * (1.0 - smoothstep(0.25, 0.5, r));
  gl_FragColor = vec4(col * a, a);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl, vs, fs, uniforms) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const U = {};
  uniforms.forEach((n) => (U[n] = gl.getUniformLocation(p, n === "u_trail" ? "u_trail[0]" : n)));
  return { p, U };
}

function loadImage(src) {
  return new Promise((ok, ko) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => ok(im);
    im.onerror = ko;
    im.src = src;
  });
}

function texture(gl, img, unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
}

// Particles only where the depth map says "character", so the background never sheds dust.
function particleGrid(depthImg) {
  const c = document.createElement("canvas");
  c.width = IMG_W;
  c.height = IMG_H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(depthImg, 0, 0, IMG_W, IMG_H);
  const px = ctx.getImageData(0, 0, IMG_W, IMG_H).data;
  const out = [];
  for (let y = 0; y < IMG_H; y += GRID) {
    for (let x = 0; x < IMG_W; x += GRID) {
      if (px[(y * IMG_W + x) * 4] < 0.38 * 255) continue;
      out.push((x + 0.5) / IMG_W, (y + 0.5) / IMG_H, Math.random());
    }
  }
  return new Float32Array(out);
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * @param {{figureEl: Element, portraitEl: Element, src: string, depthSrc: string, ticker: {add: Function}}} o
 * @returns {null | {state: {hud: number, intro: number, fade: number}, ready: Promise<void>}}
 */
export function createAvatar({ figureEl, portraitEl, src, depthSrc, ticker }) {
  const canvas = document.createElement("canvas");
  canvas.className = "avatar-gl";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const COMMON = ["u_res", "u_dpr", "u_rect", "u_crop", "u_time", "u_trail", "u_tex"];
  let photo, dust;
  try {
    photo = program(gl, PHOTO_VERT, PHOTO_FRAG, [...COMMON, "u_depth", "u_light", "u_hud", "u_intro", "u_fade"]);
    dust = program(gl, DUST_VERT, DUST_FRAG, [...COMMON, "u_size"]);
  } catch (err) {
    console.warn("avatar shader failed, keeping the still image", err);
    return null;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(photo.p, "a_pos");
  const aUv = gl.getAttribLocation(dust.p, "a_uv");
  const aRand = gl.getAttribLocation(dust.p, "a_rand");
  const points = gl.createBuffer();
  let pointCount = 0;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const state = { hud: 0, intro: 0, fade: 1 };
  const pointer = { x: innerWidth * 0.75, y: innerHeight * 0.35, t: -1e9 };
  const light = { x: 0.62, y: 0.2 };
  const trail = [];
  const trailData = new Float32Array(TRAIL_MAX * 4);
  let rect = [0, 0, 1, 1];
  let dpr = 1;
  let lastTime = 0;
  let last = { x: -1e4, y: -1e4, t: 0 };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  addEventListener("resize", resize);

  const overFigure = (x, y, pad) =>
    state.hud < 0.3 && state.intro >= 1 && x > rect[0] - pad && x < rect[0] + rect[2] + pad && y > rect[1] - pad && y < rect[1] + rect[3] + pad;
  const addTrail = (x, y, s0, r, life) => {
    trail.push({ x, y, s0, r, life, born: performance.now() });
    if (trail.length > TRAIL_MAX) trail.shift();
  };

  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = performance.now();
      if (!overFigure(e.clientX, e.clientY, 40)) return;
      const moved = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (moved < 12 && pointer.t - last.t < 70) return;
      last = { x: e.clientX, y: e.clientY, t: pointer.t };
      addTrail(e.clientX, e.clientY, 0.7, rect[3] * 0.065, 1.6);
    },
    { passive: true }
  );
  // A click on him blows a bigger hole that takes longer to heal.
  addEventListener(
    "pointerdown",
    (e) => {
      if (overFigure(e.clientX, e.clientY, 0)) addTrail(e.clientX, e.clientY, 1.4, rect[3] * 0.13, 2);
    },
    { passive: true }
  );

  const ready = Promise.all([loadImage(src), loadImage(depthSrc)]).then(([im, dm]) => {
    texture(gl, im, 0);
    texture(gl, dm, 1);
    const grid = particleGrid(dm);
    pointCount = grid.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, points);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    resize();
    document.body.appendChild(canvas);
    document.documentElement.classList.add("gl-on");
    ticker.add(render);
  });

  function setCommon(U, crop, time) {
    gl.uniform2f(U.u_res, innerWidth, innerHeight);
    gl.uniform1f(U.u_dpr, dpr);
    gl.uniform4f(U.u_rect, ...rect);
    gl.uniform4f(U.u_crop, ...crop);
    gl.uniform1f(U.u_time, time);
    gl.uniform4fv(U.u_trail, trailData);
    gl.uniform1i(U.u_tex, 0);
  }

  function render(time) {
    const h = Math.min(1, Math.max(0, state.hud));
    const a = figureEl.getBoundingClientRect();
    const b = portraitEl.getBoundingClientRect();
    rect = [lerp(a.left, b.left, h), lerp(a.top, b.top, h), lerp(a.width, b.width, h), lerp(a.height, b.height, h)];
    const crop = CROP_HERO.map((v, i) => lerp(v, CROP_HEAD[i], h));

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (rect[1] > innerHeight || rect[1] + rect[3] < 0 || state.fade < 0.01) return; // off screen or faded out

    // Cursor light, in image coordinates. Idle: it swings around him like a slow rim light.
    const idle = performance.now() - pointer.t > 4000;
    let lx, ly;
    if (idle) {
      lx = HEAD[0] / IMG_W + Math.sin(time * 0.45) * 0.42;
      ly = HEAD[1] / IMG_H + 0.1 + Math.cos(time * 0.33) * 0.15;
    } else {
      lx = crop[0] + ((pointer.x - rect[0]) / rect[2]) * (crop[2] - crop[0]);
      ly = crop[1] + ((pointer.y - rect[1]) / rect[3]) * (crop[3] - crop[1]);
    }
    const dt = Math.min(1, Math.max(0, time - lastTime));
    lastTime = time;
    const k = 1 - Math.pow(0.91, dt * 60); // frame-rate independent easing
    light.x += (lx - light.x) * k;
    light.y += (ly - light.y) * k;

    // Trail strengths fade with age; once all are gone he is whole again.
    const now = performance.now();
    for (let i = trail.length - 1; i >= 0; i--) if (now - trail[i].born > trail[i].life * 1000) trail.splice(i, 1);
    trailData.fill(0);
    trail.forEach((t, i) => {
      const age = (now - t.born) / (t.life * 1000);
      trailData.set([t.x, t.y, t.s0 * (1 - age) * (1 - age), t.r], i * 4);
    });

    gl.useProgram(photo.p);
    setCommon(photo.U, crop, time);
    gl.uniform1i(photo.U.u_depth, 1);
    gl.uniform2f(photo.U.u_light, light.x, light.y);
    gl.uniform1f(photo.U.u_hud, h);
    gl.uniform1f(photo.U.u_intro, state.intro);
    gl.uniform1f(photo.U.u_fade, state.fade);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(aPos);

    if (!trail.length || h > 0.3) return;
    gl.useProgram(dust.p);
    setCommon(dust.U, crop, time);
    gl.uniform1f(dust.U.u_size, ((GRID * rect[2]) / ((crop[2] - crop[0]) * IMG_W)) * 1.5);
    gl.bindBuffer(gl.ARRAY_BUFFER, points);
    gl.enableVertexAttribArray(aUv);
    gl.enableVertexAttribArray(aRand);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(aRand, 1, gl.FLOAT, false, 12, 8);
    gl.drawArrays(gl.POINTS, 0, pointCount);
    gl.disableVertexAttribArray(aUv);
    gl.disableVertexAttribArray(aRand);
  }

  return { state, ready };
}
