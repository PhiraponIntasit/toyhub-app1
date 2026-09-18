import { h } from '../dom.js';
import { api } from '../api.js';
import { money } from '../helpers.js';
import { cartTotals, cartModeOf } from './cart.js';
import { dueOf } from '../helpers.js';
import { emptyState } from './common.js';

let stripeJsPromise = null;
function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve(window.Stripe);
      s.onerror = () => reject(new Error('Could not load the payment gateway script.'));
      document.head.appendChild(s);
    });
  }
  return stripeJsPromise;
}

// Elements is a Stripe-hosted iframe, so it must persist across our
// otherwise full-tree re-renders instead of being torn down and recreated.
const checkoutRuntime = { stripe: null, elements: null, paymentElement: null, clientSecret: null, cartKey: null };

function cartKeyOf(store) {
  return JSON.stringify({ cart: store.state.cart, mode: store.state.mode });
}

export async function mountStripeCheckout(store) {
  const s = store.state;
  if (s.route !== 'checkout' || !store.isMember()) return;
  const { lines, total } = cartTotals(store);
  if (!lines.length) return;
  if (!s.stripeConfig.stripeConfigured) return;

  const container = document.getElementById('payment-element');
  if (!container) return;

  const key = cartKeyOf(store);
  if (checkoutRuntime.paymentElement && checkoutRuntime.cartKey === key) {
    // Same cart, same intent — just reattach the existing Element to the fresh container.
    try { checkoutRuntime.paymentElement.unmount(); } catch (e) { /* not mounted */ }
    checkoutRuntime.paymentElement.mount('#payment-element');
    return;
  }

  try {
    checkoutRuntime.paymentElement = null;
    store.set({ checkoutError: '' });
    const Stripe = await loadStripeJs();
    const { clientSecret, publishableKey } = await api.createIntent({ cart: s.cart, mode: s.mode });
    checkoutRuntime.stripe = Stripe(publishableKey);
    checkoutRuntime.clientSecret = clientSecret;
    checkoutRuntime.cartKey = key;
    checkoutRuntime.elements = checkoutRuntime.stripe.elements({
      clientSecret,
      appearance: {
        theme: s.theme === 'dark' ? 'night' : 'stripe',
        variables: {
          colorPrimary: '#b68235', colorText: s.theme === 'dark' ? '#efebe5' : '#201f1d',
          colorBackground: 'transparent', fontFamily: 'Lora, system-ui, sans-serif', borderRadius: '4px'
        }
      }
    });
    checkoutRuntime.paymentElement = checkoutRuntime.elements.create('payment');
    checkoutRuntime.paymentElement.mount('#payment-element');
  } catch (err) {
    store.set({ checkoutError: err.message || 'Could not start the payment.' });
  }
}

async function pay(store) {
  const s = store.state;
  if (!checkoutRuntime.stripe || !checkoutRuntime.elements) return;
  store.set({ checkoutSubmitting: true, checkoutError: '' });
  try {
    const { error, paymentIntent } = await checkoutRuntime.stripe.confirmPayment({
      elements: checkoutRuntime.elements, redirect: 'if_required'
    });
    if (error) { store.set({ checkoutSubmitting: false, checkoutError: error.message }); return; }
    const { order } = await api.finalizeOrder({ paymentIntentId: paymentIntent.id });
    checkoutRuntime.paymentElement = null;
    checkoutRuntime.clientSecret = null;
    store.setCart({});
    store.setMode({});
    store.state.lastOrder = order;
    store.state.checkoutSubmitting = false;
    await Promise.all([store.refreshProducts(), store.refreshMe()]);
    store.go('done');
    store.flash('Confirmation email sent to ' + order.email);
  } catch (err) {
    store.set({ checkoutSubmitting: false, checkoutError: err.message });
  }
}

export function renderCheckout(store) {
  const s = store.state;
  const { lines, subtotal, shipping, total } = cartTotals(store);
  if (!lines.length) {
    return h('main', { style: 'max-width:1100px;margin:0 auto;padding:40px 24px 90px' }, [
      emptyState('Your cart is empty', 'Add a piece before checking out.', 'Open the catalogue', () => store.go('shop'))
    ]);
  }
  const me = s.user;

  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:40px 24px 90px' }, [
    h('button', { class: 'btn btn-ghost', style: 'margin-bottom:20px', onclick: () => store.go('cart') }, '← Cart'),
    h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:52px;align-items:start' }, [
      h('div', { style: 'display:flex;flex-direction:column;gap:16px' }, [
        h('div', {}, [
          h('h1', { 'data-enter': true, style: 'font-size:34px;font-weight:400;margin:0 0 6px' }, 'Payment'),
          h('p', { style: 'font-size:13px;opacity:0.6;margin:0' }, 'Credit card only — no other method is accepted for insured collectibles.'),
          h('p', { style: 'font-size:12px;opacity:0.55;margin:8px 0 0;max-width:52ch' }, 'Processed by Stripe in test mode — card details go straight to Stripe, never through this server. Use test card 4242 4242 4242 4242, any future expiry, any CVC.')
        ]),
        s.stripeConfig.stripeConfigured
          ? h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px' }, [
            h('div', { id: 'payment-element' }, [h('div', { style: 'font-size:13px;opacity:0.6' }, 'Loading payment form…')])
          ])
          : h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px;font-size:13px;opacity:0.75' },
            'Payment gateway not configured yet — the shop needs to add Stripe test keys (see .env.example) before checkout can be completed.'),
        h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px' }, [
          h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:10px' }, 'Shipping to'),
          h('div', { style: 'font-family:var(--font-heading);font-size:18px' }, me ? me.name : ''),
          h('div', { style: 'font-size:13px;opacity:0.8;white-space:pre-line;margin-top:4px' }, me ? me.address : ''),
          h('div', { class: 'tnum', style: 'font-size:13px;opacity:0.8' }, me ? `${me.phone} — ${me.email}` : '')
        ]),
        s.checkoutError ? h('div', { style: 'font-size:12px;color:var(--color-accent-700)' }, s.checkoutError) : null,
        h('button', {
          class: 'btn btn-primary btn-block', type: 'button',
          disabled: !s.stripeConfig.stripeConfigured || s.checkoutSubmitting,
          onclick: () => pay(store)
        }, s.checkoutSubmitting ? 'Processing…' : `Pay ${money(total)}`)
      ]),
      h('aside', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px' }, [
        h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:12px' }, 'Order'),
        h('table', { class: 'table tnum' }, [
          h('tbody', {}, lines.map((p) => h('tr', {}, [
            h('td', {}, [
              h('div', { style: 'font-family:var(--font-heading);font-size:15px' }, p.name),
              h('div', { class: 'tnum', style: 'font-size:11px;opacity:0.55' }, `${s.cart[p.id]} × ${money(p.price)}`)
            ]),
            h('td', { style: 'text-align:right' }, money(dueOf(p, cartModeOf(store, p)) * s.cart[p.id]))
          ])))
        ]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px;margin-top:14px' }, [h('span', { style: 'opacity:0.7' }, 'Subtotal'), h('span', {}, money(subtotal))]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px' }, [h('span', { style: 'opacity:0.7' }, 'Insured carriage'), h('span', {}, shipping ? money(shipping) : '—')]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);margin-top:10px;padding-top:10px' }, [
          h('span', { style: 'font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7' }, 'Due now'),
          h('span', { style: 'font-family:var(--font-heading);font-size:24px' }, money(total))
        ])
      ])
    ])
  ]);
}
