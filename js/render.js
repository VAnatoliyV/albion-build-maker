import { t, nameOf, LETTERS } from './i18n.js';
import { iconOf } from './codec.js';

const CELL = 84, GAP = 8, PAD = 20, TITLE = 52, FOOT = 26, SP = 34, SCALE = 2;
const GRID = [['bag', 'head', 'cape'], ['mainhand', 'armor', 'offhand'], ['potion', 'shoes', 'food'], [null, 'mount', null]];
const SPELL_ROWS = [['mainhand', ['q', 'w', 'e', 'p']], ['armor', ['a', 'p']], ['head', ['a', 'p']], ['shoes', ['a', 'p']], ['cape', ['p']]];
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
  ctx.shadowColor = '#000'; ctx.shadowBlur = 2;
  for (let d = 0; d < data.ench; d++) {
    ctx.beginPath(); ctx.arc(x + 10 + d * 9, y + CELL - 10, 3, 0, Math.PI * 2);
    ctx.fillStyle = ECOLOR[data.ench]; ctx.fill();
  }
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
  await Promise.all(Object.entries(build.slots).map(async ([s, x]) => { imgs[s] = await img(iconOf(x.id, x.tier)); }));
  const spImgs = {};
  await Promise.all(rows.flatMap(r => r.keys.map(async k => { spImgs[r.x.sp[k]] = await img(`icons/spells/${r.x.sp[k]}.webp`); })));

  const main = build.slots.mainhand;
  const two = main && db.items.get(main.id)?.two;
  GRID.forEach((row, ri) => row.forEach((s, ci) => {
    if (!s) return;
    const x = PAD + ci * (CELL + GAP), y = TITLE + ri * (CELL + GAP);
    if (s === 'offhand' && two) {
      rrect(ctx, x, y, CELL, CELL, 8); ctx.fillStyle = '#201b15'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#3a3128'; ctx.stroke();
      if (imgs.mainhand) { ctx.globalAlpha = 0.3; ctx.drawImage(imgs.mainhand, x + 3, y + 3, CELL - 6, CELL - 6); ctx.globalAlpha = 1; }
      return;
    }
    cell(ctx, x, y, s, build.slots[s], imgs[s]);
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
