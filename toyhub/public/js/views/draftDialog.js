import { h } from '../dom.js';
import { api } from '../api.js';
import { CATS, STATUSES } from '../helpers.js';
import { textField, textareaField } from './forms.js';

export function renderDraftDialog(store) {
  const s = store.state;
  const d = s.draft;
  if (!d) return null;
  const set = (k) => (v) => { s.draft = Object.assign({}, s.draft, { [k]: v }); };

  const save = async () => {
    if (!d.name.trim()) { store.set({ draftError: true }); return; }
    const body = {
      name: d.name, line: d.line, category: d.category, scale: d.scale,
      price: Number(d.price) || 0, status: d.status, release: d.release, edition: d.edition,
      featured: !!d.featured, images: d.images || [], stock: Math.max(0, Number(d.stock) || 0),
      description: d.description
    };
    try {
      const { product, released } = d.id ? await api.updateProduct(d.id, body) : await api.createProduct(body);
      await store.refreshProducts();
      store.state.draft = null;
      store.state.draftError = false;
      store.flash(released ? `${product.name} featured — ${released} released from the hero` : `${product.name} saved`);
    } catch (err) {
      store.flash(err.message);
    }
  };

  return h('div', { class: 'dialog-backdrop', style: 'overflow:auto;align-items:start;padding-block:48px' }, [
    h('div', { class: 'dialog', 'data-enter': true, style: 'width:min(660px,100%)' }, [
      h('div', { class: 'dialog-title' }, d.id ? 'Edit piece' : 'Add a piece'),
      h('div', { 'data-formgrid': true, style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px' }, [
        h('div', { style: 'grid-column:1 / -1' }, [textField(store, { key: 'draft.name', label: 'Piece name', placeholder: 'Vigil of the Lantern Keeper', value: d.name, set: set('name') })]),
        textField(store, { key: 'draft.line', label: 'Atelier', placeholder: 'Kestrel Studio', value: d.line, set: set('line') }),
        h('div', { class: 'field' }, [
          h('label', {}, 'Category'),
          h('select', { class: 'input', value: d.category, onChange: (e) => { set('category')(e.target.value); store.set({}); } },
            CATS.map((c) => h('option', { value: c }, c)))
        ]),
        textField(store, { key: 'draft.scale', label: 'Scale', placeholder: '1/6', value: d.scale, set: set('scale') }),
        textField(store, { key: 'draft.price', label: 'Price (THB)', type: 'number', value: d.price, set: (v) => set('price')(Number(v) || 0), attrs: { min: 0, step: 100 } }),
        h('div', { class: 'field' }, [
          h('label', {}, 'Availability'),
          h('select', { class: 'input', value: d.status, onChange: (e) => { set('status')(e.target.value); store.set({}); } },
            STATUSES.map((st) => h('option', { value: st }, st)))
        ]),
        textField(store, { key: 'draft.release', label: 'Shipping window', placeholder: 'Q1 2027', value: d.release, set: set('release') }),
        textField(store, { key: 'draft.edition', label: 'Edition', placeholder: 'Edition of 500', value: d.edition, set: set('edition') }),
        h('div', { class: 'field' }, [
          h('label', {}, 'Featured in the homepage hero (max 4)'),
          h('select', { class: 'input', value: d.featured ? 'yes' : 'no', onChange: (e) => { set('featured')(e.target.value === 'yes'); store.set({}); } }, [
            h('option', { value: 'no' }, 'No'), h('option', { value: 'yes' }, 'Yes')
          ])
        ]),
        textField(store, { key: 'draft.stock', label: 'Units in stock', type: 'number', value: d.stock, set: (v) => set('stock')(Math.max(0, Number(v) || 0)), attrs: { min: 0, step: 1 } }),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField(store, {
            key: 'draft.images', label: 'Photographs — one image address per line, first is the cover',
            placeholder: 'https://…/front.jpg', value: (d.images || []).join('\n'),
            set: (v) => set('images')(v.split('\n').map((x) => x.trim()).filter(Boolean))
          })
        ]),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField(store, { key: 'draft.description', label: 'Description', placeholder: 'Bench notes, materials, what ships in the box.', value: d.description, set: set('description') })
        ])
      ]),
      s.draftError ? h('div', { style: 'font-size:12px;color:var(--color-accent-700)' }, 'A piece needs a name before it can be saved.') : null,
      h('div', { class: 'dialog-actions' }, [
        h('button', { class: 'btn btn-secondary', onclick: () => store.set({ draft: null, draftError: false }) }, 'Cancel'),
        h('button', { class: 'btn btn-primary', onclick: save }, 'Save piece')
      ])
    ])
  ]);
}
