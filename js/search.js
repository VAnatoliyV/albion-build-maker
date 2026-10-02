export function norm(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function buildIndex(items) {
  return items.map(it => ({ it, keys: [...new Set([norm(it.id), ...Object.values(it.n).map(norm)])] }));
}

function score(keys, q, words) {
  let best = 0;
  for (const k of keys) {
    if (k.startsWith(q)) return 3;
    if ((' ' + k).includes(' ' + q)) best = Math.max(best, 2);
    else if (words.every(w => k.includes(w))) best = Math.max(best, 1);
  }
  return best;
}

// Слова тира из игровых названий («Клеймор (знаток)», «Elder's Claymore») — в индексе их нет.
const TIER_WORDS = new Set(('неопытныи неопытного новичок новичка странник странника знаток знатока эксперт эксперта ' +
  'мастер мастера магистр магистра стареишина стареишины beginner beginners novice novices journeyman journeymans ' +
  'adept adepts expert experts master masters grandmaster grandmasters elder elders s').split(' '));

function cleanQuery(query) {
  const raw = String(query).trim().replace(/^t[1-8]_/i, '').replace(/@[0-4]$/, '');
  const words = norm(raw).split(' ').filter(w => !TIER_WORDS.has(w));
  return words.length ? words.join(' ') : norm(raw);
}

export function search(index, query, slot, cat = null, limit = 300) {
  const q = cleanQuery(query);
  const words = q.split(' ');
  const out = [];
  index.forEach((e, i) => {
    if (e.it.slot !== slot || (cat && e.it.cat !== cat)) return;
    const s = q ? score(e.keys, q, words) : 1;
    if (s) out.push({ s, i, it: e.it });
  });
  out.sort((a, b) => b.s - a.s || a.i - b.i);
  return out.slice(0, limit).map(x => x.it);
}
