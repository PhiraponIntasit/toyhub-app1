import { h } from '../dom.js';

// Typing records the value in the store but never re-renders: a render replaces
// every node on the page, which the visitor sees as a flicker and which would
// also overwrite whatever they are part-way through typing. Fields that drive
// live UI (the catalogue search) re-render from their own `set` instead.
// `key` must be unique across whatever's on screen at once.
export function textField({ key, label, value, set, type, placeholder, attrs }) {
  return h('div', { class: 'field' }, [
    label ? h('label', {}, label) : null,
    h('input', Object.assign({
      class: 'input', type: type || 'text', placeholder: placeholder || '', value, 'data-key': key,
      onInput: (e) => set(e.target.value)
    }, attrs))
  ]);
}

export function textareaField({ key, label, value, set, placeholder, style, onKeydown }) {
  return h('div', { class: 'field' }, [
    label ? h('label', {}, label) : null,
    h('textarea', {
      class: 'input', placeholder: placeholder || '', value, 'data-key': key, style,
      onInput: (e) => set(e.target.value),
      onKeydown
    })
  ]);
}
