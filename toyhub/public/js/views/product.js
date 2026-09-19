import { h } from '../dom.js';
import { imgsOf, stockOf, soldOutOf, dueOf, depositOf, money, bgUrl, DEPOSIT_PCT } from '../helpers.js';
import { infoCard, emptyState } from './common.js';
import { openLightbox } from './lightbox.js';

const sectionLabel = (text) => h('div', {
  style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:8px'
}, text);

// One way of paying, chosen rather than acted on — picking it changes what the
// buttons below will do instead of putting the piece in the cart there and then.
function payOption(store, { on, title, now, later, onSelect }) {
  return h('button', {
    class: 'lnk', 'aria-pressed': on ? 'true' : 'false', onclick: onSelect,
    style: `display:flex;align-items:baseline;gap:12px;width:100%;text-align:left;padding:12px 14px;
      border:1px solid ${on ? 'var(--color-accent)' : 'var(--color-divider)'};border-radius:var(--radius-md);
      background:${on ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent'}`
  }, [
    h('span', { style: `width:14px;height:14px;flex:none;border-radius:50%;margin-top:3px;border:1px solid ${on ? 'var(--color-accent)' : 'var(--color-divider)'};background:${on ? 'var(--color-accent)' : 'transparent'}` }),
    h('span', { style: 'flex:1' }, [
      h('span', { style: 'display:block;font-size:14px' }, title),
      h('span', { class: 'tnum', style: 'display:block;font-size:12px;opacity:0.7;margin-top:2px' }, later)
    ]),
    h('span', { class: 'price', style: 'font-size:16px;white-space:nowrap' }, now)
  ]);
}

export function renderProduct(store) {
  const s = store.state;
  const pd = s.products.find((p) => p.id === s.pid);
  if (!pd) {
    return h('main', { style: 'max-width:1200px;margin:0 auto;padding:32px 24px 80px' }, [
      emptyState('Piece not found', 'It may have been removed from the catalogue.', 'Back to catalogue', () => store.go('shop'))
    ]);
  }
  const admin = store.isAdmin();
  const imgs = imgsOf(pd);
  const imgI = Math.min(s.pdImgI, Math.max(imgs.length - 1, 0));
  const canOrder = !admin && !soldOutOf(pd);
  const isPreorder = pd.status === 'Pre-order' && canOrder;
  const wished = s.wishIds.indexOf(pd.id) > -1;
  // Nothing is committed until Add to cart or Buy it now: these only say what
  // those buttons will do.
  const mode = pd.status === 'Pre-order' ? (s.pdMode === 'full' ? 'full' : 'deposit') : 'full';
  const maxQty = Math.max(stockOf(pd), 1);
  const qty = Math.min(Math.max(1, Number(s.pdQty) || 1), maxQty);

  // The entrance animation belongs to arriving at the piece, not to every
  // render — without this it replays each time a payment option is chosen.
  const entering = !s.pdEntered;
  s.pdEntered = true;
  const related = s.products.filter((p) => p.id !== pd.id && p.line === pd.line)
    .concat(s.products.filter((p) => p.id !== pd.id && p.line !== pd.line)).slice(0, 4);

  // Swapping the plate in place rather than through the store: a render rebuilds
  // the whole page, which replays the entrance animation on the name and the
  // description — read as a flicker every time the photograph changed.
  // Without a render there is nothing to recompute imgI, so the arrows step from
  // whatever is on screen now rather than from the index this pass was drawn with.
  const currentPhoto = () => Math.min(s.pdImgI, Math.max(imgs.length - 1, 0));
  const showPhoto = (i) => {
    const next = (i + imgs.length) % imgs.length;
    s.pdImgI = next;
    const plate = document.querySelector('[data-gallery] [data-plate-img]');
    if (plate) plate.style.backgroundImage = bgUrl(imgs[next]);
    document.querySelectorAll('[data-thumb]').forEach((el) => {
      const on = Number(el.getAttribute('data-thumb')) === next;
      el.style.outlineColor = on ? 'var(--color-accent)' : 'var(--color-divider)';
    });
  };

  // Stepping through the viewer keeps the page behind it on the same photograph.
  const viewFullSize = () => openLightbox({
    images: imgs, index: currentPhoto(), label: pd.name, onChange: showPhoto
  });

  const buyNow = () => {
    if (admin) { store.flash('Administrator accounts cannot place orders'); return; }
    if (!s.user) { store.go('login'); store.flash('Sign in to buy this piece'); return; }
    if (soldOutOf(pd)) { store.flash(pd.name + ' is sold out'); return; }
    s.buyNow = { id: pd.id, mode, qty };
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
        h('div', { 'data-plate': true, 'data-gallery': true, 'data-enter-slow': entering, style: 'position:relative;aspect-ratio:4/5;background:var(--color-surface);border:8px solid var(--color-surface);outline:1px solid var(--color-divider);overflow:hidden' }, [
          imgs.length
            ? h('div', {
              'data-plate-img': true, role: 'button', tabindex: '0',
              'aria-label': `View ${pd.name} full size`,
              style: `position:absolute;inset:0;background-image:${bgUrl(imgs[imgI])};background-size:contain;background-repeat:no-repeat;background-position:center;filter:sepia(0.22) saturate(0.82) contrast(1.05);cursor:zoom-in`,
              onclick: viewFullSize,
              onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); viewFullSize(); } }
            })
            : h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:26px' }, [
              h('div', {}, [
                h('div', { style: 'font-family:var(--font-heading);font-size:20px;margin-bottom:6px' }, 'Plate pending'),
                h('div', { style: 'font-size:12px;opacity:0.6;max-width:26ch;margin:0 auto' }, 'Add photographs for this piece in Admin — one image address per line.')
              ])
            ]),
          imgs.length > 1 ? h('button', {
            class: 'gallery-nav', style: 'left:10px', 'aria-label': 'Previous photograph',
            onclick: () => showPhoto(currentPhoto() - 1)
          }, '‹') : null,
          imgs.length > 1 ? h('button', {
            class: 'gallery-nav', style: 'right:10px', 'aria-label': 'Next photograph',
            onclick: () => showPhoto(currentPhoto() + 1)
          }, '›') : null
        ]),
        imgs.length > 1 ? h('div', { style: 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap' },
          imgs.map((src, i) => h('button', {
            class: 'lnk', 'aria-label': 'View photograph', 'data-thumb': String(i),
            style: `width:64px;height:78px;background-image:${bgUrl(src)};background-size:cover;background-position:center;border:4px solid var(--color-surface);outline:1px solid ${i === imgI ? 'var(--color-accent)' : 'var(--color-divider)'};filter:sepia(0.22) saturate(0.82) contrast(1.05)`,
            onclick: () => showPhoto(i)
          }))) : null
      ]),
      h('div', {}, [
        h('div', { 'data-enter': entering, style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, pd.line),
        h('h1', { 'data-enter': entering, style: 'font-size:clamp(30px,3.4vw,44px);font-weight:400;margin:10px 0 14px;animation-delay:.06s' }, pd.name),
        h('p', { 'data-enter': entering, class: 'just', style: 'font-size:15px;opacity:0.85;max-width:52ch;animation-delay:.12s' }, pd.description),
        h('div', { class: 'tnum', style: 'display:flex;align-items:baseline;gap:16px;margin:24px 0 20px;border-top:1px solid var(--color-divider);padding-top:18px' }, [
          h('span', { class: 'price', style: 'font-size:30px' }, money(pd.price)),
          h('span', { class: 'tag tag-outline' }, pd.status)
        ]),
        h('div', { class: 'tnum', style: 'font-size:12px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.65;margin-bottom:14px' },
          soldOutOf(pd) ? 'Sold out' : (admin ? `${stockOf(pd)} left in stock` : (pd.status === 'Pre-order' ? 'Open for reservation' : 'Available now'))),
        isPreorder ? h('div', { style: 'margin-bottom:18px' }, [
          sectionLabel('Payment'),
          h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [
            payOption(store, {
              on: mode === 'deposit',
              title: `Deposit ${DEPOSIT_PCT}%`,
              now: money(depositOf(pd) * qty),
              later: `Balance ${money((Number(pd.price) - depositOf(pd)) * qty)} + carriage when it ships`,
              onSelect: () => store.set({ pdMode: 'deposit' })
            }),
            payOption(store, {
              on: mode === 'full',
              title: 'Full payment',
              now: money(Number(pd.price) * qty),
              later: 'Carriage when it ships',
              onSelect: () => store.set({ pdMode: 'full' })
            })
          ]),
          h('p', { style: 'font-size:12px;opacity:0.65;margin:10px 0 0;max-width:48ch' },
            `Reservations close one month before the shipping window ${pd.release ? `(${pd.release})` : ''} opens.`)
        ]) : null,

        canOrder ? h('div', { style: 'margin-bottom:18px' }, [
          sectionLabel('Quantity'),
          h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' }, [
            h('div', { style: 'display:flex;align-items:center;border:1px solid var(--color-divider);border-radius:var(--radius-md)' }, [
              h('button', { class: 'lnk', style: 'width:38px;height:38px;font-size:18px', 'aria-label': 'One fewer', disabled: qty <= 1, onclick: () => store.set({ pdQty: qty - 1 }) }, '−'),
              h('span', { class: 'tnum', style: 'min-width:34px;text-align:center;font-size:15px' }, String(qty)),
              h('button', { class: 'lnk', style: 'width:38px;height:38px;font-size:18px', 'aria-label': 'One more', disabled: qty >= maxQty, onclick: () => store.set({ pdQty: qty + 1 }) }, '+')
            ]),
            h('span', { class: 'tnum', style: 'font-size:13px;opacity:0.75' },
              `Due now ${money(dueOf(pd, mode) * qty)}`)
          ])
        ]) : null,

        h('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [
          canOrder ? h('button', { class: 'btn btn-primary', onclick: () => store.addToCart(pd, mode, qty) }, 'Add to cart') : null,
          canOrder ? h('button', { class: 'btn btn-secondary', onclick: buyNow }, 'Buy it now') : null,
          admin ? h('button', { class: 'btn btn-primary', disabled: true }, 'Staff account — ordering disabled') : null,
          h('button', { class: 'btn btn-secondary', onclick: () => store.toggleWish(pd) },
            wished ? '♥ Saved' : (soldOutOf(pd) ? '♡ Notify me when back' : '♡ Save this piece'))
        ]),
        h('table', { class: 'table tnum', style: 'margin-top:34px' }, [
          h('tbody', {}, specs.map(([k, v]) => h('tr', {}, [h('th', { style: 'width:38%' }, k), h('td', {}, v)])))
        ]),
        // Written by the shop in the piece dialog; absent until someone writes it.
        pd.details ? h('div', { style: 'margin-top:34px' }, [
          h('h2', { style: 'font-size:23px;margin:0 0 12px' }, "What's Included"),
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
