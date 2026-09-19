import { store, parseHash } from './state.js';
import { mount, h } from './dom.js';
import { renderHeader } from './views/header.js';
import { renderHome } from './views/home.js';
import { renderShop } from './views/shop.js';
import { renderProduct } from './views/product.js';
import { renderCart } from './views/cart.js';
import { renderLogin, renderSignup } from './views/auth.js';
import { renderCheckout, mountStripeCheckout, resetCheckoutFailure } from './views/checkout.js';
import { renderDone } from './views/done.js';
import { renderOrders } from './views/orders.js';
import { renderWishlist } from './views/wishlist.js';
import { renderContact } from './views/contact.js';
import { renderAdmin } from './views/admin.js';
import { renderDraftDialog } from './views/draftDialog.js';
import { toastNode } from './views/common.js';

const appEl = document.getElementById('app');

function routeMain(store) {
  const s = store.state;
  const admin = store.isAdmin();
  const member = store.isMember();

  if (s.route === 'admin' && !admin) return renderLogin(store);
  if ((s.route === 'orders' || s.route === 'wishlist') && !s.user) return renderLogin(store);
  if ((s.route === 'cart' || s.route === 'checkout') && admin) return renderAdmin(store);

  switch (s.route) {
    case 'home': return renderHome(store);
    case 'shop': return renderShop(store);
    case 'product': return renderProduct(store);
    case 'cart': return renderCart(store);
    case 'login': return renderLogin(store);
    case 'signup': return renderSignup(store);
    case 'checkout': return renderCheckout(store);
    case 'done': return renderDone(store);
    case 'orders': return member ? renderOrders(store) : renderLogin(store);
    case 'wishlist': return member ? renderWishlist(store) : renderLogin(store);
    case 'contact': return renderContact(store);
    case 'admin': return renderAdmin(store);
    default: return renderHome(store);
  }
}

// A full re-render replaces every DOM node, which would normally steal focus
// out of whatever text field the visitor is typing in — so capture the
// focused field's identity + cursor position first and restore it after.
function render() {
  const active = document.activeElement;
  let focusInfo = null;
  if (active && active.getAttribute && active.getAttribute('data-key') && appEl.contains(active)) {
    focusInfo = { key: active.getAttribute('data-key'), start: active.selectionStart, end: active.selectionEnd };
  }

  const s = store.state;
  const kids = [
    renderHeader(store),
    s.loading ? h('div', { style: 'padding:80px 24px;text-align:center;opacity:0.6' }, 'Loading…') : routeMain(store),
    renderDraftDialog(store),
    toastNode(store)
  ];
  mount(appEl, h('div', { 'data-theme': store.state.theme, style: 'min-height:100vh;background:var(--color-bg);color:var(--color-text)' }, kids));

  if (focusInfo) {
    const el = appEl.querySelector(`[data-key="${CSS.escape(focusInfo.key)}"]`);
    if (el) {
      el.focus();
      if (typeof el.setSelectionRange === 'function' && focusInfo.start != null) {
        try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) { /* not a text-like input */ }
      }
    }
  }

  if (s.route === 'checkout') mountStripeCheckout(store);
}

store.onChange = render;

async function onHashChange() {
  const { route, pid } = parseHash();
  const prevRoute = store.state.route;
  store.state.route = route;
  store.state.pid = pid;
  store.state.pdImgI = 0;
  if (route !== 'checkout') store.state.buyNow = null;
  if (route === 'checkout' && prevRoute !== 'checkout') resetCheckoutFailure();
  render();
  if (route !== prevRoute) window.scrollTo(0, 0);
  if (route === 'admin' && store.isAdmin()) {
    try { await store.refreshAdminData(); } catch (e) { store.flash(e.message); }
  }
}

window.addEventListener('hashchange', onHashChange);

async function init() {
  try {
    await store.refreshMe();
  } catch (e) { /* not signed in */ }
  try {
    await store.refreshProducts();
  } catch (e) { store.flash('Could not load the catalogue.'); }
  store.refreshStripeConfig().catch(() => {});
  store.state.loading = false;
  const { route, pid } = parseHash();
  store.state.route = route;
  store.state.pid = pid;
  render();
  if (route === 'admin' && store.isAdmin()) {
    try { await store.refreshAdminData(); } catch (e) { store.flash(e.message); }
  }

  store.startHeroRotation();
}

init();
