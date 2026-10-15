// Winter only: a visible, gentle snowfall. Nothing else in the Winter scene changes.
// Inlined by build-nature-scene.cjs after the Summer Morning scenery.
//
// The original flakes all fell 20-60 units away (sub-pixel) and were capped
// at light grey, so they vanished against the pale sky and snow. Flakes now
// fall at every depth, each inside the slice of air the camera actually sees
// at its distance, and carry a soft grey-blue rim so they read against white.

function applyWinterSnowfall(core, post, swap) {
  core = swap(core, 'const count = isMobile ? 180 : 340, positions = new Float32Array(count * 3), seeds = new Float32Array(count);',
    'const count = isMobile ? 260 : 520, positions = new Float32Array(count * 3), seeds = new Float32Array(count), spans = new Float32Array(count * 2);');
  core = swap(core, 'positions.set([(random() - 0.5) * 65, random() * 18, z], i * 3);',
    'const d = 2.5 + Math.pow(random(), 1.5) * 55, zz = 12 - d, base = Math.max(0, 1.9 - d * 0.32), span = d * 0.9 + 1.5; positions.set([(random() - 0.5) * d * 1.8, base + random() * span, zz], i * 3); spans.set([base, span], i * 2);');
  core = swap(core, "  snowGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));",
    "  snowGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));\n  snowGeometry.setAttribute('aSpan', new THREE.Float32BufferAttribute(spans, 2));");
  core = swap(core, 'uniform float uTime, uPx; attribute float aSeed; varying float vA;\n    void main() {\n      vec3 p = position;\n      p.y = mod(p.y - uTime * (0.30 + aSeed * 0.35) + 10000.0, 18.0);',
    'uniform float uTime, uPx; attribute float aSeed; attribute vec2 aSpan; varying float vA;\n    void main() {\n      vec3 p = position;\n      p.y = aSpan.x + mod(p.y - aSpan.x - uTime * (0.30 + aSeed * 0.35) + 10000.0, aSpan.y);');
  core = swap(core, 'vA = smoothstep(2.0, 5.0, depth) * (0.25 + aSeed * 0.45);', 'vA = smoothstep(1.5, 3.5, depth) * (0.65 + aSeed * 0.35);');
  core = swap(core, 'gl_PointSize = uPx * min(2.6, (12.0 + aSeed * 15.0) / depth);', 'gl_PointSize = uPx * clamp((34.0 + aSeed * 40.0) / depth, 1.5, 8.0);');
  core = swap(core, 'gl_FragColor = vec4(min(vec3(0.85), uSnowColor), (1.0 - smoothstep(0.25, 1.0, r)) * vA * uWinter);',
    // same snow colour as the ground in every phase (moonlit blue at night), soft edges
    'gl_FragColor = vec4(uSnowColor * 0.94, (1.0 - smoothstep(0.0, 1.0, r)) * vA * uWinter);');
  return { core, post };
}

module.exports = { applyWinterSnowfall };
