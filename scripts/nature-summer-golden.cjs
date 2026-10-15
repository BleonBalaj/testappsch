// Painterly Summer Golden on the existing meadow, crown, flowers, groves and
// sky. Uses their native light/wind and the existing season weight; every
// addition is gated by uSummer * uGolden, so other settled looks are unchanged.

// Low evening sun: deep viridian shade, lush greens and a few sun-dried drifts.
const GOLDEN_MEADOW_COLORS = ['#24503f', '#3f7a3c', '#5f9440', '#7fa64c', '#a8a052'];
// Crown clumps, like Autumn's colour groups: cool teal shade, two greens,
// sunlit yellow-green and amber-lit edges toward the low sun.
const GOLDEN_CANOPY_COLORS = ['#21514a', '#30734c', '#64963c', '#a9c44e', '#ecd36c'];

const linear = hex => {
  const channel = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const n = parseInt(hex.slice(1), 16);
  return `vec3(${[n >> 16, (n >> 8) & 255, n & 255].map(v => channel(v).toFixed(4)).join(', ')})`;
};

function summerGoldenCanopy(x, y, z, brightness) {
  // Broad groups follow the crown's volume; the sunward (right) shoulder and
  // the top catch the evening light, the lower left falls into cool shade.
  const field = .5 + .23 * Math.sin(x * .52 + z * .27 + 1.3) + .17 * Math.sin(y * .66 - z * .31 + .4);
  const top = Math.max(0, Math.min(1, (y - 6.5) / 5));
  const sunward = Math.max(0, Math.min(1, (x + 2) / 7));
  const light = Math.max(0, Math.min(1, top * .55 + sunward * .58 + (field - .5) * .95 - .06));
  const color = light < .22 ? 0 : light < .44 ? 1 : light < .66 ? 2 : light < .84 ? 3 : 4;
  return { color, light, shade: .58 + brightness * 1.5 };
}

function applySummerGolden(core, post, swap) {
  /* ---------------------------------------------------------------- sky */
  core = swap(core, '      uniform float uNight, uGolden, uTime, uCloudCover, uMorning, uWinter;',
    '      uniform float uNight, uGolden, uTime, uCloudCover, uMorning, uWinter, uSummer;');
  core = swap(core, '        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim', `        // Summer Golden: cooler depth above the open horizon, with long strata
        // of cloud underlit in apricot toward the sun and rose-lavender above.
        float summerGoldenSky = uSummer * uGolden;
        if (summerGoldenSky > 0.0 && y > 0.0) {
          col = mix(col, uTop * vec3(0.90, 0.94, 1.04), smoothstep(0.04, 0.40, y) * summerGoldenSky * 0.12);
          float sgAz = atan(d.x, -d.z);
          float sgDrift = uTime * 0.0016;
          float sgFeather = n2(vec2(sgAz * 5.5 + sgDrift, y * 13.0 + 21.0));
          float sgH = y + 0.016 * sin(sgAz * 2.6 + 1.1) + (sgFeather - 0.5) * 0.020;
          float sgLow = exp(-pow((sgH - 0.075) / 0.016, 2.0));
          float sgMid = exp(-pow((sgH - 0.155) / 0.026, 2.0));
          float sgHigh = exp(-pow((sgH - 0.285) / 0.040, 2.0));
          float sgBreaks = smoothstep(0.15, 0.62, n2(vec2(sgAz * 3.6 - sgDrift, sgH * 7.0 + 31.0)));
          float sgFibers = n2(vec2(sgAz * 16.0 + sgH * 30.0 + sgDrift, sgH * 120.0 - sgAz * 12.0));
          float sgBody = sgLow * 0.85 + sgMid + sgHigh * 0.55;
          float sgCloud = sgBody * sgBreaks * (0.45 + sgFibers * 0.55);
          // Undersides catch the low sun, strongest on its side; tops stay rose-violet.
          float sgBelow = (sgLow * smoothstep(0.010, -0.012, sgH - 0.075) + sgMid * smoothstep(0.016, -0.020, sgH - 0.155)
                         + sgHigh * smoothstep(0.024, -0.030, sgH - 0.285)) / max(sgBody, 1e-3);
          float sgUnder = clamp(0.10 + sgBelow * 0.55 + side * side * 0.45 + (sgFibers - 0.5) * 0.25, 0.0, 1.0);
          vec3 sgShade = mix(uCloudShade, uTop, 0.45) * vec3(0.86, 0.82, 0.92);
          vec3 sgLit = mix(uCloudLit, uSunGlow, 0.30 + side * 0.35) * 1.06;
          vec3 sgColor = mix(sgShade, sgLit, sgUnder);
          col = mix(col, sgColor, clamp(sgCloud, 0.0, 1.0) * summerGoldenSky * 0.85 * (1.0 - dens * 0.6));
          // A broken field of small, high puffs (a mackerel sky), each with a
          // sunlit lower edge, gives the wide upper sky soft painted texture.
          // (Outside +-0.22 of the band its weight is below 1/1000: skip the noise.)
          if (abs(sgH - 0.40) < 0.22) {
            float sgPuffBand = exp(-pow((sgH - 0.40) / 0.075, 2.0));
            vec2 sgPuffUv = vec2(sgAz * 11.0 - sgDrift * 3.0, sgH * 46.0);
            float sgPuffN = n2(sgPuffUv) * 0.65 + n2(sgPuffUv * 2.3 + 7.0) * 0.35;
            if (sgPuffN > 0.50) {
              float sgPuff = smoothstep(0.50, 0.78, sgPuffN) * sgPuffBand;
              float sgPuffEdge = clamp(0.5 + (sgPuffN - n2(sgPuffUv - vec2(0.0, 0.35)) * 0.65 - n2((sgPuffUv - vec2(0.0, 0.35)) * 2.3 + 7.0) * 0.35) * 3.0, 0.0, 1.0);
              vec3 sgPuffColor = mix(sgShade, sgLit, clamp(0.15 + sgPuffEdge * 0.6 + side * side * 0.3, 0.0, 1.0));
              col = mix(col, sgPuffColor, sgPuff * summerGoldenSky * 0.60 * (1.0 - dens * 0.6));
            }
          }
          // Deeper rose-violet away from the sun, so the dome is not one flat wash.
          col = mix(col, uTop * vec3(0.84, 0.78, 1.0), smoothstep(0.18, 0.60, y) * (1.0 - side) * summerGoldenSky * 0.22);
          // A distant bank of soft cumulus on the shaded side, its billows lit
          // apricot where they face the low sun and lavender in their folds.
          float sgCuEnv = exp(-pow((sgAz + 0.50) / 0.30, 2.0)) + 0.45 * exp(-pow((sgAz + 0.02) / 0.18, 2.0));
          float sgCuHeight = 0.07 + 0.17 * sgCuEnv;
          // fbm never exceeds 0.97, so above this height the bank is exactly clear.
          if (y < sgCuHeight * (1.15 + sgCuEnv)) {
            vec2 sgCuUv = vec2(sgAz * 5.0 - sgDrift * 2.0, y * 13.0) + 4.0;
            float sgCuD = fbm(sgCuUv) + sgCuEnv * 0.45 - y / sgCuHeight * 0.45;
            // The sunward lighting sample is needed only inside a cloud.
            if (sgCuD > 0.46) {
              float sgCuS = fbm(sgCuUv + vec2(0.30, 0.22)) + sgCuEnv * 0.45 - (y + 0.016) / sgCuHeight * 0.45;
              float sgCu = smoothstep(0.46, 0.70, sgCuD) * smoothstep(0.0, 0.03, y);
              float sgCuLit = clamp(0.20 + (sgCuD - sgCuS) * 4.0 + smoothstep(0.02, sgCuHeight, y) * 0.45, 0.0, 1.0);
              vec3 sgCuColor = mix(mix(uCloudShade, uCloudLit, 0.35) * vec3(0.94, 0.90, 1.0), mix(uCloudLit, uSunGlow, 0.22) * 1.06, sgCuLit);
              sgCuColor = mix(sgCuColor, uHorizon, (1.0 - smoothstep(0.0, 0.10, y)) * 0.40);
              col = mix(col, sgCuColor, sgCu * summerGoldenSky * 0.80 * (1.0 - dens * 0.5));
            }
          }
        }

        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim`);

  /* ---------------------------------------------------------------- meadow */
  const grassStart = core.indexOf('const grass ='), grassEnd = core.indexOf('scene.add(grass);', grassStart);
  if (grassStart < 0 || grassEnd < grassStart) throw new Error('Summer Golden grass shader missing');
  let grass = core.slice(grassStart, grassEnd);
  // Each blade is one brush stroke of a broad colour drift. Evaluated per
  // vertex, only while Summer Golden is visible; no new buffers or draws.
  const [m0, m1, m2, m3, m4] = GOLDEN_MEADOW_COLORS.map(linear);
  grass = swap(grass, '    attribute vec3 aOffset, aAutumnNight; attribute float aYaw, aScale, aRand; attribute vec4 aAutumn; uniform float uNight; varying vec3 vAutumnColor;',
    '    attribute vec3 aOffset, aAutumnNight; attribute float aYaw, aScale, aRand; attribute vec4 aAutumn; uniform float uNight, uSummer, uGolden; varying vec3 vAutumnColor, vSummerGolden;');
  grass = swap(grass, '      vAutumnColor = mix(aAutumn.rgb, aAutumnNight, uNight);', `      vAutumnColor = mix(aAutumn.rgb, aAutumnNight, uNight);
      vSummerGolden = vec3(0.0);
      if (uSummer * uGolden > 0.0) {
        vec2 o = aOffset.xz;
        float drift = 0.50 + 0.20 * sin(o.x * 0.105 + sin(o.y * 0.07 + 0.8) * 1.7 - 1.2) + 0.13 * sin(o.y * 0.14 - o.x * 0.05 + 2.4)
                    + 0.17 * sin(o.x * 0.55 + sin(o.y * 0.45) * 1.3 + o.y * 0.23);
        drift = clamp(drift + (aRand - 0.5) * 0.08, 0.0, 1.0);
        vec3 g = mix(${m0}, ${m1}, smoothstep(0.12, 0.34, drift));
        g = mix(g, ${m2}, smoothstep(0.38, 0.56, drift));
        g = mix(g, ${m3}, smoothstep(0.62, 0.76, drift));
        g = mix(g, ${m4}, smoothstep(0.80, 0.92, drift));
        // Uneven stroke values: a few deep blades inside every drift.
        float stroke = fract(aRand * 7.31);
        vSummerGolden = g * (0.80 + 0.34 * aRand) * mix(0.62, 1.0, smoothstep(0.0, 0.22, stroke));
      }`);
  grass = swap(grass, '    uniform vec2 uTreeXZ; uniform float uMorning, uAutumn, uWinter, uSummer, uGolden; uniform vec3 uSnowColor; varying vec3 vAutumnColor;',
    '    uniform vec2 uTreeXZ; uniform float uMorning, uAutumn, uWinter, uSummer, uGolden; uniform vec3 uSnowColor; varying vec3 vAutumnColor, vSummerGolden;');
  grass = swap(grass, '      col = mix(col, col * vec3(1.2, 1.05, 0.55), step(0.94, vRand) * 0.55);', `      float summerGoldenBlade = uSummer * uGolden;
      if (summerGoldenBlade > 0.0) {
        tip = mix(tip, vSummerGolden, summerGoldenBlade);
        vec3 goldenBlade = mix(vSummerGolden * vec3(0.20, 0.30, 0.32), vSummerGolden, smoothstep(0.0, 1.0, vH));
        col = mix(col, goldenBlade, summerGoldenBlade);
      }
      col = mix(col, col * vec3(1.2, 1.05, 0.55), step(0.94, vRand) * 0.55);`);
  grass = swap(grass, '      col = applyAir(col, vW, vDist);', `      float summerGoldenMeadow = uSummer * uGolden;
      if (summerGoldenMeadow > 0.0) {
        // Cool shaded blade bases under warm, sunlit tips.
        float baseDepth = (1.0 - smoothstep(0.32, 0.98, vH)) * (0.45 + (1.0 - shade) * 0.50);
        col *= mix(vec3(1.0), vec3(0.70, 0.96, 1.10), baseDepth * summerGoldenMeadow * 0.55);
      }
      col = applyAir(col, vW, vDist);`);
  core = core.slice(0, grassStart) + grass + core.slice(grassEnd);

  /* ---------------------------------------------------------------- flowers */
  const flowerStart = core.indexOf('const flowers ='), flowerEnd = core.indexOf('scene.add(flowers);', flowerStart);
  if (flowerStart < 0 || flowerEnd < flowerStart) throw new Error('Summer Golden flower shader missing');
  let flower = core.slice(flowerStart, flowerEnd);
  flower = swap(flower, '    uniform float uAutumn, uWinter; uniform vec3 uSnowColor;', '    uniform float uAutumn, uWinter, uSummer, uGolden; uniform vec3 uSnowColor;');
  flower = swap(flower, '      col *= (uAmbient + uLight * 0.85);', `      float summerGoldenFlower = uSummer * uGolden;
      if (summerGoldenFlower > 0.0) {
        float petalDepth = smoothstep(0.25, 0.95, r / petal);
        col *= mix(vec3(1.0), mix(vec3(1.04, 1.02, 0.96), vec3(0.88, 0.96, 1.06), petalDepth), summerGoldenFlower * 0.40);
        // Painted petals: a warm shadow ring around the eye and faint radial veins.
        float vein = 0.5 + 0.5 * cos(a * 5.0 * 3.0 + vRand * 6.28 * 3.0);
        col *= mix(vec3(1.0), vec3(0.80, 0.70, 0.62), smoothstep(0.42, 0.28, r) * smoothstep(0.20, 0.28, r) * summerGoldenFlower * 0.8);
        col *= 1.0 - vein * smoothstep(0.30, 0.80, r / petal) * 0.10 * summerGoldenFlower;
      }
      col *= (uAmbient + uLight * 0.85);
      // Low sun shining through the petal edges.
      col += uSunGlow * vColor * smoothstep(0.62, 1.0, r / petal) * pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 3.0) * 0.55 * uSummer * uGolden;`);
  core = core.slice(0, flowerStart) + flower + core.slice(flowerEnd);

  /* ---------------------------------------------------------------- crown */
  // Per-leaf colour groups, built once like Autumn's. The native volume
  // normals and sprite remain; amber light glows through the sunward clumps.
  core = swap(core, '    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uWinter = U.uWinter; sh.uniforms.uNight = U.uNight;',
    '    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uWinter = U.uWinter; sh.uniforms.uNight = U.uNight;\n    sh.uniforms.uSummer = U.uSummer; sh.uniforms.uGolden = U.uGolden;');
  core = swap(core, "sh.vertexShader = 'uniform float uTime, uAutumn, uWinter, uNight;\\nattribute vec3 aN, aAutumnColor, aAutumnNightColor; varying vec3 vAutumnColor;\\n'",
    "sh.vertexShader = 'uniform float uTime, uAutumn, uWinter, uNight;\\nattribute vec3 aN, aAutumnColor, aAutumnNightColor; attribute vec4 aSummerGolden; varying vec3 vAutumnColor; varying vec4 vSummerGolden;\\n'");
  core = swap(core, '      vec3 ip = vec3(instanceMatrix[3]);', `      vec3 ip = vec3(instanceMatrix[3]);
      vSummerGolden = aSummerGolden;`);
  core = swap(core, "sh.fragmentShader = 'uniform float uAutumn, uWinter;\\n' + sh.fragmentShader;",
    "sh.fragmentShader = 'uniform float uAutumn, uWinter, uSummer, uGolden; varying vec4 vSummerGolden;\\n' + sh.fragmentShader;");
  core = swap(core, "    // don't flip normals on back faces", `    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n if (uSummer * uGolden > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vSummerGolden.rgb * diffuse, uSummer * uGolden);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\n if (uSummer * uGolden > 0.0) totalEmissiveRadiance = mix(totalEmissiveRadiance, vSummerGolden.rgb * vec3(0.15, 0.30, 0.36) * (1.0 - vSummerGolden.a) + emissive * vSummerGolden.rgb * vSummerGolden.a * vSummerGolden.a * 10.0, uSummer * uGolden);');
    // don't flip normals on back faces`);
  core = swap(core, 'const leafShape = new THREE.PlaneGeometry(1, 1);', `{
  const summerGoldenCanopy = (${summerGoldenCanopy.toString()});
  const golden = ${JSON.stringify(GOLDEN_CANOPY_COLORS)}.map(hex => new THREE.Color(hex));
  const values = new Float32Array(canopy.count * 4), matrices = canopy.instanceMatrix.array, old = canopy.instanceColor.array;
  for (let i = 0; i < canopy.count; i++) {
    const sample = summerGoldenCanopy(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14], Math.max(old[i * 3], old[i * 3 + 1], old[i * 3 + 2]));
    const color = golden[sample.color];
    values.set([color.r * sample.shade, color.g * sample.shade, color.b * sample.shade, sample.light], i * 4);
  }
  canopy.geometry.setAttribute('aSummerGolden', new THREE.InstancedBufferAttribute(values, 4));
}
const leafShape = new THREE.PlaneGeometry(1, 1);`);

  // The existing distant stands receive a quiet green/cool tint behind the
  // amber air; preserve their layout, volume normals and Autumn colour path.
  core = swap(core, '    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uSummer = U.uSummer;',
    `    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uSummer = U.uSummer;
    if (crown) {
      sh.uniforms.uGolden = U.uGolden;
      sh.fragmentShader = 'uniform float uSummer, uGolden;\\n' + sh.fragmentShader;
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n if (uSummer * uGolden > 0.0) diffuseColor.rgb *= mix(vec3(1.0), vec3(0.65, 1.03, 1.13), uSummer * uGolden * 0.50);');
    }`);
  post = swap(post, '  const winterGoldenLight = U.uWinter.value * U.uGolden.value;', `  const summerGoldenLight = U.uSummer.value * U.uGolden.value;
  if (summerGoldenLight > 0) {
    shafts.uniforms.uStrength.value *= 1 - summerGoldenLight * 0.12;
    grade.uniforms.uGlare.value *= 1 - summerGoldenLight * 0.08;
  }
  const winterGoldenLight = U.uWinter.value * U.uGolden.value;`);
  return { core, post };
}

module.exports = { GOLDEN_MEADOW_COLORS, GOLDEN_CANOPY_COLORS, summerGoldenCanopy, applySummerGolden };
