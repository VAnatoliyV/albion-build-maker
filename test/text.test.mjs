import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildText } from '../js/text.js';

const items = new Map([
  ['2H_CLAYMORE', { id: '2H_CLAYMORE', slot: 'mainhand', n: { 'RU-RU': 'Клеймор', 'EN-US': 'Claymore' } }],
  ['HEAD_PLATE_SET3', { id: 'HEAD_PLATE_SET3', slot: 'head', n: { 'RU-RU': 'Шлем стража', 'EN-US': 'Guardian Helmet' } }],
  ['MEAL_STEW', { id: 'MEAL_STEW', slot: 'food', n: { 'RU-RU': 'Тушёное мясо', 'EN-US': 'Beef Stew' } }],
]);
const spells = { CLAYMORECHARGE: { 'RU-RU': 'Натиск', 'EN-US': 'Charge' }, CLEAVE: { 'RU-RU': 'Рассечение', 'EN-US': 'Cleave' },
  PASSIVE_X: { 'RU-RU': 'Кровотечение', 'EN-US': 'Bleed' }, TAUNT: { 'RU-RU': 'Провокация', 'EN-US': 'Taunt' } };
const S = {
  slots: { head: 'Голова', mainhand: 'Оружие', food: 'Еда' },
  q: ['Обычное', 'Хорошее', 'Выдающееся', 'Отличное', 'Шедевр'], passive: 'пассивка',
};
const build = { name: 'Ганк', slots: {
  food: { id: 'MEAL_STEW', tier: 8, ench: 0, quality: 1, sp: {} },
  mainhand: { id: '2H_CLAYMORE', tier: 8, ench: 3, quality: 5, sp: { q: 'CLEAVE', e: 'CLAYMORECHARGE', p: 'PASSIVE_X' } },
  head: { id: 'HEAD_PLATE_SET3', tier: 6, ench: 1, quality: 1, sp: { a: 'TAUNT' } },
} };

test('text lists slots in game order with tier, quality and spells', () => {
  assert.equal(buildText(build, { items, spells }, S, 'RU-RU'),
    'Ганк\n' +
    'Оружие: Клеймор 8.3, шедевр — Q: Рассечение, E: Натиск, пассивка: Кровотечение\n' +
    'Голова: Шлем стража 6.1 — D: Провокация\n' +
    'Еда: Тушёное мясо 8');
});

test('empty build gives empty text', () => {
  assert.equal(buildText({ name: '', slots: {} }, { items, spells }, S, 'RU-RU'), '');
});
