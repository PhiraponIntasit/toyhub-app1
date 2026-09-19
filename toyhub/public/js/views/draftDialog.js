import { h } from '../dom.js';
import { api } from '../api.js';
import { CATS, STATUSES, brandsOf, isMeasured, billableKg } from '../helpers.js';
import { textField, textareaField } from './forms.js';

const NEW_BRAND = '__new__';

// Shows the administrator what the box they just typed will actually be billed
// as, so an over-sized carton is obvious before the piece goes on sale.
function shippingNote(d) {
  if (!isMeasured(d)) {
    return h('div', { style: 'font-size:12px;opacity:0.7;margin-top:8px' }, 'Not measured — ships at ฿100 a unit.');
  }
  const volumetric = (d.boxW * d.boxL * d.boxH) / 5000;
  const actual = (d.weightG || 0) / 1000;
  const billed = billableKg(d);
  return h('div', { class: 'tnum', style: 'font-size:12px;opacity:0.7;margin-top:8px' },
    `Billed as ${billed} kg — volume ${volumetric.toFixed(1)} kg against ${actual.toFixed(1)} kg actual.`);
}

// A brand is picked from the ones the shop already carries, or typed once and
// then carried by the piece — which is how a new brand comes into existence.
function brandField(store, d, set) {
  const known = brandsOf(store.state.products);
  const adding = d.line === '' || (d.line && known.indexOf(d.line) === -1);
  return h('div', { class: 'field' }, [
    h('label', {}, 'Brand'),
    h('select', {
      class: 'input', value: adding ? NEW_BRAND : d.line,
      onChange: (e) => {
        set('line')(e.target.value === NEW_BRAND ? '' : e.target.value);
        store.set({});
      }
    }, known.map((b) => h('option', { value: b }, b)).concat([
      h('option', { value: NEW_BRAND }, 'Add a new brand…')
    ])),
    adding ? h('input', {
      class: 'input', style: 'margin-top:8px', placeholder: 'New brand name',
      value: d.line, 'data-key': 'draft.newBrand',
      onInput: (e) => set('line')(e.target.value)
    }) : null
  ]);
}

export function renderDraftDialog(store) {
  const s = store.state;
  const d = s.draft;
  if (!d) return null;
  const set = (k) => (v) => { s.draft = Object.assign({}, s.draft, { [k]: v }); };
  const setImages = (text) => set('images')(text.split('\n').map((x) => x.trim()).filter(Boolean));

  // Typing no longer re-renders, so `d` above is the draft as it looked when the
  // dialog was last drawn — read the live one here instead.
  const save = async () => {
    const d = store.state.draft;
    if (!d.name.trim()) { store.set({ draftError: true }); return; }
    const body = {
      name: d.name, line: d.line, category: d.category, scale: d.scale,
      price: Number(d.price) || 0, status: d.status, release: d.release,
      featured: !!d.featured, images: d.images || [], stock: Math.max(0, Number(d.stock) || 0),
      description: d.description, details: d.details || '',
      boxW: d.boxW || 0, boxL: d.boxL || 0, boxH: d.boxH || 0, weightG: d.weightG || 0
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
        h('div', { style: 'grid-column:1 / -1' }, [textField({ key: 'draft.name', label: 'Piece name', placeholder: 'Vigil of the Lantern Keeper', value: d.name, set: set('name') })]),
        brandField(store, d, set),
        h('div', { class: 'field' }, [
          h('label', {}, 'Category'),
          h('select', { class: 'input', value: d.category, onChange: (e) => { set('category')(e.target.value); store.set({}); } },
            CATS.map((c) => h('option', { value: c }, c)))
        ]),
        textField({ key: 'draft.scale', label: 'Scale', placeholder: '1/6', value: d.scale, set: set('scale') }),
        textField({ key: 'draft.price', label: 'Price (THB)', type: 'number', value: d.price, set: (v) => set('price')(Number(v) || 0), attrs: { min: 0, step: 100 } }),
        h('div', { class: 'field' }, [
          h('label', {}, 'Availability'),
          h('select', { class: 'input', value: d.status, onChange: (e) => { set('status')(e.target.value); store.set({}); } },
            STATUSES.map((st) => h('option', { value: st }, st)))
        ]),
        textField({ key: 'draft.release', label: 'Shipping window', placeholder: 'Q1 2027', value: d.release, set: set('release') }),
        h('div', { class: 'field' }, [
          h('label', {}, 'Featured in the homepage hero (max 4)'),
          h('select', { class: 'input', value: d.featured ? 'yes' : 'no', onChange: (e) => { set('featured')(e.target.value === 'yes'); store.set({}); } }, [
            h('option', { value: 'no' }, 'No'), h('option', { value: 'yes' }, 'Yes')
          ])
        ]),
        textField({ key: 'draft.stock', label: 'Units in stock', type: 'number', value: d.stock, set: (v) => set('stock')(Math.max(0, Number(v) || 0)), attrs: { min: 0, step: 1 } }),
        h('div', { style: 'grid-column:1 / -1' }, [
          h('label', { style: 'display:block;font-size:12px;margin-bottom:6px' },
            'Packed box — carriage is billed on whichever is greater, the weight or the volume. Leave blank and the piece ships at a flat ฿100.'),
          h('div', { style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px' }, [
            textField({ key: 'draft.boxW', label: 'Width (cm)', type: 'number', value: d.boxW || 0, set: (v) => set('boxW')(Math.max(0, Number(v) || 0)), attrs: { min: 0, step: 1 } }),
            textField({ key: 'draft.boxL', label: 'Length (cm)', type: 'number', value: d.boxL || 0, set: (v) => set('boxL')(Math.max(0, Number(v) || 0)), attrs: { min: 0, step: 1 } }),
            textField({ key: 'draft.boxH', label: 'Height (cm)', type: 'number', value: d.boxH || 0, set: (v) => set('boxH')(Math.max(0, Number(v) || 0)), attrs: { min: 0, step: 1 } }),
            textField({ key: 'draft.weightKg', label: 'Weight (kg)', type: 'number', value: (d.weightG || 0) / 1000, set: (v) => set('weightG')(Math.max(0, Math.round((Number(v) || 0) * 1000))), attrs: { min: 0, step: 0.1 } })
          ]),
          shippingNote(d)
        ]),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField({
            key: 'draft.images', label: 'Photographs — one image address per line, first is the cover. Ctrl+Enter tidies the list and opens the next line',
            placeholder: 'https://…/front.jpg', value: (d.images || []).join('\n'),
            set: setImages,
            onKeydown: (e) => {
              if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              const ta = e.target;
              const kept = [];
              for (const line of ta.value.split('\n').map((x) => x.trim())) {
                if (line && kept.indexOf(line) === -1) kept.push(line);
              }
              ta.value = kept.length ? kept.join('\n') + '\n' : '';
              ta.selectionStart = ta.selectionEnd = ta.value.length;
              ta.scrollTop = ta.scrollHeight;
              setImages(ta.value);
            }
          })
        ]),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField({ key: 'draft.description', label: 'Description — the short summary under the piece name', placeholder: 'Bench notes and materials.', value: d.description, set: set('description') })
        ]),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField({
            key: 'draft.details', label: "What's Included — one line per item, shown on the product page only",
            placeholder: 'One figure, fully assembled\nDisplay base\nTwo interchangeable hands',
            value: d.details || '', set: set('details')
          })
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
