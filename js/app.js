import { encode, decode, sanitize, defaultSpells, emptyBuild, iconOf } from './codec.js';
import { buildIndex } from './search.js';
import { t, lang, setLang, nameOf, strings, locale, LETTERS } from './i18n.js';
import { openPicker } from './picker.js';
import { buildText } from './text.js';
import { renderBuild, toBlob } from './render.js';

const $ = id => document.getElementById(id);
const LAYOUT = ['bag', 'head', 'cape', 'mainhand', 'armor', 'offhand', 'potion', 'shoes', 'food', null, 'mount', null];
const QCOLOR = [null, null, '#8d8d8d', '#b0713a', '#c9d1d9', '#e2b13c'];
const ECOLOR = [null, '#3fbf5f', '#3f8fdf', '#b37bff', '#e2b13c'];
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
  if (dropped) history.replaceState(null, '', '#b=' + encode(build));
  render();
}

function onChange() {
  const code = encode(build);
  history.replaceState(null, '', '#b=' + code);
  try { localStorage.setItem('abm_build', code); } catch {}
  render();
}

const dots = n => (n ? `<span class="dots">${'<i></i>'.repeat(n).replaceAll('<i>', `<i style="background:${ECOLOR[n]}">`)}</span>` : '');

function renderSlots() {
  const two = build.slots.mainhand && db.items.get(build.slots.mainhand.id)?.two;
  $('slots').innerHTML = LAYOUT.map(s => {
    if (!s) return '<span></span>';
    const x = build.slots[s];
    const off = s === 'offhand' && two;
    const border = x && QCOLOR[x.quality] ? ` style="border-color:${QCOLOR[x.quality]}"` : '';
    const title = x ? nameOf(db.items.get(x.id).n) : t('slots')[s];
    if (off) return `<button class="slot off" data-s="${s}"><img src="${iconOf(build.slots.mainhand.id, build.slots.mainhand.tier)}" alt=""></button>`;
    return `<button class="slot" data-s="${s}" title="${title}"${border}>` +
      (x ? `<img src="${iconOf(x.id, x.tier)}" alt="${title}">${dots(x.ench)}` : `<span class="lbl">${t('slots')[s]}</span>`) +
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
    rows.push(`<div class="srow"><h3>${t('slots')[s]}: ${nameOf(item.n)}</h3></div>`);
    for (const k of keys)
      rows.push(`<div class="srow"><span class="key">${LETTERS[s]?.[k] ?? '◆'}</span>` +
        item.sp[k].map(n => `<button class="sp${x.sp[k] === n ? ' on' : ''}" data-s="${s}" data-k="${k}" data-n="${n}" title="${nameOf(db.spells[n])}"><img loading="lazy" src="icons/spells/${n}.webp" alt=""></button>`).join('') +
        '</div>');
  }
  $('spells').innerHTML = rows.length ? rows.join('') : `<p class="hint">${t('spellsHint')}</p>`;
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
  $('copytxt').textContent = t('copyText');
  $('txt').placeholder = t('textHint');
  $('txt').value = buildText(build, db, strings(), locale());
  $('txt').style.height = 'auto';
  $('txt').style.height = Math.max(96, $('txt').scrollHeight + 4) + 'px';
  renderSlots();
  renderSpells();
  renderPreview();
}

let seq = 0;
async function renderPreview() {
  const my = ++seq;
  const c = await renderBuild(build, db);
  if (my === seq) $('preview').replaceChildren(c);
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

function flash(btn, key) {
  btn.textContent = t('copied');
  setTimeout(() => (btn.textContent = t(key)), 1500);
}

$('name').addEventListener('input', () => { build.name = $('name').value; onChange(); });
$('lang').addEventListener('change', () => { setLang($('lang').value); render(); });
$('link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); flash($('link'), 'copyLink'); } catch {}
});
$('copytxt').addEventListener('click', async () => {
  if (!$('txt').value) return;
  try { await navigator.clipboard.writeText($('txt').value); flash($('copytxt'), 'copyText'); }
  catch { $('txt').select(); }
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
    flash($('copy'), 'copyImg');
  } catch { $('copy').hidden = true; }
});

window.addEventListener('hashchange', () => db && restore());

load();
