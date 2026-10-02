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
