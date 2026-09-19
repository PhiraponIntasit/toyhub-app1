import { h } from '../dom.js';
import { imgsOf, featuredOrder, pickRandom, money, bgUrl, MAX_FEATURED } from '../helpers.js';
import { plateBg, plateCard, infoCard } from './common.js';

// The hero plate opens the piece it is showing, so the image is as clickable as
// the "View the plate" button beside it.
function heroPlate(store, hero, heroImgs) {
  const frame = h('div', { 'data-enter-slow': true, style: 'position:relative;aspect-ratio:4/5;background:var(--color-surface);border:8px solid var(--color-surface);outline:1px solid var(--color-divider);overflow:hidden' }, [
    hero && heroImgs.length
      ? h('div', { 'data-kenburns': true, role: 'img', 'aria-label': hero.name, style: `position:absolute;inset:0;background-image:${bgUrl(heroImgs[0])};background-size:cover;background-position:center;filter:sepia(0.22) saturate(0.82) contrast(1.05)` })
      : h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px' }, [
        h('div', {}, [
          h('div', { style: 'font-family:var(--font-heading);font-size:20px;margin-bottom:6px' }, 'Plate pending'),
          h('div', { style: 'font-size:12px;opacity:0.6;max-width:26ch;margin:0 auto' }, 'Add a photograph for this piece from the Admin screen.')
        ])
      ])
  ]);
  if (!hero) return frame;
  return h('button', {
    class: 'lnk', style: 'display:block;width:100%;cursor:pointer',
    'aria-label': `View ${hero.name}`, onclick: () => store.go('product', hero.id)
  }, [frame]);
}

export function renderHome(store) {
  const s = store.state;
  const products = s.products;
  const feat = featuredOrder(products);
  const heroPool = (feat.length ? feat : products).slice(0, MAX_FEATURED);
  const hero = heroPool.length ? heroPool[s.heroI % heroPool.length] : null;
  const heroImgs = hero ? imgsOf(hero) : [];
  const brands = Array.from(new Set(products.map((p) => p.line))).filter(Boolean);
  const featured = pickRandom(products, 4, s.seed);
  const arrivals = products.slice(-3).reverse();

  return h('main', {}, [
    h('section', { style: 'max-width:1200px;margin:0 auto;padding:56px 24px 0' }, [
      h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:56px;align-items:center' }, [
        h('div', {}, [
          h('div', { 'data-enter': true, class: 'tnum', style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:18px' },
            `Plate ${String((s.heroI % Math.max(heroPool.length, 1)) + 1).padStart(2, '0')} — ${hero ? hero.line : 'ToyHub'}`),
          h('h1', { 'data-enter': true, style: 'font-size:clamp(38px,4.4vw,62px);font-weight:400;margin:0 0 18px;animation-delay:.06s' }, hero ? hero.name : 'No pieces catalogued'),
          h('p', { 'data-enter': true, class: 'just', style: 'max-width:44ch;font-size:15px;opacity:0.85;animation-delay:.12s' }, hero ? hero.description : 'Add your first piece from the Admin screen.'),
          h('div', { class: 'tnum', style: 'display:flex;align-items:baseline;gap:14px;margin:26px 0 22px' }, [
            h('span', { style: 'font-family:var(--font-heading);font-size:26px' }, hero ? money(hero.price) : ''),
            h('span', { style: 'font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6' }, hero ? hero.status : '')
          ]),
          h('div', { style: 'display:flex;gap:10px' }, [
            h('button', { class: 'btn btn-primary', disabled: !hero, onclick: () => hero && store.go('product', hero.id) }, 'View the plate'),
            h('button', { class: 'btn btn-secondary', onclick: () => store.go('shop') }, 'Browse catalogue')
          ]),
          h('div', { style: 'display:flex;align-items:center;gap:14px;margin-top:34px' }, [
            h('button', { class: 'btn btn-icon btn-secondary', 'aria-label': 'Previous', onclick: () => store.showHero(s.heroI + heroPool.length - 1) }, '←'),
            h('button', { class: 'btn btn-icon btn-secondary', 'aria-label': 'Next', onclick: () => store.showHero(s.heroI + 1) }, '→'),
            h('div', { style: 'display:flex;gap:8px;margin-left:6px' },
              heroPool.map((p, i) => h('button', {
                class: 'lnk', 'aria-label': 'Slide',
                style: `width:26px;height:2px;background:${i === s.heroI % heroPool.length ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                onclick: () => store.showHero(i)
              })))
          ])
        ]),
        heroPlate(store, hero, heroImgs)
      ])
    ]),

    h('section', { 'data-reveal': true, style: 'max-width:1200px;margin:64px auto 0;padding:0 24px' }, [
      h('div', { style: 'display:flex;align-items:baseline;gap:18px;border-top:1px solid var(--color-divider);border-bottom:1px solid var(--color-divider);padding:14px 0;flex-wrap:wrap' }, [
        h('span', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.55' }, 'Ateliers we carry'),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:26px;margin-left:auto' },
          brands.map((name) => h('span', { style: 'font-family:var(--font-heading);font-size:15px;letter-spacing:0.08em' }, name)))
      ])
    ]),

    h('section', { 'data-reveal': true, style: 'max-width:1200px;margin:64px auto 0;padding:0 24px' }, [
      h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:26px;flex-wrap:wrap' }, [
        h('div', {}, [
          h('h2', { style: 'font-weight:400;margin:0' }, 'Featured plates'),
          h('p', { style: 'font-size:13px;opacity:0.6;margin:6px 0 0' }, 'Drawn at random from the cabinet on every visit.')
        ]),
        h('div', { style: 'display:flex;gap:8px' }, [
          h('button', { class: 'btn btn-secondary', onclick: () => store.set({ seed: String(Math.random()) }) }, 'Draw again'),
          h('button', { class: 'btn btn-ghost', onclick: () => store.go('shop') }, 'All pieces →')
        ])
      ]),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:28px' },
        featured.map((p) => plateCard(store, p, { showActions: false })))
    ]),

    h('section', { 'data-reveal': true, style: 'max-width:1200px;margin:80px auto 0;padding:0 24px' }, [
      h('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--color-divider);padding-bottom:12px;margin-bottom:24px' }, [
        h('h2', { style: 'font-weight:400;margin:0' }, 'New arrivals'),
        h('span', { class: 'tnum', style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55' }, `${String(products.length).padStart(2, '0')} pieces added`)
      ]),
      h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px' },
        arrivals.map((p) => infoCard(store, p, { body: 'short', metaRight: 'status' })))
    ]),

    h('section', { id: 'story', 'data-reveal': true, style: 'max-width:1200px;margin:88px auto 0;padding:0 24px' }, [
      h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px;align-items:start;border-top:1px solid var(--color-divider);padding-top:34px' }, [
        h('div', {}, [
          h('div', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:14px' }, 'The shop'),
          h('h2', { style: 'font-size:34px;font-weight:400;margin:0 0 16px' }, 'A cabinet, not a toybox'),
          h('div', { 'data-cols2text': true, style: 'column-count:2;column-gap:32px;column-rule:1px solid var(--color-divider)' }, [
            h('p', { class: 'just', style: 'font-size:14px;opacity:0.85' }, 'ToyHub keeps a short list on purpose. Each piece is examined, photographed on the bench, and listed with its atelier, scale and edition size — nothing enters the cabinet unless we would keep it ourselves.'),
            h('p', { class: 'just', style: 'font-size:14px;opacity:0.85' }, 'Pre-orders are held at deposit and settled when the shipping window opens. Collectors are welcome to reserve a plate, ask for bench photographs, or leave a piece on hold while a shelf is being built for it.')
          ]),
          h('button', { class: 'btn btn-secondary', style: 'margin-top:22px', onclick: () => store.go('shop') }, 'Enter the catalogue')
        ]),
        h('figure', {}, [
          // The logo art sits on its own cream field, so the slot carries the same
          // colour and the image is contained rather than cropped — the panel reads
          // as one plate instead of a letterboxed picture.
          h('div', { class: 'imgslot', style: 'width:100%;aspect-ratio:5/4;border-radius:var(--radius-md);background:#fefbec;border-style:solid;overflow:hidden' }, [
            h('img', { src: 'images/toyhub-logo.webp', alt: 'ToyHub', style: 'object-fit:contain' })
          ]),
          h('figcaption', {}, 'Made with love, do with love.')
        ])
      ])
    ]),

    h('footer', { style: 'max-width:1200px;margin:88px auto 0;padding:26px 24px 64px;border-top:1px solid var(--color-divider);display:flex;gap:18px;flex-wrap:wrap;align-items:baseline' }, [
      h('span', { style: 'font-family:var(--font-heading);letter-spacing:0.14em' }, 'TOYHUB'),
      h('span', { style: 'font-size:12px;opacity:0.55' }, 'Collectible figures, statues and dioramas.'),
      h('button', { class: 'lnk', style: 'font-size:12px;color:var(--color-accent-700)', onclick: () => store.go('contact') }, 'Contact the shop'),
      h('span', { class: 'tnum', style: 'font-size:12px;opacity:0.55;margin-left:auto' }, `${products.length} pieces catalogued`)
    ])
  ]);
}
