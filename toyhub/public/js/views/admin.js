import { h } from '../dom.js';
import { api } from '../api.js';
import { money, dateLabel, ACCENT, INK } from '../helpers.js';
import { textField } from './forms.js';
import { emptyState } from './common.js';

const ORDER_STATUSES = ['Confirmed', 'Producing', 'Ready to ship', 'Completed', 'Cancelled'];

function tabButton(store, key, label) {
  const s = store.state;
  const active = s.adminTab === key;
  return h('button', {
    class: 'lnk',
    style: `font-size:12px;letter-spacing:0.12em;text-transform:uppercase;padding-bottom:5px;border-bottom:2px solid ${active ? 'var(--color-accent)' : 'transparent'};color:${active ? ACCENT : INK}`,
    onclick: () => store.set({ adminTab: key })
  }, label);
}

async function deleteProduct(store, p) {
  await api.deleteProduct(p.id);
  await store.refreshProducts();
  store.flash(p.name + ' removed');
}

function catalogueTab(store) {
  const s = store.state;
  return h('div', {}, [
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 20px;max-width:74ch' }, 'Up to four pieces can be featured in the homepage hero — marking a fifth releases the piece featured longest. Stock falls automatically as orders are paid, and a piece with no units left is marked sold out.'),
    h('div', { 'data-scroll': true }, [
      h('table', { class: 'table tnum' }, [
        h('thead', {}, [h('tr', {}, ['Piece', 'Atelier', 'Category', 'Status', 'Stock', 'Price', 'Photos', ''].map((t) => h('th', {}, t)))]),
        h('tbody', {}, s.products.map((p) => h('tr', {}, [
          h('td', {}, [
            h('div', { style: 'font-family:var(--font-heading);font-size:17px' }, p.name),
            h('div', { style: 'font-size:11px;opacity:0.55;margin-top:2px' }, p.featured ? 'Featured in the hero' : (p.edition || 'Open edition'))
          ]),
          h('td', { style: 'opacity:0.75' }, p.line),
          h('td', { style: 'opacity:0.75' }, p.category),
          h('td', {}, p.status),
          h('td', { style: 'text-align:right' }, String(p.stock)),
          h('td', { style: 'text-align:right' }, money(p.price)),
          h('td', { style: 'opacity:0.6' }, p.images.length ? p.images.length + ' set' : 'Pending'),
          h('td', { style: 'text-align:right;white-space:nowrap' }, [
            h('button', { class: 'btn btn-ghost', onclick: () => store.set({ draft: Object.assign({}, p), draftError: false }) }, 'Edit'),
            h('button', { class: 'btn btn-ghost', onclick: () => deleteProduct(store, p) }, 'Delete')
          ])
        ])))
      ])
    ])
  ]);
}

function ordersTab(store) {
  const s = store.state;
  const orders = s.adminOrders;
  return h('div', {}, [
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 20px;max-width:74ch' }, 'Every paid order, newest first. The customer already has the confirmation email; entering a tracking number and sending it emails them a second time and closes the order as completed.'),
    orders.length ? h('div', { 'data-scroll': true }, [
      h('table', { class: 'table tnum' }, [
        h('thead', {}, [h('tr', {}, ['Reference', 'Customer', 'Pieces', 'Paid', 'State', 'Tracking', ''].map((t) => h('th', {}, t)))]),
        h('tbody', {}, orders.map((o) => {
          const trackingKey = `admin.tracking.${o.ref}`;
          const draftVal = s.trackingDraft[o.ref] !== undefined ? s.trackingDraft[o.ref] : o.tracking;
          return h('tr', {}, [
            h('td', {}, [
              h('div', { style: 'font-family:var(--font-heading);font-size:16px' }, o.ref),
              h('div', { style: 'font-size:11px;opacity:0.55' }, `${dateLabel(o.createdAt)} — card ${o.cardLast4}`)
            ]),
            h('td', { style: 'opacity:0.8' }, [
              h('div', {}, o.name), h('div', { style: 'font-size:11px;opacity:0.7' }, o.email),
              h('div', { class: 'tnum', style: 'font-size:11px;opacity:0.7' }, o.phone)
            ]),
            h('td', { style: 'opacity:0.8;font-size:13px;white-space:pre-line' }, o.items.map((it) => `${it.qty} × ${it.name}` + (it.mode === 'deposit' ? ' (deposit)' : '')).join('\n')),
            h('td', { style: 'text-align:right' }, money(o.total)),
            h('td', {}, [
              h('select', {
                class: 'input', style: 'min-width:160px', value: o.status,
                onChange: async (e) => { await api.setOrderStatus(o.ref, e.target.value); await store.refreshAdminData(); store.flash(o.ref + ' — ' + e.target.value); }
              }, ORDER_STATUSES.map((st) => h('option', { value: st }, st === 'Completed' ? 'Completed — shipped' : st)))
            ]),
            h('td', {}, [
              h('div', { style: 'display:flex;flex-direction:column;gap:6px;min-width:190px' }, [
                textField({
                  key: trackingKey, placeholder: 'TH1234567890', value: draftVal,
                  set: (v) => { s.trackingDraft = Object.assign({}, s.trackingDraft, { [o.ref]: v }); }
                }),
                h('button', {
                  class: 'btn btn-secondary', onclick: async () => {
                    // Typing no longer re-renders, so read what is in the field now.
                    const tracking = s.trackingDraft[o.ref] !== undefined ? s.trackingDraft[o.ref] : o.tracking;
                    try {
                      await api.shipOrder(o.ref, tracking);
                      const next = Object.assign({}, s.trackingDraft); delete next[o.ref];
                      s.trackingDraft = next;
                      await store.refreshAdminData();
                      store.flash('Tracking ' + tracking + ' emailed to ' + o.email + ' — ' + o.ref + ' completed');
                    } catch (err) { store.flash(err.message); }
                  }
                }, o.tracking ? 'Re-send tracking' : 'Send tracking & complete')
              ])
            ]),
            h('td', { style: 'text-align:right' }, [
              h('button', {
                class: 'btn btn-ghost', onclick: async () => { await api.deleteOrder(o.ref); await store.refreshAdminData(); store.flash(o.ref + ' deleted'); }
              }, 'Delete')
            ])
          ]);
        }))
      ])
    ]) : emptyState('No orders yet', 'Paid orders appear here with their state and contact details.', '', null)
  ]);
}

function messagesTab(store) {
  const s = store.state;
  const messages = s.adminMessages;
  return h('div', {}, [
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 20px;max-width:74ch' }, 'Enquiries sent from the contact page, newest first.'),
    messages.length ? h('div', { style: 'display:flex;flex-direction:column;gap:14px' }, messages.map((m) => h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:18px' }, [
      h('div', { style: 'display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:baseline' }, [
        h('div', {}, [
          h('div', { style: 'font-family:var(--font-heading);font-size:18px' }, m.subject + (m.ref ? ' — ' + m.ref : '')),
          h('div', { class: 'tnum', style: 'font-size:12px;opacity:0.65' }, `${m.name} — ${m.email} — ${dateLabel(m.at)}`)
        ]),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, [
          h('span', { class: 'tag tag-outline' }, m.handled ? 'Answered' : 'Open'),
          h('button', {
            class: 'btn btn-ghost', onclick: async () => { await api.toggleMessage(m.id); await store.refreshAdminData(); }
          }, m.handled ? 'Reopen' : 'Mark answered'),
          h('button', {
            class: 'btn btn-ghost', onclick: async () => { await api.deleteMessage(m.id); await store.refreshAdminData(); }
          }, 'Delete')
        ])
      ]),
      h('p', { class: 'just', style: 'font-size:14px;opacity:0.85;margin:12px 0 0;white-space:pre-line' }, m.body)
    ]))) : emptyState('No enquiries', 'Messages sent from the contact page land here.', '', null)
  ]);
}

function demandTab(store) {
  const s = store.state;
  const demand = s.demand;
  return h('div', {}, [
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 20px;max-width:74ch' }, 'Pieces collectors have saved or asked to be notified about — the cheapest signal for a second run.'),
    demand.length ? h('div', { 'data-scroll': true }, [
      h('table', { class: 'table tnum' }, [
        h('thead', {}, [h('tr', {}, ['Piece', 'Status', 'Stock', 'Collectors waiting', ''].map((t) => h('th', {}, t)))]),
        h('tbody', {}, demand.map((d) => h('tr', {}, [
          h('td', { style: 'font-family:var(--font-heading);font-size:16px' }, d.name),
          h('td', { style: 'opacity:0.8' }, d.status),
          h('td', { style: 'text-align:right' }, String(d.stock)),
          h('td', { style: 'text-align:right;color:var(--color-accent-700)' }, String(d.count)),
          h('td', { style: 'text-align:right' }, [
            h('button', {
              class: 'btn btn-ghost', onclick: () => {
                const p = s.products.find((x) => x.id === d.id);
                if (p) store.set({ draft: Object.assign({}, p), draftError: false });
              }
            }, 'Edit')
          ])
        ])))
      ])
    ]) : emptyState('No saved pieces yet', 'When collectors save a piece or ask to be told it is back, it is counted here.', '', null)
  ]);
}

export function renderAdmin(store) {
  const s = store.state;
  const title = s.adminTab === 'orders' ? 'Orders' : s.adminTab === 'demand' ? 'Demand' : s.adminTab === 'messages' ? 'Enquiries' : 'Catalogue manager';
  const unhandled = s.adminMessages.filter((m) => !m.handled).length;

  return h('main', { style: 'max-width:1200px;margin:0 auto;padding:40px 24px 80px' }, [
    h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:20px;border-bottom:1px solid var(--color-divider);padding-bottom:16px;margin-bottom:8px;flex-wrap:wrap' }, [
      h('div', {}, [
        h('div', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, 'Shop administration'),
        h('h1', { style: 'font-size:32px;font-weight:400;margin:8px 0 0' }, title)
      ]),
      h('div', { style: 'display:flex;gap:10px' }, [
        h('button', {
          class: 'btn btn-secondary', onclick: async () => {
            const { products } = await api.restoreSamples();
            store.state.products = products;
            store.flash('Sample catalogue restored');
            store.set({});
          }
        }, 'Restore samples'),
        h('button', {
          class: 'btn btn-primary',
          onclick: () => store.set({ adminTab: 'catalogue', draftError: false, draft: { id: '', name: '', line: '', category: 'Figures', scale: '1/6', price: 9900, status: 'In stock', release: '', edition: '', featured: false, images: [], stock: 5, description: '' } })
        }, 'Add a piece')
      ])
    ]),
    h('div', { style: 'display:flex;gap:22px;margin:20px 0 22px;flex-wrap:wrap' }, [
      tabButton(store, 'catalogue', 'Catalogue'),
      tabButton(store, 'orders', `Orders (${s.adminOrders.length})`),
      tabButton(store, 'messages', `Enquiries (${unhandled})`),
      tabButton(store, 'demand', 'Demand')
    ]),
    s.adminTab === 'catalogue' ? catalogueTab(store)
      : s.adminTab === 'orders' ? ordersTab(store)
        : s.adminTab === 'messages' ? messagesTab(store)
          : demandTab(store)
  ]);
}
