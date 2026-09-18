import { h } from '../dom.js';

// A labeled text input wired for the focus-preserving re-render in main.js:
// `key` must be unique across whatever's on screen at once.
export function textField(store, { key, label, value, set, type, placeholder, attrs }) {
  return h('div', { class: 'field' }, [
    label ? h('label', {}, label) : null,
    h('input', Object.assign({
      class: 'input', type: type || 'text', placeholder: placeholder || '', value, 'data-key': key,
      onInput: (e) => { set(e.target.value); store.set({}); }
    }, attrs))
  ]);
}

export function textareaField(store, { key, label, value, set, placeholder, style }) {
  return h('div', { class: 'field' }, [
    label ? h('label', {}, label) : null,
    h('textarea', {
      class: 'input', placeholder: placeholder || '', value, 'data-key': key, style,
      onInput: (e) => { set(e.target.value); store.set({}); }
    })
  ]);
}
