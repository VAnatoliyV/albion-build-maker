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

test('full in-game names and codes with tier/enchant', () => {
  assert.deepEqual(ids(search(idx, 'Клеймор (знаток)', 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, 'клеймор старейшины', 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, "Elder's Claymore", 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, 'T8_2H_CLAYMORE@3', 'mainhand')), ['2H_CLAYMORE']);
  assert.deepEqual(ids(search(idx, 't4_main_sword', 'mainhand')), ['MAIN_SWORD']);
});
