// Builds public/nature/scene.html (the Nature theme background) from the
// standalone meadow prototype, stripping its demo UI and applying an in-app
// performance profile. Every replacement asserts its match count.
//
//   node scripts/build-nature-scene.cjs <prototype index.html> [out]
const fs = require('fs');
const path = require('path');
const { createNaturePerformanceCheck } = require('./nature-performance.cjs');
const { optimizeNatureMesh } = require('./nature-mesh.cjs');
const { createNatureFrozenFrame } = require('./nature-frozen-frame.cjs');
const { applyNatureSeasons } = require('./nature-seasons.cjs');
const { applySummerMorningPalette, applySummerMorningScenery } = require('./nature-summer-morning.cjs');
const { applySeasonPolish } = require('./nature-season-polish.cjs');
const { applyWinterSnowfall } = require('./nature-winter-snowfall.cjs');
const { applyWinterMorningSky } = require('./nature-winter-morning.cjs');
const { applyWinterGolden } = require('./nature-winter-golden.cjs');
const { applySummerGolden } = require('./nature-summer-golden.cjs');
const { applySummerFlowers } = require('./nature-summer-flowers.cjs');
const { applyWinterSnowscape } = require('./nature-winter-snowscape.cjs');

const src = process.argv[2] || path.join(__dirname, 'nature', 'prototype.html');
const out = process.argv[3] || path.join(__dirname, '..', 'public', 'nature', 'scene.html');

const L = fs.readFileSync(src, 'utf8').split(/\r?\n/);
const lines = (a, b) => L.slice(a - 1, b).join('\n');
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
function swap(text, from, to, count = 1) {
  const n = text.split(from).length - 1;
  must(n === count, `expected ${count} match(es), found ${n}: ${from}`);
  return text.split(from).join(to);
}

must(L[193].startsWith('import * as THREE'), 'line 194 mismatch');
must(L[1680].startsWith('function onMove') && L[1690].trim() === '}', 'onMove range mismatch');
must(L[1758].includes('cinematic post-processing'), 'post range mismatch');
must(L[1949].startsWith('requestAnimationFrame(frame)'), 'loop end mismatch');

/* ---------------------------------------------------------------- scene core */
let core = lines(194, 1691);
core = swap(core, "import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';", "import { MarchingCubes } from './marching-cubes.js';");
const meshSource = fs.readFileSync(path.join(__dirname, '../public/nature/vendor/three/addons/objects/MarchingCubes.js'), 'utf8');
fs.writeFileSync(path.join(path.dirname(out), 'marching-cubes.js'), optimizeNatureMesh(meshSource));
core = swap(core, "import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';", "import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';\nimport { Pass } from 'three/addons/postprocessing/Pass.js';");
// Geometry is anti-aliased in the composer's MSAA target. The final canvas
// receives only a fullscreen quad, so a second multisampled buffer adds cost
// without smoothing any additional geometry edges.
core = swap(core, 'canvas, antialias: true,', 'canvas, antialias: false,');
// Use modest high-DPI headroom without exceeding the app's background budget.
// Keep the device gate ahead of the renderer's first pixel-ratio calculation.
core = swap(core, "const isMobile = matchMedia('(max-width: 760px)').matches || navigator.maxTouchPoints > 1;", '');
core = swap(core, 'renderer.setPixelRatio(Math.min(devicePixelRatio, 2));',
  "const isMobile = matchMedia('(max-width: 760px)').matches || navigator.maxTouchPoints > 1;\nlet renderScale = 1;\nconst basePR = () => Math.min(Math.max(devicePixelRatio, 1), isMobile ? 1 : 1.25);\nrenderer.setPixelRatio(basePR());");
// Density tuned for running behind a full app.
core = swap(core, 'const GRASS = isMobile ? 50000 : 140000;', 'const GRASS = isMobile ? 45000 : 100000;');
core = swap(core, 'const LEAVES = isMobile ? 9000 : 20000;', 'const LEAVES = isMobile ? 8000 : 14000;');
// Retain the prototype cat's original organic shape, IK gait, coats, sit and
// tail behaviours. Skip empty-volume triangulation, without reducing detail.
core = swap(core, '  mc.isolation = 80;', '  mc.isolation = 80;\n  mc.natureBoundedBalls = true;');
core = swap(core, '  const head = new THREE.Group(); g.add(head);', '  const head = new THREE.Group(); g.add(head);\n  const eyelids = [];');
core = swap(core, '    head.add(pupil);', '    head.add(pupil);\n    eyelids.push({ eye, pupil });');
core = swap(core, "    if (S.state === 'away') { S.timer -= dt;", "    if (dt <= 0) return; // lighting updates must not move or remesh a frozen cat\n    if (S.state === 'away') { S.timer -= dt;");
core = swap(core, '    head.position.copy(P.head);', `    head.position.copy(P.head);
    // Smooth, occasional blinking preserves the original eyes and eyeshine.
    const blinkPhase = ((t % 6.7) + 6.7) % 6.7;
    const openness = blinkPhase < 0.22 ? 1 - 0.94 * Math.sin(Math.PI * blinkPhase / 0.22) : 1;
    for (const { eye, pupil } of eyelids) { eye.scale.y = 0.021 * openness; pupil.scale.y = 0.018 * openness; }`);
core = swap(core, '  const _a = new THREE.Vector3(), _o = new THREE.Vector3();', '  const _a = new THREE.Vector3(), _o = new THREE.Vector3(), _neck = new THREE.Vector3();');
core = swap(core, 'chain(_a.copy(P.chest).add(_o.set(0.04, 0.06, 0)).clone(), P.neck, 0.09, 0.075);', 'chain(_neck.copy(P.chest).add(_o.set(0.04, 0.06, 0)), P.neck, 0.09, 0.075);');
// A cat outside the camera has no visible body to rebuild. Behaviour continues
// so it still enters, sits, walks out and returns on the prototype schedule.
core = swap(core, '    if (!isMobile || (S.frame++ & 1) === 0) skin();', '    if (Math.abs(S.x) <= halfWidthAt(S.z) + 1.5 && (!isMobile || (S.frame++ & 1) === 0)) skin();');
// Do not expose prototype console globals or demo shortcuts inside app pages.
core = swap(core, "  addEventListener('keydown', e => { if ((e.key === 'c' || e.key === 'C') && S.state === 'away') S.timer = 0; });", '');
core = swap(core, '  window.__meadow = { S, g, camera, spawn, grass, flowers };   // handy for debugging in the console', '');
// Reuse the ray-march scratch vector; its coordinates are copied into trails.
core = swap(core, 'function hitGround(cx, cy) {', 'const pointerGroundHit = new THREE.Vector3();\nfunction hitGround(cx, cy) {');
core = swap(core, 'const o = ray.ray.origin, d = ray.ray.direction, p = new THREE.Vector3();', 'const o = ray.ray.origin, d = ray.ray.direction, p = pointerGroundHit;');
core = swap(core, 'function onMove(e) {', 'function onMove(e, affectGrass = true) {');
// Most frames have no grass disturbance. Bypass the 24-entry trail loop in
// every grass/flower vertex then, without changing any active trail math.
core = swap(core, '  uTime: { value: 0 },', '  uTime: { value: 0 },\n  uHasTrail: { value: 0 },');
core = swap(core, 'uniform float uTime; uniform vec4 uTrail[${TRAIL}]; uniform vec2 uWind;', 'uniform float uTime; uniform float uHasTrail; uniform vec4 uTrail[${TRAIL}]; uniform vec2 uWind;');
core = swap(core, '    for (int i = 0; i < ${TRAIL}; i++) {', '    if (uHasTrail > 0.5) {\n    for (int i = 0; i < ${TRAIL}; i++) {');
core = swap(core, '    // freshly disturbed blades rustle and quiver before settling', '    }\n    // freshly disturbed blades rustle and quiver before settling');
// Palette interpolation changes only during time-of-day transitions. Each
// target keeps its own last key/phase, so shared scratch colors stay correct.
core = swap(core, 'function samp(key, ph, out = new THREE.Color()) {', `const sampledColors = new WeakMap();
function samp(key, ph, out = new THREE.Color()) {
  const previous = sampledColors.get(out);
  if (previous && previous.key === key && previous.phase === ph) return out;
  if (previous) { previous.key = key; previous.phase = ph; }
  else sampledColors.set(out, { key, phase: ph });`);
core = swap(core, '  const p = hitGround(e.clientX, e.clientY);', '  if (!affectGrass) return;\n  const p = hitGround(e.clientX, e.clientY);');
// Drifting particles can pass arbitrarily close to the camera. Unbounded
// perspective point sizes turn a tiny seed/pollen mote into a white flash.
// Keep visible detail, fade the near plane, and bound fill rate in CSS pixels.
core = swap(core, 'gl_PointSize = uPx * (190.0 + aSeed * 80.0) / -mv.z;', `float depth = max(-mv.z, 0.1);
      vA *= smoothstep(2.0, 5.0, depth);
      gl_PointSize = uPx * min(24.0, (190.0 + aSeed * 80.0) / depth);`);
core = swap(core, 'gl_PointSize = uPx * (14.0 + aSeed * 12.0) / -mv.z;', `float depth = max(-mv.z, 0.1);
      vA *= smoothstep(1.0, 3.0, depth);
      gl_PointSize = uPx * min(3.0, (14.0 + aSeed * 12.0) / depth);`);
// A seed's bloom is decorative; do not turn it into an HDR hotspot.
core = swap(core, 'vec3 col = tx.rgb * (0.75 * uLight + 0.35 * uSunGlow);', 'vec3 col = tx.rgb * min(vec3(0.9), 0.75 * uLight + 0.35 * uSunGlow);');
// Morning's HDR dew glints blink several times per second and bloom into
// large white patches behind frosted cards. Remove that flashing overlay,
// retaining continuous sunlight, tip translucency, shadows and wind.
core = swap(core, `      // morning dew: tiny glints on blade tips that twinkle as the wind moves them (bright enough to bloom)
      float dewSeed = fract(vRand * 731.7);
      float glint = step(0.972, dewSeed) * smoothstep(0.7, 0.95, vH)
                  * pow(0.5 + 0.5 * sin(uTime * (2.0 + dewSeed * 6.0) + vRand * 400.0 + vSheen * 3.0), 12.0);
      col += vec3(1.0, 0.97, 0.9) * glint * 2.4 * uMorning * (1.0 - smoothstep(6.0, 34.0, vDist)) * shade;
`, '');
// Bird hues depend on the phase, not on wing animation. Avoid repeatedly
// parsing and converting the same color for every bird on every frame.
core = swap(core, `    b.mesh.material.uniforms.uColor.value.set(
      b.kind === 'bat' ? '#0b0e1c' : b.kind === 'crow' ? '#121216' : golden > 0.5 ? '#35262a'
      : b.kind === 'hawk' ? '#3a2f28' : b.kind === 'sparrow' ? '#4a3a2c' : '#26303e');`, `    const color = b.kind === 'bat' ? '#0b0e1c' : b.kind === 'crow' ? '#121216' : golden > 0.5 ? '#35262a'
      : b.kind === 'hawk' ? '#3a2f28' : b.kind === 'sparrow' ? '#4a3a2c' : '#26303e';
    if (b.color !== color) { b.color = color; b.mesh.material.uniforms.uColor.value.set(color); }`);

/* ---------------------------------------------------------------- host bridge */
const bridge = `
/* ------------------------------------------------------------------ phase (driven by the host app) */
const qp = Number(new URLSearchParams(location.search).get('p'));
let phase = qp === 0 || qp === 1 || qp === 2 ? qp : (() => { const hr = new Date().getHours(); return hr >= 20 || hr < 6 ? 2 : hr >= 17 ? 1 : 0; })();
let tw = null;
let paused = false;
let motionPaused = new URLSearchParams(location.search).get('still') === '1';
let sceneDirty = true;
let sceneTime = 0;
let pendingPointer = null;
const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function setPhase(i, instant = false, duration) {
  if (!(i === 0 || i === 1 || i === 2)) return;
  if (instant) { phase = i; tw = null; sceneDirty = true; return; }
  if (!tw && phase === i) return;
  if (tw && tw.to === i) return;
  tw = { from: phase, to: i, t0: performance.now(), dur: Number.isFinite(duration) && duration >= 1800 && duration <= 4800 ? duration : 1800 + 1500 * Math.abs(i - phase) };
  sceneDirty = true;
}
addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== parent) return;
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'nature:phase') setPhase(d.index, !!d.instant, d.duration);
  else if (d.type === 'nature:season') { if (seasonState.change(d.season, performance.now(), !!d.instant)) sceneDirty = true; }
  else if (d.type === 'nature:pointer' && !motionPaused && Number.isFinite(d.x) && Number.isFinite(d.y)) pendingPointer = { clientX: d.x, clientY: d.y, grass: d.grass !== false };
  else if (d.type === 'nature:pause') paused = !!d.paused;
  else if (d.type === 'nature:motion' && typeof d.paused === 'boolean') {
    if (d.autoDetect === false) performanceCheck.disable();
    if (motionPaused === d.paused) return;
    motionPaused = d.paused;
    pendingPointer = null;
    sceneDirty = true;
  }
  requestFrame();
});
`;

/* ---------------------------------------------------------------- post + loop */
let post = lines(1759, 1950);
// Light shafts are a soft overlay: sample that overlay at half resolution,
// then add it to the untouched native-resolution scene. Grass, silhouettes,
// flowers, sky and the cat never pass through this smaller render target.
post = swap(post, 'const shafts = new ShaderPass({', `class LightShaftPass extends Pass {
  constructor(effect) {
    super();
    this.effect = effect;
    this.uniforms = effect.uniforms;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false });
    this.blend = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, tShafts: { value: null }, uActive: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse, tShafts; uniform float uActive; varying vec2 vUv; void main(){ vec3 col = texture2D(tDiffuse, vUv).rgb; if(uActive > 0.5) col += texture2D(tShafts, vUv).rgb; gl_FragColor = vec4(col, 1.0); }',
    });
    // ShaderPass clones its initial uniforms; render-target textures must be
    // attached after construction so Three does not replace them with null.
    this.blend.uniforms.tShafts.value = this.target.texture;
  }
  setSize(width, height) { this.target.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2))); }
  render(renderer, writeBuffer, readBuffer, dt, maskActive) {
    const active = this.uniforms.uStrength.value > 0.001;
    this.needsSwap = active;
    if (!active && !this.renderToScreen) return;
    this.blend.uniforms.uActive.value = active ? 1 : 0;
    if (active) this.effect.render(renderer, this.target, readBuffer, dt, maskActive);
    this.blend.renderToScreen = this.renderToScreen;
    this.blend.render(renderer, writeBuffer, readBuffer, dt, maskActive);
  }
  dispose() { this.target.dispose(); this.effect.dispose(); this.blend.dispose(); }
}
const shaftSamples = new ShaderPass({`);
post = swap(post, '      vec3 base = texture2D(tDiffuse, vUv).rgb;\n', '');
post = swap(post, 'gl_FragColor = vec4(base, 1.0); return;', 'gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return;');
post = swap(post, 'vec4(base + acc * uTint * uStrength, 1.0)', 'vec4(acc * uTint * uStrength, 1.0)');
post = swap(post, 'composer.addPass(shafts);', 'const shafts = new LightShaftPass(shaftSamples);\ncomposer.addPass(shafts);');
// Preserve all color samples while avoiding eight short-lived maps per draw.
post = swap(post, 'const look = new THREE.Vector3();', `const look = new THREE.Vector3();
const paletteBindings = Object.entries({ top: 'uTop', horizon: 'uHorizon', base: 'uBase', tip: 'uTip', light: 'uLight', ambient: 'uAmbient', sun: 'uSunColor', sunGlow: 'uSunGlow' });`);
// Accumulate simulation time only while motion runs. Lighting transitions can
// render frozen poses, and resuming after a long pause never jumps ahead.
post = swap(post, '  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;', `  const delta = Math.min(clock.getDelta(), 0.05);
  const dt = motionPaused ? 0 : delta;
  const t = sceneTime += dt;`);
post = swap(post, '  parallax.lerp(parallaxT, 0.03);', '  if (!motionPaused) parallax.lerp(parallaxT, 0.03);');
post = swap(post, '  for (const v of trail) v.z = Math.max(0, v.z - dt * 0.28);', `  let hasTrail = false;
  for (const v of trail) {
    v.z = Math.max(0, v.z - dt * 0.28);
    if (v.z > 0.001) hasTrail = true;
  }
  U.uHasTrail.value = hasTrail ? 1 : 0;`);
post = swap(post, `  ['top', 'horizon', 'base', 'tip', 'light', 'ambient', 'sun', 'sunGlow'].forEach(k => {
    const map = { top: 'uTop', horizon: 'uHorizon', base: 'uBase', tip: 'uTip', light: 'uLight', ambient: 'uAmbient', sun: 'uSunColor', sunGlow: 'uSunGlow' };
    samp(k, ph, U[map[k]].value);
  });`, `  for (const [key, uniform] of paletteBindings) samp(key, ph, U[uniform].value);`);
// Grading changes only with the phase. Projection/time still update each draw;
// transitions evaluate the same interpolation at every intermediate phase.
post = swap(post, `const _sp = new THREE.Vector3(), _lk = {}, _tint = new THREE.Color(), _tintB = new THREE.Color();
function updatePost(ph, t) {`, `for (const look of LOOK) look.tintColor = new THREE.Color(look.tint);
const _sp = new THREE.Vector3(), _lk = {}, _tint = new THREE.Color();
function updatePost(ph, t) {`);
post = swap(post, `  const i = Math.min(Math.floor(ph), 1), f = ph - i, A = LOOK[i], B = LOOK[i + 1];
  const L = (k) => A[k] + (B[k] - A[k]) * f;`, `  if (_lk.phase !== ph) {
    _lk.phase = ph;
    const i = Math.min(Math.floor(ph), 1), f = ph - i, A = LOOK[i], B = LOOK[i + 1];
    const L = (k) => A[k] + (B[k] - A[k]) * f;
    _lk.shaft = L('sh'); _lk.glare = L('gl');
    shafts.uniforms.uThresh.value = L('th');
    shafts.uniforms.uTint.value.copy(_tint.copy(A.tintColor).lerp(B.tintColor, f));
    bloom.strength = L('bs'); bloom.threshold = L('bt');
    grade.uniforms.uSat.value = L('sat');
    grade.uniforms.uGain.value.set(A.gain[0] + (B.gain[0] - A.gain[0]) * f, A.gain[1] + (B.gain[1] - A.gain[1]) * f, A.gain[2] + (B.gain[2] - A.gain[2]) * f);
    grade.uniforms.uLift.value.set(A.lift[0] + (B.lift[0] - A.lift[0]) * f, A.lift[1] + (B.lift[1] - A.lift[1]) * f, A.lift[2] + (B.lift[2] - A.lift[2]) * f);
  }`);
post = swap(post, `  shafts.uniforms.uStrength.value = L('sh') * facing;
  shafts.uniforms.uThresh.value = L('th');
  shafts.uniforms.uTint.value.copy(_tint.set(A.tint).lerp(_tintB.set(B.tint), f));
  bloom.strength = L('bs'); bloom.threshold = L('bt');
  grade.uniforms.uSat.value = L('sat');
  grade.uniforms.uGain.value.set(...A.gain.map((v, k) => v + (B.gain[k] - v) * f));
  grade.uniforms.uLift.value.set(...A.lift.map((v, k) => v + (B.lift[k] - v) * f));`, `  shafts.uniforms.uStrength.value = _lk.shaft * facing;`);
post = swap(post, "  grade.uniforms.uGlare.value = L('gl') * facing;", "  grade.uniforms.uGlare.value = _lk.glare * facing;");
// Retain the reference's desktop MSAA; reduced resolution and color-channel
// separation together made small moving silhouettes look broken at the edges.
post = swap(post, 'vec2 ca = c * 0.006 * length(c);', 'vec2 ca = c * 0.002 * length(c);');
post = swap(post, 'const int N = 56;', 'const int N = 32;');
post = swap(post, '      decay *= 0.962;', '      decay *= 0.935;');
// Resizing clears the WebGL drawing buffer: defer it until just before the
// next render, never immediately after a completed frame.
post = swap(post, "addEventListener('resize', resize); resize();", "let resizePending = false;\naddEventListener('resize', () => { resizePending = true; requestFrame(); }); resize();");
post = swap(post, '  placePill(Math.round(tw ? tw.to : phase));\n', '');
// Skip invisible particle draws, keeping their shader-driven positions live.
post = swap(post, '  pollenU.uDay.value = 1 - night;', `  // No white airborne motes in Morning: even small ones visibly blink.
  // Fade them with the existing phase tween, preserving Golden/Night looks.
  const airborne = (1 - night) * (1 - U.uMorning.value);
  pollenU.uDay.value = airborne;
  pollen.visible = pollenU.uDay.value > 0.001;
  fireflies.visible = night > 0.001;`);
post = swap(post, '  seedsU.uSeedAmt.value = (1 - night) * (0.35 + 0.65 * U.uMorning.value);   // most plentiful in the morning', `  seedsU.uSeedAmt.value = airborne * 0.35;
  seeds.visible = seedsU.uSeedAmt.value > 0.001;`);
post = swap(post, '  renderer.setSize(w, h, false);', `  renderer.setSize(w, h, false);
  const pixelRatio = renderer.getPixelRatio();
  for (const points of [seeds, pollen, fireflies]) points.material.uniforms.uPx.value = pixelRatio;`);
post = swap(post, '  composer.render(dt);\n  requestAnimationFrame(frame);\n}\nrequestAnimationFrame(frame);', `  composer.render(dt);
}

/* ------------------------------------------------------------------ 30fps cap + adaptive resolution
   The scene shares the main thread with the app, so it renders at most 30fps
   and trims high-DPI headroom when frames run long. Desktop never falls below
   one rendered pixel per CSS pixel; mobile has a bounded 85% fallback. */
const frozenFrame = (${createNatureFrozenFrame.toString()})(canvas, renderer, () => { sceneDirty = true; requestFrame(); });
const FRAME_MS = 1000 / 30;
const performanceCheck = (${createNaturePerformanceCheck.toString()})();
const MIN_SCALE = (isMobile ? 0.85 : 1) / basePR();
let lastT = 0, acc = 0, n = 0, calm = 0, pendingScale = null;
function applyScale(s) {
  renderScale = s;
  renderer.setPixelRatio(basePR() * s);
  composer.setPixelRatio(basePR() * s);
  resize();
}
const stats = window.__natureStats = { scale: 1, frames: 0, lastCost: 0, paused: false };
stats.frozenFrame = () => frozenFrame.inspect();
function adapt(cost) {
  stats.frames++; stats.lastCost = cost; stats.scale = renderScale; stats.paused = paused;
  acc += cost; n++;
  if (n < 45) return;
  const avg = acc / n; acc = 0; n = 0;
  // Leave room for the app in a 33ms frame, rather than treating ordinary
  // 14ms work as overload. Recover only after consecutive quiet windows.
  if (avg > 22) {
    if (renderScale > MIN_SCALE) pendingScale = Math.max(MIN_SCALE, renderScale - 0.1);
    calm = 0;
  } else if (avg < 12 && renderScale < 1) {
    if (++calm >= 3) { pendingScale = Math.min(1, renderScale + 0.1); calm = 0; }
  } else calm = 0;
}
let framePending = false;
function requestFrame() {
  if (framePending || paused || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
  framePending = true;
  requestAnimationFrame(loop);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', requestFrame);
function loop(now) {
  framePending = false;
  const eligible = !paused && !motionPaused && !tw && (typeof document === 'undefined' || document.visibilityState === 'visible');
  if (!eligible) performanceCheck.sample(now, 0, 0, false);
  if (paused || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
  // A frozen scene costs no ongoing GPU draws. Only explicit lighting changes
  // or a resize need another image; ambient simulation remains frozen.
  if (motionPaused && !tw && !resizePending && !sceneDirty) return;
  // Restoring a parked renderer is event-driven. Keep its exact last bitmap
  // visible until a complete new frame exists; never poll or clear the image.
  if (!frozenFrame.ready()) return;
  requestFrame();
  if (now - lastT < FRAME_MS - 2) return;
  // GPU-bound frames show up as late callbacks, CPU-bound ones as long frames.
  // Gaps over 250ms are throttling (occluded window, resume) and not a signal.
  const gap = now - lastT;
  const late = lastT && gap < 250 ? gap - FRAME_MS : 0;
  lastT = now;
  const t0 = performance.now();
  if (pendingScale !== null) { applyScale(pendingScale); pendingScale = null; resizePending = false; }
  else if (resizePending) { resize(); resizePending = false; }
  // Ray-march the latest pointer once per rendered frame, not once per message.
  if (pendingPointer) { const pointer = pendingPointer; pendingPointer = null; onMove(pointer, pointer.grass); }
  frame(now);
  sceneDirty = false;
  frozenFrame.present(motionPaused && !tw);
  stats.cpu = performance.now() - t0;
  adapt(Math.max(stats.cpu, late));
  if (performanceCheck.sample(now, gap, stats.cpu, eligible)) {
    parent.postMessage({ type: 'nature:slow' }, location.origin);
  }
}
requestFrame();
parent.postMessage({ type: 'nature:ready' }, location.origin);`);

core = applySummerMorningPalette(core, swap);
({ core, post } = applyNatureSeasons(core, post, swap));
({ core, post } = applySeasonPolish(core, post, swap));
({ core, post } = applySummerMorningScenery(core, post, swap));
({ core, post } = applyWinterSnowfall(core, post, swap));
({ core, post } = applyWinterMorningSky(core, post, swap));
({ core, post } = applyWinterGolden(core, post, swap));
({ core, post } = applySummerGolden(core, post, swap));
core = applySummerFlowers(core, swap);
({ core, post } = applyWinterSnowscape(core, post, swap));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Nature scene</title>
<!-- generated by scripts/build-nature-scene.cjs, do not edit by hand -->
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; background: transparent; }
  canvas#scene, canvas#nature-frozen-frame { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<canvas id="scene"></canvas>
<script type="importmap">
{ "imports": { "three": "./vendor/three/build/three.module.js", "three/addons/": "./vendor/three/addons/" } }
</script>
<script type="module">
${core}
${bridge}
${post}
</script>
</body>
</html>
`;
fs.writeFileSync(out, html);
console.log('wrote', out, html.length, 'bytes');
