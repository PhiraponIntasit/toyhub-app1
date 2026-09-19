import { h } from '../dom.js';
import { api } from '../api.js';
import { money, dateLabel, DEPOSIT_PCT } from '../helpers.js';
import { loadStripeJs, elementsAppearance } from './checkout.js';
import { emptyState } from './common.js';

// The same reasoning as the checkout runtime: an Element is a Stripe-hosted
// iframe, so it has to outlive our full-tree re-renders.
const runtime = { stripe: null, elements: null, element: null, ref: null, pendingRef: null, failedRef: null };

export function resetBalanceFailure() {
  runtime.failedRef = null;
}

function orderFor(store) {
  return store.state.myOrders.find((o) => o.ref === store.state.pid) || null;
}

export async function mountBalanceStripe(store) {
  const s = store.state;
  if (s.route !== 'balance' || !store.isMember()) return;
  if (s.balanceSubmitting) return;
  if (!s.stripeConfig.stripeConfigured) return;
  const order = orderFor(store);
  if (!order || order.balanceDue <= 0) return;
  if (!document.getElementById('balance-element')) return;

  if (runtime.element && runtime.ref === order.ref) {
    try { runtime.element.unmount(); } catch (e) { /* not mounted */ }
    runtime.element.mount('#balance-element');
    return;
  }
  if (runtime.pendingRef === order.ref || runtime.failedRef === order.ref) return;
  runtime.pendingRef = order.ref;
  runtime.element = null;
  s.balanceError = '';

  try {
    const Stripe = await loadStripeJs();
    const { clientSecret, publishableKey } = await api.balanceIntent(order.ref);
    runtime.stripe = Stripe(publishableKey);
    runtime.ref = order.ref;
    runtime.elements = runtime.stripe.elements({ clientSecret, appearance: elementsAppearance(s.theme) });
    runtime.element = runtime.elements.create('payment');
    runtime.element.mount('#balance-element');
  } catch (err) {
    runtime.failedRef = order.ref;
    store.set({ balanceError: err.message || 'Could not start the payment.' });
  } finally {
    runtime.pendingRef = null;
  }
}

function setPayButton(label, disabled) {
  const btn = document.querySelector('[data-key="balance.pay"]');
  if (!btn) return;
  btn.textContent = label;
  btn.disabled = disabled;
}

async function pay(store, order) {
  const s = store.state;
  if (!runtime.stripe || !runtime.elements) return;
  s.balanceSubmitting = true;
  s.balanceError = '';
  setPayButton('Processing…', true);
  try {
    const { error, paymentIntent } = await runtime.stripe.confirmPayment({
      elements: runtime.elements, redirect: 'if_required'
    });
    if (error) {
      s.balanceSubmitting = false;
      store.set({ balanceError: error.message });
      return;
    }
    await api.balanceFinalize(order.ref, { paymentIntentId: paymentIntent.id });
    runtime.element = null;
    runtime.elements = null;
    runtime.ref = null;
    await store.refreshMe();
    store.go('orders');
    s.balanceSubmitting = false;
    store.flash('Balance settled — ' + order.ref + ' is being packed');
  } catch (err) {
    s.balanceSubmitting = false;
    store.set({ balanceError: err.message });
  }
}

export function renderBalance(store) {
  const s = store.state;
  const order = orderFor(store);
  const wrap = (kid) => h('main', { style: 'max-width:820px;margin:0 auto;padding:40px 24px 90px' }, [kid]);

  if (!order) {
    return wrap(emptyState('Order not found', 'This order is not on your account.', 'Your orders', () => store.go('orders')));
  }
  if (order.balanceDue <= 0) {
    return wrap(emptyState('Nothing outstanding', 'There is no balance to settle on ' + order.ref + '.', 'Your orders', () => store.go('orders')));
  }

  const carriage = order.balanceShipping;
  const piece = order.balanceDue - carriage;

  return wrap(h('div', {}, [
    h('button', { class: 'btn btn-ghost', style: 'margin-bottom:20px', onclick: () => store.go('orders') }, '← Your orders'),
    h('h1', { 'data-enter': true, style: 'font-size:34px;font-weight:400;margin:0 0 6px' }, 'Settle the balance'),
    h('p', { style: 'font-size:13px;opacity:0.6;margin:0 0 4px' }, `Order ${order.ref} — your piece has arrived at the shop.`),
    h('p', { style: 'font-size:12px;opacity:0.55;margin:0 0 22px;max-width:60ch' },
      `The ${DEPOSIT_PCT}% deposit is already paid. What is left is the rest of the piece plus insured carriage, worked out from the box it ships in` +
      (order.balanceRequestedAt ? ` on ${dateLabel(order.balanceRequestedAt)}.` : '.')),

    h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px;margin-bottom:16px' }, [
      h('div', { style: 'font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.55;margin-bottom:12px' }, 'Outstanding'),
      ...order.items
        .filter((it) => it.mode === 'deposit')
        .map((it) => h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;gap:14px;font-size:14px;margin-bottom:6px' }, [
          h('span', {}, `${it.qty} × ${it.name}`),
          h('span', { style: 'opacity:0.75' }, money((it.price - it.due) * it.qty))
        ])),
      h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px;border-top:1px solid var(--color-divider);margin-top:10px;padding-top:10px' }, [
        h('span', { style: 'opacity:0.7' }, 'Balance on the piece'), h('span', {}, money(piece))
      ]),
      h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;font-size:13px' }, [
        h('span', { style: 'opacity:0.7' }, 'Insured carriage'), h('span', {}, carriage ? money(carriage) : '—')
      ]),
      h('div', { class: 'tnum', style: 'display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);margin-top:10px;padding-top:10px' }, [
        h('span', { style: 'font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7' }, 'Due now'),
        h('span', { class: 'price', style: 'font-size:24px' }, money(order.balanceDue))
      ])
    ]),

    s.stripeConfig.stripeConfigured
      ? h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px' }, [
        h('div', { id: 'balance-element' }, [h('div', { style: 'font-size:13px;opacity:0.6' }, 'Loading payment form…')])
      ])
      : h('div', { style: 'border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:22px;font-size:13px;opacity:0.75' },
        'Payment gateway not configured yet — the shop needs to add Stripe test keys before a balance can be settled.'),

    s.balanceError ? h('div', { style: 'font-size:12px;color:var(--color-accent-700);margin-top:12px' }, s.balanceError) : null,
    h('button', {
      class: 'btn btn-primary btn-block', type: 'button', 'data-key': 'balance.pay',
      style: 'margin-top:16px',
      disabled: !s.stripeConfig.stripeConfigured || s.balanceSubmitting,
      onclick: () => pay(store, order)
    }, s.balanceSubmitting ? 'Processing…' : `Pay ${money(order.balanceDue)}`)
  ]));
}
