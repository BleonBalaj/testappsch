// Summer meadow flowers painted as real little blooms instead of flat stars:
// tilted, foreshortened heads with separate overlapping petals, a textured eye
// and natural colours. Same instanced draw and attributes. Each flower switches
// to this path with the season weight (one by one during a season change), so a
// settled Autumn/Winter keeps its exact original flower shader path.
function applySummerFlowers(core, swap) {
  const start = core.indexOf('const flowers ='), end = core.indexOf('scene.add(flowers);', start);
  if (start < 0 || end < start) throw new Error('Summer flower shader missing');
  let flower = core.slice(start, end);
  flower = swap(flower, '    ${AIR}\n    void main(){\n      vec2 p = vUv - 0.5;', `    \${AIR}
    // One obovate petal k of n around the eye: x > 0 inside, y along (0 base,
    // 1 tip), z across (-1..1 edge to edge), w a per-petal random.
    vec4 summerPetal(vec2 q, float k, float n, float offset, float core, float width, float seed) {
      float th = (k + 0.5 - offset) / n * 6.2831853;
      vec2 dir = vec2(cos(th), sin(th));
      float u = dot(q, dir), v = dot(q, vec2(-dir.y, dir.x));
      float h = fract(sin(k * 12.9898 + seed * 78.233) * 43758.5453);
      float base = core * 0.55, tip = 0.97 - 0.13 * h;
      float t = (u - base) / (tip - base);
      float w = width * (tip - base) * pow(clamp(t, 0.0, 1.0), 0.35) * sqrt(max(1.0 - t * t, 0.0));
      return vec4(w - abs(v), t, v / max(w, 1e-4), h);
    }
    void main(){
      vec2 p = vUv - 0.5;
      // Screen size of the head, taken before any branch (derivatives stay defined).
      float summerPixel = fwidth(length(p) * 2.0);
      if (fract(vRand * 61.7) < uSummer) {
        float seedA = fract(vRand * 17.31), seedB = fract(vRand * 5.77), seedC = fract(vRand * 41.13);
        // A head tilted toward the sky, seen from eye height: turned and foreshortened.
        float tilt = (seedA - 0.5) * 1.2;
        vec2 q = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p * 2.0;
        q.y /= 0.48 + 0.40 * seedB;
        float r = length(q), ang = atan(q.y, q.x);
        float lum = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        bool daisy = min(vColor.r, min(vColor.g, vColor.b)) > 0.8;
        bool cup = !daisy && vColor.r > 0.9 && vColor.b < 0.2;
        float n = daisy ? 13.0 : (seedC > 0.5 ? 5.0 : 6.0);
        float core = daisy ? 0.27 : 0.18;
        float width = daisy ? 0.12 : (cup ? 0.60 : 0.48);
        // Small distant heads keep a simple, solid silhouette that cannot shimmer.
        float detail = step(summerPixel / (0.48 + 0.40 * seedB), daisy ? 0.06 : 0.11);
        float sector = ang / 6.2831853 * n + seedA * 7.0;
        float k0 = floor(sector), k1 = fract(sector) < 0.5 ? k0 - 1.0 : k0 + 1.0;
        vec4 p0 = summerPetal(q, k0, n, seedA * 7.0, core, width, seedC);
        vec4 p1 = summerPetal(q, k1, n, seedA * 7.0, core, width, seedC);
        // Neighbouring petals overlap; the upper one casts a soft shadow on the lower.
        bool upper1 = p1.w > p0.w;
        vec4 leaf = (p1.x > 0.0 && (p0.x <= 0.0 || upper1)) ? p1 : p0;
        vec4 other = (p1.x > 0.0 && (p0.x <= 0.0 || upper1)) ? p0 : p1;
        float shadow = (other.w > leaf.w && other.x < 0.0) ? 1.0 - 0.36 * smoothstep(-0.07, 0.0, other.x) : 1.0;
        bool inside = detail > 0.5 ? (leaf.x > 0.0 || r < core) : r < (daisy ? 0.90 : 0.80 + 0.20 * cos(n * ang + seedA * 6.28));
        if (!inside) discard;
        float t = detail > 0.5 ? clamp(leaf.y, 0.0, 1.0) : smoothstep(core, 1.0, r);
        float s = detail > 0.5 ? leaf.z : 0.0;
        // Natural, less sticker-bright colour; daisies are cream, not paper white.
        // Buttercups keep their full, glossy gold, a little deeper.
        vec3 tint = daisy ? vec3(0.93, 0.91, 0.84) : cup ? vColor * vec3(0.92, 0.82, 0.80) : mix(vec3(lum), vColor, 0.80);
        tint *= 0.90 + 0.16 * seedB;
        vec3 col = tint * (0.90 + 0.18 * leaf.w * detail);
        // Petal modelling only where it is resolvable; tiny far heads stay clear speckles of colour.
        col *= mix(1.0, mix(cup ? 0.42 : 0.60, 1.0, smoothstep(0.0, 0.45, t)), detail); // deep, saturated petal base
        col = mix(col, col * 1.06 + 0.035, smoothstep(0.55, 1.0, t) * 0.6);       // paler, light-catching tip
        col *= 1.0 - 0.11 * exp(-s * s * 30.0) * smoothstep(0.15, 0.6, t) * detail; // central crease
        col *= 1.0 - (cup ? 0.26 : 0.16) * smoothstep(0.70, 1.0, abs(s));         // petal edge
        col *= shadow * (1.0 + 0.10 * clamp(q.y / max(r, 1e-3), -1.0, 1.0));      // far side of the cup is brighter
        if (cup) col += vec3(0.11, 0.10, 0.05) * exp(-pow((t - 0.55) / 0.13, 2.0)) * exp(-s * s * 7.0) * detail;
        col *= mix(1.0, mix(0.70, 1.0, smoothstep(core, core + 0.16, r)), detail); // shade around the eye
        if (r < core) {
          // The eye: packed florets/stamens with a darker rim and a lighter crown.
          vec3 eye = daisy ? vec3(0.92, 0.58, 0.07) : cup ? vec3(0.62, 0.55, 0.12) : mix(vec3(0.90, 0.72, 0.20), vColor * 0.45, 0.40);
          float grain = fract(sin(dot(floor(q * 30.0), vec2(12.9898, 78.233))) * 43758.5453);
          eye *= 0.72 + 0.40 * grain * detail;
          eye *= mix(0.55, 1.08, smoothstep(core, core * 0.35, r));
          col = eye;
        }
        col *= (uAmbient + uLight * 0.85);
        // Low sun shining through the petals (Golden).
        col += uSunGlow * tint * smoothstep(0.55, 1.0, t) * step(core, r) * pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 3.0) * 0.55 * uGolden;
        float glow = uNight * (1.0 - uWinter) * (1.0 - uAutumn) * vWhite * (0.75 + 0.25 * sin(uTime * 2.0 + vRand * 40.0));
        col = mix(col, vec3(0.9, 1.0, 0.96) * 1.5, glow * 0.9);
        col = mix(applyAir(col, vW, vDist), col, glow * 0.5);
        gl_FragColor = vec4(col, 1.0);
        \${colorOut}
        return;
      }`);
  return core.slice(0, start) + flower + core.slice(end);
}

module.exports = { applySummerFlowers };
