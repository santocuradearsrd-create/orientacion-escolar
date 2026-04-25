import { S }         from '../state.js';
import { api }        from '../api.js';
import { navigate }   from '../router.js';
import { toast, sha256 } from '../utils.js';
import { updateNav }  from '../nav.js';

export function renderLogin() {
  document.getElementById('main').innerHTML = `
  <div class="card" style="max-width:420px;margin:40px auto">
    <h2>Acceso al sistema</h2>
    <label>Usuario</label>
    <input type="text" id="l-user" placeholder="Nombre de usuario" autocomplete="off">
    <label>PIN</label>
    <input type="password" id="l-pin" maxlength="12" placeholder="PIN de acceso">
    <div id="l-error" style="display:none" class="warn-box"></div>
    <div class="btn-row">
      <button class="btn btn-outline" id="btn-cancel-login">Cancelar</button>
      <button class="btn btn-primary" id="btn-do-login">Ingresar</button>
    </div>
  </div>`;

  document.getElementById('btn-cancel-login').addEventListener('click', () => navigate('inicio'));
  document.getElementById('btn-do-login').addEventListener('click', doLogin);
  document.getElementById('l-pin').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  setTimeout(() => document.getElementById('l-user')?.focus(), 80);
}

async function doLogin() {
  const usuario = (document.getElementById('l-user')?.value || '').trim();
  const pin     = document.getElementById('l-pin')?.value || '';
  const errEl   = document.getElementById('l-error');
  errEl.style.display = 'none';
  if (!usuario || !pin) { errEl.style.display='block'; errEl.textContent='Ingresa tu usuario y PIN.'; return; }
  const btn = document.getElementById('btn-do-login');
  btn.disabled = true; btn.textContent = 'Verificando...';
  const hash = await sha256(pin);
  const { data, error } = await api.login(usuario, hash);
  btn.disabled = false; btn.textContent = 'Ingresar';
  if (error || data?.error) {
    errEl.style.display = 'block';
    errEl.textContent   = data?.error || 'Error de conexión. Intenta de nuevo.';
    return;
  }
  S.user = { ...data, pin_hash: hash };
  updateNav();
  if (data.rol === 'admin') navigate('admin');
  else navigate('panel');
}
