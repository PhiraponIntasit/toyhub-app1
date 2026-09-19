import { h } from '../dom.js';
import { api } from '../api.js';
import { money } from '../helpers.js';
import { totalsFor } from './cart.js';
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
const checkoutRuntime = { stripe: null, elements: null, paymentElement: null, clientSecret: null, cartKey: null, pendingKey: null, failedKey: null };

// Lets a visitor retry a selection whose intent failed by leaving and coming back.
export function resetCheckoutFailure() {
  checkoutRuntime.failedKey = null;
}

// "Buy it now" checks out one piece on its own; otherwise the whole cart.
export function checkoutSelection(store) {
  const b = store.state.buyNow;
  if (b) return { cart: { [b.id]: Math.max(1, Number(b.qty) || 1) }, mode: { [b.id]: b.mode }, buyNow: b };
  return { cart: store.state.cart, mode: store.state.mode, buyNow: null };
}

export async function mountStripeCheckout(store) {
  const s = store.state;
  if (s.route !== 'checkout' || !store.isMember()) return;
  // Never touch the Element while Stripe is confirming against it.
  if (s.checkoutSubmitting) return;
  const { cart, mode } = checkoutSelection(store);
  const { lines } = totalsFor(store, cart, mode);
  if (!lines.length) return;
  if (!s.stripeConfig.stripeConfigured) return;

  const container = document.getElementById('payment-element');
  if (!container) return;

  const key = JSON.stringify({ cart, mode });
  if (checkoutRuntime.paymentElement && checkoutRuntime.cartKey === key) {
    // Same selection, same intent — just reattach the existing Element to the fresh container.
    try { checkoutRuntime.paymentElement.unmount(); } catch (e) { /* not mounted */ }
    checkoutRuntime.paymentElement.mount('#payment-element');
    return;
  }
  // render() calls this on every pass, so anything that re-renders here would
  // re-enter it. Track the in-flight and failed selections instead of touching
  // store state before the first await.
  if (checkoutRuntime.pendingKey === key || checkoutRuntime.failedKey === key) return;
  checkoutRuntime.pendingKey = key;
  checkoutRuntime.paymentElement = null;
  s.checkoutError = '';

  try {
    const Stripe = await loadStripeJs();
    const { clientSecret, publishableKey } = await api.createIntent({ cart, mode });
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
    checkoutRuntime.failedKey = key;
    store.set({ checkoutError: err.message || 'Could not start the payment.' });
  } finally {
    checkoutRuntime.pendingKey = null;
  }
}

// While a payment is confirming the button cannot be redrawn through the store:
// a render replaces the whole tree, which pulls the Stripe iframe out of the
// document and remounts it, and Stripe then rejects the confirm with "could not
// retrieve data from the specified Element". So it is updated where it stands.
function setPayButton(label, disabled) {
  const btn = document.querySelector('[data-key="checkout.pay"]');
  if (!btn) return;
  btn.textContent = label;
  btn.disabled = disabled;
}

async function pay(store) {
  const s = store.state;
  if (!checkoutRuntime.stripe || !checkoutRuntime.elements) return;
  s.checkoutSubmitting = true;
  s.checkoutError = '';
  setPayButton('Processing…', true);
  try {
    const { error, paymentIntent } = await checkoutRuntime.stripe.confirmPayment({
      elements: checkoutRuntime.elements, redirect: 'if_required'
    });
    if (error) {
      s.checkoutSubmitting = false;
      store.set({ checkoutError: error.message });
      return;
    }
    const { order } = await api.finalizeOrder({ paymentIntentId: paymentIntent.id });
    checkoutRuntime.paymentElement = null;
    checkoutRuntime.clientSecret = null;
    checkoutRuntime.cartKey = null;
    if (s.buyNow) {
      s.buyNow = null;
    } else {
      store.setCart({});
      store.setMode({});
    }
    store.state.lastOrder = order;
    await Promise.all([store.refreshProducts(), store.refreshMe()]);
    store.go('done');
    // Cleared only once the checkout screen is behind us, so no render along
    // the way tries to build a fresh intent for a cart that is already paid.
    s.checkoutSubmitting = false;
    store.flash('Confirmation email sent to ' + order.email);
  } catch (err) {
    s.checkoutSubmitting = false;
    store.set({ checkoutError: err.message });
  }
}

export function renderCheckout(store) {
  const s = store.state;
  const { cart, mode, buyNow } = checkoutSelection(store);
  const { lines, modeOf, subtotal, shipping, total } = totalsFor(store, cart, mode);
  if (!lines.length) {
    return h('main', { style: 'max-width:1100px;margin:0 auto;padding:40px 24px 90px' }, [
      emptyState('Your cart is empty', 'Add a piece before checking out.', 'Open the catalogue', () => store.go('shop'))
    ]);
  }
  const me = s.user;

  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:40px 24px 90px' }, [
    buyNow
      ? h('button', { class: 'btn btn-ghost', style: 'margin-bottom:20px', onclick: () => store.go('product', buyNow.id) }, '← Back to the piece')
      : h('button', { class: 'btn btn-ghost', style: 'margin-bottom:20px', onclick: () => store.go('cart') }, '← Cart'),
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
          class: 'btn btn-primary btn-block', type: 'button', 'data-key': 'checkout.pay',
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
              h('div', { class: 'tnum', style: 'font-size:11px;opacity:0.55' }, `${cart[p.id]} × ${money(p.price)}`)
            ]),
            h('td', { style: 'text-align:right' }, money(dueOf(p, modeOf(p)) * cart[p.id]))
          ])))
        ]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px;margin-top:14px' }, [h('span', { style: 'opacity:0.7' }, 'Subtotal'), h('span', {}, money(subtotal))]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px' }, [h('span', { style: 'opacity:0.7' }, 'Insured carriage'), h('span', {}, shipping ? money(shipping) : '—')]),
        h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);margin-top:10px;padding-top:10px' }, [
          h('span', { style: 'font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7' }, 'Due now'),
          h('span', { class: 'price', style: 'font-size:24px' }, money(total))
        ])
      ])
    ])
  ]);
}
