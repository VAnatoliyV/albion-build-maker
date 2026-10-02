// Собирает рамки качества icons/quality/e{зачарование}_q{качество}.png (q 2–5, e 0–4)
// из пяти эталонных вещей T8 с render.albiononline.com. Запускать после изменения вида иконок в игре.
import { mkdir, writeFile } from 'node:fs/promises';
import { decodePng, encodePng } from './lib/png.mjs';
import { buildOverlay } from './lib/quality.mjs';

const REFS = ['T8_2H_CLAYMORE', 'T8_HEAD_CLOTH_SET1', 'T8_MAIN_DAGGER', 'T8_OFF_SHIELD', 'T8_ARMOR_LEATHER_SET1'];
const RENDER = 'https://render.albiononline.com/v1/item/';

async function get(id, quality) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${RENDER}${id}.png?size=128&quality=${quality}`).catch(() => null);
    if (r?.ok) return decodePng(Buffer.from(await r.arrayBuffer())).data;
    await new Promise(s => setTimeout(s, 1000 * (i + 1)));
  }
  throw new Error(`не скачалась ${id} q${quality}`);
}

await mkdir('icons/quality', { recursive: true });
for (let e = 0; e <= 4; e++) {
  const ids = REFS.map(r => (e ? `${r}@${e}` : r));
  const base = await Promise.all(ids.map(id => get(id, 1)));
  for (let q = 2; q <= 5; q++) {
    const withQ = await Promise.all(ids.map(id => get(id, q)));
    await writeFile(`icons/quality/e${e}_q${q}.png`, encodePng({ width: 128, height: 128, data: buildOverlay(base, withQ) }));
  }
  console.log(`зачарование ${e}: готово`);
}
