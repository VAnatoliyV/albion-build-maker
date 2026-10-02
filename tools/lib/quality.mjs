// Рамка качества: пиксели, которые меняются от качества 1 к качеству N у большинства эталонных вещей.
// Значение — медиана по тем эталонам, где пиксель изменился, так чужой рисунок не попадает в рамку.
const THRESHOLD = 12;

export function buildOverlay(base, withQuality) {
  const n = base.length, out = new Uint8Array(base[0].length);
  for (let p = 0; p < out.length; p += 4) {
    const on = [];
    for (let k = 0; k < n; k++) {
      const a = base[k], b = withQuality[k];
      const d = Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]) + Math.abs(a[p + 3] - b[p + 3]);
      if (d > THRESHOLD) on.push(b);
    }
    if (on.length * 2 <= n) continue;
    for (let ch = 0; ch < 4; ch++) {
      const v = on.map(d => d[p + ch]).sort((x, y) => x - y);
      out[p + ch] = v[v.length >> 1];
    }
  }
  return out;
}
