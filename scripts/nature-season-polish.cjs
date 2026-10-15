// Summer scenery polish and the shared bird population (user-requested).
// Inlined by build-nature-scene.cjs right after applyNatureSeasons; the Winter
// overhaul lives in nature-winter.cjs.
//
// Summer effects are weighted by uSummer and live in a trailing shader block,
// so a settled Autumn keeps its exact compiled colour path. No render passes,
// global grading, extra rays or flashing highlights.

// Summer Golden: teal-green depth with gold only on lit tips (first/third stops untouched).
const SUMMER_GOLDEN = Object.freeze({ base: '#1c3a26', tip: '#7aa04c', ambient: '#7c8578' });

// Lush distant stands for Summer; the same trees turn to Autumn's copper.
const SUMMER_GROVE_COLORS = ['#41703a', '#50803f', '#5d8b44', '#3a663f', '#6b9149'];

// A slightly larger flock in every season, created after all scene layouts so
// no other placement shifts.
const EXTRA_BIRDS = Object.freeze({ goose: 2, goose2: 2, sparrow: 4, crow: 1, swallow: 2, bat: 2 });

function replaceStop(core, key, column, color) {
  const start = core.indexOf('const PAL = {'), end = core.indexOf('\n};', start);
  const block = core.slice(start, end);
  const pattern = new RegExp(`(\\b${key}\\s*:\\s*hex\\(\\[)('#[a-fA-F0-9]{6}'),\\s*('#[a-fA-F0-9]{6}'),\\s*('#[a-fA-F0-9]{6}')`);
  const match = block.match(pattern);
  if (!match) throw new Error(`Summer palette ${key} not found`);
  const stops = [match[2], match[3], match[4]];
  stops[column] = `'${color}'`;
  const next = block.replace(pattern, `${match[1]}${stops.join(', ')}`);
  return core.slice(0, start) + next + core.slice(end);
}

function applySeasonPolish(core, post, swap) {
  /* -------------------------------------------------------------- Summer Golden palette */
  core = replaceStop(core, 'base', 1, SUMMER_GOLDEN.base);
  core = replaceStop(core, 'tip', 1, SUMMER_GOLDEN.tip);
  core = replaceStop(core, 'ambient', 1, SUMMER_GOLDEN.ambient);

  /* -------------------------------------------------------------- uSummer */
  core = swap(core, '  uAutumn: { value: 0 }, uWinter: { value: 0 }, uSnowColor: { value: new THREE.Color() },',
    '  uAutumn: { value: 0 }, uWinter: { value: 0 }, uSnowColor: { value: new THREE.Color() }, uSummer: { value: 1 },');
  post = swap(post, '  U.uAutumn.value = seasonWeights[1]; U.uWinter.value = seasonWeights[2];',
    '  U.uAutumn.value = seasonWeights[1]; U.uWinter.value = seasonWeights[2]; U.uSummer.value = seasonWeights[0];');

  /* -------------------------------------------------------------- grass: trailing Summer block */
  core = swap(core, '    uniform vec2 uTreeXZ; uniform float uMorning, uAutumn, uWinter; uniform vec3 uSnowColor; varying vec3 vAutumnColor;',
    '    uniform vec2 uTreeXZ; uniform float uMorning, uAutumn, uWinter, uSummer, uGolden; uniform vec3 uSnowColor; varying vec3 vAutumnColor;');
  core = swap(core, `      col = mix(col, reed, uWinter);
      col = applyAir(col, vW, vDist);`, `      col = mix(col, reed, uWinter);
      if (uSummer > 0.0 && uNight < 1.0) {
        // Drifting cloud shadows read as cool patches sweeping over the hill,
        // and a slightly deeper foreground frames the bright summer meadow.
        float natureCloud = (1.0 - shade) * uSummer * (1.0 - uNight);
        col *= mix(vec3(1.0), vec3(0.66, 0.75, 0.87), min(1.0, natureCloud * 2.2));
        col *= mix(1.0, mix(0.8, 1.0, smoothstep(2.5, 16.0, vDist)), uSummer * (1.0 - uNight));
        // Summer Golden: broad warm rim light on blade tips across the sunward meadow.
        float rim = pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 2.0);
        col += uSunGlow * vec3(1.0, 0.62, 0.26) * rim * vH * vH * vH * 0.42 * shade * uGolden * uSummer;
      }
      col = applyAir(col, vW, vDist);`);

  /* -------------------------------------------------------------- summer groves (shared with Autumn) */
  core = swap(core, 'const groveNormals = new Float32Array(groveLayout.length * groveLeaves * 3);',
    `const groveNormals = new Float32Array(groveLayout.length * groveLeaves * 3);
const summerGroveColors = new Float32Array(groveLayout.length * groveLeaves * 3);
const SUMMER_GROVE = ${JSON.stringify(SUMMER_GROVE_COLORS)}.map(hex => new THREE.Color(hex)), summerGroveScratch = new THREE.Color();`);
  core = swap(core, `    sh.uniforms.uAutumn = U.uAutumn;
    sh.vertexShader = 'uniform float uAutumn;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n transformed *= uAutumn;');`,
  `    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uSummer = U.uSummer;
    sh.vertexShader = 'uniform float uAutumn, uSummer;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n transformed *= uAutumn + uSummer;');
    if (crown) sh.vertexShader = 'attribute vec3 aSummerGrove;\\n' + sh.vertexShader.replace('#include <color_vertex>', '#include <color_vertex>\\n vColor = mix(vColor, aSummerGrove, uSummer);');`);
  core = swap(core, '      color.copy(canopyColors[tree.color]).multiplyScalar(.60+radius*.44+Math.max(0,y)*.2);mesh.setColorAt(index,color);',
    `      color.copy(canopyColors[tree.color]).multiplyScalar(.60+radius*.44+Math.max(0,y)*.2);mesh.setColorAt(index,color);
      summerGroveScratch.copy(SUMMER_GROVE[tree.color]).multiplyScalar(.60+radius*.44+Math.max(0,y)*.2);summerGroveColors.set([summerGroveScratch.r,summerGroveScratch.g,summerGroveScratch.b],index*3);`);
  core = swap(core, "  if(crown) geometry.setAttribute('aGroveNormal',new THREE.InstancedBufferAttribute(groveNormals,3));",
    "  if(crown) geometry.setAttribute('aGroveNormal',new THREE.InstancedBufferAttribute(groveNormals,3));\n  if(crown) geometry.setAttribute('aSummerGrove',new THREE.InstancedBufferAttribute(summerGroveColors,3));");
  post = swap(post, '  autumnGrove.visible = autumnTrunks.visible = seasonWeights[1] > 0.001;',
    '  autumnGrove.visible = autumnTrunks.visible = seasonWeights[0] + seasonWeights[1] > 0.001;');

  /* -------------------------------------------------------------- more birds, every season */
  core = swap(core, '/* ------------------------------------------------------------------ pointer', `/* ------------------------------------------------------------------ a few more birds */
// Appended after every scene layout so no other placement shifts.
{
  const extra = ${JSON.stringify(EXTRA_BIRDS)};
  for (let i = 9; i < 9 + extra.goose; i++) { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; addBird('goose', gooseGeo, 1.3, '#2e3540', { off: new THREE.Vector3(-row * 2.6, rand(-0.3, 0.3) - row * 0.25, row * side * 2.2) }); }
  for (let i = 7; i < 7 + extra.goose2; i++) { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1; addBird('goose2', gooseGeo, 1.1, '#2e3540', { off: new THREE.Vector3(row * 2.4, rand(-0.3, 0.3) - row * 0.2, row * side * 2.0) }); }
  for (let i = 0; i < extra.sparrow; i++) addBird('sparrow', swallowGeo, 0.3, '#3b3026', { o: new THREE.Vector3(rand(-2.5, 2.5), rand(-1, 1), rand(-2.5, 2.5)), a: rand(0.8, 1.25) });
  for (let i = 0; i < extra.crow; i++) addBird('crow', gooseGeo, 1.0, '#141418', { y: rand(19, 26), z: rand(-100, -72), sp: rand(4.5, 6.5), x0: rand(0, 220) });
  for (let i = 0; i < extra.swallow; i++) { const x = rand(-18, 18), z = rand(-38, -14); addBird('swallow', swallowGeo, 0.42, '#1f2a44', { c: new THREE.Vector3(x, hgt(x, z) + rand(4, 8), z), a: rand(0.35, 0.6), b: rand(0.7, 1.1), cc: rand(0.3, 0.5) }); }
  for (let i = 0; i < extra.bat; i++) addBird('bat', batGeo, 0.55, '#0b0e1c', { a: rand(0.5, 0.9), b: rand(0.8, 1.4), cc: rand(0.6, 1.0) });
}

/* ------------------------------------------------------------------ pointer`);
  return { core, post };
}

module.exports = { SUMMER_GOLDEN, SUMMER_GROVE_COLORS, EXTRA_BIRDS, applySeasonPolish };
