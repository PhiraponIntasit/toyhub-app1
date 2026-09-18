import { h } from '../dom.js';
import { imgsOf, stockOf, soldOutOf, bgUrl, money } from '../helpers.js';

export function plateBg(p, extraStyle) {
  const imgs = imgsOf(p);
  if (imgs.length) {
    return h('div', { role: 'img', 'aria-label': p.name, style: `position:absolute;inset:0;background-image:${bgUrl(imgs[0])};background-size:cover;background-position:center;filter:sepia(0.22) saturate(0.82) contrast(1.05);${extraStyle || ''}` });
  }
  return h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.45' }, 'Plate pending');
}

// Data shared by every card render (mirrors the prototype's card() helper).
export function productCardData(store, p) {
  const wished = store.state.wishIds.indexOf(p.id) > -1;
  const admin = store.isAdmin();
  const out = soldOutOf(p);
  return {
    p, hasImage: imgsOf(p).length > 0,
    priceLabel: money(p.price),
    scaleLabel: p.scale && p.scale !== '—' ? p.scale : p.category,
    short: (p.description || '').slice(0, 96),
    stockNote: out ? 'Sold out — you are on the notify list.' : stockOf(p) + ' available' + (p.status === 'Pre-order' ? ' to reserve' : ''),
    soldOut: out || admin,
    addLabel: admin ? 'Staff' : (out ? 'Sold out' : (p.status === 'Pre-order' ? 'Reserve' : 'Add')),
    wishGlyph: wished ? '♥' : '♡',
    wished
  };
}

// The plate-image article style — used for the home hero's featured grid and the shop grid.
export function plateCard(store, p, { showActions } = {}) {
  const d = productCardData(store, p);
  return h('article', { style: 'display:flex;flex-direction:column;gap:12px;animation:fadeUp 0.35s ease both' }, [
    h('button', { class: 'lnk', style: 'display:block', onclick: () => store.go('product', p.id) }, [
      h('div', { 'data-plate': true, style: 'position:relative;aspect-ratio:3/4;background:var(--color-surface);border:6px solid var(--color-surface);outline:1px solid var(--color-divider);overflow:hidden' }, [plateBg(p)])
    ]),
    h('div', {}, [
      h('div', { style: 'font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-accent-700)' }, p.line),
      h('button', { class: 'lnk', style: 'font-family:var(--font-heading);font-size:17px;text-align:left;margin-top:4px;display:block', onclick: () => store.go('product', p.id) }, p.name)
    ]),
    h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--color-divider);padding-top:10px' }, [
      h('span', { style: 'font-size:15px' }, d.priceLabel),
      showActions ? h('div', { style: 'display:flex;gap:4px;align-items:center' }, [
        h('button', { class: 'btn btn-ghost', title: 'Save this piece', 'aria-label': 'Save this piece', onclick: () => store.toggleWish(p) }, d.wishGlyph),
        h('button', { class: 'btn btn-ghost', disabled: d.soldOut, onclick: () => store.addToCart(p) }, d.addLabel)
      ]) : h('span', { style: 'font-size:11px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.6' }, d.scaleLabel)
    ])
  ]);
}

// The bordered .card style — used for new arrivals, related pieces, and wishlist.
export function infoCard(store, p, opts) {
  opts = opts || {};
  const d = productCardData(store, p);
  const kids = [
    h('span', { class: 'card-kicker' }, p.line),
    h('button', { class: 'lnk card-title', style: 'text-align:left', onclick: () => store.go('product', p.id) }, p.name)
  ];
  if (opts.body) kids.push(h('p', { class: 'card-body' }, opts.body === 'stock' ? d.stockNote : d.short));
  kids.push(h('div', { class: 'card-meta tnum', style: 'justify-content:space-between;border-top:1px solid var(--color-divider);padding-top:10px' }, [
    h('span', {}, d.priceLabel),
    h('span', {}, opts.metaRight === 'status' ? p.status : d.scaleLabel)
  ]));
  if (opts.actions) {
    kids.push(h('div', { style: 'display:flex;gap:8px' }, [
      h('button', { class: 'btn btn-primary', style: 'flex:1', disabled: d.soldOut, onclick: () => store.addToCart(p) }, d.addLabel),
      h('button', { class: 'btn btn-secondary', onclick: () => store.toggleWish(p) }, 'Remove')
    ]));
  }
  return h('div', { class: 'card', style: 'gap:10px' }, kids);
}

export function toastNode(store) {
  const s = store.state;
  if (!s.toast) return null;
  return h('div', {
    style: 'animation:toastIn .3s cubic-bezier(.2,.7,.2,1) both;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:40;background:var(--color-neutral-900);color:var(--color-neutral-100);padding:10px 18px;border-radius:var(--radius-md);font-size:13px;box-shadow:var(--shadow-md)'
  }, s.toast);
}

export function emptyState(title, body, actionLabel, onAction) {
  return h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:56px;text-align:center' }, [
    h('div', { style: 'font-family:var(--font-heading);font-size:24px;margin-bottom:8px' }, title),
    h('p', { style: 'font-size:13px;opacity:0.65;margin:0 0 18px' }, body),
    onAction ? h('button', { class: 'btn btn-primary', onclick: onAction }, actionLabel) : null
  ]);
}
