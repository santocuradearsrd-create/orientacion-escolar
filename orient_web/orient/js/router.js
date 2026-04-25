import { S } from './state.js';

const _views = {};
let   _params = {};

export function registerView(name, fn) {
  _views[name] = fn;
}

export function renderView() {
  const fn = _views[S.view] || _views['inicio'];
  if (fn) fn(_params);
}

export function navigate(view, params = {}) {
  S.view  = view;
  _params = params;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderView();
}

// Expose globally so inline onclick handlers can call navigate()
window.navigate = navigate;
