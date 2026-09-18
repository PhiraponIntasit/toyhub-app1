import { h } from '../dom.js';
import { ACCENT, INK } from '../helpers.js';
import { api } from '../api.js';

export function renderHeader(store) {
  const s = store.state;
  const admin = store.isAdmin();
  const member = store.isMember();
  const canBuy = !admin;
  const cartCount = Object.values(s.cart).reduce((t, n) => t + (Number(n) || 0), 0);
  const tab = (route) => (s.route === route ? ACCENT : INK);

  return h('header', { style: 'position:sticky;top:0;z-index:20;background:var(--color-bg);border-bottom:1px solid var(--color-divider)' }, [
    h('div', { 'data-header': true, style: 'max-width:1200px;margin:0 auto;display:flex;align-items:baseline;gap:28px;padding:16px 24px' }, [
      h('button', { class: 'lnk', style: 'font-family:var(--font-heading);font-size:22px;letter-spacing:0.14em;margin-right:auto', onclick: () => store.go('home') }, 'TOYHUB'),
      h('nav', { style: 'display:flex;flex-wrap:wrap;gap:22px;align-items:baseline' }, [
        h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${tab('home')}`, onclick: () => store.go('home') }, 'Home'),
        h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${s.route === 'shop' || s.route === 'product' ? ACCENT : INK}`, onclick: () => store.go('shop') }, 'Catalogue'),
        h('button', { class: 'lnk', style: 'font-size:13px;letter-spacing:0.06em;text-transform:uppercase', onclick: () => store.scrollToId('story') }, 'Story'),
        h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${tab('contact')}`, onclick: () => store.go('contact') }, 'Contact'),
        member ? h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${tab('orders')}`, onclick: () => store.go('orders') }, 'Orders') : null,
        member ? h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${tab('wishlist')}`, onclick: () => store.go('wishlist') }, `Wishlist (${s.wishIds.length})`) : null,
        admin ? h('button', { class: 'lnk', style: `font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${tab('admin')}`, onclick: () => store.go('admin') }, 'Admin') : null
      ]),
      h('div', { 'data-actions': true, style: 'display:flex;align-items:center;gap:12px;flex-wrap:nowrap' }, [
        h('button', {
          class: 'btn btn-secondary btn-icon', title: s.theme === 'dark' ? 'Switch to light' : 'Switch to dark',
          'aria-label': s.theme === 'dark' ? 'Switch to light' : 'Switch to dark',
          onclick: () => store.setTheme(s.theme === 'dark' ? 'light' : 'dark')
        }, s.theme === 'dark' ? '☀' : '☾'),
        canBuy ? h('button', { class: 'btn btn-secondary', style: 'letter-spacing:0.06em', onclick: () => store.go('cart') }, `Cart (${cartCount})`) : null,
        s.user ? h('div', { style: 'display:flex;align-items:center;gap:10px' }, [
          h('div', { style: 'text-align:right;line-height:1.25;white-space:nowrap' }, [
            h('div', { style: 'font-family:var(--font-heading);font-size:14px' }, s.user.name),
            h('div', { style: 'font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-accent-700)' }, admin ? 'Administrator' : 'Member')
          ]),
          h('button', {
            class: 'btn btn-ghost', onclick: async () => {
              await api.logout();
              store.state.user = null; store.state.wishIds = []; store.state.myOrders = [];
              store.go('home'); store.flash('Signed out');
            }
          }, 'Sign out')
        ]) : h('div', { style: 'display:flex;gap:8px' }, [
          h('button', { class: 'btn btn-secondary', onclick: () => store.go('login') }, 'Sign in'),
          h('button', { class: 'btn btn-primary', onclick: () => store.go('signup') }, 'Register')
        ])
      ])
    ])
  ]);
}
