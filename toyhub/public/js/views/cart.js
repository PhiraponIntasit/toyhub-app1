import { h } from '../dom.js';
import { money, dueOf, CARRIAGE, DEPOSIT_PCT, ACCENT, INK } from '../helpers.js';
import { emptyState } from './common.js';

export function cartModeOf(store, p) {
  const s = store.state;
  return p.status === 'Pre-order' ? (s.mode[p.id] === 'full' ? 'full' : 'deposit') : 'full';
}

// Priced over an arbitrary {id: qty} selection so "Buy it now" can check out a
// single piece without the cart taking part.
export function totalsFor(store, cart, mode) {
  const lines = Object.keys(cart)
    .filter((id) => cart[id] > 0)
    .map((id) => store.state.products.find((p) => p.id === id))
    .filter(Boolean);
  const modeOf = (p) => (p.status === 'Pre-order' ? (mode[p.id] === 'full' ? 'full' : 'deposit') : 'full');
  const subtotal = lines.reduce((t, p) => t + dueOf(p, modeOf(p)) * cart[p.id], 0);
  const balance = lines.reduce((t, p) => t + (Number(p.price) - dueOf(p, modeOf(p))) * cart[p.id], 0);
  const shipsNow = lines.some((p) => modeOf(p) === 'full');
  const shipping = shipsNow ? CARRIAGE : 0;
  return { lines, modeOf, subtotal, shipping, total: subtotal + shipping, balance, shipsNow };
}

export function cartTotals(store) {
  return totalsFor(store, store.state.cart, store.state.mode);
}

export function renderCart(store) {
  const s = store.state;
  const { lines, subtotal, shipping, total, balance, shipsNow } = cartTotals(store);

  const setLineMode = (p, v) => { const m = Object.assign({}, s.mode); m[p.id] = v; store.setMode(m); };
  const inc = (p) => {
    if ((s.cart[p.id] || 0) >= (Number(p.stock) || 0)) { store.flash('Only ' + (Number(p.stock) || 0) + ' left of ' + p.name); return; }
    const c = Object.assign({}, s.cart); c[p.id] = c[p.id] + 1; store.setCart(c);
  };
  const dec = (p) => { const c = Object.assign({}, s.cart); c[p.id] = Math.max(0, c[p.id] - 1); if (!c[p.id]) delete c[p.id]; store.setCart(c); };
  const remove = (p) => { const c = Object.assign({}, s.cart); delete c[p.id]; store.setCart(c); };

  return h('main', { style: 'max-width:980px;margin:0 auto;padding:40px 24px 80px' }, [
    h('h1', { 'data-enter': true, style: 'font-size:34px;font-weight:400;margin:0 0 6px' }, 'Your cart'),
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 26px' }, 'Pre-order lines can be settled as a 30% deposit or in full. A deposit-only order carries no carriage — that is charged when the piece ships.'),
    lines.length ? h('div', {}, [
      h('table', { class: 'table tnum' }, [
        h('thead', {}, [h('tr', {}, [h('th', {}, 'Piece'), h('th', {}, 'Brand'), h('th', { style: 'text-align:center' }, 'Qty'), h('th', { style: 'text-align:right' }, 'Line'), h('th', {})])]),
        h('tbody', {}, lines.map((p) => {
          const md = cartModeOf(store, p);
          const dep = md === 'deposit' && p.status === 'Pre-order';
          return h('tr', {}, [
            h('td', {}, [
              h('button', { class: 'lnk', style: 'font-family:var(--font-heading);font-size:17px;text-align:left;display:block', onclick: () => store.go('product', p.id) }, p.name),
              h('div', { style: 'font-size:11px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.55;margin-top:2px' },
                `${p.status} — ${p.status === 'Pre-order' ? (dep ? DEPOSIT_PCT + '% deposit of ' + money(p.price) : 'paid in full, ' + money(p.price)) : money(p.price)}`),
              p.status === 'Pre-order' ? h('div', { style: 'display:flex;gap:14px;margin-top:8px' }, [
                h('button', { class: 'lnk', style: `font-size:12px;padding-bottom:3px;border-bottom:1px solid ${dep ? 'var(--color-accent)' : 'transparent'};color:${dep ? ACCENT : INK}`, onclick: () => setLineMode(p, 'deposit') }, '30% deposit'),
                h('button', { class: 'lnk', style: `font-size:12px;padding-bottom:3px;border-bottom:1px solid ${dep ? 'transparent' : 'var(--color-accent)'};color:${dep ? INK : ACCENT}`, onclick: () => setLineMode(p, 'full') }, 'Pay in full')
              ]) : null
            ]),
            h('td', { style: 'opacity:0.75' }, p.line),
            h('td', {}, [
              h('div', { style: 'display:flex;gap:6px;justify-content:center;align-items:center' }, [
                h('button', { class: 'btn btn-secondary', style: 'width:30px;height:30px;padding:0', onclick: () => dec(p) }, '−'),
                h('span', { style: 'min-width:22px;text-align:center' }, String(s.cart[p.id])),
                h('button', { class: 'btn btn-secondary', style: 'width:30px;height:30px;padding:0', onclick: () => inc(p) }, '+')
              ])
            ]),
            h('td', { style: 'text-align:right' }, money(dueOf(p, md) * s.cart[p.id])),
            h('td', { style: 'text-align:right' }, [h('button', { class: 'btn btn-ghost', onclick: () => remove(p) }, 'Remove')])
          ]);
        }))
      ]),
      h('div', { style: 'display:flex;justify-content:flex-end;margin-top:28px' }, [
        h('div', { style: 'width:320px;display:flex;flex-direction:column;gap:10px' }, [
          h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:14px' }, [h('span', { style: 'opacity:0.7' }, 'Subtotal'), h('span', {}, money(subtotal))]),
          h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:14px' }, [h('span', { style: 'opacity:0.7' }, 'Insured carriage'), h('span', {}, shipping ? money(shipping) : '—')]),
          !shipsNow ? h('div', { style: 'font-size:12px;opacity:0.6' }, 'Carriage is charged when the reserved piece ships.') : null,
          balance > 0 ? h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px;opacity:0.7' }, [h('span', {}, 'Balance on shipping'), h('span', {}, money(balance))]) : null,
          h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);padding-top:10px' }, [
            h('span', { style: 'font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7' }, 'Due now'),
            h('span', { class: 'price', style: 'font-size:24px' }, money(total))
          ]),
          h('button', {
            class: 'btn btn-primary btn-block', onclick: () => {
              if (!s.user) { store.go('login'); store.flash('Sign in to check out'); return; }
              if (store.isAdmin()) { store.flash('Administrator accounts cannot place orders'); return; }
              store.set({ checkoutError: '' });
              store.go('checkout');
            }
          }, 'Proceed to checkout'),
          h('button', { class: 'btn btn-secondary btn-block', onclick: () => store.go('shop') }, 'Keep browsing')
        ])
      ])
    ]) : emptyState('The cart is empty', 'Nothing reserved yet.', 'Open the catalogue', () => store.go('shop'))
  ]);
}
