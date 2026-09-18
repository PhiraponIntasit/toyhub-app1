import { h } from '../dom.js';
import { money } from '../helpers.js';

export function renderDone(store) {
  const s = store.state;
  const order = s.lastOrder;
  if (!order) {
    return h('main', { style: 'max-width:680px;margin:0 auto;padding:90px 24px 120px;text-align:center' }, [
      h('h1', { style: 'font-size:28px;font-weight:400' }, 'No order to show'),
      h('button', { class: 'btn btn-primary', onclick: () => store.go('shop') }, 'Back to the catalogue')
    ]);
  }
  return h('main', { style: 'max-width:680px;margin:0 auto;padding:90px 24px 120px;text-align:center' }, [
    h('div', { 'data-enter': true, style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, 'Order placed'),
    h('h1', { 'data-enter': true, style: 'font-size:42px;font-weight:400;margin:14px 0 12px;animation-delay:.08s' }, `Thank you, ${order.name}`),
    h('p', { class: 'tnum', style: 'font-size:14px;opacity:0.8' }, `Reference ${order.ref} — charged ${money(order.total)} to the card ending ${order.cardLast4}.`),
    h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:20px;text-align:left;margin:22px 0 18px' }, [
      h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:8px' }, 'Confirmation email sent'),
      h('div', { style: 'font-size:14px' }, ['To ', h('strong', {}, order.email), ` — subject “ToyHub order ${order.ref} confirmed”.`]),
      h('p', { style: 'font-size:13px;opacity:0.7;margin:8px 0 12px' }, `It lists each piece, how it was settled (deposit or in full), the shipping window and the card ending ${order.cardLast4}.`),
      h('div', { style: 'border-top:1px solid var(--color-divider);padding-top:12px;font-size:13px;opacity:0.75' }, [
        'A second email follows when the order leaves the bench, carrying its tracking number — at that point the order reads ',
        h('em', {}, 'Completed'),
        '. Anything unclear, ',
        h('button', { class: 'lnk', style: 'color:var(--color-accent-700)', onclick: () => store.go('contact') }, 'contact the shop'),
        '.'
      ])
    ]),
    h('button', { class: 'btn btn-primary', style: 'margin-top:14px', onclick: () => store.go('shop') }, 'Back to the catalogue')
  ]);
}
