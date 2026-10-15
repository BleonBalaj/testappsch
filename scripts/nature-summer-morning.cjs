// Summer Morning's palette changes only first stops. Its separate scenery
// materials below reuse the native meshes; all other settings use the originals.
const SUMMER_MORNING = Object.freeze({
  top: '#397ca6', mid: '#9ecbd5', horizon: '#f7e7cb',
  cloudLit: '#fff6e7', cloudShade: '#89a5b8',
  mountFar: '#9fbbc3', mountNear: '#6e999f', fog: '#b4cbd8',
  base: '#244a30', tip: '#80b36a',
  light: '#ffe9cb', ambient: '#7b9593',
  sun: '#fff5d9', sunGlow: '#f8dfb4', mist: '#e2e9dc',
  hemiSky: '#d8eae7', hemiGnd: '#465c32', cloud: '#fff7e8', leaf: '#f0f3dd',
});

function applySummerMorningPalette(core, swap) {
  const start = core.indexOf('const PAL = {');
  const end = core.indexOf('\n};', start);
  if (start < 0 || end < 0) throw new Error('Summer Morning palette block is missing');
  const original = core.slice(start, end);
  let palette = original;
  for (const [key, color] of Object.entries(SUMMER_MORNING)) {
    const pattern = new RegExp(`(\\b${key}\\s*:\\s*hex\\(\\[)'#[a-fA-F0-9]{6}'`, 'g');
    let count = 0;
    palette = palette.replace(pattern, (_, prefix) => { count++; return `${prefix}'${color}'`; });
    if (count !== 1) throw new Error(`Summer Morning ${key}: expected one palette stop, found ${count}`);
  }
  return swap(core, original, palette);
}

const MORNING_MEADOW_COLORS = ['#326853', '#4c8464', '#739e60', '#86b55e', '#a6c97a'];
// Painterly crown clumps: cool teal shade, two greens, then fresh yellow-green
// where the high morning sun (upper left) reaches the crown.
const MORNING_CANOPY_COLORS = ['#1e5545', '#2b7348', '#4a8a44', '#80ad55', '#bfd27a'];

function summerMorningWeight(phase, summer) {
  const k = Math.max(0, Math.min(1, phase / 0.9));
  return summer * (1 - k * k * (3 - 2 * k));
}

function summerMorningMeadow(x, z, seed) {
  // Broad overlapping colour fields plus a mid-scale term, so the near meadow
  // also breaks into patches. Seeds vary only stroke value, never the colour.
  const field = Math.max(0, Math.min(0.999999,
    .5 + .22 * Math.sin(x * .11 + Math.sin(z * .075) * 1.5)
    + .16 * Math.sin(z * .13 - x * .045)
    + .14 * Math.sin(x * .52 + Math.sin(z * .41) * 1.2 + z * .19)));
  const band = field * 4;
  const stroke = (seed * 7.31) % 1;
  return { color: Math.floor(band), next: Math.min(4, Math.floor(band) + 1), blend: band % 1,
    shade: (.78 + .34 * seed) * (stroke < .28 ? .58 + stroke * 1.5 : 1) };
}

function summerMorningCanopy(x, y, z, brightness) {
  // Discrete colour groups follow the crown's volume, like Autumn's: the top
  // and the sunward (left) shoulder are lit, the lower right falls into shade.
  const field = .5 + .23 * Math.sin(x * .5 + z * .29 + .6) + .17 * Math.sin(y * .63 - z * .27 + 1.9);
  const top = Math.max(0, Math.min(1, (y - 5.5) / 7));
  const sunward = Math.max(0, Math.min(1, (2 - x) / 7));
  const light = Math.max(0, Math.min(1, top * .5 + sunward * .38 + (field - .5) * 1.1 + .02));
  const color = light < .22 ? 0 : light < .44 ? 1 : light < .66 ? 2 : light < .84 ? 3 : 4;
  return { color, next: color, blend: 0, light, shade: .55 + Math.min(.9, brightness * 1.35) };
}

function createSummerMorningScenery() {
  const weight = { value: 0 }, pairs = [];
  const meadowColors = MORNING_MEADOW_COLORS.map(hex => new THREE.Color(hex));
  const crownColors = MORNING_CANOPY_COLORS.map(hex => new THREE.Color(hex));
  const scratch = new THREE.Color();
  function swatch(sample, palette, buffer, index) {
    scratch.copy(palette[sample.color]).lerp(palette[sample.next], sample.blend).multiplyScalar(sample.shade);
    buffer[index] = scratch.r; buffer[index + 1] = scratch.g; buffer[index + 2] = scratch.b;
  }
  const colors = new Float32Array(grass.geometry.instanceCount * 3);
  const offsets = grass.geometry.attributes.aOffset.array, seeds = grass.geometry.attributes.aRand.array;
  for (let i = 0; i < grass.geometry.instanceCount; i++) {
    swatch(summerMorningMeadow(offsets[i * 3], offsets[i * 3 + 2], seeds[i]), meadowColors, colors, i * 3);
  }
  grass.geometry.setAttribute('aSummerMorning', new THREE.InstancedBufferAttribute(colors, 3));
  const leaves = new Float32Array(canopy.count * 4), matrices = canopy.instanceMatrix.array, original = canopy.instanceColor.array;
  for (let i = 0; i < canopy.count; i++) {
    const sample = summerMorningCanopy(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14],
      Math.max(original[i * 3], original[i * 3 + 1], original[i * 3 + 2]));
    swatch(sample, crownColors, leaves, i * 4);
    leaves[i * 4 + 3] = sample.light;
  }
  canopy.geometry.setAttribute('aSummerMorning', new THREE.InstancedBufferAttribute(leaves, 4));
  const replace = (source, from, to) => {
    if (source.split(from).length !== 2) throw new Error('Summer Morning material anchor: ' + from);
    return source.replace(from, to);
  };
  const add = mesh => {
    const native = mesh.material, morning = native.clone();
    // Clone() copies ShaderMaterial uniforms by value. Rebind native live
    // lighting/time/trail objects, including each wisp's own seed.
    morning.uniforms = { ...native.uniforms, uSummerMorning: weight };
    morning.fragmentShader = 'uniform float uSummerMorning;\n' + native.fragmentShader;
    pairs.push({ mesh, native, morning });
    return morning;
  };
  function localAir(material) {
    // Keep crisp foreground; let low mist collect in two distant depressions.
    // Uses the existing air shader, no fog planes/render passes/new draw calls.
    // Soft shadows of passing clouds are also evaluated per vertex: cool pools
    // between warm, sunlit meadow (the light contrast Golden has).
    material.uniforms.uSummerMorningClock = material.uniforms.uTime;
    material.vertexShader = 'varying float vSummerMorningMist, vSummerMorningShade; uniform float uSummerMorningClock;\n' + material.vertexShader;
    material.vertexShader = replace(material.vertexShader, '      gl_Position =',
      `      vec2 mistA = (vW.xz - vec2(-19.0, -31.0)) / vec2(15.0, 12.0);
      vec2 mistB = (vW.xz - vec2(25.0, -54.0)) / vec2(21.0, 15.0);
      vSummerMorningMist = 0.28 + max(exp(-dot(mistA, mistA)), exp(-dot(mistB, mistB)));
      // A broad, slowly drifting cloud shadow that sweeps across the hill below
      // the crest and a far slope; the tree's hilltop and the near meadow stay sunlit.
      float cloudT = uSummerMorningClock * 0.012;
      float cloudField = 0.5 + 0.28 * sin(vW.x * 0.085 + sin(vW.z * 0.06 + 0.4) * 1.8 + 1.8 + cloudT)
        + 0.20 * sin(vW.z * 0.11 - vW.x * 0.045 + 0.6 + cloudT * 0.7) + 0.12 * sin(vW.x * 0.21 + vW.z * 0.17 + 2.0);
      vSummerMorningShade = smoothstep(0.55, 0.75, cloudField) * smoothstep(10.0, 22.0, length(vW.xz - vec2(1.5, -50.0)));
      gl_Position =`);
    material.fragmentShader = 'varying float vSummerMorningMist, vSummerMorningShade;\n' + material.fragmentShader;
    material.fragmentShader = replace(material.fragmentShader,
      '    col = mix(col, fc, smoothstep(uFogNear, uFogFar, dist));',
      `    col *= mix(vec3(1.0), mix(vec3(1.06, 1.04, 0.94), vec3(0.58, 0.72, 0.90), vSummerMorningShade), uSummerMorning);
    col = mix(col, fc, smoothstep(uFogNear, uFogFar, dist) * (1.0 - uSummerMorning * 0.22));`);
    material.fragmentShader = replace(material.fragmentShader,
      '    col = mix(col, uMistColor + uSunGlow * sunAmt * 0.3, clamp(mist, 0.0, 0.8));',
      `    mist *= mix(1.0, vSummerMorningMist, uSummerMorning);
    col = mix(col, uMistColor + uSunGlow * sunAmt * 0.3, clamp(mist, 0.0, 0.8));`);
  }
  const morningGrass = add(grass);
  morningGrass.vertexShader = 'attribute vec3 aSummerMorning; varying vec3 vSummerMorning;\n' + morningGrass.vertexShader;
  morningGrass.vertexShader = replace(morningGrass.vertexShader, '      float h = position.y;',
    '      vSummerMorning = aSummerMorning;\n      float h = position.y;');
  morningGrass.fragmentShader = 'varying vec3 vSummerMorning;\n' + morningGrass.fragmentShader;
  morningGrass.fragmentShader = replace(morningGrass.fragmentShader,
    '      vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));',
    `      vec3 col = mix(uBase, tip, smoothstep(0.0, 1.0, vH));
      tip = mix(tip, vSummerMorning, uSummerMorning);
      vec3 paintedBlade = mix(vSummerMorning * vec3(0.24, 0.35, 0.30), vSummerMorning, smoothstep(0.0, 1.0, vH));
      // Alternate cool blue-green and warm sunlit strokes along the upper blades.
      vec3 strokeHue = mix(vec3(0.84, 1.0, 1.12), vec3(1.10, 1.05, 0.80), fract(vRand * 13.7));
      paintedBlade *= mix(vec3(1.0), strokeHue, smoothstep(0.25, 1.0, vH) * 0.85);
      col = mix(col, paintedBlade, uSummerMorning);`);
  // Morning light with a direction (as Golden has): a warm wash toward the
  // sun's side, cooler air away from it, cool pools under passing clouds and
  // a few blade tips catching the light. Assembled anchor: see sunDisc below.
  const meadowAir = '      col = apply' + 'Air(col, vW, vDist);';
  morningGrass.fragmentShader = replace(morningGrass.fragmentShader, meadowAir,
    `      if (uSummerMorning > 0.0) {
        vec3 smView = normalize(vW - cameraPosition);
        float smSide = smoothstep(0.62, -0.50, smView.x / max(length(smView.xz), 1e-3));
        col *= mix(vec3(1.0), mix(vec3(0.90, 0.97, 1.07), vec3(1.07, 1.04, 0.90), smSide), uSummerMorning * 0.55);
        // A cooler, deeper foreground leading into a sunlit middle distance.
        float smFore = 1.0 - smoothstep(3.0, 13.0, vDist);
        float smMid = smoothstep(10.0, 20.0, vDist) * (1.0 - smoothstep(42.0, 70.0, vDist));
        col *= mix(vec3(1.0), vec3(0.74, 0.86, 0.95), smFore * uSummerMorning * 0.75);
        // Backlit blades: the low sun glows through upper blades facing it.
        float smRim = pow(max(dot(smView, uSunDir), 0.0), 3.0);
        col += uSunGlow * vec3(0.78, 1.0, 0.40) * smRim * vH * vH * shade * (1.0 - vSummerMorningShade) * uSummerMorning * 0.55;
        col *= mix(vec3(1.0), vec3(1.08, 1.06, 0.90), smMid * shade * uSummerMorning * 0.55);
        col *= mix(vec3(1.0), vec3(0.80, 0.90, 1.03), min(1.0, (1.0 - shade) * 1.6) * uSummerMorning * 0.7);
        col += vec3(0.22, 0.20, 0.08) * vH * vH * vH * shade * step(0.6, fract(vRand * 5.3)) * uSummerMorning * 0.6;
      }
${meadowAir}`);
  localAir(morningGrass);
  localAir(add(terrain));
  localAir(add(flowers));
  const morningSky = add(sky);
  morningSky.fragmentShader = replace(morningSky.fragmentShader,
    '          float lit = clamp(0.55 + (n - ns) * 3.5, 0.0, 1.0);',
    `          float lit = clamp(0.55 + (n - ns) * 3.5, 0.0, 1.0);
          lit = mix(lit, clamp(0.62 + (n - ns) * 5.0, 0.0, 1.0), uSummerMorning);
          // Crisper, brushed forms instead of soft smudges: a narrower density
          // edge broken by wind-combed fibres, which also vary the light.
          float smBrush = n2(vec2(cp.x * 7.0 - cp.y * 2.0, cp.y * 30.0 + cp.x * 3.0));
          float smEdge = smoothstep(1.0 - uCloudCover + 0.04, 1.0 - uCloudCover + 0.20, n + (smBrush - 0.5) * 0.10);
          dens = mix(dens, smEdge * smoothstep(0.0, 0.14, y), uSummerMorning * 0.7);
          lit = clamp(lit + (smBrush - 0.5) * 0.30 * uSummerMorning, 0.0, 1.0);`);
  // Assembled at runtime: this function's inlined source must not repeat the
  // build-time anchor that other generators locate exactly once.
  const sunDisc = '        // sun disc with limb ' + 'darkening';
  morningSky.fragmentShader = replace(morningSky.fragmentShader, sunDisc,
    `        if (uSummerMorning > 0.0 && y > 0.0) {
          // The sun as a painted light: a tighter white core inside a soft
          // apricot-gold halo, instead of a broad white/cyan blowout.
          col -= uSunGlow * (pow(sd, 260.0) * 0.20 + pow(sd, 40.0) * 0.12) * sunVis * uSummerMorning;
          vec3 smHalo = mix(uSunGlow, vec3(1.0, 0.80, 0.52), 0.45);
          col = mix(col, smHalo, (pow(sd, 120.0) * 0.50 + pow(sd, 36.0) * 0.16) * sunVis * (1.0 - dens * 0.5) * uSummerMorning);
          // A clearer, deeper blue overhead above the pale warm horizon.
          col = mix(col, uTop * vec3(0.94, 1.02, 1.10), smoothstep(0.10, 0.48, y) * (1.0 - dens * 0.7) * 0.40 * uSummerMorning);
          // Low, flat morning cloud banks either side of the hill: brushed
          // crowns lit from the high sun (upper left), soft blue-grey bases.
          float smAz = atan(d.x, -d.z);
          float smDrift = uTime * 0.0015;
          float smEnv = exp(-pow((smAz + 0.58) / 0.26, 2.0)) + 0.85 * exp(-pow((smAz - 0.52) / 0.24, 2.0));
          float smTall = 0.045 + 0.08 * smEnv;
          float smBase = 0.035 + 0.012 * sin(smAz * 7.0);
          // fbm never exceeds 0.97, so above this height the banks are exactly clear.
          if (y < smBase + smTall * (1.05 + smEnv)) {
            vec2 smUv = vec2(smAz * 5.0 - smDrift, y * 12.0) + 17.0;
            float smD = fbm(smUv) + smEnv * 0.48 - (y - smBase) / smTall * 0.48;
            // The sunward lighting sample is needed only inside a cloud.
            if (smD > 0.48) {
              float smS = fbm(smUv + vec2(-0.12, 0.30)) + smEnv * 0.48 - (y + 0.025 - smBase) / smTall * 0.48;
              float smCu = smoothstep(0.48, 0.68, smD) * smoothstep(smBase - 0.01, smBase + 0.03, y);
              float smLit = clamp(0.35 + (smD - smS) * 4.5 + smoothstep(smBase, smBase + smTall, y) * 0.45, 0.0, 1.0);
              vec3 smCuColor = mix(mix(uCloudShade, uCloudLit, 0.35) * vec3(0.94, 0.98, 1.05), uCloudLit * 1.04, smLit);
              smCuColor = mix(smCuColor, uHorizon, (1.0 - smoothstep(0.02, 0.12, y)) * 0.40);
              col = mix(col, smCuColor, smCu * uSummerMorning * 0.88 * (1.0 - dens * 0.5));
            }
          }
          // A few small cotton puffs drifting through the open mid-sky.
          if (y > 0.13 && y < 0.50) {
            vec2 smP = d.xz / (y + 0.02) * 1.10 + vec2(uTime * 0.006 + 7.0, uTime * 0.002 + 2.0);
            // fbm(smP), unrolled: when its first two octaves are too thin to reach
            // the puff threshold (the last three add at most 0.22), stop early.
            mat2 smM = mat2(1.6, 1.2, -1.2, 1.6);
            vec2 smQ = smM * smP;
            float smPuffN = 0.5 * n2(smP) + 0.25 * n2(smQ);
            if (smPuffN > 0.351) {
              smQ = smM * smQ; smPuffN += 0.125 * n2(smQ);
              smQ = smM * smQ; smPuffN += 0.0625 * n2(smQ);
              smQ = smM * smQ; smPuffN += 0.03125 * n2(smQ);
            }
            if (smPuffN > 0.57) {
              float smPuffS = fbm(smP + normalize(uSunDir.xz + 1e-4) * 0.08);
              float smPuff = smoothstep(0.57, 0.70, smPuffN) * smoothstep(0.13, 0.22, y) * (1.0 - smoothstep(0.38, 0.50, y));
              float smPuffLit = clamp(0.60 + (smPuffN - smPuffS) * 6.0, 0.0, 1.0);
              col = mix(col, mix(mix(uCloudShade, uCloudLit, 0.4) * vec3(0.94, 0.98, 1.05), uCloudLit * 1.04, smPuffLit), smPuff * uSummerMorning * 0.62 * (1.0 - dens * 0.5));
            }
          }
          // High, feathered cirrus brushed across the upper sky.
          float smCiH = y + 0.02 * sin(smAz * 2.3 + 0.7);
          float smFibers = n2(vec2(smAz * 16.0 + smCiH * 34.0 + uTime * 0.001, smCiH * 140.0 - smAz * 18.0));
          float smCirrus = exp(-pow((smCiH - 0.40) / 0.07, 2.0)) * smoothstep(0.25, 0.75, n2(vec2(smAz * 3.2 + 2.0, smCiH * 6.0))) * (0.3 + smFibers * 0.7);
          col = mix(col, mix(uCloudLit, vec3(1.0), 0.3), smCirrus * uSummerMorning * 0.45);
        }
${sunDisc}`);
  // Existing wisps remain subtle, with a little more body in the middle distance.
  for (const wisp of wisps) {
    const material = add(wisp);
    material.fragmentShader = replace(material.fragmentShader,
      '          gl_FragColor = vec4(c, a * uMist * 0.32);',
      '          gl_FragColor = vec4(c, a * uMist * (0.32 + uSummerMorning * 0.10));');
  }
  const morningLeaf = leafMat.clone();
  morningLeaf.onBeforeCompile = shader => {
    leafMat.onBeforeCompile(shader);
    shader.uniforms.uSummerMorning = weight;
    shader.vertexShader = 'attribute vec4 aSummerMorning; varying vec4 vSummerMorning;\n' + shader.vertexShader;
    shader.vertexShader = replace(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n vSummerMorning = aSummerMorning;');
    shader.fragmentShader = 'uniform float uSummerMorning; varying vec4 vSummerMorning;\n' + shader.fragmentShader;
    shader.fragmentShader = replace(shader.fragmentShader, '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vSummerMorning.rgb * diffuse, uSummerMorning);');
    // Painterly light: cool sky bounce in the shaded clumps, a soft warm glow on the sunlit ones.
    shader.fragmentShader = replace(shader.fragmentShader, '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += vSummerMorning.rgb * mix(vec3(0.04, 0.13, 0.15) * (1.0 - vSummerMorning.a), vec3(0.20, 0.17, 0.06), vSummerMorning.a * vSummerMorning.a) * uSummerMorning;');
  };
  morningLeaf.customProgramCacheKey = () => 'nature-summer-morning-canopy-v2';
  pairs.push({ mesh: canopy, native: leafMat, morning: morningLeaf });
  let active = false;
  return {
    update(value) {
      weight.value = value;
      // The native programs are restored at every other settled combination;
      // they never run the Morning colour/mist shader branches.
      const next = value > 0;
      if (next !== active) {
        for (const pair of pairs) pair.mesh.material = next ? pair.morning : pair.native;
        active = next;
      }
      // Keep native Golden emissive warmth when fading out of Morning.
      morningLeaf.emissive.copy(leafMat.emissive);
    },
  };
}

function createLazySummerMorningScenery(build) {
  let scenery = null;
  return {
    update(value) {
      if (!scenery) {
        if (value <= 0) return;
        scenery = build();
      }
      scenery.update(value);
    },
  };
}

function applySummerMorningScenery(core, post, swap) {
  const scenery = `
/* ------------------------------------------------------------------ Summer Morning painterly materials */
const MORNING_MEADOW_COLORS = ${JSON.stringify(MORNING_MEADOW_COLORS)};
const MORNING_CANOPY_COLORS = ${JSON.stringify(MORNING_CANOPY_COLORS)};
${summerMorningWeight.toString()}
${summerMorningMeadow.toString()}
${summerMorningCanopy.toString()}
${createSummerMorningScenery.toString()}
${createLazySummerMorningScenery.toString()}
const summerMorningScenery = createLazySummerMorningScenery(createSummerMorningScenery);
`;
  core = swap(core, '/* ------------------------------------------------------------------ pointer', scenery + '\n/* ------------------------------------------------------------------ pointer');
  // A touch more contrast lifts Morning's milky haze; exactly 1.05 elsewhere.
  // Soft rays from the now-visible sun; updatePost resets the strength every draw.
  post = swap(post, '  updatePost(ph, t);', '  summerMorningScenery.update(summerMorningWeight(ph, seasonWeights[0]));\n  grade.uniforms.uContrast.value = 1.05 + 0.07 * summerMorningWeight(ph, seasonWeights[0]);\n  updatePost(ph, t);\n  shafts.uniforms.uStrength.value *= 1 + 1.4 * summerMorningWeight(ph, seasonWeights[0]);');
  // A lower morning sun, just inside the top-left of the frame, so its glow
  // and rays reach the meadow. Weighted by Morning: other looks keep the native arc.
  post = swap(post, '  dirFrom(saz + Math.sin(t * 0.05) * 1.5, sel + Math.sin(t * 0.07) * 0.6, U.uSunDir.value);',
    '  dirFrom(saz + Math.sin(t * 0.05) * 1.5, sel - 12 * summerMorningWeight(ph, seasonWeights[0]) + Math.sin(t * 0.07) * 0.6, U.uSunDir.value);');
  post = swap(post, "  samp('sunCore', ph, U.uSunCore.value);", "  U.uCloudCover.value -= 0.08 * summerMorningWeight(ph, seasonWeights[0]);\n  samp('sunCore', ph, U.uSunCore.value);");
  return { core, post };
}

module.exports = { SUMMER_MORNING, MORNING_MEADOW_COLORS, MORNING_CANOPY_COLORS,
  summerMorningWeight, summerMorningMeadow, summerMorningCanopy, createSummerMorningScenery, createLazySummerMorningScenery,
  applySummerMorningPalette, applySummerMorningScenery };
