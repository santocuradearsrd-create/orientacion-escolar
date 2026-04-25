import { S }             from '../state.js';
import { api }            from '../api.js';
import { navigate }       from '../router.js';
import { toast, esc, calcArea, areaLabel } from '../utils.js';
import { pdfBorrador }    from '../pdf.js';
import { GRADOS, SECCIONES } from '../config.js';

// ── Main report form ─────────────────────────────────────────

export async function renderReporte() {
  // Pre-load students in background
  if (!S.estudiantes.length) {
    api.getEstudiantes().then(({ data }) => { S.estudiantes = data || []; });
  }

  document.getElementById('main').innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <button class="btn btn-outline btn-sm" id="btn-volver">&#8592; Volver</button>
    <h2 style="margin:0;border:none;padding:0;font-size:19px">Nuevo reporte de caso</h2>
  </div>
  <div class="card">
    <div class="info-box">
      Este formulario es <strong>confidencial</strong>. Solo el/la psicólogo/a asignado/a y
      la coordinación tendrán acceso al caso.
    </div>

    <h3>¿A quién va dirigido este reporte?</h3>
    <div class="grid3">
      <div>
        <label>Nivel educativo *</label>
        <select id="r-nivel">
          <option value="">-- Selecciona --</option>
          <option value="primaria">Primaria</option>
          <option value="secundaria">Secundaria</option>
        </select>
      </div>
      <div>
        <label>Grado *</label>
        <select id="r-grado" disabled>
          <option value="">-- Selecciona nivel --</option>
          ${GRADOS.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Psicólogo/a asignado/a *</label>
        <select id="r-psicologo" disabled>
          <option value="">-- Selecciona grado --</option>
        </select>
      </div>
    </div>
    <div id="area-info" style="display:none" class="gold-box"></div>

    <div class="divider"></div>
    <h3>Datos del docente</h3>
    <div class="grid2">
      <div>
        <label>Nombre completo *</label>
        <input type="text" id="r-docente" placeholder="Prof. Ana García" autocomplete="off">
      </div>
      <div>
        <label>Materia *</label>
        <input type="text" id="r-materia" placeholder="Matemáticas">
      </div>
    </div>
    <div class="grid2">
      <div>
        <label>Sección del estudiante *</label>
        <select id="r-seccion">
          <option value="">-- Sección --</option>
          ${SECCIONES.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Estudiante *</label>
        <select id="r-estudiante">
          <option value="">-- Selecciona grado y sección --</option>
        </select>
      </div>
    </div>
    <div id="est-manual-wrap" style="display:none;margin-top:6px">
      <label>Nombre del estudiante</label>
      <input type="text" id="r-est-manual" placeholder="Nombre completo">
    </div>

    <div class="divider"></div>
    <h3>Descripción del caso</h3>
    <label>Descripción detallada de la situación *</label>
    <textarea id="r-desc" rows="5"
      placeholder="Qué ocurrió, cuándo, dónde, quiénes estuvieron involucrados..."></textarea>

    <label>Acciones ya tomadas por el docente *</label>
    <textarea id="r-acciones" rows="3"
      placeholder="Conversación con el estudiante, llamada a padres, reunión..."></textarea>

    <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
      <input type="checkbox" id="r-repetida" style="width:18px;height:18px;accent-color:var(--g1)">
      <label style="margin:0;font-size:14px;cursor:pointer;text-transform:none;letter-spacing:0" for="r-repetida">
        Esta es una actitud o comportamiento <strong>repetido</strong>
      </label>
    </div>
    <div id="r-veces-wrap" style="display:none;margin-top:8px">
      <label>¿Cuántas veces aproximadamente?</label>
      <input type="number" id="r-veces" min="2" max="50" value="2" style="width:130px">
    </div>

    <label>Observaciones adicionales <span style="font-weight:400;text-transform:none">(opcional)</span></label>
    <textarea id="r-obs" rows="3"
      placeholder="Contexto familiar, situaciones externas, información de respaldo..."></textarea>

    <div class="divider"></div>
    <div id="r-error" style="display:none" class="warn-box"></div>
    <div class="btn-row">
      <button class="btn btn-outline" id="btn-borrador">📄 Guardar PDF borrador</button>
      <button class="btn btn-primary" id="btn-enviar">✉ Enviar reporte</button>
    </div>
    <div style="font-size:12px;color:var(--sub);margin-top:8px">
      Guarda el PDF borrador antes de enviar — será tu copia del reporte.
    </div>
  </div>`;

  // Events
  document.getElementById('btn-volver').addEventListener('click', () => navigate('inicio'));

  const nivelSel = document.getElementById('r-nivel');
  const gradoSel = document.getElementById('r-grado');
  const secSel   = document.getElementById('r-seccion');
  const estSel   = document.getElementById('r-estudiante');
  const psicSel  = document.getElementById('r-psicologo');

  nivelSel.addEventListener('change', () => {
    gradoSel.disabled = !nivelSel.value;
    gradoSel.value = '';
    psicSel.innerHTML = '<option value="">-- Selecciona grado --</option>';
    psicSel.disabled  = true;
    document.getElementById('area-info').style.display = 'none';
    actualizarEstudiantes();
  });

  gradoSel.addEventListener('change', cargarPsicologos);
  secSel.addEventListener('change', actualizarEstudiantes);

  estSel.addEventListener('change', () => {
    document.getElementById('est-manual-wrap').style.display =
      estSel.value === 'manual' ? 'block' : 'none';
  });

  document.getElementById('r-repetida').addEventListener('change', function () {
    document.getElementById('r-veces-wrap').style.display = this.checked ? 'block' : 'none';
  });

  document.getElementById('btn-borrador').addEventListener('click', () => {
    const d = getDatos();
    pdfBorrador(d, getEstNombre(d));
  });

  document.getElementById('btn-enviar').addEventListener('click', enviarReporte);
}

async function cargarPsicologos() {
  const nivel  = document.getElementById('r-nivel').value;
  const grado  = document.getElementById('r-grado').value;
  const psicSel= document.getElementById('r-psicologo');
  const infoEl = document.getElementById('area-info');

  if (!nivel || !grado) return;
  const area = calcArea(nivel, grado);

  psicSel.innerHTML = '<option value="">Cargando...</option>';
  psicSel.disabled  = true;
  infoEl.style.display = 'block';
  infoEl.innerHTML = `<strong>Área:</strong> ${areaLabel(area)} — buscando psicólogos...`;

  const { data, error } = await api.getPsicologosArea(area);
  const psics = Array.isArray(data) ? data : [];

  if (error || !psics.length) {
    infoEl.innerHTML = `<strong>Área:</strong> ${areaLabel(area)} — ⚠ Sin psicólogos disponibles para esta área.`;
    psicSel.innerHTML = '<option value="">Sin psicólogos disponibles</option>';
    psicSel.disabled  = true;
  } else {
    infoEl.innerHTML = `<strong>Área:</strong> ${areaLabel(area)} &nbsp;·&nbsp; ${psics.length} psicólogo/a(s) disponible(s)`;
    psicSel.innerHTML = '<option value="">-- Selecciona --</option>' +
      psics.map(p => {
        const tag = p.es_principal ? '' : ' <em style="opacity:.7">(cobertura)</em>';
        return `<option value="${p.id}">${esc(p.nombre)}${p.es_principal ? '' : ' (cobertura)'}</option>`;
      }).join('');
    psicSel.disabled = false;
  }

  actualizarEstudiantes();
}

function actualizarEstudiantes() {
  const grado = document.getElementById('r-grado').value;
  const sec   = document.getElementById('r-seccion').value;
  const estSel= document.getElementById('r-estudiante');
  if (!grado || !sec) { estSel.innerHTML = '<option value="">-- Selecciona grado y sección --</option>'; return; }
  const lista = S.estudiantes.filter(e => e.grado === grado && e.seccion === sec);
  estSel.innerHTML = '<option value="">-- Selecciona --</option>' +
    lista.map(e => `<option value="${e.id}">${e.numero_orden}. ${esc(e.nombre)}</option>`).join('') +
    '<option value="manual">✏ Escribir nombre manualmente</option>';
}

function getDatos() {
  return {
    nivel_caso:               document.getElementById('r-nivel')?.value    || '',
    docente_nombre:           (document.getElementById('r-docente')?.value  || '').trim(),
    docente_materia:          (document.getElementById('r-materia')?.value  || '').trim(),
    docente_grado:            document.getElementById('r-grado')?.value     || '',
    docente_seccion:          document.getElementById('r-seccion')?.value   || '',
    estudiante_id:            document.getElementById('r-estudiante')?.value || '',
    estudiante_nombre_manual: (document.getElementById('r-est-manual')?.value || '').trim(),
    descripcion_situacion:    (document.getElementById('r-desc')?.value      || '').trim(),
    acciones_tomadas:         (document.getElementById('r-acciones')?.value  || '').trim(),
    es_actitud_repetida:      document.getElementById('r-repetida')?.checked || false,
    veces_repetida:           parseInt(document.getElementById('r-veces')?.value) || 0,
    observaciones_adicionales:(document.getElementById('r-obs')?.value       || '').trim(),
    asignado_a:               document.getElementById('r-psicologo')?.value  || '',
  };
}

function getEstNombre(d) {
  if (d.estudiante_id && d.estudiante_id !== 'manual') {
    return S.estudiantes.find(e => e.id === d.estudiante_id)?.nombre || '—';
  }
  return d.estudiante_nombre_manual || '—';
}

async function enviarReporte() {
  const d     = getDatos();
  const errEl = document.getElementById('r-error');
  const show  = m => { errEl.style.display = 'block'; errEl.textContent = m; errEl.scrollIntoView({ behavior: 'smooth' }); };
  errEl.style.display = 'none';

  if (!d.asignado_a)                          { show('Selecciona el nivel, grado y psicólogo/a.'); return; }
  if (!d.docente_nombre || !d.docente_materia){ show('Ingresa tu nombre y materia.'); return; }
  if (!d.docente_grado  || !d.docente_seccion){ show('Selecciona el grado y la sección.'); return; }
  if (!d.estudiante_id && !d.estudiante_nombre_manual) { show('Selecciona o escribe el nombre del estudiante.'); return; }
  if (!d.descripcion_situacion)               { show('Describe la situación detalladamente.'); return; }
  if (!d.acciones_tomadas)                    { show('Indica las acciones que ya tomaste.'); return; }

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true; btn.textContent = 'Enviando...';

  const payload = { ...d };
  if (payload.estudiante_id === 'manual') payload.estudiante_id = null;

  const { data, error } = await api.enviarCaso(payload);
  btn.disabled = false; btn.textContent = '✉ Enviar reporte';

  if (error || data?.error) {
    show('Error al enviar: ' + (data?.error || error?.message));
    return;
  }

  S._reporteData = { datos: d, estNombre: getEstNombre(d) };
  navigate('enviado');
}

// ── Enviado confirmation page ────────────────────────────────

export function renderEnviado() {
  const { datos: d, estNombre } = S._reporteData || {};
  document.getElementById('main').innerHTML = `
  <div class="card enviado-wrap">
    <div class="enviado-check">✓</div>
    <div style="font-size:24px;font-weight:700;color:var(--ve);margin-bottom:8px">Reporte enviado</div>
    <p style="color:var(--sub);margin-bottom:22px">
      El/la psicólogo/a asignado/a ha recibido el caso.
    </p>
    <div class="success-box" style="display:inline-block;text-align:left;max-width:400px">
      <div><strong>Docente:</strong> ${esc(d?.docente_nombre || '')}</div>
      <div><strong>Estudiante:</strong> ${esc(estNombre || '')}</div>
      <div><strong>Grado / Sección:</strong> ${esc(d?.docente_grado || '')} ${esc(d?.docente_seccion || '')}</div>
      <div style="margin-top:6px;font-size:12px;color:var(--sub)">
        Guarda tu PDF como constancia del reporte enviado.
      </div>
    </div>
    <div class="btn-row" style="justify-content:center;margin-top:28px">
      <button class="btn btn-outline" id="btn-pdf-enviado">📄 PDF del reporte</button>
      <button class="btn btn-primary" id="btn-inicio-enviado">Volver al inicio</button>
    </div>
  </div>`;

  document.getElementById('btn-pdf-enviado').addEventListener('click', () => pdfBorrador(d, estNombre));
  document.getElementById('btn-inicio-enviado').addEventListener('click', () => navigate('inicio'));
}
