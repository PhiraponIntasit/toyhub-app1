import { h } from '../dom.js';
import { api } from '../api.js';
import { textField, textareaField } from './forms.js';

export function renderLogin(store) {
  const s = store.state;
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { user } = await api.login({ email: s.authForm.email, password: s.authForm.password });
      store.state.authError = '';
      store.state.authForm = { email: '', password: '' };
      await store.refreshMe();
      store.go(user.role === 'admin' ? 'admin' : 'shop');
      store.flash('Signed in as ' + user.name);
    } catch (err) {
      store.set({ authError: err.message });
    }
  };

  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:56px 24px 90px' }, [
    h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px;align-items:start;border-top:1px solid var(--color-divider);padding-top:36px' }, [
      h('div', {}, [
        h('div', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, 'Members'),
        h('h1', { 'data-enter': true, style: 'font-size:40px;font-weight:400;margin:10px 0 16px' }, 'Sign in'),
        h('p', { class: 'just', style: 'font-size:14px;opacity:0.8;max-width:42ch' }, 'Reserving a plate or settling a pre-order requires an account. Shop staff sign in here as well — administrator accounts manage the catalogue and cannot place orders.'),
        h('div', { style: 'font-size:12px;opacity:0.6;margin-top:18px;border-top:1px solid var(--color-divider);padding-top:14px' }, 'Demo administrator — admin@toyhub.co / admin1234')
      ]),
      h('form', { style: 'display:flex;flex-direction:column;gap:14px;border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:26px', onSubmit: submit }, [
        textField({ key: 'auth.email', label: 'Email', type: 'email', placeholder: 'you@example.com', value: s.authForm.email, set: (v) => { s.authForm = Object.assign({}, s.authForm, { email: v }); } }),
        textField({ key: 'auth.password', label: 'Password', type: 'password', placeholder: '••••••••', value: s.authForm.password, set: (v) => { s.authForm = Object.assign({}, s.authForm, { password: v }); } }),
        s.authError ? h('div', { style: 'font-size:12px;color:var(--color-accent-700)' }, s.authError) : null,
        h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Sign in'),
        h('div', { style: 'font-size:12px;opacity:0.7;text-align:center' }, [
          'No account yet? ',
          h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => store.go('signup') }, 'Register')
        ])
      ])
    ])
  ]);
}

export function renderSignup(store) {
  const s = store.state;
  const setReg = (k) => (v) => { s.regForm = Object.assign({}, s.regForm, { [k]: v }); };
  const submit = async (e) => {
    e.preventDefault();
    const r = s.regForm;
    try {
      const { user } = await api.signup({
        name: r.name, email: r.email, phone: r.phone, address: r.address,
        password: r.password, confirm: r.confirm
      });
      store.state.regError = '';
      store.state.regForm = { name: '', email: '', phone: '', address: '', password: '', confirm: '' };
      await store.refreshMe();
      store.go('shop');
      store.flash('Welcome, ' + user.name);
    } catch (err) {
      store.set({ regError: err.message });
    }
  };

  return h('main', { style: 'max-width:1100px;margin:0 auto;padding:56px 24px 90px' }, [
    h('div', { 'data-col2': true, style: 'display:grid;grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr);gap:56px;align-items:start;border-top:1px solid var(--color-divider);padding-top:36px' }, [
      h('div', {}, [
        h('div', { style: 'font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--color-accent-700)' }, 'Members'),
        h('h1', { 'data-enter': true, style: 'font-size:40px;font-weight:400;margin:10px 0 16px' }, 'Register'),
        h('p', { class: 'just', style: 'font-size:14px;opacity:0.8;max-width:40ch' }, 'Every field is required: pieces ship insured and pre-orders are confirmed by telephone before the window opens.')
      ]),
      h('form', { 'data-formgrid': true, style: 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:26px', onSubmit: submit }, [
        h('div', { style: 'grid-column:1 / -1' }, [textField({ key: 'reg.name', label: 'Full name (required)', placeholder: 'Somchai Phanit', value: s.regForm.name, set: setReg('name') })]),
        textField({ key: 'reg.email', label: 'Email (required)', type: 'email', placeholder: 'you@example.com', value: s.regForm.email, set: setReg('email') }),
        textField({ key: 'reg.phone', label: 'Telephone (required)', placeholder: '081 234 5678', value: s.regForm.phone, set: setReg('phone') }),
        h('div', { style: 'grid-column:1 / -1' }, [
          textareaField({ key: 'reg.address', label: 'Shipping address (required)', placeholder: 'House number, street, district, province, postal code', value: s.regForm.address, set: setReg('address') })
        ]),
        textField({ key: 'reg.password', label: 'Password (required, 6+ characters)', type: 'password', value: s.regForm.password, set: setReg('password') }),
        textField({ key: 'reg.confirm', label: 'Confirm password', type: 'password', value: s.regForm.confirm, set: setReg('confirm') }),
        s.regError ? h('div', { style: 'grid-column:1 / -1;font-size:12px;color:var(--color-accent-700)' }, s.regError) : null,
        h('div', { style: 'grid-column:1 / -1;display:flex;gap:10px;justify-content:flex-end;margin-top:4px' }, [
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => store.go('login') }, 'I have an account'),
          h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create account')
        ])
      ])
    ])
  ]);
}
