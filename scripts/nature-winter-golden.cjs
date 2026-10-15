// Winter Golden polish on the existing sky/snow shaders. No new meshes,
// textures, passes, layout randomness or animation loops.
function applyWinterGolden(core, post, swap) {
  core = swap(core, '        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim', `        // Winter Golden: amber-lit cloud edges against a lavender evening sky.
        float winterGoldenSky = uWinter * uGolden;
        if (winterGoldenSky > 0.0 && y > 0.0) {
          float azimuth = atan(d.x, -d.z);
          float drift = uTime * 0.0018;
          float feather = n2(vec2(azimuth * 6.0 + drift, y * 14.0 + 8.0));
          float height = y + 0.018 * sin(azimuth * 3.5) + (feather - 0.5) * 0.016;
          float lower = exp(-pow((height - 0.12) / 0.018, 2.0));
          float upper = exp(-pow((height - 0.23) / 0.028, 2.0));
          float banks = exp(-pow((azimuth + 0.45 - drift) / 0.55, 2.0)) + 0.72 * exp(-pow((azimuth - 0.65 - drift) / 0.48, 2.0));
          float patches = 0.38 + 0.62 * smoothstep(0.16, 0.70, n2(vec2(azimuth * 4.0 + drift, height * 8.0 + 12.0)));
          float fibers = n2(vec2(azimuth * 15.0 + height * 24.0, height * 105.0 - azimuth * 10.0));
          float cloud = (lower + upper * 0.65) * banks * patches * (0.35 + fibers * 0.65);
          // Retain the sun disc and native shafts; temper only the broad sky wash.
          col -= uSunGlow * (pow(sd, 6.0) * 0.12 + pow(sd, 3.0) * 0.04) * sunVis * winterGoldenSky;
          vec3 dusk = mix(uTop, uCloudShade, 0.18) * vec3(0.76, 0.82, 1.0);
          col = mix(col, dusk, smoothstep(0.035, 0.35, y) * winterGoldenSky * 0.45);
          vec3 cloudColor = mix(uCloudShade, uCloudLit, 0.86 + fibers * 0.12);
          cloudColor = mix(cloudColor, uSunGlow, side * side * 0.24);
          col = mix(col, cloudColor, cloud * winterGoldenSky * 0.85 * (1.0 - dens * 0.65));
        }

        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim`);

  const start = core.indexOf('const terrain ='), end = core.indexOf('scene.add(terrain);', start);
  if (start < 0 || end < start) throw new Error('Winter Golden terrain shader not found');
  let terrain = core.slice(start, end);
  terrain = swap(terrain, '    varying float vDist; varying vec3 vW;', '    varying float vDist; varying vec3 vW; varying vec3 vWinterSlope;', 2);
  terrain = swap(terrain, 'vW = wp.xyz; vDist = distance(wp.xyz, cameraPosition);', 'vW = wp.xyz; vWinterSlope = normal; vDist = distance(wp.xyz, cameraPosition);');
  terrain = swap(terrain, '    uniform float uWinter; uniform vec3 uSnowColor;', '    uniform float uWinter, uGolden; uniform vec3 uSnowColor;');
  terrain = swap(terrain, '      col = mix(col, snow, uWinter);', `      float winterGoldenSnow = uWinter * uGolden;
      if (winterGoldenSnow > 0.0) {
        float slopeLight = smoothstep(0.03, 0.24, dot(normalize(vWinterSlope), uSunDir)) * shade;
        vec3 coolSnow = uSnowColor * vec3(0.53, 0.62, 0.90);
        vec3 warmSnow = mix(uSnowColor, uSunGlow, 0.13) * 0.98;
        snow = mix(snow, mix(coolSnow, warmSnow, slopeLight), winterGoldenSnow * 0.70);
      }
      col = mix(col, snow, uWinter);`);
  core = core.slice(0, start) + terrain + core.slice(end);
  // Existing effects are reset to their native values on every frame before
  // applying the local weight: no cached attenuation can leak into another phase.
  post = swap(post, '  grade.uniforms.uGlare.value = _lk.glare * facing;', `  grade.uniforms.uGlare.value = _lk.glare * facing;
  const winterGoldenLight = U.uWinter.value * U.uGolden.value;
  if (winterGoldenLight > 0) {
    shafts.uniforms.uStrength.value *= 1 - winterGoldenLight * 0.27;
    grade.uniforms.uGlare.value *= 1 - winterGoldenLight * 0.25;
  }`);
  return { core, post };
}

module.exports = { applyWinterGolden };
