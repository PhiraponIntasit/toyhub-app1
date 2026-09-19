import { h } from '../dom.js';
import { infoCard, emptyState } from './common.js';

export function renderWishlist(store) {
  const s = store.state;
  const items = s.wishIds.map((id) => s.products.find((p) => p.id === id)).filter(Boolean);
  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:40px 24px 90px' }, [
    h('h1', { 'data-enter': true, style: 'font-size:34px;font-weight:400;margin:0 0 6px' }, 'Saved pieces'),
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 26px' }, 'Sold-out pieces you save count as demand — the shop is told, and you are notified first if a second run is announced.'),
    items.length
      ? h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:22px' },
        items.map((p) => infoCard(store, p, { image: true, body: 'stock', metaRight: 'status', actions: true })))
      : emptyState('Nothing saved yet', 'Use “Save this piece” on any plate — including sold-out ones.', 'Open the catalogue', () => store.go('shop'))
  ]);
}
