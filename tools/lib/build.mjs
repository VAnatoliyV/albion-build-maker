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
