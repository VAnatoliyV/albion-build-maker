# Albion Build Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статичный сайт-конструктор билдов Albion Online: слоты, вещь, тир, зачарование, качество, навыки, быстрый поиск, экспорт PNG и ссылка на билд.

**Architecture:** Node-скрипт `tools/fetch.mjs` один раз превращает ao-bin-dumps в компактные `data/*.json` и локальные WebP-иконки. Страница — ванильный HTML + ES-модули: чистые модули (`codec`, `search`) покрыты `node --test`, UI-модули (`app`, `picker`, `render`) проверяются в браузере. PNG рисуется на canvas из своих же иконок (CORS не нужен).

**Tech Stack:** HTML/CSS, ES modules, Canvas 2D, Node 26 (`node --test`, встроенный `fetch`), `cwebp` (Homebrew).

**Spec:** `docs/superpowers/specs/2026-10-02-albion-build-maker-design.md`

## Global Constraints

- Без фреймворков, без сборщика, без npm-зависимостей (рантайм и tools).
- Никаких запросов к render.albiononline.com из страницы — только при `fetch.mjs`.
- Языки интерфейса: ru, en. Названия в данных — все языки дампа.
- Коммиты без строки Co-Authored-By (правило пользователя), автор `VAnatoliyV <voroninsfamilyllc@gmail.com>`.
- localStorage только в try/catch, ключи с префиксом `abm_`.
- Тиры экипировки 4–8; маунты, еда, зелья — все тиры из дампа.
- Отступление от спеки: в ссылке навыки хранятся по коду (`CLAYMORECHARGE`), а не по индексу — переживает патчи, где меняется порядок списка. Спека правится в Task 1.

## Review Focus

1. Ссылка из старой версии данных (вещь удалили/переименовали, навык убрали) — билд открывается, битые слоты пустые, предупреждение. Тест: `sanitize` в Task 3.
2. Двуручное оружие при занятом втором оружии — второе снимается, и в ссылке тоже. Тест: `sanitize` в Task 3.
3. Поиск с «ё», заглавными, по-английски на русском интерфейсе и по коду — находит. Тест: Task 4.
4. Иконки нет (404 при сборке) — сайт и PNG не ломаются, рисуется заглушка. Проверка: Task 6, шаг с подменой пути.
5. Браузер без `ClipboardItem` (Firefox старый) — кнопка «Копировать картинку» скрыта, скачивание работает. Проверка: Task 6.

---

## Файлы

```
tools/lib/build.mjs   чистые функции: spellListOf, groupSpells, baseName, slotOf
tools/fetch.mjs       скачивание дампов, сборка data/, иконки
tools/check.mjs       проверка целостности data/ и icons/
js/codec.js           encode/decode/sanitize/defaultSpells, SLOTS
js/search.js          norm, buildIndex, search
js/i18n.js            строки ru/en, язык, nameOf
js/render.js          renderBuild(build, db, lang) -> canvas, toBlob
js/picker.js          окно выбора вещи
js/app.js             состояние, слоты, навыки, превью, кнопки
index.html, css/style.css
test/build.test.mjs, test/codec.test.mjs, test/search.test.mjs
```

---

### Task 1: Каркас и чистые функции сборки данных

**Files:**
- Create: `tools/lib/build.mjs`, `test/build.test.mjs`, `package.json`, `.gitignore`
- Modify: `docs/superpowers/specs/2026-10-02-albion-build-maker-design.md` (раздел «Ссылка»: «индексы навыков» → «коды навыков»)

**Interfaces:**
- Produces:
  - `arr(x) -> any[]` (null → [], объект → [объект])
  - `spellListOf(itemsById: Map<string, raw>, id: string) -> {name: string, slots: string|null}[]`
  - `groupSpells(list, slot: string, kinds: Map<string,'active'|'passive'>) -> {q?,w?,e?,a?,p?: string[]}`
  - `baseName(names: string[]) -> string`
  - `slotOf(raw, section: string) -> string|null` — одно из `SLOTS` codec.js

- [ ] **Step 1: package.json и .gitignore**

```json
{ "name": "albion-build-maker", "private": true, "type": "module",
  "scripts": { "test": "node --test test/", "fetch": "node tools/fetch.mjs", "check": "node tools/check.mjs" } }
```

`.gitignore`:
```
.cache/
.DS_Store
```

- [ ] **Step 2: Failing tests** — `test/build.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spellListOf, groupSpells, baseName, slotOf } from '../tools/lib/build.mjs';

const raw = (id, list, extra = {}) => ({ '@uniquename': id, craftingspelllist: list, ...extra });
const items = new Map([
  ['T4_MAIN_SWORD', raw('T4_MAIN_SWORD', { craftspell: [
    { '@uniquename': 'HEROICSTRIKE2', '@slots': '1' },
    { '@uniquename': 'SWORD_SPIN', '@slots': '2' },
    { '@uniquename': 'MIGHTYBLOW', '@slots': '3' },
    { '@uniquename': 'PASSIVE_BLEEDCHANCE' } ] })],
  ['T4_2H_CLAYMORE', raw('T4_2H_CLAYMORE', { '@reference': 'T4_MAIN_SWORD',
    removespell: { '@uniquename': 'MIGHTYBLOW' },
    craftspell: { '@uniquename': 'CLAYMORECHARGE', '@slots': '3' } })],
  ['T3_ARMOR_PLATE_SET1', raw('T3_ARMOR_PLATE_SET1', { craftspell: [
    { '@uniquename': 'TAUNT' }, { '@uniquename': 'PASSIVE_ARMOR_MR_AR', '@slots': '1' } ] })],
  ['T4_ARMOR_PLATE_SET1', raw('T4_ARMOR_PLATE_SET1', { '@reference': 'T3_ARMOR_PLATE_SET1' })],
  ['LOOP_A', raw('LOOP_A', { '@reference': 'LOOP_B' })],
  ['LOOP_B', raw('LOOP_B', { '@reference': 'LOOP_A' })],
]);
const kinds = new Map([['HEROICSTRIKE2','active'],['SWORD_SPIN','active'],['MIGHTYBLOW','active'],
  ['CLAYMORECHARGE','active'],['PASSIVE_BLEEDCHANCE','passive'],['TAUNT','active'],['PASSIVE_ARMOR_MR_AR','passive']]);

test('reference + removespell + craftspell', () => {
  const g = groupSpells(spellListOf(items, 'T4_2H_CLAYMORE'), 'mainhand', kinds);
  assert.deepEqual(g, { q: ['HEROICSTRIKE2'], w: ['SWORD_SPIN'], e: ['CLAYMORECHARGE'], p: ['PASSIVE_BLEEDCHANCE'] });
});

test('armor: active by kind, not by @slots', () => {
  const g = groupSpells(spellListOf(items, 'T4_ARMOR_PLATE_SET1'), 'armor', kinds);
  assert.deepEqual(g, { a: ['TAUNT'], p: ['PASSIVE_ARMOR_MR_AR'] });
});

test('reference loop does not hang', () => {
  assert.deepEqual(spellListOf(items, 'LOOP_A'), []);
});

test('unknown spell kind is skipped', () => {
  const g = groupSpells([{ name: 'NOPE', slots: '1' }], 'mainhand', kinds);
  assert.deepEqual(g, {});
});

test('baseName strips tier words', () => {
  assert.equal(baseName(["Adept's Claymore", "Expert's Claymore", "Master's Claymore", "Grandmaster's Claymore", "Elder's Claymore"]), 'Claymore');
  assert.equal(baseName(['Клеймор (знаток)', 'Клеймор (эксперт)', 'Клеймор (мастер)']), 'Клеймор');
  assert.equal(baseName(['Омлет']), 'Омлет');
});

test('slotOf', () => {
  assert.equal(slotOf({ '@slottype': 'mainhand' }, 'weapon'), 'mainhand');
  assert.equal(slotOf({ '@slottype': 'cape' }, 'equipmentitem'), 'cape');
  assert.equal(slotOf({}, 'mount'), 'mount');
  assert.equal(slotOf({ '@shopsubcategory1': 'food' }, 'consumableitem'), 'food');
  assert.equal(slotOf({ '@shopsubcategory1': 'potions' }, 'consumableitem'), 'potion');
  assert.equal(slotOf({ '@shopsubcategory1': 'fish' }, 'consumableitem'), null);
});
```

- [ ] **Step 3: Run** `npm test` → FAIL (module not found).

- [ ] **Step 4: Implement** `tools/lib/build.mjs`

```js
export const arr = x => (x == null ? [] : Array.isArray(x) ? x : [x]);

export function spellListOf(itemsById, id, seen = new Set()) {
  const it = itemsById.get(id);
  if (!it || seen.has(id)) return [];
  seen.add(id);
  const l = it.craftingspelllist;
  if (!l) return [];
  let list = l['@reference'] ? spellListOf(itemsById, l['@reference'], seen) : [];
  const removed = new Set(arr(l.removespell).map(s => s['@uniquename']));
  list = list.filter(s => !removed.has(s.name));
  for (const s of arr(l.craftspell)) {
    const name = s['@uniquename'];
    list = list.filter(x => x.name !== name);
    list.push({ name, slots: s['@slots'] ?? null });
  }
  return list;
}

const WEAPON_KEYS = { 1: 'q', 2: 'w', 3: 'e' };

export function groupSpells(list, slot, kinds) {
  const out = {};
  for (const { name, slots } of list) {
    const kind = kinds.get(name);
    if (!kind) continue;
    const key = kind === 'passive' ? 'p' : slot === 'mainhand' ? WEAPON_KEYS[slots] : 'a';
    if (!key) continue;
    (out[key] ??= []).push(name);
  }
  return out;
}

const lcp = ss => { let i = 0; while (ss.every(s => i < s.length && s[i] === ss[0][i])) i++; return ss[0].slice(0, i); };
const lcs = ss => { const r = ss.map(s => [...s].reverse().join('')); return [...lcp(r)].reverse().join(''); };
const tidy = s => s.replace(/^['’]s\s+/, '').replace(/^[\s(),.:'’-]+|[\s(),.:'’-]+$/g, '');

export function baseName(names) {
  if (names.length < 2) return names[0] ?? '';
  const a = tidy(lcp(names)), b = tidy(lcs(names));
  return (a.length >= b.length ? a : b) || names[0];
}

export function slotOf(raw, section) {
  if (section === 'weapon' || section === 'equipmentitem') return raw['@slottype'] ?? null;
  if (section === 'mount') return 'mount';
  if (section === 'consumableitem')
    return { food: 'food', potions: 'potion' }[raw['@shopsubcategory1']] ?? null;
  return null;
}
```

- [ ] **Step 5: Run** `npm test` → PASS (6 tests).

- [ ] **Step 6: Spec fix + commit**

В спеке в разделе «Ссылка» заменить «индексы навыков» на «коды навыков (переживают смену порядка в патче)».

```bash
git add -A && git commit -m "Чистые функции сборки данных из дампа"
```

---

### Task 2: fetch.mjs и check.mjs — данные и иконки

**Files:**
- Create: `tools/fetch.mjs`, `tools/check.mjs`
- Generated (коммитятся): `data/items.json`, `data/spells.json`, `icons/items/*.webp`, `icons/spells/*.webp`

**Interfaces:**
- Consumes: всё из `tools/lib/build.mjs`.
- Produces `data/items.json`:
  `{ v: "YYYY-MM-DD", cats: {code: {"RU-RU","EN-US"}}, items: [{ id, slot, cat, two, tiers: number[], ench: 0..4, n: {lang: name}, sp: {q?,w?,e?,a?,p?: string[]} }] }`
  Иконка вещи: `icons/items/${id}.webp`, `id` — uniquename без `T\d_`.
- Produces `data/spells.json`: `{ NAME: { "RU-RU": string, "EN-US": string } }`. Иконка: `icons/spells/${NAME}.webp`.

- [ ] **Step 1: Write** `tools/fetch.mjs`

```js
import { mkdir, readFile, writeFile, access, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { arr, spellListOf, groupSpells, baseName, slotOf } from './lib/build.mjs';

const run = promisify(execFile);
const DUMPS = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/';
const RENDER = 'https://render.albiononline.com/v1/';
const EQUIP = new Set(['head', 'armor', 'shoes', 'mainhand', 'offhand', 'cape', 'bag']);
const exists = p => access(p).then(() => true, () => false);

async function dump(name) {
  const file = `.cache/${name.replace(/\//g, '_')}`;
  if (!(await exists(file))) {
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

const items = [];
const usedSpells = new Set();
let spellMismatch = 0;
for (const [id, g] of groups) {
  g.members.sort((a, b) => a.tier - b.tier);
  const first = g.members[0].it;
  const langs = Object.keys(names.get(first['@uniquename']));
  const n = {};
  for (const L of langs) n[L] = baseName(g.members.map(m => names.get(m.it['@uniquename'])?.[L]).filter(Boolean));
  const sp = groupSpells(spellListOf(byId, first['@uniquename']), g.slot, kinds);
  for (const m of g.members.slice(1)) {
    const other = groupSpells(spellListOf(byId, m.it['@uniquename']), g.slot, kinds);
    if (JSON.stringify(other) !== JSON.stringify(sp)) spellMismatch++;
  }
  Object.values(sp).flat().forEach(s => usedSpells.add(s));
  items.push({
    id, slot: g.slot, cat: first['@shopsubcategory1'] ?? 'other', two: first['@twohanded'] === 'true',
    tiers: g.members.map(m => m.tier), ench: arr(first.enchantments?.enchantment).length,
    n, sp, src: first['@uniquename'],
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
const today = new Date().toISOString().slice(0, 10);
await writeFile('data/items.json', JSON.stringify({ v: today, cats: catNames, items: items.map(({ src, ...i }) => i) }));
await writeFile('data/spells.json', JSON.stringify(spells));

const missing = await pool([
  ...items.map(i => ({ name: i.src, go: () => icon(`${RENDER}item/${i.src}.png`, `icons/items/${i.id}.webp`, 128) })),
  ...[...usedSpells].map(s => ({ name: s, go: () => icon(`${RENDER}spell/${s}.png`, `icons/spells/${s}.webp`, 64) })),
], 8);

console.log(`вещей ${items.length}, навыков ${usedSpells.size}, категорий ${cats.length}`);
console.log(`разные навыки у тиров одной вещи: ${spellMismatch}`);
console.log(`иконок не нашлось: ${missing.length}${missing.length ? ' — ' + missing.slice(0, 20).join(', ') : ''}`);
```

- [ ] **Step 2: Run** `node tools/fetch.mjs` (первый раз долго: ~150 МБ дампов + ~2500 иконок).
Expected: вещей ~1000–1600, навыков ~800–1200, иконок не нашлось — единицы. Если `разные навыки у тиров` > 0 — посмотреть пару примеров и записать в отчёт; блокером не считается (берём младший тир).

- [ ] **Step 3: Write** `tools/check.mjs`

```js
import { readFile, access } from 'node:fs/promises';
const ok = p => access(p).then(() => true, () => false);
const db = JSON.parse(await readFile('data/items.json', 'utf8'));
const spells = JSON.parse(await readFile('data/spells.json', 'utf8'));
const errors = [], warns = [];
const ids = new Set();
const NEED = { mainhand: ['q', 'w', 'e', 'p'], armor: ['a', 'p'], head: ['a', 'p'], shoes: ['a', 'p'] };
for (const it of db.items) {
  if (ids.has(it.id)) errors.push(`дубль id ${it.id}`);
  ids.add(it.id);
  if (!(await ok(`icons/items/${it.id}.webp`))) warns.push(`нет иконки ${it.id}`);
  if (!it.n['EN-US']) errors.push(`нет имени ${it.id}`);
  for (const k of NEED[it.slot] ?? []) if (!it.sp[k]?.length) warns.push(`${it.id}: пусто ${k}`);
  for (const s of Object.values(it.sp).flat()) if (!spells[s]) errors.push(`${it.id}: навык ${s} не в spells.json`);
}
for (const s of Object.keys(spells)) if (!(await ok(`icons/spells/${s}.webp`))) warns.push(`нет иконки навыка ${s}`);
console.log(`вещей ${db.items.length}, навыков ${Object.keys(spells).length}, ошибок ${errors.length}, предупреждений ${warns.length}`);
warns.slice(0, 40).forEach(w => console.log('  ! ' + w));
errors.forEach(e => console.log('  ✗ ' + e));
process.exit(errors.length ? 1 : 0);
```

- [ ] **Step 4: Run** `node tools/check.mjs` → exit 0. Предупреждения «пусто q/w/e» допустимы только для экзотики (собирательские инструменты-оружие: `cat` fiber/ore/…); если их сотни у обычного оружия — баг в `groupSpells`, вернуться к Task 1.

- [ ] **Step 5: Spot-check** `node -e "const d=require('./data/items.json');const c=d.items.find(i=>i.id==='2H_CLAYMORE');console.log(c.n['RU-RU'],c.n['EN-US'],c.tiers,c.ench,c.sp)"`
Expected: `Клеймор Claymore [4..8] 4` и `e` содержит `CLAYMORECHARGE`, без `MIGHTYBLOW`. `du -sh icons` ≤ 40 МБ.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Сборка справочника вещей, навыков и иконок из ao-bin-dumps"
```

---

### Task 3: codec.js — ссылка, проверка билда

**Files:**
- Create: `js/codec.js`, `test/codec.test.mjs`

**Interfaces:**
- Produces:
  - `SLOTS = ['head','armor','shoes','mainhand','offhand','cape','bag','mount','food','potion']`
  - Билд: `{ name: string, slots: { [slot]: { id, tier, ench, quality, sp: {key: SPELLNAME} } } }`
  - `encode(build) -> string`, `decode(str) -> build|null`
  - `sanitize(build, itemsById: Map<string,item>) -> { build, dropped: number }`
  - `defaultSpells(item) -> {key: SPELLNAME}`
  - `emptyBuild() -> build`

- [ ] **Step 1: Failing tests** — `test/codec.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, sanitize, defaultSpells, emptyBuild } from '../js/codec.js';

const claymore = { id: '2H_CLAYMORE', slot: 'mainhand', two: true, tiers: [4,5,6,7,8], ench: 4,
  sp: { q: ['A', 'B'], w: ['C'], e: ['D'], p: ['P1', 'P2'] } };
const sword = { id: 'MAIN_SWORD', slot: 'mainhand', two: false, tiers: [4,5,6,7,8], ench: 4, sp: { q: ['A'], w: ['C'], e: ['X'], p: ['P1'] } };
const shield = { id: 'OFF_SHIELD', slot: 'offhand', two: false, tiers: [4,5,6,7,8], ench: 4, sp: {} };
const omelette = { id: 'MEAL_OMELETTE', slot: 'food', two: false, tiers: [3,5,7], ench: 3, sp: {} };
const db = new Map([claymore, sword, shield, omelette].map(i => [i.id, i]));

test('roundtrip with cyrillic name', () => {
  const b = { name: 'Ганк Клеймор ⚔', slots: { mainhand: { id: '2H_CLAYMORE', tier: 8, ench: 3, quality: 4, sp: { q: 'B', w: 'C', e: 'D', p: 'P2' } } } };
  const s = encode(b);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decode(s), b);
});

test('garbage and wrong version decode to null', () => {
  assert.equal(decode('%%%'), null);
  assert.equal(decode(''), null);
  const v2 = Buffer.from(JSON.stringify({ v: 2, n: '', s: {} })).toString('base64url');
  assert.equal(decode(v2), null);
});

test('decode clamps numbers and ignores unknown slots', () => {
  const s = Buffer.from(JSON.stringify({ v: 1, n: 'x', s: { mainhand: ['MAIN_SWORD', 99, -3, 9, {}], hat: ['X', 4, 0, 1, {}] } })).toString('base64url');
  assert.deepEqual(decode(s).slots, { mainhand: { id: 'MAIN_SWORD', tier: 8, ench: 0, quality: 5, sp: {} } });
});

test('sanitize: unknown item dropped, spells repaired, tier snapped', () => {
  const b = { name: '', slots: {
    head: { id: 'GONE', tier: 4, ench: 0, quality: 1, sp: {} },
    mainhand: { id: 'MAIN_SWORD', tier: 6, ench: 2, quality: 1, sp: { q: 'A', e: 'REMOVED_IN_PATCH', z: 'A' } },
    food: { id: 'MEAL_OMELETTE', tier: 6, ench: 4, quality: 3, sp: {} } } };
  const { build, dropped } = sanitize(b, db);
  assert.equal(dropped, 2);
  assert.equal(build.slots.head, undefined);
  assert.deepEqual(build.slots.mainhand.sp, { q: 'A', w: 'C', e: 'X', p: 'P1' });
  assert.equal(build.slots.food.tier, 5); // 6 равноудалён от 5 и 7 — берётся меньший
  assert.equal(build.slots.food.ench, 3);
});

test('sanitize: two-handed weapon removes offhand', () => {
  const b = { name: '', slots: {
    mainhand: { id: '2H_CLAYMORE', tier: 4, ench: 0, quality: 1, sp: defaultSpells(claymore) },
    offhand: { id: 'OFF_SHIELD', tier: 4, ench: 0, quality: 1, sp: {} } } };
  const { build } = sanitize(b, db);
  assert.equal(build.slots.offhand, undefined);
});

test('defaultSpells takes first of each list', () => {
  assert.deepEqual(defaultSpells(claymore), { q: 'A', w: 'C', e: 'D', p: 'P1' });
  assert.deepEqual(emptyBuild(), { name: '', slots: {} });
});
```

- [ ] **Step 2: Run** `npm test` → FAIL (codec.js not found).

- [ ] **Step 3: Implement** `js/codec.js`

```js
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
    out.slots[k] = { id: x.id, tier: nearest(item.tiers, x.tier), ench: Math.min(x.ench, item.ench), quality: x.quality, sp };
  }
  const main = out.slots.mainhand && itemsById.get(out.slots.mainhand.id);
  if (main?.two) delete out.slots.offhand;
  return { build: out, dropped };
}
```

Примечание к тесту `sanitize`: `dropped` = 2 — слот `head` (нет вещи) + слот `mainhand` (битый навык `e`); лишний ключ `z` молча отбрасывается, отсутствующий `w` молча заполняется. Тир 6 у омлета [3,5,7] равноудалён от 5 и 7; `reduce` со строгим `<` оставляет первый найденный — 5.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "Кодирование билда в ссылку и проверка по справочнику"`

---

### Task 4: search.js — поиск вещей

**Files:**
- Create: `js/search.js`, `test/search.test.mjs`

**Interfaces:**
- Produces: `norm(s) -> string`, `buildIndex(items) -> Entry[]`, `search(index, query, slot, cat?) -> item[]` (порядок по рангу, до 300).

- [ ] **Step 1: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, buildIndex, search } from '../js/search.js';

const items = [
  { id: '2H_CLAYMORE', slot: 'mainhand', cat: 'sword', n: { 'RU-RU': 'Клеймор', 'EN-US': 'Claymore', 'DE-DE': 'Claymore' } },
  { id: 'MAIN_SWORD', slot: 'mainhand', cat: 'sword', n: { 'RU-RU': 'Палаш', 'EN-US': 'Broadsword' } },
  { id: '2H_DUALSWORD', slot: 'mainhand', cat: 'sword', n: { 'RU-RU': 'Парные клинки', 'EN-US': 'Dual Swords' } },
  { id: 'HEAD_PLATE_SET1', slot: 'head', cat: 'plate_helmet', n: { 'RU-RU': 'Шлем солдата', 'EN-US': 'Soldier Helmet' } },
  { id: 'MEAL_STEW', slot: 'food', cat: 'food', n: { 'RU-RU': 'Тушёное мясо', 'EN-US': 'Beef Stew' } },
];
const idx = buildIndex(items);
const ids = r => r.map(i => i.id);

test('norm', () => {
  assert.equal(norm('  Тушёное  МЯСО! '), 'тушеное мясо');
  assert.equal(norm('Épée_longue'), 'epee longue');
});

test('slot filter and empty query', () => {
  assert.deepEqual(ids(search(idx, '', 'mainhand')), ['2H_CLAYMORE', 'MAIN_SWORD', '2H_DUALSWORD']);
});

test('russian prefix, case, ё', () => {
  assert.deepEqual(ids(search(idx, 'КЛЕЙ', 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, 'тушен', 'food')), ['MEAL_STEW']);
});

test('english on any UI, and by code', () => {
  assert.deepEqual(ids(search(idx, 'clay', 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, '2h clay', 'mainhand')), ['2H_CLAYMORE']);
});

test('ranking: name prefix > word prefix > substring', () => {
  assert.deepEqual(ids(search(idx, 'sword', 'mainhand')), ['MAIN_SWORD', '2H_DUALSWORD']);
  assert.deepEqual(ids(search(idx, 'клин', 'mainhand')), ['2H_DUALSWORD']);
});

test('category filter', () => {
  assert.deepEqual(ids(search(idx, '', 'head', 'plate_helmet')), ['HEAD_PLATE_SET1']);
  assert.deepEqual(ids(search(idx, '', 'head', 'cloth_helmet')), []);
});
```

Пояснение к ранжированию `sword`: `MAIN_SWORD` — код `main sword` содержит слово `sword` с начала слова (2), `Broadsword` — подстрока (1) → итог 2. `2H_DUALSWORD` — `Dual Swords` слово с начала (2), но код `2h dualsword` — подстрока. Оба 2 → порядок индекса (MAIN_SWORD раньше). Ожидание `['MAIN_SWORD','2H_DUALSWORD']` верно; Claymore не содержит `sword` → отсутствует.

- [ ] **Step 2: Run** `npm test` → FAIL.

- [ ] **Step 3: Implement** `js/search.js`

```js
export function norm(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function buildIndex(items) {
  return items.map(it => ({ it, keys: [...new Set([norm(it.id), ...Object.values(it.n).map(norm)])] }));
}

function score(keys, q, words) {
  let best = 0;
  for (const k of keys) {
    if (k.startsWith(q)) return 3;
    if ((' ' + k).includes(' ' + q)) best = Math.max(best, 2);
    else if (words.every(w => k.includes(w))) best = Math.max(best, 1);
  }
  return best;
}

export function search(index, query, slot, cat = null, limit = 300) {
  const q = norm(query);
  const words = q.split(' ');
  const out = [];
  index.forEach((e, i) => {
    if (e.it.slot !== slot || (cat && e.it.cat !== cat)) return;
    const s = q ? score(e.keys, q, words) : 1;
    if (s) out.push({ s, i, it: e.it });
  });
  out.sort((a, b) => b.s - a.s || a.i - b.i);
  return out.slice(0, limit).map(x => x.it);
}
```

Обратите внимание: «Палаш»/`Broadsword` для `sword` даст 2 только через код `main sword`; Step 1 это и проверяет.

- [ ] **Step 4: Run** `npm test` → PASS.

- [ ] **Step 5: Commit** `git add -A && git commit -m "Поиск вещей по всем языкам и коду"`

---

### Task 5: Страница — слоты, окно выбора, навыки, ссылка

**Files:**
- Create: `index.html`, `css/style.css`, `js/i18n.js`, `js/picker.js`, `js/app.js`

**Interfaces:**
- Consumes: `codec.js` (всё), `search.js` (`buildIndex`, `search`), `data/*.json`.
- Produces для Task 6: в `app.js` функция `onChange()` вызывает `window.dispatchEvent(new CustomEvent('abm:build', { detail: { build, db } }))`; `db = { items: Map, spells: object, cats: object }`; `i18n.js` экспортирует `lang()`, `t(key)`, `nameOf(nObj)`, `setLang(l)`, `LETTERS`.

- [ ] **Step 1: `js/i18n.js`**

```js
const S = {
  ru: { title: 'Конструктор билдов Albion', name: 'Название билда', search: 'Поиск: клеймор, claymore…',
    tier: 'Тир', ench: 'Зачарование', quality: 'Качество', clear: 'Убрать', close: 'Закрыть', all: 'Все',
    download: 'Скачать PNG', copyImg: 'Копировать картинку', copyLink: 'Копировать ссылку', copied: 'Скопировано',
    loadFail: 'Не удалось загрузить данные.', retry: 'Повторить', broken: 'Часть билда из ссылки устарела и была поправлена: ',
    empty: 'Ничего не найдено', q: ['Обычное', 'Хорошее', 'Выдающееся', 'Отличное', 'Шедевр'],
    slots: { head: 'Голова', armor: 'Броня', shoes: 'Обувь', mainhand: 'Оружие', offhand: 'Вторая рука', cape: 'Плащ', bag: 'Сумка', mount: 'Маунт', food: 'Еда', potion: 'Зелье' } },
  en: { title: 'Albion Build Maker', name: 'Build name', search: 'Search: claymore, клеймор…',
    tier: 'Tier', ench: 'Enchant', quality: 'Quality', clear: 'Remove', close: 'Close', all: 'All',
    download: 'Download PNG', copyImg: 'Copy image', copyLink: 'Copy link', copied: 'Copied',
    loadFail: 'Could not load data.', retry: 'Retry', broken: 'Part of the linked build was outdated and fixed: ',
    empty: 'Nothing found', q: ['Normal', 'Good', 'Outstanding', 'Excellent', 'Masterpiece'],
    slots: { head: 'Head', armor: 'Armor', shoes: 'Shoes', mainhand: 'Weapon', offhand: 'Off-hand', cape: 'Cape', bag: 'Bag', mount: 'Mount', food: 'Food', potion: 'Potion' } },
};
export const LETTERS = { mainhand: { q: 'Q', w: 'W', e: 'E' }, armor: { a: 'R' }, head: { a: 'D' }, shoes: { a: 'F' } };

let L = 'en';
try { L = localStorage.getItem('abm_lang') || ''; } catch {}
if (!S[L]) L = (navigator.languages || [navigator.language]).some(x => /^(ru|uk|be|kk)/i.test(x)) ? 'ru' : 'en';

export const lang = () => L;
export const t = k => S[L][k];
export const nameOf = n => (n && (n[L === 'ru' ? 'RU-RU' : 'EN-US'] || n['EN-US'])) || '';
export function setLang(l) { L = l; try { localStorage.setItem('abm_lang', l); } catch {} }
```

- [ ] **Step 2: `index.html`**

```html
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Albion Build Maker</title>
<meta name="description" content="Собери билд Albion Online: вещи, тир, зачарование, качество, навыки — и получи картинку для Discord.">
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<header>
  <h1 id="h1"></h1>
  <input id="name" maxlength="60" autocomplete="off">
  <select id="lang"><option value="ru">RU</option><option value="en">EN</option></select>
</header>
<div id="banner" hidden></div>
<main>
  <section id="slots"></section>
  <section id="spells"></section>
  <aside>
    <div id="preview"></div>
    <div class="actions">
      <button id="dl"></button><button id="copy"></button><button id="link"></button>
    </div>
  </aside>
</main>
<dialog id="picker">
  <div class="ph"><input id="q" autocomplete="off"><button id="pclose" aria-label="close">✕</button></div>
  <div id="cats"></div>
  <div id="list"></div>
  <div class="opts">
    <label><span data-t="tier"></span> <select id="tier"></select></label>
    <label><span data-t="ench"></span> <select id="ench"></select></label>
    <label id="qwrap"><span data-t="quality"></span> <select id="qual"></select></label>
    <button id="pclear"></button>
  </div>
</dialog>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: `css/style.css`**

```css
:root { --bg: #15120e; --panel: #201b15; --line: #3a3128; --text: #eadfcf; --dim: #9c8f7d; --acc: #e2b13c; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
header { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
h1 { font-size: 18px; margin: 0 auto 0 0; }
input, select, button { font: inherit; color: var(--text); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; }
button { cursor: pointer; } button:hover { border-color: var(--acc); }
#name { min-width: 0; flex: 1 1 220px; max-width: 360px; }
#banner { padding: 8px 16px; background: #4a2f12; }
main { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; padding: 16px; align-items: start; }
#slots { display: grid; grid-template-columns: repeat(3, 84px); gap: 8px; }
.slot { width: 84px; height: 84px; padding: 0; position: relative; background: var(--panel); border: 2px solid var(--line); border-radius: 8px; overflow: hidden; }
.slot img { width: 100%; height: 100%; display: block; }
.slot .lbl { position: absolute; inset: auto 0 4px; font-size: 11px; color: var(--dim); text-align: center; }
.slot .badge { position: absolute; left: 4px; top: 2px; font-size: 12px; font-weight: 700; text-shadow: 0 1px 2px #000; }
.slot.off { opacity: .35; pointer-events: none; }
#spells { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.srow { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.srow .key { width: 28px; color: var(--acc); font-weight: 700; text-align: center; }
.srow h3 { width: 100%; margin: 6px 0 0; font-size: 13px; color: var(--dim); font-weight: 500; }
.sp { width: 44px; height: 44px; padding: 0; border-radius: 50%; overflow: hidden; border: 2px solid transparent; background: #000; opacity: .45; }
.sp.on { opacity: 1; border-color: var(--acc); }
.sp img { width: 100%; height: 100%; }
#preview canvas { width: 100%; max-width: 560px; height: auto; display: block; border-radius: 8px; }
aside { width: min(560px, 100%); }
.actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
dialog { background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 10px; width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 48px); padding: 12px; }
dialog::backdrop { background: #000a; }
.ph { display: flex; gap: 8px; } #q { flex: 1; }
#cats { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
#cats button.on { border-color: var(--acc); color: var(--acc); }
#list { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; max-height: 50vh; overflow: auto; }
.it { display: flex; gap: 8px; align-items: center; text-align: left; padding: 4px; }
.it img { width: 40px; height: 40px; flex: none; }
.it.cur { border-color: var(--acc); }
.opts { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.e1 { color: #3fbf5f } .e2 { color: #3f8fdf } .e3 { color: #b37bff } .e4 { color: #e2b13c }
@media (max-width: 900px) { main { grid-template-columns: 1fr; } #slots { justify-content: center; } }
```

- [ ] **Step 4: `js/picker.js`**

```js
import { search } from './search.js';
import { t, nameOf } from './i18n.js';

const $ = id => document.getElementById(id);
const NO_QUALITY = new Set(['food', 'potion']);

export function openPicker({ slot, current, db, index, last, onPick, onUpdate, onClear }) {
  const dlg = $('picker');
  let cat = null;
  const slotItems = db.list.filter(i => i.slot === slot);
  const cats = [...new Set(slotItems.map(i => i.cat))];
  const tiers = [...new Set(slotItems.flatMap(i => i.tiers))].sort((a, b) => a - b);
  const curItem = current && db.items.get(current.id);

  const fill = (sel, values, label, value) => {
    sel.innerHTML = values.map(v => `<option value="${v}">${label(v)}</option>`).join('');
    sel.value = String(value);
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  fill($('tier'), curItem ? curItem.tiers : tiers, v => ROMAN[v], current?.tier ?? (tiers.includes(last.tier) ? last.tier : tiers.at(-1)));
  fill($('ench'), [0, 1, 2, 3, 4].slice(0, (curItem ? curItem.ench : 4) + 1), v => (v ? '.' + v : '—'), current?.ench ?? last.ench);
  fill($('qual'), [1, 2, 3, 4, 5], v => t('q')[v - 1], current?.quality ?? last.quality);
  $('qwrap').hidden = NO_QUALITY.has(slot);

  const opts = () => ({ tier: +$('tier').value, ench: +$('ench').value, quality: NO_QUALITY.has(slot) ? 1 : +$('qual').value });

  $('cats').innerHTML = cats.length > 1
    ? [`<button data-c="" class="on">${t('all')}</button>`, ...cats.map(c => `<button data-c="${c}">${nameOf(db.cats[c]) || c}</button>`)].join('')
    : '';
  const renderList = () => {
    const found = search(index, $('q').value, slot, cat);
    $('list').innerHTML = found.length
      ? found.map(i => `<button class="it${i.id === current?.id ? ' cur' : ''}" data-id="${i.id}"><img loading="lazy" src="icons/items/${i.id}.webp" alt=""><span>${nameOf(i.n)}</span></button>`).join('')
      : `<p>${t('empty')}</p>`;
  };

  $('q').value = '';
  $('q').placeholder = t('search');
  $('pclear').textContent = t('clear');
  dlg.querySelectorAll('[data-t]').forEach(el => (el.textContent = t(el.dataset.t)));

  const ctl = new AbortController();
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ctl.signal });
  on($('q'), 'input', renderList);
  on($('cats'), 'click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.c || null;
    $('cats').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderList();
  });
  on($('list'), 'click', e => {
    const b = e.target.closest('.it'); if (!b) return;
    onPick(db.items.get(b.dataset.id), opts());
    dlg.close();
  });
  for (const id of ['tier', 'ench', 'qual']) on($(id), 'change', () => onUpdate(opts()));
  on($('pclear'), 'click', () => { onClear(); dlg.close(); });
  on($('pclose'), 'click', () => dlg.close());
  on(dlg, 'close', () => ctl.abort());

  renderList();
  dlg.showModal();
  $('q').focus();
}
```

- [ ] **Step 5: `js/app.js`**

```js
import { SLOTS, encode, decode, sanitize, defaultSpells, emptyBuild } from './codec.js';
import { buildIndex } from './search.js';
import { t, lang, setLang, nameOf, LETTERS } from './i18n.js';
import { openPicker } from './picker.js';

const $ = id => document.getElementById(id);
const LAYOUT = ['bag', 'head', 'cape', 'mainhand', 'armor', 'offhand', 'potion', 'shoes', 'food', null, 'mount', null];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const QCOLOR = [null, null, '#8d8d8d', '#b0713a', '#c9d1d9', '#e2b13c'];
const SPELL_SLOTS = ['mainhand', 'armor', 'head', 'shoes', 'cape'];

let db, index, build = emptyBuild();
let last = { tier: 8, ench: 0, quality: 1 };
try { Object.assign(last, JSON.parse(localStorage.getItem('abm_last') || '{}')); } catch {}

async function load() {
  try {
    const [items, spells] = await Promise.all(['data/items.json', 'data/spells.json'].map(u => fetch(u).then(r => { if (!r.ok) throw r.status; return r.json(); })));
    db = { list: items.items, items: new Map(items.items.map(i => [i.id, i])), spells, cats: items.cats, v: items.v };
    index = buildIndex(db.list);
    $('banner').hidden = true;
    restore();
  } catch {
    $('banner').hidden = false;
    $('banner').innerHTML = `${t('loadFail')} <button id="retry">${t('retry')}</button>`;
    $('retry').onclick = load;
  }
}

function restore() {
  let raw = null;
  const m = /^#b=(.+)$/.exec(location.hash);
  if (m) raw = decode(m[1]);
  if (!raw) try { raw = decode(localStorage.getItem('abm_build') || ''); } catch {}
  const { build: b, dropped } = sanitize(raw ?? emptyBuild(), db.items);
  build = b;
  if (m && (!raw || dropped)) { $('banner').hidden = false; $('banner').textContent = t('broken') + (raw ? dropped : '—'); }
  render();
}

function onChange() {
  const code = encode(build);
  history.replaceState(null, '', '#b=' + code);
  try { localStorage.setItem('abm_build', code); } catch {}
  render();
}

function badge(x) {
  return `${ROMAN[x.tier]}${x.ench ? `<span class="e${x.ench}">.${x.ench}</span>` : ''}`;
}

function renderSlots() {
  const two = build.slots.mainhand && db.items.get(build.slots.mainhand.id)?.two;
  $('slots').innerHTML = LAYOUT.map(s => {
    if (!s) return '<span></span>';
    const x = build.slots[s];
    const off = s === 'offhand' && two;
    const border = x && QCOLOR[x.quality] ? ` style="border-color:${QCOLOR[x.quality]}"` : '';
    const title = x ? nameOf(db.items.get(x.id).n) : t('slots')[s];
    return `<button class="slot${off ? ' off' : ''}" data-s="${s}" title="${title}"${border}>` +
      (x ? `<img src="icons/items/${x.id}.webp" alt="${title}"><span class="badge">${badge(x)}</span>` : `<span class="lbl">${t('slots')[s]}</span>`) +
      '</button>';
  }).join('');
}

function renderSpells() {
  const rows = [];
  for (const s of SPELL_SLOTS) {
    const x = build.slots[s];
    if (!x) continue;
    const item = db.items.get(x.id);
    const keys = ['q', 'w', 'e', 'a', 'p'].filter(k => item.sp[k]?.length);
    if (!keys.length) continue;
    rows.push(`<div class="srow"><h3>${nameOf(item.n)}</h3></div>`);
    for (const k of keys)
      rows.push(`<div class="srow"><span class="key">${LETTERS[s]?.[k] ?? '◆'}</span>` +
        item.sp[k].map(n => `<button class="sp${x.sp[k] === n ? ' on' : ''}" data-s="${s}" data-k="${k}" data-n="${n}" title="${nameOf(db.spells[n])}"><img loading="lazy" src="icons/spells/${n}.webp" alt=""></button>`).join('') +
        '</div>');
  }
  $('spells').innerHTML = rows.join('');
}

function render() {
  document.documentElement.lang = lang();
  $('h1').textContent = t('title');
  $('name').placeholder = t('name');
  if ($('name').value !== build.name) $('name').value = build.name;
  $('lang').value = lang();
  $('dl').textContent = t('download');
  $('copy').textContent = t('copyImg');
  $('link').textContent = t('copyLink');
  renderSlots();
  renderSpells();
  window.dispatchEvent(new CustomEvent('abm:build', { detail: { build, db } }));
}

$('slots').addEventListener('click', e => {
  const b = e.target.closest('.slot'); if (!b) return;
  const slot = b.dataset.s;
  openPicker({
    slot, current: build.slots[slot], db, index, last,
    onPick(item, o) {
      const tier = item.tiers.includes(o.tier) ? o.tier : item.tiers.reduce((a, x) => (Math.abs(x - o.tier) < Math.abs(a - o.tier) ? x : a));
      build.slots[slot] = { id: item.id, tier, ench: Math.min(o.ench, item.ench), quality: o.quality, sp: defaultSpells(item) };
      if (slot === 'mainhand' && item.two) delete build.slots.offhand;
      last = o;
      try { localStorage.setItem('abm_last', JSON.stringify(o)); } catch {}
      onChange();
    },
    onUpdate(o) {
      const x = build.slots[slot]; if (!x) return;
      Object.assign(x, o);
      onChange();
    },
    onClear() { delete build.slots[slot]; onChange(); },
  });
});

$('spells').addEventListener('click', e => {
  const b = e.target.closest('.sp'); if (!b) return;
  build.slots[b.dataset.s].sp[b.dataset.k] = b.dataset.n;
  onChange();
});

$('name').addEventListener('input', () => { build.name = $('name').value; onChange(); });
$('lang').addEventListener('change', () => { setLang($('lang').value); render(); });
$('link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); $('link').textContent = t('copied'); } catch {}
});
window.addEventListener('hashchange', () => db && restore());

load();
```

- [ ] **Step 6: Проверка в браузере** (`python3 -m http.server 8765` в корне, Chrome через claude-in-chrome):
  1. Клик по «Оружие» → окно, ввести `клей` → Клеймор первым; выбрать → иконка в слоте, бейдж `VIII`, слот «Вторая рука» погашен.
  2. Справа ряды Q/W/E/◆, на E `CLAYMORECHARGE` (подсказка «Натиск»); клик по другому навыку подсвечивает его.
  3. Снова открыть «Оружие», поменять зачарование на .3 и качество на Шедевр → бейдж `VIII.3` фиолетовый, рамка золотая.
  4. Скопировать адрес → открыть в новой вкладке → тот же билд. Подменить в хэше код вещи на несуществующий → билд открывается без этого слота, жёлтая плашка.
  5. Переключить EN → подписи и названия на английском.
  6. Ширина 390px → одна колонка, нет горизонтальной прокрутки.
  7. `npm test` по-прежнему PASS.

- [ ] **Step 7: Commit** `git add -A && git commit -m "Страница конструктора: слоты, поиск, навыки, ссылка"`

---

### Task 6: render.js — картинка, скачать, копировать

**Files:**
- Create: `js/render.js`
- Modify: `js/app.js` (подключить превью и кнопки — в конец файла)

**Interfaces:**
- Consumes: событие `abm:build` `{ build, db }`; `i18n.js` (`t`, `nameOf`, `LETTERS`).
- Produces: `renderBuild(build, db) -> Promise<HTMLCanvasElement>`, `toBlob(canvas) -> Promise<Blob>`.

- [ ] **Step 1: `js/render.js`**

```js
import { t, nameOf, LETTERS } from './i18n.js';

const CELL = 84, GAP = 8, PAD = 20, TITLE = 52, FOOT = 26, SP = 34, SCALE = 2;
const GRID = [['bag', 'head', 'cape'], ['mainhand', 'armor', 'offhand'], ['potion', 'shoes', 'food'], [null, 'mount', null]];
const SPELL_ROWS = [['mainhand', ['q', 'w', 'e', 'p']], ['armor', ['a', 'p']], ['head', ['a', 'p']], ['shoes', ['a', 'p']], ['cape', ['p']]];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const QCOLOR = [null, null, '#8d8d8d', '#b0713a', '#c9d1d9', '#e2b13c'];
const ECOLOR = [null, '#3fbf5f', '#3f8fdf', '#b37bff', '#e2b13c'];
const SITE = location.host + location.pathname.replace(/index\.html$/, '');
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const cache = new Map();
function img(src) {
  if (!cache.has(src)) cache.set(src, new Promise(res => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  }));
  return cache.get(src);
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

function cell(ctx, x, y, slot, data, image) {
  rrect(ctx, x, y, CELL, CELL, 8);
  ctx.fillStyle = '#201b15'; ctx.fill();
  ctx.lineWidth = data && QCOLOR[data.quality] ? 3 : 1.5;
  ctx.strokeStyle = (data && QCOLOR[data.quality]) || '#3a3128'; ctx.stroke();
  if (!data) {
    ctx.fillStyle = '#5c5246'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(t('slots')[slot], x + CELL / 2, y + CELL - 8);
    return;
  }
  if (image) ctx.drawImage(image, x + 3, y + 3, CELL - 6, CELL - 6);
  else { ctx.fillStyle = '#5c5246'; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(data.id.slice(0, 12), x + CELL / 2, y + CELL / 2); }
  ctx.textAlign = 'left'; ctx.font = `bold 13px ${FONT}`;
  ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  const tier = ROMAN[data.tier];
  ctx.fillStyle = '#eadfcf'; ctx.fillText(tier, x + 6, y + 17);
  if (data.ench) { ctx.fillStyle = ECOLOR[data.ench]; ctx.fillText('.' + data.ench, x + 6 + ctx.measureText(tier).width, y + 17); }
  ctx.shadowBlur = 0;
}

export async function renderBuild(build, db) {
  const rows = SPELL_ROWS.map(([s, keys]) => {
    const x = build.slots[s];
    return x ? { s, x, keys: keys.filter(k => x.sp[k]) } : null;
  }).filter(r => r?.keys.length);
  const gridW = 3 * CELL + 2 * GAP, gridH = 4 * CELL + 3 * GAP;
  const spW = rows.length ? 24 + 4 * (SP + 8) + 16 : 0;
  const W = PAD * 2 + gridW + spW, H = TITLE + gridH + FOOT + PAD;

  const c = document.createElement('canvas');
  c.width = W * SCALE; c.height = H * SCALE;
  const ctx = c.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#15120e'; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#eadfcf'; ctx.font = `bold 20px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(build.name || 'Albion build', PAD, 34, W - PAD * 2);

  const imgs = {};
  await Promise.all(Object.entries(build.slots).map(async ([s, x]) => { imgs[s] = await img(`icons/items/${x.id}.webp`); }));
  const spImgs = {};
  await Promise.all(rows.flatMap(r => r.keys.map(async k => { spImgs[r.x.sp[k]] = await img(`icons/spells/${r.x.sp[k]}.webp`); })));

  GRID.forEach((row, ri) => row.forEach((s, ci) => {
    if (!s) return;
    cell(ctx, PAD + ci * (CELL + GAP), TITLE + ri * (CELL + GAP), s, build.slots[s], imgs[s]);
  }));

  const sx = PAD + gridW + 24;
  const rowH = rows.length ? Math.min(SP + 22, gridH / rows.length) : 0;
  rows.forEach((r, i) => {
    const y = TITLE + i * rowH;
    ctx.fillStyle = '#9c8f7d'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText(nameOf(db.items.get(r.x.id)?.n).slice(0, 28), sx, y + 10);
    r.keys.forEach((k, j) => {
      const x = sx + j * (SP + 8), yy = y + 16;
      const name = r.x.sp[k], im = spImgs[name];
      ctx.save(); ctx.beginPath(); ctx.arc(x + SP / 2, yy + SP / 2, SP / 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(x, yy, SP, SP);
      if (im) ctx.drawImage(im, x, yy, SP, SP);
      ctx.restore();
      const letter = LETTERS[r.s]?.[k];
      if (letter) {
        ctx.fillStyle = '#e2b13c'; ctx.font = `bold 11px ${FONT}`; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
        ctx.fillText(letter, x + SP - 8, yy + SP); ctx.shadowBlur = 0;
      }
    });
  });

  ctx.fillStyle = '#5c5246'; ctx.font = `11px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(SITE, W - PAD, H - 12);
  return c;
}

export const toBlob = c => new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
```

- [ ] **Step 2: Подключить в конец `js/app.js`**

```js
import { renderBuild, toBlob } from './render.js';

let current = null, seq = 0;
window.addEventListener('abm:build', async e => {
  const my = ++seq;
  const c = await renderBuild(e.detail.build, e.detail.db);
  if (my !== seq) return;
  current = c;
  $('preview').replaceChildren(c);
});

const fileName = () => (build.name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'albion-build') + '.png';

$('dl').addEventListener('click', async () => {
  const c = await renderBuild(build, db);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await toBlob(c));
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

if (!window.ClipboardItem || !navigator.clipboard?.write) $('copy').hidden = true;
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderBuild(build, db).then(toBlob) })]);
    $('copy').textContent = t('copied');
    setTimeout(() => ($('copy').textContent = t('copyImg')), 1500);
  } catch { $('copy').hidden = true; }
});
```

Строку `import { renderBuild, toBlob } from './render.js';` поставить к остальным импортам в начале файла, остальное — в конец.

- [ ] **Step 3: Проверка в браузере**
  1. Собрать билд «Ганк Клеймор»: Клеймор 8.3 шедевр, латы, шлем, ботинки, плащ, еда, зелье, маунт. Превью обновляется на каждое действие.
  2. «Скачать PNG» → файл `Ганк-Клеймор.png`, размер 2× (около 1150×980 px), открыть — чёткий, бейджи, рамки, навыки с буквами Q/W/E/R/D/F.
  3. «Копировать картинку» → вставить в любое поле, принимающее картинки (например, новое письмо Gmail) — картинка вставилась.
  4. Ветка без `ClipboardItem`: в DevTools до загрузки страницы (Sources → Snippets не годится, нужен ранний запуск) проверить нельзя, поэтому — чтением кода: кнопка скрывается при отсутствии API и при ошибке записи; скачивание от буфера не зависит.
  5. Временно переименовать одну иконку (`mv icons/items/2H_CLAYMORE.webp /tmp/`), перезагрузить: в слоте и на PNG заглушка с кодом, ошибок в консоли кроме 404 нет. Вернуть файл.
  6. Второй билд: Палаш + щит, без маунта — сетка навыков короче, PNG без пустых рядов.

- [ ] **Step 4: Commit** `git add -A && git commit -m "Картинка билда: превью, скачивание, копирование"`

---

### Task 7: README и выкладка (выкладка — только с согласия пользователя)

**Files:**
- Create: `README.md`, `LICENSE` (MIT, VAnatoliyV)

- [ ] **Step 1: README** — что это, как обновить данные (`npm run fetch && npm run check`), как запустить локально (`python3 -m http.server`), источник данных ao-bin-dumps, иконки © Sandbox Interactive, неофициальный фан-проект.

- [ ] **Step 2: Commit** `git add -A && git commit -m "README"`

- [ ] **Step 3: Спросить пользователя** про создание публичного репозитория `VAnatoliyV/albion-build-maker` и GitHub Pages. Только после «да»: создать репозиторий в веб-интерфейсе (через claude-in-chrome) или `gh`, `git remote add origin git@github.com:VAnatoliyV/albion-build-maker.git`, `git push -u origin main`, Pages из ветки `main` / корень. Проверить `https://vanatoliyv.github.io/albion-build-maker/` — шаги 1–4 из Task 5 Step 6 на живом адресе.
