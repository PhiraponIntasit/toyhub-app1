import { h } from '../dom.js';
import { money, dateLabel, DEPOSIT_PCT } from '../helpers.js';
import { emptyState } from './common.js';

function orderCard(o) {
  const emails = [
    { mark: '✓', color: 'var(--color-accent-700)', title: 'Order confirmed by email', detail: `${dateLabel(o.confirmedAt || o.createdAt)} — sent to ${o.email}` }
  ];
  emails.push(o.tracking
    ? { mark: '✓', color: 'var(--color-accent-700)', title: 'Shipped — tracking emailed', detail: `Tracking ${o.tracking}` + (o.shippedAt ? ` — ${dateLabel(o.shippedAt)}` : '') }
    : { mark: '○', color: 'var(--color-text)', title: 'Tracking email pending', detail: o.status === 'Cancelled' ? 'Order cancelled' : 'Sent the day the piece leaves the bench' });

  return h('div', { 'data-reveal': true, style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px' }, [
    h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap' }, [
      h('div', {}, [
        h('div', { class: 'tnum', style: 'font-family:var(--font-heading);font-size:20px' }, o.ref),
        h('div', { class: 'tnum', style: 'font-size:12px;opacity:0.6' }, `${dateLabel(o.createdAt)} — card ending ${o.cardLast4}`)
      ]),
      h('span', { class: 'tag tag-outline' }, o.status)
    ]),
    h('div', { style: 'margin-top:14px;border-top:1px solid var(--color-divider);padding-top:12px;display:flex;flex-direction:column;gap:8px' },
      o.items.map((it) => h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;gap:14px;font-size:14px' }, [
        h('span', {}, `${it.qty} × ${it.name}` + (it.status === 'Pre-order'
          ? (it.mode === 'full' ? ` (paid in full, ships ${it.release || 'TBA'})` : ` (${DEPOSIT_PCT}% deposit, ships ${it.release || 'TBA'})`)
          : '')),
        h('span', {}, money(it.due * it.qty))
      ]))),
    h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;border-top:1px solid var(--color-divider);margin-top:12px;padding-top:10px;font-size:14px' }, [
      h('span', { style: 'opacity:0.7' }, 'Paid'),
      h('span', { class: 'price', style: 'font-size:20px' }, money(o.total))
    ]),
    o.balance > 0 ? h('div', { class: 'tnum', style: 'font-size:12px;opacity:0.65;margin-top:6px' }, `Balance due when the window opens — ${money(o.balance)} (plus carriage)`) : null,
    h('div', { style: 'border-top:1px solid var(--color-divider);margin-top:14px;padding-top:12px;display:flex;flex-direction:column;gap:8px' },
      emails.map((m) => h('div', { style: 'display:flex;gap:10px;align-items:baseline' }, [
        h('span', { style: `color:${m.color};font-size:13px` }, m.mark),
        h('div', {}, [h('div', { style: 'font-size:13px' }, m.title), h('div', { class: 'tnum', style: 'font-size:11px;opacity:0.6' }, m.detail)])
      ])))
  ]);
}

export function renderOrders(store) {
  const s = store.state;
  return h('main', { style: 'max-width:980px;margin:0 auto;padding:40px 24px 90px' }, [
    h('h1', { 'data-enter': true, style: 'font-size:34px;font-weight:400;margin:0 0 6px' }, 'Your orders'),
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 20px;max-width:74ch' }, 'You are emailed twice: once when the order is confirmed, and again with the tracking number when it ships — which closes the order as completed.'),
    h('div', { style: 'display:flex;gap:10px;margin:0 0 26px;flex-wrap:wrap' }, [
      h('button', { class: 'btn btn-secondary', onclick: () => store.go('contact') }, 'A problem with an order? Contact us')
    ]),
    s.myOrders.length
      ? h('div', { style: 'display:flex;flex-direction:column;gap:18px' }, s.myOrders.map(orderCard))
      : emptyState('No orders yet', 'Anything you buy is listed here with its state.', 'Open the catalogue', () => store.go('shop'))
  ]);
}
