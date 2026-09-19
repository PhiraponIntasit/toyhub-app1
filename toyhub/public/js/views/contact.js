import { h } from '../dom.js';
import { api } from '../api.js';
import { textField, textareaField } from './forms.js';

export function renderContact(store) {
  const s = store.state;
  const set = (k) => (v) => { s.contactForm = Object.assign({}, s.contactForm, { [k]: v }); };
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { sentTo } = await api.sendMessage(s.contactForm);
      store.state.contactError = '';
      store.state.contactSent = sentTo;
      store.state.contactForm = { name: '', email: '', subject: 'An order or tracking', ref: '', body: '' };
      store.flash('Message sent — the shop replies to ' + sentTo);
      store.set({});
    } catch (err) {
      store.set({ contactError: err.message, contactSent: '' });
    }
  };

  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:56px 24px 90px' }, [
    h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:56px;align-items:start;border-top:1px solid var(--color-divider);padding-top:36px' }, [
      h('div', {}, [
        h('div', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, 'Contact'),
        h('h1', { 'data-enter': true, style: 'font-size:40px;font-weight:400;margin:10px 0 16px' }, 'Talk to the shop'),
        h('p', { class: 'just', style: 'font-size:14px;opacity:0.8;max-width:42ch' }, 'A damaged plate, a tracking number that has not moved, a question before you reserve — write to us and we answer in one working day.'),
        h('table', { class: 'table tnum', style: 'margin-top:24px' }, [
          h('tbody', {}, [
            h('tr', {}, [h('th', { style: 'width:36%' }, 'Email'), h('td', {}, 'help@toyhub.co')]),
            h('tr', {}, [h('th', {}, 'Telephone'), h('td', {}, '02 114 9070')]),
            h('tr', {}, [h('th', {}, 'LINE'), h('td', {}, '@toyhub')]),
            h('tr', {}, [h('th', {}, 'Hours'), h('td', {}, 'Mon–Sat, 10.00–19.00 ICT')]),
            h('tr', {}, [h('th', {}, 'Bench'), h('td', {}, '18 Charoen Krung Soi 30, Bang Rak, Bangkok 10500')])
          ])
        ]),
        h('p', { style: 'font-size:12px;opacity:0.6;margin-top:16px' }, 'For a specific order, quote its reference (TH-XXXXXX) — it is on both emails.')
      ]),
      h('form', { 'data-formgrid': true, style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:26px', onSubmit: submit }, [
        textField({ key: 'contact.name', label: 'Your name', placeholder: 'Somchai Phanit', value: s.contactForm.name, set: set('name') }),
        textField({ key: 'contact.email', label: 'Email', type: 'email', placeholder: 'you@example.com', value: s.contactForm.email, set: set('email') }),
        h('div', { class: 'field', style: 'grid-column:1 / -1' }, [
          h('label', {}, 'Subject'),
          h('select', { class: 'input', value: s.contactForm.subject, onChange: (e) => { s.contactForm = Object.assign({}, s.contactForm, { subject: e.target.value }); store.set({}); } }, [
            h('option', { value: 'An order or tracking' }, 'An order or tracking'),
            h('option', { value: 'A damaged or missing piece' }, 'A damaged or missing piece'),
            h('option', { value: 'Before I reserve' }, 'Before I reserve'),
            h('option', { value: 'Something else' }, 'Something else')
          ])
        ]),
        h('div', { style: 'grid-column:1 / -1' }, [textField({ key: 'contact.ref', label: 'Order reference (if any)', placeholder: 'TH-XXXXXX', value: s.contactForm.ref, set: set('ref') })]),
        h('div', { style: 'grid-column:1 / -1' }, [textareaField({ key: 'contact.body', label: 'Message', placeholder: 'What happened, and what would put it right.', value: s.contactForm.body, set: set('body'), style: 'min-height:130px' })]),
        s.contactError ? h('div', { style: 'grid-column:1 / -1;font-size:12px;color:var(--color-accent-700)' }, s.contactError) : null,
        s.contactSent ? h('div', { style: 'grid-column:1 / -1;font-size:13px;border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:14px' }, `Thank you — the shop has your message and replies to ${s.contactSent}.`) : null,
        h('div', { style: 'grid-column:1 / -1;display:flex;justify-content:flex-end;gap:10px' }, [
          h('button', { class: 'btn btn-primary', type: 'submit' }, 'Send the message')
        ])
      ])
    ])
  ]);
}
