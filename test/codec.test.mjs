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

test('iconOf points to the per-tier icon', async () => {
  const { iconOf } = await import('../js/codec.js');
  assert.equal(iconOf('2H_CLAYMORE', 8), 'icons/items/T8_2H_CLAYMORE.webp');
  assert.equal(iconOf('2H_CLAYMORE', 8, 0), 'icons/items/T8_2H_CLAYMORE.webp');
  assert.equal(iconOf('2H_CLAYMORE', 6, 3), 'icons/items/T6_2H_CLAYMORE@3.webp');
});

test('sanitize: food and potions have no quality', () => {
  const b = { name: '', slots: { food: { id: 'MEAL_OMELETTE', tier: 5, ench: 0, quality: 5, sp: {} } } };
  assert.equal(sanitize(b, db).build.slots.food.quality, 1);
});

test('qualityOf: frame overlay path, none for normal quality', async () => {
  const { qualityOf } = await import('../js/codec.js');
  assert.equal(qualityOf(3, 4), 'icons/quality/e3_q4.png');
  assert.equal(qualityOf(0, 1), null);
});
