import { h } from '../dom.js';
import { imgsOf, stockOf, soldOutOf, dueOf, depositOf, money, bgUrl, DEPOSIT_PCT } from '../helpers.js';
import { infoCard, emptyState } from './common.js';

export function renderProduct(store) {
  const s = store.state;
  const pd = s.products.find((p) => p.id === s.pid);
  if (!pd) {
    return h('main', { style: 'max-width:1200px;margin:0 auto;padding:32px 24px 80px' }, [
      emptyState('Piece not found', 'It may have been removed from the catalogue.', 'Back to catalogue', () => store.go('shop'))
    ]);
  }
  const admin = store.isAdmin();
  const canBuy = !admin;
  const imgs = imgsOf(pd);
  const imgI = Math.min(s.pdImgI, Math.max(imgs.length - 1, 0));
  const soldOut = soldOutOf(pd) || admin;
  const isPreorder = pd.status === 'Pre-order' && !soldOutOf(pd) && canBuy;
  const isStocked = pd.status !== 'Pre-order' || soldOutOf(pd) || admin;
  const wished = s.wishIds.indexOf(pd.id) > -1;
  const related = s.products.filter((p) => p.id !== pd.id && p.line === pd.line)
    .concat(s.products.filter((p) => p.id !== pd.id && p.line !== pd.line)).slice(0, 4);

  const buyNow = () => {
    if (admin) { store.flash('Administrator accounts cannot place orders'); return; }
    if (!s.user) { store.go('login'); store.flash('Sign in to buy this piece'); return; }
    if (soldOutOf(pd)) { store.flash(pd.name + ' is sold out'); return; }
    s.buyNow = { id: pd.id, mode: pd.status === 'Pre-order' ? 'deposit' : 'full' };
    s.checkoutError = '';
    store.go('checkout');
  };

  // How many are left is stock-keeping, not a selling point — only staff see it.
  const specs = [
    ['Brand', pd.line], ['Category', pd.category], ['Scale', pd.scale || '—'],
    ['Shipping window', pd.release || 'Ships now']
  ].concat(admin ? [['Units left', String(stockOf(pd))]] : []);

  return h('main', { style: 'max-width:1200px;margin:0 auto;padding:32px 24px 80px' }, [
    h('button', { class: 'btn btn-ghost', style: 'margin-bottom:22px', onclick: () => store.go('shop') }, '← Catalogue'),
    h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,0.95fr);gap:56px;align-items:start' }, [
      h('div', {}, [
        h('div', { 'data-plate': true, 'data-gallery': true, 'data-enter-slow': true, style: 'position:relative;aspect-ratio:4/5;background:var(--color-surface);border:8px solid var(--color-surface);outline:1px solid var(--color-divider);overflow:hidden' }, [
          imgs.length
            ? h('div', { role: 'img', 'aria-label': pd.name, style: `position:absolute;inset:0;background-image:${bgUrl(imgs[imgI])};background-size:cover;background-position:center;filter:sepia(0.22) saturate(0.82) contrast(1.05)` })
            : h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:26px' }, [
              h('div', {}, [
                h('div', { style: 'font-family:var(--font-heading);font-size:20px;margin-bottom:6px' }, 'Plate pending'),
                h('div', { style: 'font-size:12px;opacity:0.6;max-width:26ch;margin:0 auto' }, 'Add photographs for this piece in Admin — one image address per line.')
              ])
            ]),
          imgs.length > 1 ? h('button', {
            class: 'gallery-nav', style: 'left:10px', 'aria-label': 'Previous photograph',
            onclick: () => store.set({ pdImgI: (imgI + imgs.length - 1) % imgs.length })
          }, '‹') : null,
          imgs.length > 1 ? h('button', {
            class: 'gallery-nav', style: 'right:10px', 'aria-label': 'Next photograph',
            onclick: () => store.set({ pdImgI: (imgI + 1) % imgs.length })
          }, '›') : null
        ]),
        imgs.length > 1 ? h('div', { style: 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap' },
          imgs.map((src, i) => h('button', {
            class: 'lnk', 'aria-label': 'View photograph',
            style: `width:64px;height:78px;background-image:url("${src}");background-size:cover;background-position:center;border:4px solid var(--color-surface);outline:1px solid ${i === imgI ? 'var(--color-accent)' : 'var(--color-divider)'};filter:sepia(0.22) saturate(0.82) contrast(1.05)`,
            onclick: () => store.set({ pdImgI: i })
          }))) : null
      ]),
      h('div', {}, [
        h('div', { 'data-enter': true, style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, pd.line),
        h('h1', { 'data-enter': true, style: 'font-size:clamp(30px,3.4vw,44px);font-weight:400;margin:10px 0 14px;animation-delay:.06s' }, pd.name),
        h('p', { 'data-enter': true, class: 'just', style: 'font-size:15px;opacity:0.85;max-width:52ch;animation-delay:.12s' }, pd.description),
        h('div', { class: 'tnum', style: 'display:flex;align-items:baseline;gap:16px;margin:24px 0 20px;border-top:1px solid var(--color-divider);padding-top:18px' }, [
          h('span', { style: 'font-family:var(--font-heading);font-size:30px' }, money(pd.price)),
          h('span', { class: 'tag tag-outline' }, pd.status)
        ]),
        h('div', { class: 'tnum', style: 'font-size:12px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.65;margin-bottom:14px' },
          soldOutOf(pd) ? 'Sold out' : (admin ? `${stockOf(pd)} left in stock` : (pd.status === 'Pre-order' ? 'Open for reservation' : 'Available now'))),
        isPreorder ? h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:18px;margin-bottom:18px' }, [
          h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:8px' }, 'Pre-order terms'),
          h('div', { class: 'tnum', style: 'font-size:14px' }, `Shipping window ${pd.release || 'to be announced'}`),
          h('p', { class: 'just', style: 'font-size:13px;opacity:0.78;margin:8px 0 14px;max-width:48ch' }, 'Reservations close one month before the window opens. Take it on a 30% deposit — the balance and insured carriage fall due when the piece ships — or settle it in full today.'),
          h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
            h('button', { class: 'btn btn-primary', disabled: soldOut, onclick: () => store.addToCart(pd, 'deposit') }, `Reserve — ${money(depositOf(pd))} deposit`),
            h('button', { class: 'btn btn-secondary', disabled: soldOut, onclick: () => store.addToCart(pd, 'full') }, `Pay in full — ${money(pd.price)}`),
            h('button', { class: 'btn btn-ghost', disabled: soldOut, onclick: buyNow }, 'Pre-order it now →')
          ])
        ]) : null,
        h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [
          isStocked ? h('button', {
            class: 'btn btn-primary', disabled: soldOut,
            onclick: () => store.addToCart(pd)
          }, admin ? 'Staff account — ordering disabled' : (soldOutOf(pd) ? 'Sold out' : (pd.status === 'Pre-order' ? 'Reserve with deposit' : 'Add to cart'))) : null,
          isStocked ? h('button', { class: 'btn btn-secondary', disabled: soldOut, onclick: buyNow }, 'Buy it now') : null,
          h('button', { class: 'btn btn-secondary', onclick: () => store.toggleWish(pd) },
            wished ? '♥ Saved' : (soldOutOf(pd) ? '♡ Notify me when back' : '♡ Save this piece'))
        ]),
        h('table', { class: 'table tnum', style: 'margin-top:34px' }, [
          h('tbody', {}, specs.map(([k, v]) => h('tr', {}, [h('th', { style: 'width:38%' }, k), h('td', {}, v)])))
        ]),
        // Written by the shop in the piece dialog; absent until someone writes it.
        pd.details ? h('div', { style: 'margin-top:34px;border-top:1px solid var(--color-divider);padding-top:20px' }, [
          h('h2', { style: 'font-size:17px;font-weight:400;margin:0 0 10px' }, "What's Included"),
          h('p', { style: 'font-size:14px;opacity:0.85;margin:0;white-space:pre-line' }, pd.details)
        ]) : null
      ])
    ]),
    related.length ? h('section', { 'data-reveal': true, style: 'margin-top:72px' }, [
      h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--color-divider);padding-bottom:12px;margin-bottom:24px' }, [
        h('h2', { style: 'font-weight:400;margin:0' }, 'From the same shelf')
      ]),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:26px' },
        related.map((p) => infoCard(store, p, { image: true })))
    ]) : null
  ]);
}
