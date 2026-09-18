// Minimal safe DOM-building helper — no innerHTML for anything user-supplied,
// so product names, messages, etc. can never inject markup.
export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  attrs = attrs || {};
  let deferredValue;
  for (const key of Object.keys(attrs)) {
    const v = attrs[key];
    if (v == null || v === false) continue;
    if (key === 'style') el.style.cssText = v;
    else if (key === 'class') el.className = v;
    else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2).toLowerCase(), v);
    // <select> only knows which <option> to select once its children exist, so defer.
    else if (key === 'value' && tag === 'select') deferredValue = v;
    else if (key === 'value' && ('value' in el)) el.value = v;
    else if (key === 'checked') { if (v) el.setAttribute('checked', ''); el.checked = !!v; }
    else if (v === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(v));
  }
  const kids = children == null ? [] : Array.isArray(children) ? children : [children];
  for (const kid of kids) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}

export function frag(children) {
  const f = document.createDocumentFragment();
  (Array.isArray(children) ? children : [children]).forEach((c) => { if (c != null && c !== false) f.appendChild(c); });
  return f;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function mount(el, children) {
  clear(el);
  el.appendChild(frag(children));
}
