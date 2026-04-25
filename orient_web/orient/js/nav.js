import { S }        from './state.js';
import { navigate } from './router.js';
import { hoy }      from './utils.js';

export function initNav() {
  document.getElementById('btn-login').addEventListener('click', () => {
    if (S.user) doLogout();
    else navigate('login');
  });
}

export function updateNav() {
  const nu  = document.getElementById('nav-user');
  const btn = document.getElementById('btn-login');
  if (!S.user) {
    nu.style.display = 'none';
    document.getElementById('nav-badge').style.display = 'none';
    btn.textContent = 'Acceso';
    return;
  }
  nu.textContent  = `${S.user.nombre} · ${S.user.rol}`;
  nu.style.display = 'inline';
  btn.textContent = 'Salir';
}

export function updateBadge(casos) {
  if (!S.user) return;
  const key  = `orient_last_${S.user.id}`;
  const last = localStorage.getItem(key) || new Date(0).toISOString();
  const n    = casos.filter(c => c.created_at > last && c.estado !== 'cerrado').length;
  const el   = document.getElementById('nav-badge');
  el.style.display = n > 0 ? 'inline' : 'none';
  if (n > 0) el.textContent = n;
  localStorage.setItem(key, new Date().toISOString());
}

function doLogout() {
  S.user          = null;
  S.casos         = [];
  S.casoActual    = null;
  S.usuarios      = [];
  S.filtroGravedad= null;
  S.filtroArea    = null;
  S.filtroGrado   = null;
  S.panelTab      = 'activos';
  updateNav();
  navigate('inicio');
}
