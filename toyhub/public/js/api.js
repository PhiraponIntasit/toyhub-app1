async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/auth/me'),
  signup: (body) => request('POST', '/api/auth/signup', body),
  login: (body) => request('POST', '/api/auth/login', body),
  logout: () => request('POST', '/api/auth/logout'),

  products: () => request('GET', '/api/products'),
  createProduct: (body) => request('POST', '/api/products', body),
  updateProduct: (id, body) => request('PUT', `/api/products/${encodeURIComponent(id)}`, body),
  deleteProduct: (id) => request('DELETE', `/api/products/${encodeURIComponent(id)}`),

  wishlist: () => request('GET', '/api/wishlist'),
  toggleWishlist: (id) => request('POST', `/api/wishlist/${encodeURIComponent(id)}/toggle`),
  demand: () => request('GET', '/api/wishlist/admin/demand'),

  sendMessage: (body) => request('POST', '/api/messages', body),
  adminMessages: () => request('GET', '/api/messages/admin'),
  toggleMessage: (id) => request('PUT', `/api/messages/admin/${encodeURIComponent(id)}/toggle`),
  deleteMessage: (id) => request('DELETE', `/api/messages/admin/${encodeURIComponent(id)}`),

  config: () => request('GET', '/api/config'),
  createIntent: (body) => request('POST', '/api/checkout/create-intent', body),
  finalizeOrder: (body) => request('POST', '/api/checkout/finalize', body),
  myOrders: () => request('GET', '/api/orders/mine'),
  balanceIntent: (ref) => request('POST', `/api/orders/${encodeURIComponent(ref)}/balance-intent`),
  balanceFinalize: (ref, body) => request('POST', `/api/orders/${encodeURIComponent(ref)}/balance-finalize`, body),

  adminOrders: () => request('GET', '/api/admin/orders'),
  setOrderStatus: (ref, status) => request('PUT', `/api/admin/orders/${encodeURIComponent(ref)}/status`, { status }),
  setOrderTracking: (ref, tracking) => request('PUT', `/api/admin/orders/${encodeURIComponent(ref)}/tracking`, { tracking }),
  shipOrder: (ref, tracking) => request('POST', `/api/admin/orders/${encodeURIComponent(ref)}/ship`, { tracking }),
  requestBalance: (ref) => request('POST', `/api/admin/orders/${encodeURIComponent(ref)}/request-balance`),
  deleteOrder: (ref) => request('DELETE', `/api/admin/orders/${encodeURIComponent(ref)}`)
};
