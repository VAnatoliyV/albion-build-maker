import { search } from './search.js';
import { t, nameOf } from './i18n.js';
import { iconOf } from './codec.js';

const $ = id => document.getElementById(id);
const NO_QUALITY = new Set(['food', 'potion']);

export function openPicker({ slot, current, db, index, last, onPick, onUpdate, onClear }) {
  const dlg = $('picker');
  let cat = null;
  const slotItems = db.list.filter(i => i.slot === slot);
  const cats = [...new Set(slotItems.map(i => i.cat))];
  const tiers = [...new Set(slotItems.flatMap(i => i.tiers))].sort((a, b) => a - b);
  const curItem = current && db.items.get(current.id);

  const fill = (sel, values, label, value) => {
    sel.innerHTML = values.map(v => `<option value="${v}">${label(v)}</option>`).join('');
    sel.value = String(value);
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  fill($('tier'), curItem ? curItem.tiers : tiers, v => ROMAN[v], current?.tier ?? (tiers.includes(last.tier) ? last.tier : tiers.at(-1)));
  fill($('ench'), [0, 1, 2, 3, 4].slice(0, (curItem ? curItem.ench : 4) + 1), v => (v ? '.' + v : '—'), current?.ench ?? last.ench);
  fill($('qual'), [1, 2, 3, 4, 5], v => t('q')[v - 1], current?.quality ?? last.quality);
  $('qwrap').hidden = NO_QUALITY.has(slot);

  const opts = () => ({ tier: +$('tier').value, ench: +$('ench').value, quality: NO_QUALITY.has(slot) ? 1 : +$('qual').value });

  $('cats').innerHTML = cats.length > 1
    ? [`<button data-c="" class="on">${t('all')}</button>`, ...cats.map(c => `<button data-c="${c}">${nameOf(db.cats[c]) || c}</button>`)].join('')
    : '';
  const renderList = () => {
    const found = search(index, $('q').value, slot, cat);
    $('list').innerHTML = found.length
      ? found.map(i => `<button class="it${i.id === current?.id ? ' cur' : ''}" data-id="${i.id}"><img loading="lazy" src="${iconOf(i.id, i.tiers.includes(+$('tier').value) ? +$('tier').value : i.tiers.at(-1))}" alt=""><span>${nameOf(i.n)}</span></button>`).join('')
      : `<p>${t('empty')}</p>`;
  };

  $('q').value = '';
  $('q').placeholder = t('search');
  $('pclear').textContent = t('clear');
  dlg.querySelectorAll('[data-t]').forEach(el => (el.textContent = t(el.dataset.t)));

  const ctl = new AbortController();
  const on = (el, ev, fn) => el.addEventListener(ev, fn, { signal: ctl.signal });
  on($('q'), 'input', renderList);
  on($('cats'), 'click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cat = b.dataset.c || null;
    $('cats').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderList();
  });
  on($('list'), 'click', e => {
    const b = e.target.closest('.it'); if (!b) return;
    onPick(db.items.get(b.dataset.id), opts());
    dlg.close();
  });
  for (const id of ['tier', 'ench', 'qual']) on($(id), 'change', () => { onUpdate(opts()); if (id === 'tier') renderList(); });
  on($('pclear'), 'click', () => { onClear(); dlg.close(); });
  on($('pclose'), 'click', () => dlg.close());
  on(dlg, 'close', () => ctl.abort());

  renderList();
  dlg.showModal();
  $('q').focus();
}
