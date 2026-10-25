// Living avatar: one photo + an AI depth map, rendered with a custom shader.
// Head and pupils turn toward the cursor, the cursor relights him in 3D, energy runs
// through the suit's seams, and on scroll he beams down into a corner comms portrait.

const IMG_W = 892;
const IMG_H = 1200;
// Landmarks measured on public/media/avatar.webp (pixels).
const HEAD = [452, 235];
const HEAD_R = [108, 152];
const EYE_L = [419, 237.5];
const EYE_R = [493, 237.5];
// Source windows: hero shows him past the belt (keeps the wrist hologram), comms shows a square head crop.
const CROP_HERO = [0, 0, 1, 0.92];
const CROP_HEAD = [302 / IMG_W, 92 / IMG_H, 602 / IMG_W, 392 / IMG_H];

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_depth;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec4 u_rect;
uniform vec4 u_crop;
uniform vec2 u_look;
uniform vec2 u_light;
uniform float u_time;
uniform float u_hud;
uniform float u_intro;

const vec2 IMG = vec2(${IMG_W}.0, ${IMG_H}.0);
const vec2 HEAD = vec2(${HEAD[0]}.0, ${HEAD[1]}.0) / IMG;
const vec2 HEAD_R = vec2(${HEAD_R[0]}.0, ${HEAD_R[1]}.0) / IMG;
const vec2 EYE_L = vec2(${EYE_L[0]}, ${EYE_L[1]}) / IMG;
const vec2 EYE_R = vec2(${EYE_R[0]}, ${EYE_R[1]}) / IMG;
const vec3 CYAN = vec3(0.31, 0.88, 0.95);

float hash(float n) { return fract(sin(n) * 43758.5453); }
float depthAt(vec2 uv) { return texture2D(u_depth, uv).r; }

// Slide the iris inside a small ellipse around each eye.
vec2 eyeWarp(vec2 uv, vec2 c, vec2 shift) {
  vec2 q = (uv - c) * IMG;
  q.y *= 1.8;
  float f = 1.0 - smoothstep(4.0, 13.0, length(q));
  return uv - shift * f;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 local = (p - u_rect.xy) / u_rect.zw;
  if (local.x < 0.0 || local.y < 0.0 || local.x > 1.0 || local.y > 1.0) discard;

  // Transmission glitch while beaming between hero and comms.
  float glitch = sin(clamp(u_hud, 0.0, 1.0) * 3.14159);
  float row = floor(local.y * 48.0);
  float tear = (hash(row + floor(u_time * 24.0)) - 0.5) * step(0.7, hash(row * 1.73 + floor(u_time * 17.0)));
  local.x += tear * 0.09 * glitch;

  vec2 uv = mix(u_crop.xy, u_crop.zw, local);

  // Head turn: a soft spherical bulge on the head plus depth parallax on the body.
  vec2 turn = u_look * vec2(1.0, 0.65);
  float d0 = depthAt(uv);
  float hw = 1.0 - smoothstep(0.3, 1.0, length((uv - HEAD) / HEAD_R));
  vec2 s = uv - turn * hw * vec2(13.0, 9.0) / IMG - turn * (d0 - 0.5) * vec2(6.0, 3.0) / IMG;
  s.y += sin(u_time * 1.6) * 0.0011 * smoothstep(0.3, 0.6, uv.y); // breathing
  vec2 eyeShift = turn * vec2(3.4, 2.2) / IMG;
  s = eyeWarp(s, EYE_L, eyeShift);
  s = eyeWarp(s, EYE_R, eyeShift);

  vec3 base = texture2D(u_tex, s).rgb;
  vec3 c = base;
  if (glitch > 0.01) {
    c.r = texture2D(u_tex, s + vec2(0.007 * glitch, 0.0)).r;
    c.b = texture2D(u_tex, s - vec2(0.007 * glitch, 0.0)).b;
  }

  float d = depthAt(s);
  float subj = smoothstep(0.34, 0.54, d);

  // Normals from the depth map, lit by the cursor.
  vec2 px = 1.5 / IMG;
  float dx = depthAt(s + vec2(px.x, 0.0)) - depthAt(s - vec2(px.x, 0.0));
  float dy = depthAt(s + vec2(0.0, px.y)) - depthAt(s - vec2(0.0, px.y));
  vec3 N = normalize(vec3(-dx * 16.0, -dy * 16.0, 1.0));
  vec2 toL = (u_light - s) * vec2(IMG.x / IMG.y, 1.0);
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
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
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
  return t;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {{figureEl: Element, portraitEl: Element, src: string, depthSrc: string, ticker: {add: Function}}} o
 * @returns {null | {state: {hud: number, intro: number}, ready: Promise<void>}}
 */
export function createAvatar({ figureEl, portraitEl, src, depthSrc, ticker }) {
  const canvas = document.createElement("canvas");
  canvas.className = "avatar-gl";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn("avatar shader failed, keeping the still image", err);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const U = {};
  ["u_tex", "u_depth", "u_res", "u_dpr", "u_rect", "u_crop", "u_look", "u_light", "u_time", "u_hud", "u_intro"].forEach(
    (n) => (U[n] = gl.getUniformLocation(prog, n))
  );

  const state = { hud: 0, intro: 0 };
  const pointer = { x: innerWidth * 0.75, y: innerHeight * 0.35, t: -1e9 };
  const look = { x: 0, y: 0 };
  const light = { x: 0.62, y: 0.2 };
  let dpr = 1;
  let lastTime = 0;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  addEventListener("resize", resize);
  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.t = performance.now();
    },
    { passive: true }
  );

  const ready = Promise.all([loadImage(src), loadImage(depthSrc)]).then(([im, dm]) => {
    texture(gl, im, 0);
    texture(gl, dm, 1);
    gl.uniform1i(U.u_tex, 0);
    gl.uniform1i(U.u_depth, 1);
    resize();
    document.body.appendChild(canvas);
    document.documentElement.classList.add("gl-on");
    ticker.add(render);
  });

  function render(time) {
    const h = clamp(state.hud, 0, 1);
    const a = figureEl.getBoundingClientRect();
    const b = portraitEl.getBoundingClientRect();
    const rect = [lerp(a.left, b.left, h), lerp(a.top, b.top, h), lerp(a.width, b.width, h), lerp(a.height, b.height, h)];
    const crop = CROP_HERO.map((v, i) => lerp(v, CROP_HEAD[i], h));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (rect[1] > innerHeight || rect[1] + rect[3] < 0) return; // off screen

    const toScreen = (u, v) => [
      rect[0] + ((u - crop[0]) / (crop[2] - crop[0])) * rect[2],
      rect[1] + ((v - crop[1]) / (crop[3] - crop[1])) * rect[3],
    ];
    const toImage = (x, y) => [
      crop[0] + ((x - rect[0]) / rect[2]) * (crop[2] - crop[0]),
      crop[1] + ((y - rect[1]) / rect[3]) * (crop[3] - crop[1]),
    ];

    const idle = performance.now() - pointer.t > 4000;
    let tx, ty, lx, ly;
    if (idle) {
      tx = Math.sin(time * 0.5) * 0.6;
      ty = Math.sin(time * 0.31) * 0.25;
      // Idle light swings around him like a slow rim light, never parked on the face.
      lx = HEAD[0] / IMG_W + Math.sin(time * 0.45) * 0.42;
      ly = HEAD[1] / IMG_H + 0.1 + Math.cos(time * 0.33) * 0.15;
    } else {
      // Look at the cursor from wherever the head currently is on screen.
      const [hx, hy] = toScreen(HEAD[0] / IMG_W, HEAD[1] / IMG_H);
      tx = clamp((pointer.x - hx) / (innerWidth * 0.42), -1, 1);
      ty = clamp((pointer.y - hy) / (innerHeight * 0.5), -1, 1);
      [lx, ly] = toImage(pointer.x, pointer.y);
    }
    // Frame-rate independent easing (same feel at 60Hz and 144Hz).
    const dt = Math.min(1, Math.max(0, time - lastTime));
    lastTime = time;
    const kLook = 1 - Math.pow(0.93, dt * 60);
    const kLight = 1 - Math.pow(0.91, dt * 60);
    look.x += (tx - look.x) * kLook;
    look.y += (ty - look.y) * kLook;
    light.x += (lx - light.x) * kLight;
    light.y += (ly - light.y) * kLight;

    gl.uniform2f(U.u_res, innerWidth, innerHeight);
    gl.uniform1f(U.u_dpr, dpr);
    gl.uniform4f(U.u_rect, ...rect);
    gl.uniform4f(U.u_crop, ...crop);
    gl.uniform2f(U.u_look, look.x, look.y);
    gl.uniform2f(U.u_light, light.x, light.y);
    gl.uniform1f(U.u_time, time);
    gl.uniform1f(U.u_hud, h);
    gl.uniform1f(U.u_intro, state.intro);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { state, ready };
}
