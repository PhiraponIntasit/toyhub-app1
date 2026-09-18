import { h } from '../dom.js';
import { CATS, STATUSES, ACCENT, INK, money } from '../helpers.js';
import { plateCard, emptyState } from './common.js';
import { textField } from './forms.js';

function filteredProducts(s) {
  const q = s.q.trim().toLowerCase();
  let list = s.products.filter((p) =>
    (s.cat === 'All' || p.category === s.cat) &&
    (s.status === 'All' || p.status === s.status) &&
    Number(p.price) <= Number(s.maxPrice) &&
    (!q || (p.name + ' ' + p.line + ' ' + p.category).toLowerCase().includes(q))
  );
  if (s.sort === 'low') list = list.slice().sort((a, b) => a.price - b.price);
  if (s.sort === 'high') list = list.slice().sort((a, b) => b.price - a.price);
  if (s.sort === 'new') list = list.slice().reverse();
  return list;
}

export function renderShop(store) {
  const s = store.state;
  const products = s.products;
  const shop = filteredProducts(s);
  const prices = products.map((p) => Number(p.price) || 0);
  const priceMax = Math.max(30000, ...prices, 30000);

  const filterRow = (label, count, active, onClick) => h('button', {
    class: 'lnk',
    style: `display:flex;justify-content:space-between;gap:8px;padding:5px 0;font-size:14px;border-bottom:1px solid var(--color-divider);color:${active ? ACCENT : INK}`,
    onclick: onClick
  }, [h('span', {}, label), h('span', { class: 'tnum', style: 'opacity:0.5;font-size:12px' }, String(count))]);

  return h('main', { style: 'max-width:1200px;margin:0 auto;padding:40px 24px 80px' }, [
    h('div', { 'data-shopgrid': true, style: 'display:grid;grid-template-columns:238px minmax(0,1fr);gap:44px;align-items:start' }, [
      h('aside', { 'data-sticky': true, style: 'position:sticky;top:96px;display:flex;flex-direction:column;gap:26px' }, [
        textField(store, { key: 'shop.q', label: 'Search', type: 'search', placeholder: 'Piece or atelier', value: s.q, set: (v) => store.set({ q: v }) }),
        h('div', {}, [
          h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:10px' }, 'Category'),
          h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, [
            filterRow('All pieces', products.length, s.cat === 'All', () => store.set({ cat: 'All' })),
            ...CATS.map((c) => filterRow(c, products.filter((p) => p.category === c).length, s.cat === c, () => store.set({ cat: c })))
          ])
        ]),
        h('div', {}, [
          h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:10px' }, 'Availability'),
          h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, [
            filterRow('Any', products.length, s.status === 'All', () => store.set({ status: 'All' })),
            ...STATUSES.map((st) => filterRow(st, products.filter((p) => p.status === st).length, s.status === st, () => store.set({ status: st })))
          ])
        ]),
        h('div', { class: 'field' }, [
          h('label', {}, `Ceiling — ${money(s.maxPrice)} and under`),
          h('input', { class: 'input', type: 'range', 'data-key': 'shop.maxPrice', min: 1000, max: priceMax, step: 500, value: s.maxPrice, style: 'padding:0;border:0;accent-color:var(--color-accent)', onInput: (e) => store.set({ maxPrice: Number(e.target.value) }) })
        ]),
        h('button', { class: 'btn btn-secondary', onclick: () => store.set({ q: '', cat: 'All', status: 'All', maxPrice: 30000, sort: 'curated' }) }, 'Clear filters')
      ]),
      h('div', {}, [
        h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--color-divider);padding-bottom:14px;margin-bottom:26px;flex-wrap:wrap' }, [
          h('div', {}, [
            h('h1', { 'data-enter': true, style: 'font-size:32px;font-weight:400;margin:0' }, 'Catalogue'),
            h('span', { class: 'tnum', style: 'font-size:12px;opacity:0.6' }, `${shop.length} of ${products.length} pieces`)
          ]),
          h('div', { class: 'field', style: 'width:190px' }, [
            h('label', {}, 'Order'),
            h('select', { class: 'input', value: s.sort, onChange: (e) => store.set({ sort: e.target.value }) }, [
              h('option', { value: 'curated' }, 'Curated'),
              h('option', { value: 'new' }, 'Newest first'),
              h('option', { value: 'low' }, 'Price, low to high'),
              h('option', { value: 'high' }, 'Price, high to low')
            ])
          ])
        ]),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:30px' },
          shop.map((p) => plateCard(store, p, { showActions: true }))),
        shop.length === 0 ? emptyState('Nothing under these terms', 'Loosen the ceiling or clear the filters to see the full cabinet.', 'Clear filters',
          () => store.set({ q: '', cat: 'All', status: 'All', maxPrice: 30000, sort: 'curated' })) : null
      ])
    ])
  ]);
}
