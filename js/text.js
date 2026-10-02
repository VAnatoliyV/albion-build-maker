export const LETTERS = { mainhand: { q: 'Q', w: 'W', e: 'E' }, armor: { a: 'R' }, head: { a: 'D' }, shoes: { a: 'F' } };
const ORDER = ['mainhand', 'offhand', 'head', 'armor', 'shoes', 'cape', 'bag', 'food', 'potion', 'mount'];
const KEYS = ['q', 'w', 'e', 'a', 'p'];

export function buildText(build, db, S, L) {
  const name = n => (n && (n[L] || n['EN-US'])) || '';
  const lines = [];
  for (const s of ORDER) {
    const x = build.slots[s];
    const item = x && db.items.get(x.id);
    if (!item) continue;
    let line = `${S.slots[s]}: ${name(item.n)} ${x.tier}${x.ench ? '.' + x.ench : ''}`;
    if (x.quality > 1) line += `, ${S.q[x.quality - 1].toLowerCase()}`;
    const sp = KEYS.filter(k => x.sp[k]).map(k => `${LETTERS[s]?.[k] ?? S.passive}: ${name(db.spells[x.sp[k]]) || x.sp[k]}`);
    if (sp.length) line += ' — ' + sp.join(', ');
    lines.push(line);
  }
  if (!lines.length) return '';
  return [build.name.trim(), ...lines].filter(Boolean).join('\n');
}
