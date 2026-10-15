// Small Winter Morning sky details in the existing dome shader. Shared clock,
// no geometry, textures, post passes, layout randomness or new frame callbacks.
function applyWinterMorningSky(core, post, swap) {
  core = swap(core, '        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim', `        // Winter Morning: wind-combed cirrus above a softly lit, clear horizon.
        // A uniform branch leaves every other settled season/phase untouched.
        float winterMorningSky = uWinter * uMorning;
        if (winterMorningSky > 0.0 && y > 0.0) {
          float wa = atan(d.x, -d.z);
          float drift = uTime * 0.0025;
          float feather = n2(vec2(wa * 7.0 + drift, y * 12.0 + 3.0));
          float height = y + 0.020 * sin(wa * 3.1 + 0.4) + (feather - 0.5) * 0.022;
          float veilA = exp(-pow((height - 0.14) / 0.017, 2.0));
          float veilB = exp(-pow((height - 0.25) / 0.026, 2.0));
          float bankA = exp(-pow((wa + 0.52 - drift) / 0.46, 2.0));
          float bankB = exp(-pow((wa - 0.70 - drift) / 0.55, 2.0));
          float patches = smoothstep(0.18, 0.68, n2(vec2(wa * 4.2 + drift, height * 7.0 + 6.0)));
          float fibers = n2(vec2(wa * 14.0 + height * 26.0 - drift, height * 110.0 - wa * 14.0));
          float wisps = (veilA * (bankA + bankB * 0.82) + veilB * bankA * 0.75) * patches * (0.28 + fibers * 0.72);
          float skyDepth = smoothstep(0.035, 0.30, y) * (1.0 - dens * 0.75);
          col = mix(col, uTop * vec3(0.67, 0.86, 1.04), skyDepth * winterMorningSky * 0.42);
          vec3 iceCloud = mix(uCloudShade, uCloudLit, 0.78 + fibers * 0.18);
          iceCloud = mix(iceCloud, uSunGlow, side * side * 0.16);
          col = mix(col, iceCloud, wisps * winterMorningSky * 0.72 * (1.0 - dens * 0.65));
          float dawn = exp(-pow((y - 0.055) / 0.068, 2.0));
          col = mix(col, mix(uHorizon, uSunGlow, 0.34), dawn * side * winterMorningSky * 0.24);
        }

        // sun disc with limb darkening: white-hot centre fading smoothly to a warm gold rim`);
  return { core, post };
}

module.exports = { applyWinterMorningSky };
