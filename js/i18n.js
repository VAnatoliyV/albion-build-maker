import { LETTERS } from './text.js';
export { LETTERS };

export const S = {
  ru: { title: 'Конструктор билдов Albion', name: 'Название билда', search: 'Поиск: клеймор, claymore…',
    tier: 'Тир', ench: 'Зачарование', quality: 'Качество', clear: 'Убрать', close: 'Закрыть', all: 'Все',
    download: 'Скачать PNG', copyImg: 'Копировать картинку', copyLink: 'Копировать ссылку', copied: 'Скопировано',
    copyText: 'Копировать текст', textHint: 'Текст билда — выберите вещи, и он появится здесь', passive: 'пассивка', spellsHint: 'Навыки появятся, когда выберете оружие или броню',
    loadFail: 'Не удалось загрузить данные.', retry: 'Повторить', broken: 'Часть билда из ссылки устарела и была поправлена: ',
    empty: 'Ничего не найдено', q: ['Обычное', 'Хорошее', 'Выдающееся', 'Отличное', 'Шедевр'],
    slots: { head: 'Голова', armor: 'Броня', shoes: 'Обувь', mainhand: 'Оружие', offhand: 'Вторая рука', cape: 'Плащ', bag: 'Сумка', mount: 'Маунт', food: 'Еда', potion: 'Зелье' } },
  en: { title: 'Albion Build Maker', name: 'Build name', search: 'Search: claymore, клеймор…',
    tier: 'Tier', ench: 'Enchant', quality: 'Quality', clear: 'Remove', close: 'Close', all: 'All',
    download: 'Download PNG', copyImg: 'Copy image', copyLink: 'Copy link', copied: 'Copied',
    copyText: 'Copy text', textHint: 'Build text — pick items and it shows up here', passive: 'passive', spellsHint: 'Spells show up once you pick a weapon or armor',
    loadFail: 'Could not load data.', retry: 'Retry', broken: 'Part of the linked build was outdated and fixed: ',
    empty: 'Nothing found', q: ['Normal', 'Good', 'Outstanding', 'Excellent', 'Masterpiece'],
    slots: { head: 'Head', armor: 'Armor', shoes: 'Shoes', mainhand: 'Weapon', offhand: 'Off-hand', cape: 'Cape', bag: 'Bag', mount: 'Mount', food: 'Food', potion: 'Potion' } },
};

let L = 'en';
try { L = localStorage.getItem('abm_lang') || ''; } catch {}
if (!S[L]) L = 'ru';

export const lang = () => L;
export const t = k => S[L][k];
export const strings = () => S[L];
export const locale = () => (L === 'ru' ? 'RU-RU' : 'EN-US');
export const nameOf = n => (n && (n[L === 'ru' ? 'RU-RU' : 'EN-US'] || n['EN-US'])) || '';
export function setLang(l) { L = l; try { localStorage.setItem('abm_lang', l); } catch {} }
