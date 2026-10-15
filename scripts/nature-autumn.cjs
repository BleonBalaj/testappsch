// Static Autumn composition, evaluated once when the original scene is built.
// Independent arithmetic/RNG keeps Summer/Winter geometry and randomness intact.
const AUTUMN_MEADOW_COLORS = ['#9c7848', '#b59959', '#a09a60', '#c2a977', '#86503b'];
// Moonlit moss, olive and bronze keep the same spatial patches as daytime,
// with their own hues rather than a blue/grey multiplier over pale straw.
const AUTUMN_NIGHT_MEADOW_COLORS = ['#3d645d', '#637457', '#426271', '#8e705b', '#68464e'];
const AUTUMN_CANOPY_COLORS = ['#9f3f29', '#bb602c', '#d89535', '#e4b954', '#71352d'];
const AUTUMN_NIGHT_CANOPY_COLORS = ['#c57450', '#d88c59', '#e4ab67', '#f0ca88', '#8f514a'];

function autumnMeadow(x, z, seed, treeX, treeZ) {
  const patch = Math.max(0, Math.min(0.999999, .5 + .24 * Math.sin(x * .19 + Math.sin(z * .12) * 1.8) + .19 * Math.sin(z * .23 - x * .09)));
  // Short, irregular pockets expose fallen leaves, without flattening the meadow.
  const pool = (cx, cz, sx, sz) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));
  const carpet = Math.max(pool(treeX, treeZ + 3, 11, 9), pool(-4, 2, 3.8, 5), pool(9, -14, 6, 5));
  const band = patch * 4;
  return { color: Math.floor(band), next: Math.min(4, Math.floor(band) + 1), blend: band % 1, height: .94 - .88 * carpet, shade: .87 + seed * .23 };
}

function autumnCanopy(x, y, z, brightness) {
  // Broad red/copper/gold groups follow the crown's volume rather than random leaves.
  const warmth = .5 + .23 * Math.sin(x * .48 + z * .23) + .17 * Math.sin(y * .61 - z * .33);
  const top = Math.max(0, Math.min(1, (y - 6.5) / 5));
  const color = warmth < .31 ? 4 : warmth < .49 ? 0 : warmth < .67 ? 1 : 2;
  return { color: top > .64 && warmth > .47 ? 3 : color, shade: .53 + brightness * 1.65 };
}

function createAutumnLeafLayout(count, airborne, height, treeX, treeZ) {
  const offsets = new Float32Array(count * 3), seeds = new Float32Array(count), slopes = new Float32Array(count * 2);
  let state = airborne ? 913 : 617;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < count; i++) {
    let x, z;
    if (airborne) {
      z = 6 - random() * 68; x = (random() - .5) * (12 - z) * 1.2;
    } else {
      const area = random(), angle = random() * Math.PI * 2, radius = Math.pow(random(), .75);
      const center = area < .58 ? [treeX, treeZ + 3, 12, 10] : area < .82 ? [-4, 2, 4.2, 5.5] : [9, -14, 6.5, 5.5];
      x = center[0] + Math.cos(angle) * radius * center[2]; z = center[1] + Math.sin(angle) * radius * center[3];
    }
    offsets.set([x, height(x, z) + .045, z], i * 3); seeds[i] = random();
    slopes.set([(height(x + .1, z) - height(x - .1, z)) / .2, (height(x, z + .1) - height(x, z - .1)) / .2], i * 2);
  }
  return { offsets, seeds, slopes };
}

function createAutumnGroveLayout() {
  let state = 1387;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: 16 }, (_, i) => {
    const group = i < 8 ? [-55, -105] : [62, -123];
    return { x: group[0] + (random() - .5) * 24, z: group[1] + (random() - .5) * 25, scale: 1.5 + random() * .85, yaw: random() * Math.PI * 2, color: i % 5 };
  });
}

function createAutumnInsectLayout(mobile, height) {
  const day = mobile ? 8 : 16, moths = mobile ? 5 : 8;
  let state = 2189;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: day + moths }, (_, i) => {
    const moth = i >= day, z = 4 - random() * (moth ? 24 : 34), x = (random() - .5) * (12 - z) * .9;
    return { x, y: height(x, z) + .95 + random() * .75, z, seed: random(), size: (moth ? .075 : .115) + random() * .035, moth: moth ? 1 : 0, color: i % 3 };
  });
}

function createAutumnFlowerLayout(mobile, height, treeX, treeZ) {
  // Loose groups of two/three blooms leave visible space between flower heads.
  // One foreground group replaces the formerly overlapping pair of clusters.
  const centers = [[-4.5, 1], [8.4, -13], [10, -12], [treeX - 4, treeZ + 5], [treeX + 3, treeZ + 4]];
  let state = 2671;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return Array.from({ length: mobile ? 10 : 15 }, (_, i) => {
    const center = centers[i % centers.length], slot = Math.floor(i / centers.length);
    const spread = mobile ? (slot ? .65 : -.65) : slot - 1;
    const x = center[0] + spread + (random() - .5) * .16;
    const z = center[1] + (slot % 2 ? -.24 : .15) + (random() - .5) * .14;
    return { x, y: height(x, z), z, yaw: random() * Math.PI * 2, scale: .60 + random() * .30, color: i % 3 };
  });
}

function createAutumnFlowerShapes() {
  // Two shared, low-poly shapes. No Three object/UUID creation or layout RNG
  // here: later Summer/Winter particle placement keeps its exact random stream.
  const blossom = { positions: [], normals: [], petals: [] };
  const foliage = { positions: [], normals: [] };
  const triangle = (shape, a, b, c, petal = 1) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    for (const [index, point] of [a, b, c].entries()) {
      shape.positions.push(...point);
      shape.normals.push(nx / length, ny / length, nz / length);
      if (shape.petals) shape.petals.push(Array.isArray(petal) ? petal[index] : petal);
    }
  };
  const head = (x, y, z) => [x, .31 + y * Math.cos(.95) - z * Math.sin(.95), y * Math.sin(.95) + z * Math.cos(.95)];
  // Five staggered whorls form a full, rounded dahlia rather than a flat cap.
  // Every petal is a separate cupped surface with an inward-rolled, broad tip.
  // Shared geometry and baked fold tones keep this detail in one blossom draw.
  const rings = [
    { count: 14, root: .110, radius: .232, width: .062, base: -.038, tip: .035 },
    { count: 13, root: .076, radius: .193, width: .055, base: -.009, tip: .099 },
    { count: 10, root: .048, radius: .148, width: .047, base: .044, tip: .157 },
    { count: 7, root: .022, radius: .096, width: .036, base: .102, tip: .192 },
    { count: 5, root: .003, radius: .050, width: .026, base: .147, tip: .212 },
  ];
  rings.forEach((ring, layer) => {
    for (let petal = 0; petal < ring.count; petal++) {
      const angle = (petal + layer * .47) * Math.PI * 2 / ring.count, cos = Math.cos(angle), sin = Math.sin(angle);
      const point = (radius, width, y) => head(cos * radius - sin * width, y, sin * radius + cos * width);
      const length = ring.radius - ring.root, rise = ring.tip - ring.base;
      const root = point(ring.root, 0, ring.base);
      const bands = [[.40, .20, 1], [.84, .65, .88], [.92, 1, .50]].map(([r, y, width]) =>
        [-1, 0, 1].map(side => point(ring.root + length * r, ring.width * width * side,
          ring.base + rise * y + Math.abs(side) * .015)));
      const tip = point(ring.root + length * .85, 0, ring.tip + .010);
      const start = blossom.positions.length;
      for (let side = 0; side < 2; side++) {
        triangle(blossom, root, bands[0][side + 1], bands[0][side], [.12, side === 0 ? .38 : .98, side === 0 ? .98 : .38]);
        for (let band = 0; band < 2; band++) {
          const tones = band === 0 ? [.98, .38, .98] : [1, .44, 1];
          triangle(blossom, bands[band][side], bands[band][side + 1], bands[band + 1][side], [tones[side], tones[side + 1], tones[side]]);
          triangle(blossom, bands[band][side + 1], bands[band + 1][side + 1], bands[band + 1][side], [tones[side + 1], tones[side + 1], tones[side]]);
        }
        triangle(blossom, bands[2][side], bands[2][side + 1], tip, [side === 0 ? 1 : .60, side === 0 ? .60 : 1, .94]);
      }
      // Smooth only within this petal: neighboring whorls retain their creases.
      // Preparation happens once, with no new objects or per-frame work.
      const normals = new Map();
      for (let i = start; i < blossom.positions.length; i += 3) {
        const key = blossom.positions.slice(i, i + 3).join(','), sum = normals.get(key) || [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) sum[axis] += blossom.normals[i + axis];
        normals.set(key, sum);
      }
      for (let i = start; i < blossom.positions.length; i += 3) {
        const normal = normals.get(blossom.positions.slice(i, i + 3).join(',')), length = Math.hypot(...normal);
        for (let axis = 0; axis < 3; axis++) blossom.normals[i + axis] = normal[axis] / length;
      }
    }
  });
  // The center stays a tiny, closed wine-colored bud between the inner petals.
  for (let segment = 0; segment < 8; segment++) {
    const angle = segment * Math.PI * 2 / 8, next = (segment + 1) * Math.PI * 2 / 8;
    triangle(blossom, head(.012 * Math.cos(angle), .205, .012 * Math.sin(angle)),
      head(0, .220, 0), head(.012 * Math.cos(next), .205, .012 * Math.sin(next)), .48);
  }
  const stem = (top, segment) => {
    const angle = segment * Math.PI * 2 / 5, radius = top ? .009 : .014;
    return [Math.cos(angle) * radius, top ? .31 : 0, Math.sin(angle) * radius];
  };
  for (let segment = 0; segment < 5; segment++) {
    triangle(foliage, stem(false, segment), stem(false, segment + 1), stem(true, segment));
    triangle(foliage, stem(true, segment), stem(false, segment + 1), stem(true, segment + 1));
    triangle(foliage, [0, 0, 0], stem(false, segment + 1), stem(false, segment));
    triangle(foliage, [0, .31, 0], stem(true, segment), stem(true, segment + 1));
  }
  for (const [side, y] of [[-1, .09], [1, .17]]) {
    const points = [[0, y, 0], [side * .08, y + .035, .042], [side * .16, y + .07, 0], [side * .08, y + .035, -.042]];
    const ridge = [side * .075, y + .05, 0];
    for (let edge = 0; edge < 4; edge++) {
      const next = (edge + 1) % 4;
      triangle(foliage, points[side > 0 ? next : edge], ridge, points[side > 0 ? edge : next]);
    }
  }
  return { blossom, foliage };
}

module.exports = { AUTUMN_MEADOW_COLORS, AUTUMN_NIGHT_MEADOW_COLORS, AUTUMN_CANOPY_COLORS, AUTUMN_NIGHT_CANOPY_COLORS, autumnMeadow, autumnCanopy, createAutumnLeafLayout, createAutumnGroveLayout, createAutumnInsectLayout, createAutumnFlowerLayout, createAutumnFlowerShapes };
