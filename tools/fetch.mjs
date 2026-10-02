import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { arr, spellListOf, groupSpells, tierAffixes, stripTier, slotOf } from './lib/build.mjs';

const run = promisify(execFile);
const DUMPS = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/';
const RENDER = 'https://render.albiononline.com/v1/';
const EQUIP = new Set(['head', 'armor', 'shoes', 'mainhand', 'offhand', 'cape', 'bag']);
const exists = p => access(p).then(() => true, () => false);

// По умолчанию дампы качаются заново; --cached берёт уже скачанные из .cache/.
const CACHED = process.argv.includes('--cached');

async function dump(name) {
  const file = `.cache/${name.replace(/\//g, '_')}`;
  if (!CACHED || !(await exists(file))) {
    await mkdir('.cache', { recursive: true });
    const r = await fetch(DUMPS + name);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

async function icon(url, out, size) {
  if (await exists(out)) return true;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${url}?size=${size}&quality=1`).catch(() => null);
    if (r?.status === 404) return false;
    if (!r?.ok) { await new Promise(s => setTimeout(s, 1000 * (i + 1))); continue; }
    const tmp = out + '.png';
    await writeFile(tmp, Buffer.from(await r.arrayBuffer()));
    await run('cwebp', ['-quiet', '-q', '82', '-alpha_q', '90', tmp, '-o', out]);
    await unlink(tmp);
    return true;
  }
  return false;
}

async function pool(tasks, n) {
  let i = 0, bad = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) { const t = tasks[i++]; if (!(await t.go())) bad.push(t.name); }
  }));
  return bad;
}

const raw = (await dump('items.json')).items;
const spellsRaw = (await dump('spells.json')).spells;
const formatted = await dump('formatted/items.json');

const byId = new Map();
const sections = ['weapon', 'equipmentitem', 'mount', 'consumableitem'];
for (const sec of Object.keys(raw)) for (const it of arr(raw[sec])) if (it?.['@uniquename']) byId.set(it['@uniquename'], it);

const kinds = new Map();
const nameTag = new Map();
for (const [sec, kind] of [['activespell', 'active'], ['togglespell', 'active'], ['passivespell', 'passive']])
  for (const s of arr(spellsRaw[sec])) {
    kinds.set(s['@uniquename'], kind);
    nameTag.set(s['@uniquename'], s['@namelocatag'] ?? `@SPELLS_${s['@uniquename']}`);
  }

const names = new Map(formatted.filter(f => f.LocalizedNames).map(f => [f.UniqueName, f.LocalizedNames]));

const groups = new Map();
for (const sec of sections) for (const it of arr(raw[sec])) {
  const m = /^T(\d)_(.+)$/.exec(it['@uniquename'] ?? '');
  const slot = slotOf(it, sec);
  if (!m || !slot || !names.get(it['@uniquename'])?.['EN-US']) continue;
  const tier = +m[1];
  if (EQUIP.has(slot) && tier < 4) continue;
  const key = m[2];
  if (!groups.has(key)) groups.set(key, { slot, members: [] });
  groups.get(key).members.push({ tier, it });
}

const ORDER = ['q', 'w', 'e', 'a', 'p'];
const canon = g => Object.fromEntries(ORDER.filter(k => g[k]).map(k => [k, g[k]]));
const REF = '2H_TOOL_PICK';
const affixes = {};
for (const L of Object.keys(names.get(`T4_${REF}`))) {
  const ref = {};
  for (let t = 1; t <= 8; t++) ref[t] = names.get(`T${t}_${REF}`)[L];
  affixes[L] = tierAffixes(ref);
}
const items = [];
const usedSpells = new Set();
let spellMismatch = 0;
for (const [id, g] of groups) {
  g.members.sort((a, b) => a.tier - b.tier);
  const first = g.members[0].it;
  const langs = Object.keys(names.get(first['@uniquename']));
  const n = {};
  for (const L of langs) {
    const byTier = {};
    for (const m of g.members) { const x = names.get(m.it['@uniquename'])?.[L]; if (x) byTier[m.tier] = x; }
    n[L] = stripTier(byTier, affixes[L] ?? {});
  }
  const sp = canon(groupSpells(spellListOf(byId, first['@uniquename']), g.slot, kinds));
  for (const m of g.members.slice(1)) {
    const other = canon(groupSpells(spellListOf(byId, m.it['@uniquename']), g.slot, kinds));
    const key = g2 => JSON.stringify(Object.fromEntries(Object.entries(g2).map(([k, v]) => [k, [...v].sort()])));
    if (key(other) !== key(sp)) { spellMismatch++; if (!m.it["@uniquename"].includes("_TOOL_")) console.log(`  навыки различаются: ${m.it["@uniquename"]}`); }
  }
  Object.values(sp).flat().forEach(s => usedSpells.add(s));
  items.push({
    id, slot: g.slot, cat: first['@shopsubcategory1'] ?? 'other', two: first['@twohanded'] === 'true',
    tiers: g.members.map(m => m.tier), ench: arr(first.enchantments?.enchantment).length,
    n, sp, srcs: g.members.map(m => m.it['@uniquename']),
  });
}

const neededTags = new Set([...usedSpells].map(s => nameTag.get(s)));
const cats = [...new Set(items.map(i => i.cat))];
for (const c of cats) neededTags.add(`@MARKETPLACEGUI_ROLLOUT_SHOPSUBCATEGORY_${c.toUpperCase()}`);
const loc = new Map();
for (const tu of (await dump('localization.json')).tmx.body.tu) {
  if (!neededTags.has(tu['@tuid'])) continue;
  const o = {};
  for (const v of arr(tu.tuv)) if (v['@xml:lang'] === 'RU-RU' || v['@xml:lang'] === 'EN-US') o[v['@xml:lang']] = v.seg;
  loc.set(tu['@tuid'], o);
}

const spells = {};
for (const s of [...usedSpells].sort()) spells[s] = loc.get(nameTag.get(s)) ?? { 'EN-US': s };
const catNames = {};
for (const c of cats) catNames[c] = loc.get(`@MARKETPLACEGUI_ROLLOUT_SHOPSUBCATEGORY_${c.toUpperCase()}`) ?? { 'EN-US': c };

await mkdir('data', { recursive: true });
await mkdir('icons/items', { recursive: true });
await mkdir('icons/spells', { recursive: true });

const tierIcons = items.flatMap(i => i.srcs.map(src => ({ i, src })));
const enchIcons = items.flatMap(i => i.srcs.flatMap(src => Array.from({ length: i.ench }, (_, k) => `${src}@${k + 1}`)));
const gotIcon = new Set();
const missing = await pool([
  ...tierIcons.map(({ i, src }) => ({ name: src, go: async () => {
    const ok = await icon(`${RENDER}item/${src}.png`, `icons/items/${src}.webp`, 128);
    if (ok) gotIcon.add(src);
    return ok;
  } })),
  ...enchIcons.map(src => ({ name: src, go: () => icon(`${RENDER}item/${src}.png`, `icons/items/${src}.webp`, 128) })),
  ...[...usedSpells].map(s => ({ name: s, go: () => icon(`${RENDER}spell/${s}.png`, `icons/spells/${s}.webp`, 64) })),
], 8);
for (const i of items) i.tiers = i.tiers.filter((t, k) => gotIcon.has(i.srcs[k]));
const kept = items.filter(i => i.tiers.length);

const today = new Date().toISOString().slice(0, 10);
await writeFile('data/items.json', JSON.stringify({ v: today, cats: catNames, items: kept.map(({ srcs, ...i }) => i) }));
await writeFile('data/spells.json', JSON.stringify(spells));

console.log(`вещей ${kept.length} (без иконки выкинуто ${items.length - kept.length}), навыков ${usedSpells.size}, категорий ${cats.length}`);
console.log(`разные навыки у тиров одной вещи: ${spellMismatch}`);
console.log(`иконок не нашлось: ${missing.length}${missing.length ? ' — ' + missing.slice(0, 20).join(', ') : ''}`);
