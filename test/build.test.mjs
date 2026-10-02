import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spellListOf, groupSpells, baseName, tierAffixes, stripTier, slotOf } from '../tools/lib/build.mjs';

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

const swordRu = { 4: 'Палаш (знаток)', 5: 'Палаш (эксперт)', 6: 'Палаш (мастер)', 7: 'Палаш (магистр)', 8: 'Палаш (старейшина)' };
const swordEn = { 4: "Adept's Broadsword", 5: "Expert's Broadsword", 6: "Master's Broadsword", 7: "Grandmaster's Broadsword", 8: "Elder's Broadsword" };

test('tierAffixes learns tier words from a reference item', () => {
  assert.deepEqual(tierAffixes(swordRu), { 4: ' (знаток)', 5: ' (эксперт)', 6: ' (мастер)', 7: ' (магистр)', 8: ' (старейшина)' });
  assert.deepEqual(tierAffixes(swordEn)[7], "Grandmaster's ");
});

test('stripTier: unique T8 name loses to majority', () => {
  const aff = tierAffixes(swordRu);
  assert.equal(stripTier({ 4: 'Большой огненный посох (знаток)', 5: 'Большой огненный посох (эксперт)', 6: 'Большой огненный посох (мастер)', 7: 'Большой огненный посох (магистр)', 8: 'Гнев Vendetta' }, aff), 'Большой огненный посох');
});

test('stripTier: single tier item and per-tier dishes', () => {
  assert.equal(stripTier({ 4: 'Гигантский олень (знаток)' }, tierAffixes(swordRu)), 'Гигантский олень');
  assert.equal(stripTier({ 4: "Grandmaster's Grandmaster's Hat" }, tierAffixes(swordEn)), "Grandmaster's Grandmaster's Hat");
  assert.equal(stripTier({ 1: 'Суп из илистых моллюсков', 3: 'Суп из грязевых моллюсков' }, tierAffixes(swordRu)), 'Суп из илистых моллюсков');
});
