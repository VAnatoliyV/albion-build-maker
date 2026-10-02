export const SLOTS = ['head', 'armor', 'shoes', 'mainhand', 'offhand', 'cape', 'bag', 'mount', 'food', 'potion'];
const VERSION = 1;

export const emptyBuild = () => ({ name: '', slots: {} });

const clampInt = (x, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(x) || 0)));

function toB64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export function encode(build) {
  const s = {};
  for (const k of SLOTS) {
    const x = build.slots[k];
    if (x) s[k] = [x.id, x.tier, x.ench, x.quality, x.sp ?? {}];
  }
  return toB64url(JSON.stringify({ v: VERSION, n: build.name ?? '', s }));
}

export function decode(str) {
  try {
    const o = JSON.parse(fromB64url(str));
    if (o?.v !== VERSION || typeof o.s !== 'object') return null;
    const build = { name: typeof o.n === 'string' ? o.n.slice(0, 80) : '', slots: {} };
    for (const k of SLOTS) {
      const x = o.s[k];
      if (!Array.isArray(x) || typeof x[0] !== 'string') continue;
      const sp = {};
      if (x[4] && typeof x[4] === 'object')
        for (const [key, v] of Object.entries(x[4])) if (typeof v === 'string') sp[key] = v;
      build.slots[k] = { id: x[0], tier: clampInt(x[1], 1, 8), ench: clampInt(x[2], 0, 4), quality: clampInt(x[3], 1, 5), sp };
    }
    return build;
  } catch {
    return null;
  }
}

export function defaultSpells(item) {
  const sp = {};
  for (const [k, list] of Object.entries(item.sp)) if (list.length) sp[k] = list[0];
  return sp;
}

const nearest = (tiers, t) => tiers.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), tiers[0]);

export function sanitize(build, itemsById) {
  let dropped = 0;
  const out = { name: build.name, slots: {} };
  for (const k of SLOTS) {
    const x = build.slots[k];
    if (!x) continue;
    const item = itemsById.get(x.id);
    if (!item || item.slot !== k) { dropped++; continue; }
    let broken = false;
    const sp = {};
    for (const [key, list] of Object.entries(item.sp)) {
      if (!list.length) continue;
      if (list.includes(x.sp[key])) sp[key] = x.sp[key];
      else { sp[key] = list[0]; if (x.sp[key] !== undefined) broken = true; }
    }
    if (broken) dropped++;
    const quality = k === 'food' || k === 'potion' ? 1 : x.quality;
    out.slots[k] = { id: x.id, tier: nearest(item.tiers, x.tier), ench: Math.min(x.ench, item.ench), quality, sp };
  }
  const main = out.slots.mainhand && itemsById.get(out.slots.mainhand.id);
  if (main?.two) delete out.slots.offhand;
  return { build: out, dropped };
}

export const iconOf = (id, tier, ench = 0) => `icons/items/T${tier}_${id}${ench ? '@' + ench : ''}.webp`;
export const qualityOf = (ench, quality) => (quality > 1 ? `icons/quality/e${ench}_q${quality}.png` : null);
