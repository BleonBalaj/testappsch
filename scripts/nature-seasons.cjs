// Nature-only seasonal scene construction. Inlined by build-nature-scene.cjs.
// One scene, shared geometry/uniforms; no new renderer or seasonal frame loop.
const { AUTUMN_MEADOW_COLORS, AUTUMN_NIGHT_MEADOW_COLORS, AUTUMN_CANOPY_COLORS, AUTUMN_NIGHT_CANOPY_COLORS, autumnMeadow, autumnCanopy, createAutumnLeafLayout, createAutumnGroveLayout, createAutumnInsectLayout, createAutumnFlowerLayout, createAutumnFlowerShapes } = require('./nature-autumn.cjs');
function createNatureSeasonTransition(initial = 'summer') {
  const names = ['summer', 'autumn', 'winter'];
  const weights = [1, 0, 0], from = [1, 0, 0];
  let target = 0, started = 0, running = false, revision = 0;
  function sample(now) {
    if (!running) return weights;
    const k = Math.min(1, Math.max(0, (now - started) / 2600));
    const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    let changed = false;
    for (let i = 0; i < 3; i++) {
      const value = from[i] + ((i === target ? 1 : 0) - from[i]) * eased;
      if (weights[i] !== value) { changed = true; weights[i] = value; }
    }
    if (changed) revision++;
    if (k >= 1) running = false;
    return weights;
  }
  function change(name, now, instant = false) {
    const index = names.indexOf(name);
    if (index < 0) return false;
    // An unchanged target must not advance/finish a covered transition without
    // a draw. Its next real frame samples the blend and paints the final season.
    if (!instant && target === index) return false;
    sample(now);
    if (instant) {
      target = index; running = false;
      for (let i = 0; i < 3; i++) weights[i] = from[i] = i === index ? 1 : 0;
      revision++;
      return true;
    }
    for (let i = 0; i < 3; i++) from[i] = weights[i];
    target = index; started = now; running = true;
    return true;
  }
  change(names.includes(initial) ? initial : 'summer', 0, true);
  return { sample, change, get weights() { return weights; }, get active() { return running; }, get revision() { return revision; }, get target() { return names[target]; } };
}

// Each column is Morning / Golden / Night; Color converts sRGB swatches into
// the scene's linear working space, just like the original Summer palette.
const PALETTES = {
  autumn: {
    top: ['#648ea9', '#9c839c', '#0d0c1c'], mid: ['#c1d5d5', '#dfb29e', '#24213e'],
    horizon: ['#edddc5', '#ffdab0', '#4b3549'], cloudLit: ['#fff5df', '#ffd6b2', '#847b9b'],
    cloudShade: ['#a6b1bd', '#b7848d', '#201a31'], mountFar: ['#b8bdc1', '#dcb6a3', '#34283d'],
    mountNear: ['#a7aca9', '#b68e7c', '#221d2c'], fog: ['#d3c8b0', '#edb88e', '#352b3b'],
    base: ['#654122', '#794b20', '#252c32'], tip: ['#cbb064', '#e3bd73', '#627a74'],
    light: ['#fff0d8', '#ffdaa9', '#c7c6de'], ambient: ['#a3a8b0', '#a6a0ad', '#37374b'],
    sun: ['#fff3d9', '#ffce80', '#ffad6d'], sunCore: ['#fffaf0', '#fff0ce', '#ffe0b0'],
    sunGlow: ['#ffe1ba', '#ffb373', '#dc9760'], mist: ['#e1d6bf', '#f1c29e', '#665268'],
    hemiSky: ['#e3e7dd', '#ffe3c5', '#b3b0ca'], hemiGnd: ['#715637', '#705442', '#57423e'],
    cloud: ['#fff5df', '#ffddc3', '#716682'], leaf: ['#ffffff', '#ffe8d1', '#fff1d8'],
  },
  winter: {
    top: ['#6995b8', '#9d94b7', '#0b1530'], mid: ['#bed8e9', '#e8b6ba', '#243d65'],
    horizon: ['#e8eff3', '#fbe2d0', '#647795'], cloudLit: ['#f4f8fd', '#ffe8dc', '#8b9fb9'],
    cloudShade: ['#a6bbd1', '#b9a9bf', '#35456a'], mountFar: ['#c4d9e5', '#e3cdd8', '#536d8c'],
    mountNear: ['#acc6d8', '#c4adbd', '#3c5577'], fog: ['#d3e2ed', '#f0d9d8', '#476387'],
    base: ['#b9cad8', '#cdbbbf', '#597493'], tip: ['#eef5fa', '#fcebe0', '#afc8e1'],
    light: ['#f5f5f2', '#ffd2b0', '#b3cced'], ambient: ['#afc6d9', '#c1a9b8', '#526e91'],
    sun: ['#fff8ef', '#ffcd92', '#ffb279'], sunCore: ['#fffdf6', '#fff1db', '#ffdec1'],
    sunGlow: ['#fae4cb', '#ffc398', '#ccabc0'], mist: ['#e5eff4', '#f4dfdf', '#728bb0'],
    hemiSky: ['#ecf4fc', '#ffe2d2', '#bacfe7'], hemiGnd: ['#becedd', '#d4bcc5', '#5a7497'],
    cloud: ['#f6faff', '#ffe4db', '#7a8da7'], leaf: ['#eaf3fa', '#f3d9ce', '#afc9e3'],
  },
};

function applyNatureSeasons(core, post, swap) {
  core = swap(core, 'const PAL = {', `const seasonState = (${createNatureSeasonTransition.toString()})(new URLSearchParams(location.search).get('s'));
const SEASON_PAL = Object.fromEntries(Object.entries(${JSON.stringify(PALETTES)}).map(([season, palette]) => [season, Object.fromEntries(Object.entries(palette).map(([key, colors]) => [key, hex(colors)]))]));
const seasonScratch = new THREE.Color();
const PAL = {`);
  core = swap(core, 'previous.phase === ph) return out;', 'previous.phase === ph && previous.season === seasonState.revision) return out;');
  core = swap(core, 'previous.phase = ph; }', 'previous.phase = ph; previous.season = seasonState.revision; }');
  core = swap(core, 'else sampledColors.set(out, { key, phase: ph });', 'else sampledColors.set(out, { key, phase: ph, season: seasonState.revision });');
  core = swap(core, '  return out.copy(a[i]).lerp(a[i + 1], f);', `  out.copy(a[i]).lerp(a[i + 1], f);
  const weights = seasonState.weights;
  if (weights[1] === 0 && weights[2] === 0) return out;
  out.multiplyScalar(weights[0]);
  for (const [index, name] of [[1, 'autumn'], [2, 'winter']]) {
    if (weights[index] === 0) continue;
    const colors = SEASON_PAL[name][key];
    seasonScratch.copy(colors[i]).lerp(colors[i + 1], f).multiplyScalar(weights[index]);
    out.add(seasonScratch);
  }
  return out;`);
  core = swap(core, '  uNight: { value: 0 }, uGolden: { value: 0 },', `  uNight: { value: 0 }, uGolden: { value: 0 },
  uAutumn: { value: 0 }, uWinter: { value: 0 }, uSnowColor: { value: new THREE.Color() },`);

  // Add uniforms only to existing local shaders; never touch vendored chunks.
  core = swap(core, 'const COMMON = /* glsl */`', 'const COMMON = /* glsl */`\n  uniform float uAutumn, uWinter;');
  core = swap(core, 'uniform float uNight, uGolden, uTime, uCloudCover, uMorning;', 'uniform float uNight, uGolden, uTime, uCloudCover, uMorning, uWinter;');
  core = swap(core, '        gl_FragColor = vec4(col, 1.0);', `        // Snow-capped ridges and a quiet aurora only in the winter night sky.
        if (uWinter > 0.001) {
          float caps = smoothstep(r1 * 0.68, r1 * 0.91, y) * m1;
          col = mix(col, uCloudLit * 0.83, caps * uWinter * 0.35);
          float ribbon = 0.20 + 0.06 * sin(az * 2.8 + uTime * 0.018) + 0.035 * sin(az * 6.0 - uTime * 0.012);
          float veil = exp(-pow((y - ribbon) / 0.055, 2.0)) * smoothstep(0.03, 0.14, y);
          float curtains = 0.55 + 0.45 * sin(az * 48.0 + sin(az * 7.0) * 4.0 + uTime * 0.025);
          col += mix(vec3(0.055, 0.12, 0.12), vec3(0.085, 0.065, 0.14), smoothstep(0.18, 0.33, y)) * veil * curtains * uWinter * uNight * (1.0 - dens * 0.75);
        }
        gl_FragColor = vec4(col, 1.0);`);

  // Terrain keeps the same silhouette; soft shadow bands make snow sculptural.
  core = swap(core, '      vec3 col = mix(uBase, uTip, 0.18 + 0.12 * n) * 0.75 * (uAmbient + uLight * 0.7 * shade);', `      vec3 col = mix(uBase, uTip, 0.18 + 0.12 * n) * 0.75 * (uAmbient + uLight * 0.7 * shade);
      float snowRipple = 0.5 + 0.5 * sin(vW.x * 0.43 + sin(vW.z * 0.31) * 2.0);
      vec3 snow = uSnowColor * (0.79 + 0.15 * shade + 0.035 * snowRipple);
      snow = mix(snow * vec3(0.78, 0.86, 1.0), snow, shade);
      col = mix(col, snow, uWinter);`);
  const terrainStart = core.indexOf('const terrain =');
  const terrainEnd = core.indexOf('scene.add(terrain);', terrainStart);
  let terrain = core.slice(terrainStart, terrainEnd);
  terrain = swap(terrain, '    varying float vDist; varying vec3 vW;\n    ${SHADOW}', '    uniform float uWinter; uniform vec3 uSnowColor;\n    varying float vDist; varying vec3 vW;\n    ${SHADOW}');
  core = core.slice(0, terrainStart) + terrain + core.slice(terrainEnd);

  // Dormant stalks emerge sparsely from the snow instead of a green recolor.
  core = swap(core, '    attribute vec3 aOffset; attribute float aYaw, aScale, aRand;', '    attribute vec3 aOffset, aAutumnNight; attribute float aYaw, aScale, aRand; attribute vec4 aAutumn; uniform float uNight; varying vec3 vAutumnColor;');
  core = swap(core, '      p.y *= aScale;', `      float winterStalk = step(0.986, aRand);
      p.y *= aScale * mix(1.0, 0.38 * winterStalk, uWinter);
      if (uAutumn > 0.0) {
        p.y *= mix(1.0, aAutumn.w, uAutumn);
        p.x *= mix(1.0, 0.45 + 0.55 * smoothstep(0.06, 0.70, aAutumn.w), uAutumn);
      }
      vAutumnColor = mix(aAutumn.rgb, aAutumnNight, uNight);
      p.x *= mix(1.0, 0.15 * winterStalk, uWinter);`);
  core = swap(core, '      p += sway(aOffset, h, aScale, aRand, sheen, press);', '      p += sway(aOffset, h, aScale, aRand, sheen, press) * (1.0 - uWinter * 0.92) * mix(1.0, aAutumn.w, uAutumn);');
  core = swap(core, '    uniform vec2 uTreeXZ; uniform float uMorning;', '    uniform vec2 uTreeXZ; uniform float uMorning, uAutumn, uWinter; uniform vec3 uSnowColor; varying vec3 vAutumnColor;');
  core = swap(core, '      vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));', `      vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));
      if (uAutumn > 0.0) {
        // Colour was blended at the blade vertices; reuse the same varying
        // and lighting so the night palette needs no extra fragment work.
        vec3 autumnTip = vAutumnColor;
        tip = mix(tip, autumnTip, uAutumn);
        vec3 autumnBlade = mix(autumnTip * vec3(0.25, 0.21, 0.20), autumnTip, smoothstep(0.0, 1.0, vH));
        col = mix(col, autumnBlade, uAutumn);
      }`);
  core = swap(core, '      col += vPress * mix(vec3(0.04, 0.05, 0.02), vec3(0.06, 0.2, 0.17), uNight) * vH;', `      col += vPress * mix(vec3(0.04, 0.05, 0.02), vec3(0.06, 0.2, 0.17), uNight) * vH;
      vec3 reed = mix(uSnowColor * 0.82, vec3(0.28, 0.22, 0.17) * (uAmbient + uLight * 0.6), smoothstep(0.12, 0.85, vH));
      col = mix(col, reed, uWinter);`);

  // Summer flowers remain exact. Autumn keeps muted late flowers; winter has
  // small snow-dusted seed heads rather than glowing summertime petals.
  core = swap(core, '      mv.xy += position.xy * aSize * (1.0 - press * 0.4);', '      mv.xy += position.xy * aSize * (1.0 - press * 0.4) * mix(1.0, 0.40, uWinter);');
  const flowerStart = core.indexOf('const flowers =');
  const flowerEnd = core.indexOf('flowers.frustumCulled', flowerStart);
  let flower = core.slice(flowerStart, flowerEnd);
  flower = swap(flower, '    ${AIR}', '    uniform float uAutumn, uWinter; uniform vec3 uSnowColor;\n    ${AIR}');
  flower = swap(flower, '      vec3 col = mix(vColor, vColor * 0.72, smoothstep(0.3, 1.0, r / petal));', `      vec3 col = mix(vColor, vColor * 0.72, smoothstep(0.3, 1.0, r / petal));
      if (uAutumn > 0.0 && vRand > 0.48 && r > mix(petal, petal * 0.40, uAutumn)) discard;`);
  flower = swap(flower, '      if (r > petal) discard;', `      if (vRand < uWinter * 0.80) discard;
      petal = mix(petal, 0.70 + 0.14 * cos(a * 9.0), uWinter);
      if (r > petal) discard;`);
  flower = swap(flower, '      col *= (uAmbient + uLight * 0.85);', `      vec3 lateFlower = mix(vec3(0.42, 0.13, 0.045), vec3(0.66, 0.48, 0.22), vRand);
      lateFlower = mix(lateFlower, vec3(0.19, 0.11, 0.055), step(0.48, vRand) * 0.76);
      col = mix(col, lateFlower, uAutumn * 0.94);
      col *= (uAmbient + uLight * 0.85);
      col = mix(col, uSnowColor * (0.75 + 0.15 * cos(a * 9.0)), uWinter);`);
  flower = swap(flower, 'float glow = uNight * vWhite', 'float glow = uNight * (1.0 - uWinter) * (1.0 - uAutumn) * vWhite');
  core = core.slice(0, flowerStart) + flower + core.slice(flowerEnd);

  // Existing branch material gains a snow mantle on upward-facing surfaces.
  core = swap(core, '  const bark = new THREE.MeshLambertMaterial({ color: 0x4d3726 });', `  const bark = new THREE.MeshLambertMaterial({ color: 0x4d3726 });
  bark.onBeforeCompile = sh => {
    sh.uniforms.uWinter = U.uWinter; sh.uniforms.uSnowColor = U.uSnowColor;
    sh.vertexShader = 'varying vec3 vBranchNormal; varying float vBranchSide;\\n' + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\\n vBranchNormal = normalize(mat3(modelMatrix) * objectNormal); vBranchSide = 1.0 - step(0.95, abs(objectNormal.y));');
    sh.fragmentShader = 'uniform float uWinter; uniform vec3 uSnowColor; varying vec3 vBranchNormal; varying float vBranchSide;\\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n diffuseColor.rgb = mix(diffuseColor.rgb, uSnowColor * 0.92, uWinter * vBranchSide * smoothstep(0.25, 0.75, normalize(vBranchNormal).y));');
  };`);
  // Colour groups follow existing leaf positions and their volume shading.
  // Attribute construction happens once; no extra per-frame work or geometry.
  core = swap(core, '    sh.uniforms.uTime = U.uTime;', '    sh.uniforms.uTime = U.uTime;\n    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uWinter = U.uWinter; sh.uniforms.uNight = U.uNight;');
  core = swap(core, "sh.vertexShader = 'uniform float uTime;\\nattribute vec3 aN;\\n'", "sh.vertexShader = 'uniform float uTime, uAutumn, uWinter, uNight;\\nattribute vec3 aN, aAutumnColor, aAutumnNightColor; varying vec3 vAutumnColor;\\n'");
  core = swap(core, '      vec3 ip = vec3(instanceMatrix[3]);', `      transformed *= 1.0 - uWinter;
      vAutumnColor = mix(aAutumnColor, aAutumnNightColor, uNight);
      vec3 ip = vec3(instanceMatrix[3]);`);
  core = swap(core, "    // don't flip normals on back faces", `    sh.fragmentShader = 'uniform float uAutumn, uWinter;\\n' + sh.fragmentShader;
    sh.fragmentShader = 'varying vec3 vAutumnColor;\\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n if (uAutumn > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vAutumnColor * diffuse, uAutumn);');
    // don't flip normals on back faces`);
  // A bare winter crown should not issue thousands of degenerate leaf quads.
  core = swap(core, 'let leafMat;', 'let leafMat, canopy, winterCrown, createWinterCrown;\nconst winterTips = [];');
  core = swap(core, '    if (depth === 0) {', '    if (depth === 0) {\n      winterTips.push({ position: p.clone(), direction: d.clone(), radius: r * 0.45 });');
  core = swap(core, '  tree.add(leaves);', `  tree.add(leaves); canopy = leaves;
  createWinterCrown = () => {
  // Terminal twigs are one merged seasonal mesh, not hundreds of draw calls.
  const twigPositions = [], twigNormals = [];
  let twigSeed = 349;
  const twigRandom = () => { twigSeed = (Math.imul(twigSeed, 1664525) + 1013904223) >>> 0; return twigSeed / 4294967296; };
  const twigUp = new THREE.Vector3(0, 1, 0), twigRotation = new THREE.Quaternion(), twigMatrix = new THREE.Matrix4();
  function growTwig(start, direction, length, radius, depth) {
    let origin = start.clone(); const directionNow = direction.clone().normalize();
    for (let segment = 0; segment < 3; segment++) {
      directionNow.add(new THREE.Vector3((twigRandom() - 0.5) * 0.25, 0.05, (twigRandom() - 0.5) * 0.25)).normalize();
      const span = length / 3, end = origin.clone().addScaledVector(directionNow, span);
      const geometry = new THREE.CylinderGeometry(radius * (1 - (segment + 1) * 0.23), radius * (1 - segment * 0.23), span, 5, 1, true).toNonIndexed();
      twigRotation.setFromUnitVectors(twigUp, directionNow);
      twigMatrix.compose(origin.clone().add(end).multiplyScalar(0.5), twigRotation, new THREE.Vector3(1, 1, 1));
      geometry.applyMatrix4(twigMatrix);
      for (const value of geometry.attributes.position.array) twigPositions.push(value);
      for (const value of geometry.attributes.normal.array) twigNormals.push(value);
      geometry.dispose(); origin = end;
    }
    if (depth > 0) for (let child = 0; child < 3; child++) {
      const angle = twigRandom() * Math.PI * 2;
      const next = directionNow.clone().multiplyScalar(0.60).add(new THREE.Vector3(Math.cos(angle) * 0.55, 0.32, Math.sin(angle) * 0.55)).normalize();
      growTwig(origin, next, length * (0.58 + twigRandom() * 0.18), radius * 0.42, depth - 1);
    }
  }
  for (const tip of winterTips) growTwig(tip.position, tip.direction, 0.85 + twigRandom() * 0.75, Math.min(0.09, tip.radius * 0.85), 2);
  const twigs = new THREE.BufferGeometry();
  twigs.setAttribute('position', new THREE.Float32BufferAttribute(twigPositions, 3));
  twigs.setAttribute('normal', new THREE.Float32BufferAttribute(twigNormals, 3));
  winterCrown = new THREE.Mesh(twigs, bark); winterCrown.visible = false; tree.add(winterCrown);
  };`);

  // Two inexpensive instanced leaf draws and one bounded snow particle draw.
  // No object-per-leaf updates, DOM animations or high-dynamic-range glows.
  core += `
/* ------------------------------------------------------------------ seasonal details */
// Construct extras after Summer's original geometry/random sequence is complete.
createWinterCrown();
const autumnMeadow = (${autumnMeadow.toString()});
const autumnCanopy = (${autumnCanopy.toString()});
const createAutumnLeafLayout = (${createAutumnLeafLayout.toString()});
const createAutumnGroveLayout = (${createAutumnGroveLayout.toString()});
const createAutumnInsectLayout = (${createAutumnInsectLayout.toString()});
const createAutumnFlowerLayout = (${createAutumnFlowerLayout.toString()});
const createAutumnFlowerShapes = (${createAutumnFlowerShapes.toString()});
const meadowColors = ${JSON.stringify(AUTUMN_MEADOW_COLORS)}.map(hex => new THREE.Color(hex));
const nightMeadowColors = ${JSON.stringify(AUTUMN_NIGHT_MEADOW_COLORS)}.map(hex => new THREE.Color(hex));
const canopyColors = ${JSON.stringify(AUTUMN_CANOPY_COLORS)}.map(hex => new THREE.Color(hex));
const nightCanopyColors = ${JSON.stringify(AUTUMN_NIGHT_CANOPY_COLORS)}.map(hex => new THREE.Color(hex));
{
  const colors = new Float32Array(grass.geometry.instanceCount * 4);
  const nightColors = new Float32Array(grass.geometry.instanceCount * 3);
  const offsets = grass.geometry.attributes.aOffset.array, seeds = grass.geometry.attributes.aRand.array;
  for (let i = 0; i < seeds.length; i++) {
    const sample = autumnMeadow(offsets[i * 3], offsets[i * 3 + 2], seeds[i], TREE_X, TREE_Z);
    const color = seasonScratch.copy(meadowColors[sample.color]).lerp(meadowColors[sample.next], sample.blend);
    colors.set([color.r * sample.shade, color.g * sample.shade, color.b * sample.shade, sample.height], i * 4);
    color.copy(nightMeadowColors[sample.color]).lerp(nightMeadowColors[sample.next], sample.blend);
    nightColors.set([color.r * sample.shade, color.g * sample.shade, color.b * sample.shade], i * 3);
  }
  grass.geometry.setAttribute('aAutumn', new THREE.InstancedBufferAttribute(colors, 4));
  grass.geometry.setAttribute('aAutumnNight', new THREE.InstancedBufferAttribute(nightColors, 3));
  const leafColors = new Float32Array(canopy.count * 3), nightLeafColors = new Float32Array(canopy.count * 3), matrices = canopy.instanceMatrix.array, old = canopy.instanceColor.array;
  for (let i = 0; i < canopy.count; i++) {
    const sample = autumnCanopy(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14], Math.max(old[i * 3], old[i * 3 + 1], old[i * 3 + 2]));
    const color = canopyColors[sample.color]; leafColors.set([color.r * sample.shade, color.g * sample.shade, color.b * sample.shade], i * 3);
    const nightColor = nightCanopyColors[sample.color]; nightLeafColors.set([nightColor.r * sample.shade, nightColor.g * sample.shade, nightColor.b * sample.shade], i * 3);
  }
  canopy.geometry.setAttribute('aAutumnColor', new THREE.InstancedBufferAttribute(leafColors, 3));
  canopy.geometry.setAttribute('aAutumnNightColor', new THREE.InstancedBufferAttribute(nightLeafColors, 3));
}
// The settled snowy scene draws only its visible dormant stalks. The complete
// original meadow geometry remains available during a season transition.
const winterGrassGeometry = new THREE.InstancedBufferGeometry();
winterGrassGeometry.setIndex(grass.geometry.index);
for (const [name, attribute] of Object.entries(grass.geometry.attributes)) if (!attribute.isInstancedBufferAttribute) winterGrassGeometry.setAttribute(name, attribute);
{
  const selected = [];
  for (let i = 0; i < grass.geometry.instanceCount; i++) if (grass.geometry.attributes.aRand.array[i] >= 0.986) selected.push(i);
  for (const [name, attribute] of Object.entries(grass.geometry.attributes)) if (attribute.isInstancedBufferAttribute) {
    const values = new attribute.array.constructor(selected.length * attribute.itemSize);
    selected.forEach((index, i) => values.set(attribute.array.subarray(index * attribute.itemSize, (index + 1) * attribute.itemSize), i * attribute.itemSize));
    winterGrassGeometry.setAttribute(name, new THREE.InstancedBufferAttribute(values, attribute.itemSize));
  }
  winterGrassGeometry.instanceCount = selected.length;
}
const winterGrass = new THREE.Mesh(winterGrassGeometry, grass.material);
winterGrass.frustumCulled = false; winterGrass.visible = false; scene.add(winterGrass);
const leafShape = new THREE.PlaneGeometry(1, 1);
const leafFragment = /* glsl */\`
  uniform float uAutumn, uNight; uniform vec3 uLight, uAmbient, uFogColor;
  varying vec2 vUv; varying float vSeed, vDist, vLeafFade;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float angle = atan(p.y, p.x);
    float lobes = mix(5.0, 7.0, step(0.5, vSeed));
    float edge = 0.67 + 0.19 * cos(angle * lobes) + 0.08 * cos(angle * lobes * 2.0);
    if (length(p) > edge || uAutumn < 0.002) discard;
    vec3 color = mix(vec3(0.25, 0.035, 0.017), vec3(0.67, 0.33, 0.055), vSeed);
    float vein = exp(-abs(p.x) * 65.0) * 0.13 + exp(-abs(abs(p.x) * 0.65 + p.y - floor(p.y * 4.0) * 0.25) * 80.0) * 0.055;
    color *= (0.72 + vein + length(p) * 0.12) * (uAmbient + uLight * 0.65);
    color = mix(color, uFogColor, smoothstep(20.0, 100.0, vDist));
    gl_FragColor = vec4(color, uAutumn * vLeafFade);
    \${colorOut}
  }\`;
function seasonalLeaves(count, airborne) {
  const geometry = new THREE.InstancedBufferGeometry().copy(leafShape);
  const { offsets, seeds, slopes } = createAutumnLeafLayout(count, airborne, hgt, TREE_X, TREE_Z);
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute('aSlope', new THREE.InstancedBufferAttribute(slopes, 2));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1)); geometry.instanceCount = count;
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide, transparent: true, depthWrite: false, forceSinglePass: true,
    vertexShader: /* glsl */\`
      uniform float uTime, uAutumn; attribute vec3 aOffset; attribute float aSeed; attribute vec2 aSlope;
      varying vec2 vUv; varying float vSeed, vDist, vLeafFade;
      void main() {
        vec3 origin = aOffset; float rotation = aSeed * 6.283;
        vec3 p = position; vLeafFade = 1.0;
        \${airborne ? \`float progress = fract(uTime * (0.025 + aSeed * 0.018) + aSeed);
        vLeafFade = smoothstep(0.0, 0.055, progress) * (1.0 - smoothstep(0.86, 1.0, progress));
        origin.y += (1.0 - progress) * (7.0 + aSeed * 8.0);
        origin.x += sin(progress * 6.0 + aSeed * 40.0) * 1.7 + sin(progress * 19.0 + aSeed * 7.0) * 0.22;
        origin.z += sin(progress * 7.0 + aSeed * 23.0) * 0.7;
        rotation += uTime * (0.22 + aSeed * 0.35) + sin(uTime * 1.1 + aSeed * 17.0) * 0.4;
        p *= 0.16 + aSeed * 0.16;
        p.z += sin(uTime * 1.6 + aSeed * 31.0) * p.y * 0.5;
        p.y *= 0.3 + 0.7 * cos(rotation * 0.7);\` : \`p *= 0.22 + aSeed * 0.23;
        p = vec3(p.x, p.z, p.y);\`}
        float c = cos(rotation), s = sin(rotation);
        p.xz = mat2(c, -s, s, c) * p.xz;
        \${airborne ? '' : 'p.y += dot(p.xz, aSlope);'}
        vec3 world = origin + p; vUv = uv; vSeed = aSeed; vDist = distance(world, cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }\`, fragmentShader: leafFragment,
  }));
  mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh); return mesh;
}
const leafLitter = seasonalLeaves(isMobile ? 650 : 1300, false);
const fallingLeaves = seasonalLeaves(isMobile ? 42 : 76, true);
// Two small distant stands frame the hero oak; sixteen trees share two draws.
const groveLayout = createAutumnGroveLayout(), groveLeaves = isMobile ? 100 : 180;
const groveCrown = new THREE.PlaneGeometry(1.15, 1.15);
const groveNormals = new Float32Array(groveLayout.length * groveLeaves * 3);
const groveTrunk = new THREE.CylinderGeometry(.08, .28, 5.7, 5); groveTrunk.translate(0, 2.85, 0);
function autumnStand(geometry, crown) {
  const material = new THREE.MeshLambertMaterial(crown ? {map:leafMat.map,alphaTest:0.45,side:THREE.DoubleSide} : {color:0x534037});
  material.onBeforeCompile = sh => {
    sh.uniforms.uAutumn = U.uAutumn;
    sh.vertexShader = 'uniform float uAutumn;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n transformed *= uAutumn;');
    if (crown) sh.vertexShader = 'attribute vec3 aGroveNormal;\\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(aGroveNormal);');
  };
  const mesh = new THREE.InstancedMesh(geometry, material, groveLayout.length * (crown ? groveLeaves : 1)), matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const normal = new THREE.Vector3(), inverse = new THREE.Quaternion(), color = new THREE.Color(), euler = new THREE.Euler();
  let seed = 721; const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  groveLayout.forEach((tree, i) => {
    if (!crown) {
      rotation.setFromEuler(euler.set(0,tree.yaw,0));
      matrix.compose(position.set(tree.x,hgt(tree.x,tree.z),tree.z),rotation,scale.setScalar(tree.scale));mesh.setMatrixAt(i,matrix);return;
    }
    for(let leaf = 0; leaf < groveLeaves; leaf++) {
      const az = random() * Math.PI * 2, y = random() * 2 - 1, radius = Math.pow(random(),.33), r = Math.sqrt(1-y*y);
      const x = Math.cos(az) * r * radius * 2.65, z = Math.sin(az) * r * radius * 2.2;
      rotation.setFromEuler(euler.set(random()*6.28,random()*6.28,random()*6.28));
      position.set(tree.x+x*tree.scale,hgt(tree.x,tree.z)+(5.7+y*radius*2.2)*tree.scale,tree.z+z*tree.scale);
      const leafScale = (.65 + random() * .5) * tree.scale;
      const index = i * groveLeaves + leaf;
      matrix.compose(position,rotation,scale.setScalar(leafScale));mesh.setMatrixAt(index,matrix);
      normal.set(x,y*radius*2.2,z).normalize().applyQuaternion(inverse.copy(rotation).invert());groveNormals.set([normal.x,normal.y,normal.z],index*3);
      color.copy(canopyColors[tree.color]).multiplyScalar(.60+radius*.44+Math.max(0,y)*.2);mesh.setColorAt(index,color);
    }
  });
  if(crown) geometry.setAttribute('aGroveNormal',new THREE.InstancedBufferAttribute(groveNormals,3));
  mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); return mesh;
}
const autumnGrove = autumnStand(groveCrown, true), autumnTrunks = autumnStand(groveTrunk, false);
// Warm butterflies by day and small tawny moths after dusk share one draw.
// Reuse the established wing shape and flight shader, with separate attributes
// and a local deterministic layout so Summer's butterflies remain exact.
const insectGeometry = new THREE.InstancedBufferGeometry();
insectGeometry.setIndex(bfGeo.index);
for (const [name, attribute] of Object.entries(bfGeo.attributes)) if (!attribute.isInstancedBufferAttribute) insectGeometry.setAttribute(name, attribute);
{
  const layout = createAutumnInsectLayout(isMobile, hgt), count = layout.length;
  const bases = new Float32Array(count * 3), seeds = new Float32Array(count), sizes = new Float32Array(count), moths = new Float32Array(count);
  const colors = [new Float32Array(count * 3),new Float32Array(count * 3),new Float32Array(count * 3)];
  const dayColors = [['#da792e','#291c16','#dab78b'],['#b7582f','#33211b','#d2a76b'],['#d9a048','#413121','#e1c997']].map(row=>row.map(hex=>new THREE.Color(hex)));
  const nightColors = [['#8e795c','#44362a','#b3a182'],['#aa8a64','#514131','#c0ad8d'],['#79694f','#342c25','#9e9177']].map(row=>row.map(hex=>new THREE.Color(hex)));
  layout.forEach((insect,i)=>{
    bases.set([insect.x,insect.y,insect.z],i*3);seeds[i]=insect.seed;sizes[i]=insect.size;moths[i]=insect.moth;
    const palette = (insect.moth ? nightColors : dayColors)[insect.color];
    palette.forEach((color,j)=>colors[j].set([color.r,color.g,color.b],i*3));
  });
  for(const [name,array,size] of [['aBase',bases,3],['aSeed',seeds,1],['aSize',sizes,1],['aMoth',moths,1],['aC1',colors[0],3],['aC2',colors[1],3],['aC3',colors[2],3]]) insectGeometry.setAttribute(name,new THREE.InstancedBufferAttribute(array,size));
  insectGeometry.instanceCount = count;
}
const autumnInsects = new THREE.Mesh(insectGeometry,new THREE.ShaderMaterial({
  uniforms:U,side:THREE.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true,
  vertexShader: butterflies.material.vertexShader
    .replace('uniform float uTime, uNight;', 'uniform float uTime, uNight, uAutumn; varying float vAutumnInsectAlpha;')
    .replace('attribute float aSeed, aSize, aSide;', 'attribute float aSeed, aSize, aSide, aMoth;')
    .replace('float t = uTime + aSeed * 100.0;', 'float t = uTime * mix(1.0, 0.78, aMoth) + aSeed * 100.0;')
    .replace('float hide = 1.0 - smoothstep(0.35, 0.8, uNight);', 'float nocturnal = smoothstep(0.35, 0.8, uNight); float hide = uAutumn * mix(1.0 - nocturnal, nocturnal, aMoth); vAutumnInsectAlpha = hide;'),
  fragmentShader: butterflies.material.fragmentShader
    .replace('void main(){', 'varying float vAutumnInsectAlpha; void main(){ if(vAutumnInsectAlpha < 0.002) discard;')
    .replace('vec4(applyAir(col, vW, vDist), 1.0)', 'vec4(applyAir(col, vW, vDist), vAutumnInsectAlpha)'),
}));
autumnInsects.frustumCulled = false; autumnInsects.visible = false; scene.add(autumnInsects);
// Compact red dahlias sit low in Autumn's existing short-grass pockets.
// Shared layered petals and foliage still use only two instanced draws.
const autumnFlowerLayout = createAutumnFlowerLayout(isMobile,hgt,TREE_X,TREE_Z);
const autumnFlowerShapes = createAutumnFlowerShapes();
function autumnFlowers(shape,bloom) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(shape.positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(shape.normals,3));
  if(bloom) geometry.setAttribute('aPetal',new THREE.Float32BufferAttribute(shape.petals,1));
  const material = new THREE.MeshLambertMaterial({color:bloom?0xffffff:0x3f4f32,side:THREE.DoubleSide});
  material.customProgramCacheKey = () => bloom ? 'autumn-flower-bloom' : 'autumn-flower-foliage';
  material.onBeforeCompile = sh => {
    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform float uAutumn,uTime;\\n' + (bloom?'attribute float aPetal; varying float vPetal;\\n':'') + sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\n' + (bloom?'vPetal = aPetal;\\n':'') + 'float stemBend = smoothstep(0.0,.31,position.y); float breeze = uTime * 1.2 + instanceMatrix[3].x * .71 + instanceMatrix[3].z * .31; transformed.x += sin(breeze) * .012 * stemBend * stemBend; transformed.z += cos(breeze * .83) * .008 * stemBend * stemBend; transformed *= uAutumn;');
    if(bloom) {
      sh.uniforms.uFlowerRim = {value:new THREE.Color('#b45143')};
      // A baked petal tone deepens folds while keeping the red edges readable.
      // Both sides receive native light as thin petals, not black silhouettes.
      sh.fragmentShader = 'uniform vec3 uFlowerRim; varying float vPetal;\\n' + sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\\n diffuseColor.rgb = mix(diffuseColor.rgb * .20,mix(diffuseColor.rgb,uFlowerRim,.34),vPetal * vPetal);').replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\\n normal *= faceDirection;');
    }
  };
  const mesh = new THREE.InstancedMesh(geometry,material,autumnFlowerLayout.length),matrix = new THREE.Matrix4(),rotation = new THREE.Quaternion(),position = new THREE.Vector3(),scale = new THREE.Vector3();
  const colors = ['#7e182b','#a12b29','#943521'].map(hex=>new THREE.Color(hex));
  autumnFlowerLayout.forEach((flower,i)=>{
    // Slightly nodding heads expose the rosette from the fixed meadow camera;
    // varied angles keep them organic instead of displaying cap-like backs.
    const yaw = bloom ? Math.atan2(-flower.x,12-flower.z) + Math.sin(flower.yaw)*.35 : flower.yaw;
    rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
    matrix.compose(position.set(flower.x,flower.y,flower.z),rotation,scale.setScalar(flower.scale));
    mesh.setMatrixAt(i,matrix);if(bloom)mesh.setColorAt(i,colors[flower.color]);
  });
  mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); return mesh;
}
const autumnBlossoms = autumnFlowers(autumnFlowerShapes.blossom,true), autumnFlowerStems = autumnFlowers(autumnFlowerShapes.foliage,false);
const snowGeometry = new THREE.BufferGeometry();
{
  const count = isMobile ? 180 : 340, positions = new Float32Array(count * 3), seeds = new Float32Array(count);
  let seed = 127; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) { const z = -55 + random() * 66; positions.set([(random() - 0.5) * 65, random() * 18, z], i * 3); seeds[i] = random(); }
  snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  snowGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
}
const snowflakes = new THREE.Points(snowGeometry, new THREE.ShaderMaterial({
  uniforms: { ...U, uPx: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false,
  vertexShader: /* glsl */\`
    uniform float uTime, uPx; attribute float aSeed; varying float vA;
    void main() {
      vec3 p = position;
      p.y = mod(p.y - uTime * (0.30 + aSeed * 0.35) + 10000.0, 18.0);
      p.x += sin(uTime * 0.12 + aSeed * 40.0) * 1.2;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float depth = max(-mv.z, 0.1);
      vA = smoothstep(2.0, 5.0, depth) * (0.25 + aSeed * 0.45);
      gl_PointSize = uPx * min(2.6, (12.0 + aSeed * 15.0) / depth);
      gl_Position = projectionMatrix * mv;
    }\`,
  fragmentShader: /* glsl */\`
    uniform float uWinter; uniform vec3 uSnowColor; varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
      gl_FragColor = vec4(min(vec3(0.85), uSnowColor), (1.0 - smoothstep(0.25, 1.0, r)) * vA * uWinter);
      \${colorOut}
    }\`,
}));
snowflakes.frustumCulled = false; snowflakes.visible = false; scene.add(snowflakes);
// A distant snow-dusted grove lends depth to the quiet winter hills. All its
// trees share one mesh/material; it is entirely absent from Summer/Autumn draws.
const pinePositions = [], pineNormals = [];
for (let tier = 0; tier < 4; tier++) {
  const geometry = new THREE.ConeGeometry(1.1 - tier * 0.23, 1.55 - tier * 0.18, 7, 1, true).toNonIndexed();
  geometry.translate(0, 1.0 + tier * 0.62, 0);
  for (const value of geometry.attributes.position.array) pinePositions.push(value);
  for (const value of geometry.attributes.normal.array) pineNormals.push(value);
  geometry.dispose();
}
const pineGeometry = new THREE.InstancedBufferGeometry();
pineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pinePositions, 3));
pineGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(pineNormals, 3));
{
  const count = isMobile ? 34 : 54, offsets = new Float32Array(count * 3), sizes = new Float32Array(count);
  let seed = 691; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const x = (i % 2 ? 1 : -1) * (14 + random() * 94), z = -84 - random() * 80;
    offsets.set([x, hgt(x, z), z], i * 3); sizes[i] = 1.8 + random() * 1.7;
  }
  pineGeometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  pineGeometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1)); pineGeometry.instanceCount = count;
}
const winterGrove = new THREE.Mesh(pineGeometry, new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: /* glsl */\`
    uniform float uWinter; attribute vec3 aOffset; attribute float aSize;
    varying vec3 vNormal; varying float vDist, vTier;
    void main() {
      vec3 world = aOffset + position * aSize * uWinter;
      vNormal = normal; vDist = distance(world, cameraPosition); vTier = position.y;
      gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    }\`,
  fragmentShader: /* glsl */\`
    uniform vec3 uSnowColor, uLight, uAmbient, uFogColor, uSunDir;
    varying vec3 vNormal; varying float vDist, vTier;
    void main() {
      float light = 0.45 + 0.55 * max(0.0, dot(normalize(vNormal), uSunDir));
      vec3 evergreen = vec3(0.065, 0.14, 0.15) * (uAmbient + uLight * light);
      float snow = smoothstep(0.24, 0.65, vNormal.y) * (0.68 + 0.25 * sin(vTier * 8.0));
      vec3 color = mix(evergreen, uSnowColor * (0.7 + light * 0.18), snow);
      color = mix(color, uFogColor, smoothstep(65.0, 210.0, vDist) * 0.85);
      gl_FragColor = vec4(color, 1.0);
      \${colorOut}
    }\`,
}));
winterGrove.frustumCulled = false; winterGrove.visible = false; scene.add(winterGrove);
fireflies.material.uniforms.uNight = { value: 0 };
`;

  const detailsStart = core.indexOf('/* ------------------------------------------------------------------ seasonal details */');
  const details = core.slice(detailsStart);
  core = core.slice(0, detailsStart);
  core = swap(core, '/* ------------------------------------------------------------------ pointer', details + '\n/* ------------------------------------------------------------------ pointer');

  post = swap(post, '  U.uTime.value = t;', `  U.uTime.value = t;
  const seasonWeights = seasonState.sample(now);
  U.uAutumn.value = seasonWeights[1]; U.uWinter.value = seasonWeights[2];
  canopy.visible = seasonWeights[2] < 0.999;
  grass.visible = seasonWeights[2] < 1;
  winterGrass.visible = seasonWeights[2] === 1;
  winterCrown.visible = seasonWeights[2] > 0.001;
  winterCrown.scale.setScalar(Math.max(0.0001, seasonWeights[2]));
  butterflies.visible = seasonWeights[0] > 0.01;
  leafLitter.visible = fallingLeaves.visible = seasonWeights[1] > 0.001;
  autumnGrove.visible = autumnTrunks.visible = seasonWeights[1] > 0.001;
  autumnInsects.visible = autumnBlossoms.visible = autumnFlowerStems.visible = seasonWeights[1] > 0.001;
  snowflakes.visible = winterGrove.visible = seasonWeights[2] > 0.001;`);
  post = swap(post, "  samp('fog', ph, U.uFogColor.value);", `  const si = Math.min(Math.floor(ph), 1), sf = ph - si;
  U.uSnowColor.value.copy(SEASON_PAL.winter.tip[si]).lerp(SEASON_PAL.winter.tip[si + 1], sf);
  samp('fog', ph, U.uFogColor.value);`);
  post = swap(post, 'U.uCloudCover.value = CLOUD_COVER[i] + (CLOUD_COVER[i + 1] - CLOUD_COVER[i]) * f;', 'U.uCloudCover.value = (CLOUD_COVER[i] + (CLOUD_COVER[i + 1] - CLOUD_COVER[i]) * f) * (1 - seasonWeights[2] * 0.32);');
  post = swap(post, '  pollenU.uDay.value = airborne;', '  pollenU.uDay.value = airborne * seasonWeights[0];');
  post = swap(post, '  seedsU.uSeedAmt.value = airborne * 0.35;', '  seedsU.uSeedAmt.value = airborne * 0.35 * seasonWeights[0];');
  post = swap(post, '  fireflies.visible = night > 0.001;', '  fireflies.visible = night > 0.001 && seasonWeights[0] > 0.001;\n  fireflies.material.uniforms.uNight.value = night * seasonWeights[0];');
  post = swap(post, 'for (const points of [seeds, pollen, fireflies])', 'for (const points of [seeds, pollen, fireflies, snowflakes])');
  post = swap(post, '!motionPaused && !tw &&', '!motionPaused && !tw && !seasonState.active &&');
  post = swap(post, 'motionPaused && !tw && !resizePending', 'motionPaused && !tw && !seasonState.active && !resizePending');
  post = swap(post, 'frozenFrame.present(motionPaused && !tw);', 'frozenFrame.present(motionPaused && !tw && !seasonState.active);');
  return { core, post };
}

module.exports = { createNatureSeasonTransition, PALETTES, applyNatureSeasons };
