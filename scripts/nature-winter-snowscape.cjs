// Winter Morning/Golden snow modelling in the existing terrain shader: the hill
// lit by the sun (the mesh itself keeps flat normals), soft wind-combed drift
// ripples that catch low light, and the bare tree's shadow across the snow.
// Weighted by uWinter * (1 - uNight); no meshes, textures, passes or RNG.

// Winter Morning shading shared by the snow and the dormant reeds standing in
// it: Summer Morning's sweeping cloud-shadow band, blue on snow, and a sky-blue
// near slope beneath the sunlit white crest.
function winterMorningShade(target, p, indent) {
  return `float winterMorningShade = uWinter * uMorning;
if (winterMorningShade > 0.0) {
  float cloudT = uTime * 0.012;
  float cloudField = 0.5 + 0.28 * sin(${p}.x * 0.085 + sin(${p}.y * 0.06 + 0.4) * 1.8 + 1.8 + cloudT)
    + 0.20 * sin(${p}.y * 0.11 - ${p}.x * 0.045 + 0.6 + cloudT * 0.7) + 0.12 * sin(${p}.x * 0.21 + ${p}.y * 0.17 + 2.0);
  float cloudBand = smoothstep(0.55, 0.75, cloudField) * smoothstep(10.0, 22.0, length(${p} - uTreeXZ));
  ${target} *= mix(vec3(1.0), vec3(0.68, 0.79, 0.98), cloudBand * winterMorningShade);
  ${target} *= mix(vec3(1.0), vec3(0.88, 0.93, 1.02), (1.0 - smoothstep(4.0, 30.0, vDist)) * winterMorningShade);
}`.split('\n').map(line => indent + line).join('\n');
}

// Winter Golden: a lavender near slope, so the sunlit crest glows warm above it.
function goldenNearSlope(target) {
  return `${target} *= mix(vec3(1.0), vec3(0.88, 0.85, 0.98), (1.0 - smoothstep(4.0, 30.0, vDist)) * uWinter * uGolden * (1.0 - uNight));`;
}

function applyWinterSnowscape(core, post, swap) {
  const start = core.indexOf('const terrain ='), end = core.indexOf('scene.add(terrain);', start);
  if (start < 0 || end < start) throw new Error('Winter snowscape terrain shader not found');
  let terrain = core.slice(start, end);
  terrain = swap(terrain, '    uniform float uWinter, uGolden; uniform vec3 uSnowColor;',
    '    uniform float uWinter, uGolden, uMorning; uniform vec2 uTreeXZ; uniform vec3 uSnowColor;');
  terrain = swap(terrain, '      col = mix(col, snow, uWinter);', `      float winterDaylight = uWinter * (1.0 - uNight);
      if (winterDaylight > 0.0) {
        // Smooth hill normal from the terrain height function.
        vec2 w = vW.xz;
        float e1 = exp(-(w.x * w.x) / 1800.0 - (w.y + 48.0) * (w.y + 48.0) / 1000.0);
        float e2 = exp(-(w.x + 80.0) * (w.x + 80.0) / 1800.0 - (w.y + 140.0) * (w.y + 140.0) / 1300.0);
        float e3 = exp(-(w.x - 85.0) * (w.x - 85.0) / 2400.0 - (w.y + 160.0) * (w.y + 160.0) / 1600.0);
        float hx = -7.5 * e1 * w.x / 900.0 + 0.075 * cos(w.x * 0.15 + 1.0) * cos(w.y * 0.12)
                 - 10.0 * e2 * (w.x + 80.0) / 900.0 - 8.0 * e3 * (w.x - 85.0) / 1200.0;
        float hz = -7.5 * e1 * (w.y + 48.0) / 500.0 - 0.06 * sin(w.x * 0.15 + 1.0) * sin(w.y * 0.12)
                 - 10.0 * e2 * (w.y + 140.0) / 650.0 - 8.0 * e3 * (w.y + 160.0) / 800.0;
        // Wind-combed drifts: soft ripples across the wind, faded with distance.
        vec2 wind = vec2(0.8, -0.6);
        float rp = dot(w, wind) * 0.85 + sin(dot(w, vec2(0.6, 0.8)) * 0.21) * 2.4 + sin(w.x * 0.11 + w.y * 0.07) * 1.6;
        vec2 ripple = wind * cos(rp) * 0.10 * (1.0 - smoothstep(12.0, 40.0, vDist));
        vec3 snowNormal = normalize(vec3(-hx - ripple.x, 1.0, -hz - ripple.y));
        // Light relative to flat ground: modelling, not a change of exposure.
        float relLight = (dot(snowNormal, uSunDir) - uSunDir.y) * 7.0;
        vec3 snowShadowTint = mix(vec3(0.62, 0.76, 1.02), vec3(0.70, 0.72, 0.96), uGolden);
        vec3 snowLightTint = mix(vec3(1.03, 1.02, 0.99), mix(vec3(1.0), uSunGlow, 0.22) * 1.04, uGolden);
        snow *= mix(snowShadowTint, snowLightTint, smoothstep(-1.0, 1.0, relLight)) / mix(snowShadowTint, snowLightTint, 0.5);

        // The bare tree's shadow: a soft trunk streak and a faint fan of twigs,
        // long and blue-violet in the low Golden sun, shorter in the morning.
        vec2 sunXZ = normalize(uSunDir.xz + 1e-4);
        float tanEl = max(max(uSunDir.y, 0.0) / max(length(uSunDir.xz), 1e-3), 0.32);
        vec2 tq = w - uTreeXZ;
        float along = dot(tq, -sunXZ), across = dot(tq, vec2(-sunXZ.y, sunXZ.x));
        float trunkLen = 7.0 / tanEl, crownLen = 15.0 / tanEl;
        float trunkShadow = smoothstep(-0.5, 0.5, along) * (1.0 - smoothstep(0.55, 1.1, abs(across)))
                          * (1.0 - smoothstep(trunkLen * 0.8, trunkLen * 1.05, along));
        float fanT = clamp((along - trunkLen * 0.6) / (crownLen - trunkLen * 0.6), 0.0, 1.0);
        float fanHalf = mix(1.0, 7.0, sqrt(fanT));
        float twigs = 0.45 + 0.55 * smoothstep(0.25, 0.85, abs(sin(across / max(along - trunkLen * 0.45, 1.0) * 11.0 + along * 0.04)));
        float fanShadow = step(trunkLen * 0.6, along) * (1.0 - smoothstep(crownLen * 0.85, crownLen * 1.05, along))
                        * (1.0 - smoothstep(fanHalf * 0.7, fanHalf, abs(across))) * twigs;
        float treeShadow = max(trunkShadow * 0.55, fanShadow * 0.32) * smoothstep(0.0, 0.03, uSunDir.y);
        vec3 treeShadowTint = mix(vec3(0.74, 0.83, 0.98), vec3(0.62, 0.62, 0.90), uGolden);
        snow *= mix(vec3(1.0), treeShadowTint, treeShadow * winterDaylight);
        ${goldenNearSlope('snow')}

${winterMorningShade('snow', 'w', '        ')}
      }
      col = mix(col, snow, uWinter);`);
  core = core.slice(0, start) + terrain + core.slice(end);

  // The reeds share the snow's Morning shading, so they don't stand out as pale needles.
  const grassStart = core.indexOf('const grass ='), grassEnd = core.indexOf('scene.add(grass);', grassStart);
  if (grassStart < 0 || grassEnd < grassStart) throw new Error('Winter snowscape grass shader not found');
  let grass = core.slice(grassStart, grassEnd);
  grass = swap(grass, '      col = mix(col, reed, uWinter);', `      col = mix(col, reed, uWinter);
${winterMorningShade('col', 'vW.xz', '      ')}
      ${goldenNearSlope('col')}`);
  core = core.slice(0, grassStart) + grass + core.slice(grassEnd);

  // Winter Morning sun: a faint pale-gold warmth inside its cold halo.
  core = swap(core, '        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim', `        float winterMorningSun = uWinter * uMorning;
        if (winterMorningSun > 0.0 && y > 0.0) {
          col = mix(col, vec3(1.0, 0.93, 0.80), pow(sd, 60.0) * 0.30 * sunVis * winterMorningSun);
        }

        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim`);
  // Winter Morning shares Summer Morning's lower sun, inside the top-left of
  // the frame, so its light rakes across the snow (the weight is linear).
  post = swap(post, 'sel - 12 * summerMorningWeight(ph, seasonWeights[0]) +', 'sel - 12 * summerMorningWeight(ph, seasonWeights[0] + seasonWeights[2]) +');
  return { core, post };
}

module.exports = { applyWinterSnowscape };
