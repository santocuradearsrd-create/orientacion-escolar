import { S } from '../state.js';
import { api } from '../api.js';
import { navigate } from '../router.js';
import { esc, sha256, toast, areaLabel } from '../utils.js';
import { AREAS, ROLES_LABEL } from '../config.js';

export async function vistaAdmin() {
  if (!S.user || !['admin','direccion'].includes(S.user.rol)) {
    toast('Acceso no autorizado.'); navigate('panel'); return;
  }

  const app = document.getElementById('main');
  app.innerHTML = `<div class="loading-spinner">Cargando…</div>`;

  try { S.usuarios = await api.getUsuarios(S.user.pin_hash) || []; }
  catch(e) { toast('Error: ' + e.message); S.usuarios = []; }

  _renderAdmin();
}

/* ─── RENDER PRINCIPAL ─────────────────── */
function _renderAdmin() {
  const isAdmin = S.user.rol === 'admin';
  const app = document.getElementById('main');
  app.innerHTML = `
    <div class="admin-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px">
        <div>
          <h2 style="margin:0;color:#1E3A5F">Administración</h2>
          <p style="margin:4px 0 0;color:#64748B;font-size:13px">
            ${isAdmin ? 'Gestión completa del sistema' : 'Gestión de cobertura'}
          </p>
        </div>
        <button class="btn-back" onclick="navigate('panel')">← Panel</button>
      </div>

      <!-- Tabs admin -->
      <div class="tabs" style="margin-bottom:24px">
        <button class="tab active" id="tab-usuarios" onclick="window._adminTab('usuarios')">Usuarios</button>
        ${isAdmin ? `<button class="tab" id="tab-estudiantes" onclick="window._adminTab('estudiantes')">Estudiantes</button>` : ''}
        ${isAdmin ? `<button class="tab" id="tab-anio" onclick="window._adminTab('anio')">Año Escolar</button>` : ''}
      </div>

      <div id="admin-content"></div>
    </div>

    <!-- Modal usuario -->
    ${_modalUsuario()}
    <!-- Modal cobertura -->
    ${_modalCobertura()}
  `;

  _renderTabUsuarios();

  window._adminTab = t => {
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + t)?.classList.add('active');
    if (t === 'usuarios') _renderTabUsuarios();
    if (t === 'estudiantes') _renderTabEstudiantes();
    if (t === 'anio') _renderTabAnio();
  };
}

/* ─── TAB USUARIOS ─────────────────────── */
function _renderTabUsuarios() {
  const isAdmin = S.user.rol === 'admin';
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0">Usuarios del Sistema (${S.usuarios.length})</h3>
      ${isAdmin ? `<button class="btn-primary btn-sm" onclick="window._nuevoUsuario()">+ Nuevo Usuario</button>` : ''}
    </div>
    <div class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th><th>Usuario</th><th>Rol</th><th>Área</th><th>Cobertura</th>
            ${isAdmin ? '<th>Estado</th><th>Acciones</th>' : '<th>Acciones</th>'}
          </tr>
        </thead>
        <tbody>
          ${S.usuarios.map(u => _filaUsuario(u, isAdmin)).join('')}
        </tbody>
      </table>
    </div>`;
}

function _filaUsuario(u, isAdmin) {
  const coberturaLabels = (u.areas_cobertura||[]).map(a => areaLabel(a)).join(', ') || '—';
  return `<tr>
    <td>${esc(u.nombre)}</td>
    <td><code>${esc(u.usuario)}</code></td>
    <td>${ROLES_LABEL[u.rol]||u.rol}</td>
    <td>${areaLabel(u.area)}</td>
    <td style="font-size:12px;color:#64748B">${coberturaLabels}</td>
    ${isAdmin ? `<td><span class="badge ${u.activo?'b-proceso':'b-cerrado'}">${u.activo?'Activo':'Inactivo'}</span></td>` : ''}
    <td>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${isAdmin ? `<button class="btn-secondary btn-sm" onclick="window._editarUsuario('${u.id}')">Editar</button>` : ''}
        <button class="btn-secondary btn-sm" onclick="window._gestionCobertura('${u.id}')">Cobertura</button>
      </div>
    </td>
  </tr>`;
}

/* ─── TAB ESTUDIANTES ───────────────────── */
function _renderTabEstudiantes() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="info-card" style="margin-bottom:20px">
      <h3>Importar Estudiantes (CSV)</h3>
      <p style="color:#64748B;font-size:13px;margin:4px 0 12px">
        El CSV debe tener columnas: <code>nombre, grado, seccion, nivel</code> (sin encabezado o con él).
      </p>
      <input type="file" id="csv-file" accept=".csv" onchange="window._onCsvFile(this)" />
      <div id="csv-preview" style="margin-top:12px"></div>
    </div>`;

  window._onCsvFile = async (input) => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const filas = _parseCsv(text);
    if (!filas.length) { toast('CSV vacío o formato incorrecto.'); return; }

    document.getElementById('csv-preview').innerHTML = `
      <p style="color:#065F46;font-size:13px">✓ ${filas.length} estudiantes detectados</p>
      <div style="max-height:160px;overflow:auto;font-size:12px;border:1px solid #E2E8F0;border-radius:6px;padding:8px">
        ${filas.slice(0,10).map(f => `<div>${esc(f.nombre)} — ${esc(f.grado)} ${esc(f.seccion)} (${esc(f.nivel)})</div>`).join('')}
        ${filas.length > 10 ? `<div style="color:#94A3B8">… y ${filas.length-10} más</div>` : ''}
      </div>
      <button class="btn-primary btn-sm" style="margin-top:10px" onclick="window._importarEstudiantes()">
        Importar ${filas.length} estudiantes
      </button>`;

    window._estudiantesParaImportar = filas;
  };

  window._importarEstudiantes = async () => {
    const filas = window._estudiantesParaImportar;
    if (!filas?.length) return;
    try {
      await api.upsertEstudiantes(S.user.pin_hash, filas);
      toast(`${filas.length} estudiantes importados correctamente.`);
      document.getElementById('csv-preview').innerHTML =
        `<p style="color:#065F46">✅ Importación completada.</p>`;
    } catch(e) { toast('Error: ' + e.message); }
  };
}

/* ─── TAB AÑO ESCOLAR ───────────────────── */
function _renderTabAnio() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `
    <div class="info-card" style="margin-bottom:16px">
      <h3 style="color:#9B1C1C">⚠️ Gestión de Año Escolar</h3>
      <p style="color:#64748B;font-size:13px">Estas acciones son irreversibles. Úselas solo al inicio o fin del año escolar.</p>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="accion-card">
        <div>
          <strong>Promover Estudiantes</strong>
          <p style="color:#64748B;font-size:13px;margin:4px 0 0">Sube todos los estudiantes de grado automáticamente.</p>
        </div>
        <button class="btn-secondary" onclick="window._promover()">Promover todos</button>
      </div>
      <div class="accion-card">
        <div>
          <strong>Desactivar Graduados (6to Primaria / 6to Secundaria)</strong>
          <p style="color:#64748B;font-size:13px;margin:4px 0 0">Marca como inactivos a los estudiantes de 6to grado.</p>
        </div>
        <button class="btn-secondary" onclick="window._desactivarGraduados()">Desactivar graduados</button>
      </div>
      <div class="accion-card" style="border-color:#9B1C1C">
        <div>
          <strong style="color:#9B1C1C">Limpiar estudiantes inactivos</strong>
          <p style="color:#64748B;font-size:13px;margin:4px 0 0">Elimina todos los registros inactivos.</p>
        </div>
        <button class="btn-danger" onclick="window._limpiar()">Limpiar</button>
      </div>
    </div>`;

  window._promover = async () => {
    if (!confirm('¿Promover todos los estudiantes de grado? Esta acción no se puede deshacer.')) return;
    try { await api.gestionEstudiantes(S.user.pin_hash, 'promover', null, null, null); toast('Promoción completada.'); }
    catch(e) { toast('Error: ' + e.message); }
  };
  window._desactivarGraduados = async () => {
    if (!confirm('¿Desactivar estudiantes de 6to grado?')) return;
    try { await api.gestionEstudiantes(S.user.pin_hash, 'desactivar_graduados', null, null, null); toast('Hecho.'); }
    catch(e) { toast('Error: ' + e.message); }
  };
  window._limpiar = async () => {
    if (!confirm('¿Eliminar TODOS los estudiantes inactivos? Esta acción es irreversible.')) return;
    try { await api.gestionEstudiantes(S.user.pin_hash, 'limpiar', null, null, null); toast('Limpieza completada.'); }
    catch(e) { toast('Error: ' + e.message); }
  };
}

/* ─── MODAL USUARIO ─────────────────────── */
function _modalUsuario() {
  return `
  <div id="modal-usuario" class="modal-backdrop" style="display:none">
    <div class="modal-card" style="max-width:480px">
      <h3 id="mu-titulo" style="margin:0 0 16px">Nuevo Usuario</h3>
      <input type="hidden" id="mu-id" />
      <div class="field-row">
        <div class="field-group">
          <label>Nombre completo <span class="req">*</span></label>
          <input id="mu-nombre" type="text" />
        </div>
        <div class="field-group">
          <label>Usuario <span class="req">*</span></label>
          <input id="mu-usuario" type="text" placeholder="ej. p.garcia" />
        </div>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Rol <span class="req">*</span></label>
          <select id="mu-rol">
            ${Object.entries(ROLES_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label>Área</label>
          <select id="mu-area">
            ${Object.entries(AREAS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-group">
        <label>PIN nuevo <span style="color:#94A3B8;font-size:12px">(dejar en blanco para no cambiar)</span></label>
        <input id="mu-pin" type="password" placeholder="Mínimo 4 caracteres" />
      </div>
      <div class="field-group" style="margin-top:6px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="mu-activo" checked style="width:16px;height:16px" />
          Usuario activo
        </label>
      </div>
      <div id="mu-err" class="form-error" style="display:none"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn-secondary" onclick="window._hideModalUsuario()">Cancelar</button>
        <button class="btn-primary" onclick="window._guardarUsuario()">Guardar</button>
      </div>
    </div>
  </div>`;
}

/* ─── MODAL COBERTURA ───────────────────── */
function _modalCobertura() {
  return `
  <div id="modal-cobertura" class="modal-backdrop" style="display:none">
    <div class="modal-card" style="max-width:420px">
      <h3 style="margin:0 0 4px">Cobertura de Áreas</h3>
      <p id="mc-sub" style="color:#64748B;font-size:13px;margin:0 0 16px"></p>
      <input type="hidden" id="mc-uid" />
      <div id="mc-checks" style="display:flex;flex-direction:column;gap:10px">
        ${Object.entries(AREAS).filter(([k])=>k!=='ambos').map(([k,v])=>`
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px">
            <input type="checkbox" class="mc-area" value="${k}" style="width:16px;height:16px" />
            ${v}
          </label>`).join('')}
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
        <button class="btn-secondary" onclick="window._hideModalCobertura()">Cancelar</button>
        <button class="btn-primary" onclick="window._guardarCobertura()">Guardar Cobertura</button>
      </div>
    </div>
  </div>`;
}

/* ─── HANDLERS ──────────────────────────── */
window._nuevoUsuario = () => {
  document.getElementById('mu-titulo').textContent = 'Nuevo Usuario';
  ['mu-id','mu-nombre','mu-usuario','mu-pin'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('mu-activo').checked = true;
  document.getElementById('mu-rol').value = 'psicologia';
  document.getElementById('mu-area').value = 'primaria_ciclo1';
  document.getElementById('mu-err').style.display = 'none';
  document.getElementById('modal-usuario').style.display = 'flex';
};

window._editarUsuario = id => {
  const u = S.usuarios.find(x => x.id === id);
  if (!u) return;
  document.getElementById('mu-titulo').textContent = 'Editar Usuario';
  document.getElementById('mu-id').value     = u.id;
  document.getElementById('mu-nombre').value  = u.nombre;
  document.getElementById('mu-usuario').value = u.usuario;
  document.getElementById('mu-rol').value     = u.rol;
  document.getElementById('mu-area').value    = u.area || 'primaria_ciclo1';
  document.getElementById('mu-activo').checked = u.activo !== false;
  document.getElementById('mu-pin').value     = '';
  document.getElementById('mu-err').style.display = 'none';
  document.getElementById('modal-usuario').style.display = 'flex';
};

window._hideModalUsuario = () => {
  document.getElementById('modal-usuario').style.display = 'none';
};

window._guardarUsuario = async () => {
  const nombre  = document.getElementById('mu-nombre').value.trim();
  const usuario = document.getElementById('mu-usuario').value.trim();
  const pin     = document.getElementById('mu-pin').value.trim();
  const errEl   = document.getElementById('mu-err');
  errEl.style.display = 'none';

  if (!nombre || !usuario) {
    errEl.textContent = 'Nombre y usuario son requeridos.'; errEl.style.display = ''; return;
  }

  const id    = document.getElementById('mu-id').value || null;
  const datos = {
    id,
    nombre,
    usuario,
    rol:    document.getElementById('mu-rol').value,
    area:   document.getElementById('mu-area').value,
    activo: document.getElementById('mu-activo').checked,
  };
  if (pin) datos.pin_hash = await sha256(pin);

  try {
    await api.upsertUsuario(S.user.pin_hash, datos);
    S.usuarios = await api.getUsuarios(S.user.pin_hash) || [];
    window._hideModalUsuario();
    _renderTabUsuarios();
    toast('Usuario guardado.');
  } catch(e) { errEl.textContent = e.message; errEl.style.display = ''; }
};

window._gestionCobertura = id => {
  const u = S.usuarios.find(x => x.id === id);
  document.getElementById('mc-uid').value = id;
  document.getElementById('mc-sub').textContent = `Psicólogo/a: ${u?.nombre || ''}`;
  const actual = u?.areas_cobertura || [];
  document.querySelectorAll('.mc-area').forEach(cb => {
    cb.checked = actual.includes(cb.value);
  });
  document.getElementById('modal-cobertura').style.display = 'flex';
};

window._hideModalCobertura = () => {
  document.getElementById('modal-cobertura').style.display = 'none';
};

window._guardarCobertura = async () => {
  const uid   = document.getElementById('mc-uid').value;
  const areas = [...document.querySelectorAll('.mc-area:checked')].map(cb => cb.value);
  try {
    await api.setCobertura(S.user.pin_hash, uid, areas);
    S.usuarios = await api.getUsuarios(S.user.pin_hash) || [];
    window._hideModalCobertura();
    _renderTabUsuarios();
    toast('Cobertura actualizada.');
  } catch(e) { toast('Error: ' + e.message); }
};

/* ─── HELPERS ───────────────────────────── */
function _parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const filas = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.replace(/^"|"$/g,'').trim());
    if (cols.length < 4) continue;
    const [nombre, grado, seccion, nivel] = cols;
    if (nombre.toLowerCase() === 'nombre') continue; // skip header
    filas.push({ nombre, grado, seccion, nivel: nivel || 'primaria' });
  }
  return filas;
}
