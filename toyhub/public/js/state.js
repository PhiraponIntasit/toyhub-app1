import { api } from './api.js';
import { loadLocal, saveLocal, soldOutOf, stockOf } from './helpers.js';

const KEY_CART = 'toyhub.cart.v1';
const KEY_MODE = 'toyhub.paymode.v1';
const KEY_THEME = 'toyhub.theme.v1';
const HERO_MS = 7000;

export const store = {
  state: {
    route: 'home', pid: null,
    heroI: 0, pdImgI: 0, seed: String(Math.random()),
    products: [],
    cart: loadLocal(KEY_CART, {}),
    mode: loadLocal(KEY_MODE, {}),
    buyNow: null,
    theme: loadLocal(KEY_THEME, 'light'),
    user: null,
    wishIds: [],
    myOrders: [],
    adminOrders: [],
    adminMessages: [],
    demand: [],
    q: '', cat: 'All', status: 'All', maxPrice: 30000, sort: 'curated',
    draft: null, draftError: false,
    adminTab: 'catalogue',
    toast: '',
    authForm: { email: '', password: '' }, authError: '',
    regForm: { name: '', email: '', phone: '', address: '', password: '', confirm: '' }, regError: '',
    contactForm: { name: '', email: '', subject: 'An order or tracking', ref: '', body: '' }, contactError: '', contactSent: '',
    cardForm: { name: '', number: '', exp: '', cvc: '' },
    checkoutError: '', checkoutSubmitting: false,
    stripeConfig: { stripeConfigured: false, stripePublishableKey: '' },
    lastOrder: null,
    trackingDraft: {},
    loading: true
  },
  onChange: null,
  _toastTimer: null,

  set(patch) {
    Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
    if (this.onChange) this.onChange();
  },

  setCart(cart) { this.state.cart = cart; saveLocal(KEY_CART, cart); if (this.onChange) this.onChange(); },
  setMode(mode) { this.state.mode = mode; saveLocal(KEY_MODE, mode); if (this.onChange) this.onChange(); },
  setTheme(theme) { this.state.theme = theme; saveLocal(KEY_THEME, theme); if (this.onChange) this.onChange(); },

  flash(msg) {
    this.state.toast = msg;
    if (this.onChange) this.onChange();
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.state.toast = ''; if (this.onChange) this.onChange(); }, 2600);
  },

  go(route, pid) {
    location.hash = pid ? `#/${route}/${pid}` : `#/${route}`;
  },

  scrollToId(id) {
    const after = () => setTimeout(() => {
      const el = document.getElementById(id);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }, 60);
    if (this.state.route !== 'home') { location.hash = '#/home'; setTimeout(after, 60); }
    else after();
  },

  startHeroRotation() {
    clearInterval(this._heroTimer);
    this._heroTimer = setInterval(() => {
      if (this.state.route === 'home') this.set({ heroI: this.state.heroI + 1 });
    }, HERO_MS);
  },

  // Stepping through the hero by hand restarts the countdown, so the slide
  // someone just chose is not swept away a moment later.
  showHero(i) {
    this.set({ heroI: i });
    this.startHeroRotation();
  },

  isMember() { return !!this.state.user && this.state.user.role !== 'admin'; },
  isAdmin() { return !!this.state.user && this.state.user.role === 'admin'; },

  async refreshMe() {
    const { user } = await api.me();
    this.state.user = user;
    if (user && user.role !== 'admin') {
      const [{ productIds }, { orders }] = await Promise.all([api.wishlist(), api.myOrders()]);
      this.state.wishIds = productIds;
      this.state.myOrders = orders;
    } else {
      this.state.wishIds = [];
      this.state.myOrders = [];
    }
    if (this.onChange) this.onChange();
  },

  async refreshProducts() {
    const { products } = await api.products();
    this.state.products = products;
    if (this.onChange) this.onChange();
  },

  async refreshAdminData() {
    const [{ orders }, { messages }, { demand }] = await Promise.all([api.adminOrders(), api.adminMessages(), api.demand()]);
    this.state.adminOrders = orders;
    this.state.adminMessages = messages;
    this.state.demand = demand;
    if (this.onChange) this.onChange();
  },

  async refreshStripeConfig() {
    this.state.stripeConfig = await api.config();
    if (this.onChange) this.onChange();
  },

  addToCart(p, payMode) {
    const admin = this.isAdmin();
    if (admin) { this.flash('Administrator accounts cannot place orders'); return; }
    if (!this.state.user) { this.go('login'); this.flash('Sign in to reserve a piece'); return; }
    if (soldOutOf(p)) { this.flash(p.name + ' is sold out — save it to be notified'); return; }
    const inCart = this.state.cart[p.id] || 0;
    if (inCart >= stockOf(p)) { this.flash('Only ' + stockOf(p) + ' left of ' + p.name); return; }
    const cart = Object.assign({}, this.state.cart);
    cart[p.id] = inCart + 1;
    this.setCart(cart);
    if (p.status === 'Pre-order') {
      const mode = Object.assign({}, this.state.mode);
      mode[p.id] = payMode === 'full' ? 'full' : 'deposit';
      this.setMode(mode);
      this.flash(p.name + (payMode === 'full' ? ' reserved, paid in full' : ' reserved on a 30% deposit'));
      return;
    }
    this.flash(p.name + ' added to the cart');
  },

  async toggleWish(p) {
    if (!this.state.user) { this.go('login'); this.flash('Sign in to save pieces'); return; }
    if (this.isAdmin()) { this.flash('Saved pieces belong to member accounts — see the Demand tab'); return; }
    const { saved } = await api.toggleWishlist(p.id);
    this.state.wishIds = saved
      ? this.state.wishIds.concat([p.id])
      : this.state.wishIds.filter((id) => id !== p.id);
    this.flash(saved ? (soldOutOf(p) ? 'We will email you if ' + p.name + ' returns' : p.name + ' saved') : p.name + ' removed from saved pieces');
    if (this.onChange) this.onChange();
  }
};

export function parseHash() {
  const parts = (location.hash || '#/home').replace(/^#\//, '').split('/').filter(Boolean);
  return { route: parts[0] || 'home', pid: parts[1] || null };
}
