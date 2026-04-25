import { S }        from '../state.js';
import { api }       from '../api.js';
import { navigate }  from '../router.js';
import { toast, esc, badgeEstado, badgeGravedad, badgeArea, estaVencida, fmtDate, fmtShort, SEG_COLOR, SEG_EMOJI } from '../utils.js';
import { pdfCaso }   from '../pdf.js';

export async function renderCaso() {
  const c = S.casoActual?.caso;
  const seg = S.casoActual?.seguimiento || [];
  if (!c) { renderPanel(); return; }
  if (!S.usuarios.length && ['psicologia','admin','coordinador'].includes(S.user.rol)) {
    const { data } = await api.getUsuarios(S.user.id, S.user.pin_hash);
    if (data && !data.error) S.usuarios = data;
  }
  const psics = (S.usuarios||[]).filter(u=>u.rol==='psicologia'&&u.activo);
  const estNom = c.estudiante_nombre_bd||c.estudiante_nombre_manual||'—';
  const yaActivo = c.estado!=='cerrado';
  const puedeGestionar = yaActivo&&S.user.rol!=='direccion';
  const puedeCerrar = yaActivo&&['psicologia','admin'].includes(S.user.rol);
  const puedeReasignar = yaActivo&&['psicologia','admin','coordinador'].includes(S.user.rol);
  const puedeGravedad = yaActivo&&['psicologia','admin'].includes(S.user.rol);
  const venc = estaVencida(c);

  document.getElementById('main').innerHTML = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-outline btn-sm" id="btn-volver-caso">&#8592; Volver</button>
    <div style="flex:1;min-width:0">
      <div style="font-size:20px;font-weight:700">${esc(estNom)}</div>
      <div style="font-size:12px;color:var(--sub)">${esc(c.docente_grado)} ${esc(c.docente_seccion)} · ${esc(c.docente_nombre)}</div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${badgeEstado(c.estado)} ${badgeGravedad(c.gravedad)} ${badgeArea(c.area)}
      ${venc?'<span class="badge b-vencida">📅 Cita vencida</span>':''}
      <button class="btn btn-outline btn-sm" id="btn-pdf-caso">📄 PDF</button>
    </div>
  </div>
  <div class="card">
    <h3>Reporte del docente</h3>
    <div class="grid2" style="margin-bottom:10px">
      <div><label style="margin-top:0">Docente / Materia</label><div style="font-size:14px">${esc(c.docente_nombre)} · ${esc(c.docente_materia)}</div></div>
      <div><label style="margin-top:0">Fecha</label><div style="font-size:14px">${fmtDate(c.created_at)}</div></div>
    </div>
    <label>Descripción</label><div class="text-box">${esc(c.descripcion_situacion)}</div>
    <label>Acciones tomadas</label><div class="text-box">${esc(c.acciones_tomadas)}</div>
    ${c.es_actitud_repetida?`<div class="warn-box" style="margin-top:10px">⚠ Actitud repetida — ${c.veces_repetida} veces</div>`:''}
    ${c.observaciones_adicionales?`<label>Observaciones adicionales</label><div class="text-box">${esc(c.observaciones_adicionales)}</div>`:''}
    ${c.asignado_nombre?`<div class="info-box" style="margin-top:10px">👤 Asignado/a a: <strong>${esc(c.asignado_nombre)}</strong></div>`:''}
  </div>
  ${puedeGestionar?`
  <div class="card">
    <h3>${S.user.rol==='coordinador'?'Agregar comentario':'Gestión del caso'}</h3>
    ${puedeGravedad?`
    <div class="grid2">
      <div><label>Nivel de gravedad</label><select id="g-gravedad">
        <option value="">-- Sin asignar --</option>
        ${['leve','moderado','grave','urgente'].map(g=>`<option value="${g}"${c.gravedad===g?' selected':''}>${g.charAt(0).toUpperCase()+g.slice(1)}</option>`).join('')}
      </select></div>
      <div><label>Próxima cita</label><input type="date" id="g-cita" value="${c.proxima_cita||''}"></div>
    </div>`:''}
    ${puedeReasignar&&psics.length>1?`
    <label>Reasignar a otro/a psicólogo/a</label>
    <select id="g-reasignar">
      <option value="">-- No reasignar --</option>
      ${psics.filter(u=>u.id!==c.asignado_a).map(u=>`<option value="${u.id}">${esc(u.nombre)}</option>`).join('')}
    </select>`:''}
    <label>${S.user.rol==='coordinador'?'Comentario':'Nota de gestión'}</label>
    <textarea id="g-nota" rows="3" placeholder="Escribe una nota..."></textarea>
    <div class="btn-row">
      ${puedeCerrar?`<button class="btn btn-success" id="btn-cerrar-caso">✓ Cerrar caso</button>`:''}
      <button class="btn btn-primary" id="btn-guardar">Guardar</button>
    </div>
  </div>`:''}
  ${c.estado==='cerrado'?`
  <div class="card" style="border-left:4px solid var(--ve3)">
    <h3 style="color:var(--ve)">✅ Caso cerrado · ${fmtDate(c.cerrado_at)}</h3>
    <label>Resolución</label><div class="text-box" style="background:var(--ve2)">${esc(c.resolucion||'—')}</div>
    ${c.acuerdos?`<label>Acuerdos</label><div class="text-box" style="background:var(--ve2)">${esc(c.acuerdos)}</div>`:''}
    ${c.proxima_cita?`<div class="success-box" style="margin-top:10px">📅 Próxima cita: <strong>${fmtShort(c.proxima_cita)}</strong></div>`:''}
  </div>`:''}
  <div class="card">
    <h3>Historial del caso</h3>
    ${seg.length===0?'<p style="color:var(--sub);font-size:13px">Sin movimientos aún.</p>':seg.map(segItem).join('')}
  </div>`;

  document.getElementById('btn-volver-caso').addEventListener('click',()=>{S.casoActual=null;navigate('panel');});
  document.getElementById('btn-pdf-caso').addEventListener('click',()=>pdfCaso(S.casoActual));
  document.getElementById('btn-guardar')?.addEventListener('click',guardarGestion);
  document.getElementById('btn-cerrar-caso')?.addEventListener('click',showCierre);
}

function segItem(s) {
  const color=SEG_COLOR[s.tipo]||'#888';
  return `<div class="seg-item">
    <div class="seg-dot" style="background:${color}22;color:${color}">${SEG_EMOJI[s.tipo]||'📌'}</div>
    <div class="seg-body">
      <div class="seg-tipo">${esc(s.tipo)}</div>
      <div class="seg-contenido">${esc(s.contenido)}</div>
      <div class="seg-fecha">${esc(s.usuario_nombre||'Sistema')} · ${fmtDate(s.created_at)}</div>
    </div>
  </div>`;
}

async function guardarGestion() {
  const nota=(document.getElementById('g-nota')?.value||'').trim();
  const gravedad=document.getElementById('g-gravedad')?.value||'';
  const cita=document.getElementById('g-cita')?.value||'';
  const reasignar=document.getElementById('g-reasignar')?.value||'';
  const id=S.casoActual.caso.id;
  if(!nota&&!gravedad&&!cita&&!reasignar){toast('Escribe una nota o realiza algún cambio');return;}
  const btn=document.getElementById('btn-guardar');
  btn.disabled=true;btn.textContent='Guardando...';
  if(gravedad) await api.agregarObservacion(S.user.id,S.user.pin_hash,id,'gravedad',gravedad);
  if(cita)     await api.agregarObservacion(S.user.id,S.user.pin_hash,id,'cita',cita);
  if(reasignar) await api.asignarCaso(S.user.id, S.user.pin_hash,id,reasignar,nota||null);
  if(nota&&!reasignar) await api.agregarObservacion(S.user.id,S.user.pin_hash,id,'observacion',nota);
  toast('Guardado exitosamente');
  const {data}=await api.getCasoDetalle(S.user.id, S.user.pin_hash,id);
  if(data&&!data.error){S.casoActual=data;renderCaso();}
}

function showCierre() {
  const ov=document.createElement('div');ov.id='cierre-modal';ov.className='modal-bg';
  ov.innerHTML=`<div class="modal">
    <h2>Cerrar caso</h2>
    <label>Resolución / intervención realizada *</label>
    <textarea id="c-res" rows="4" placeholder="Describe la intervención y estado actual del estudiante..."></textarea>
    <label>Acuerdos <span style="font-weight:400;text-transform:none">(opcional)</span></label>
    <textarea id="c-ac" rows="3" placeholder="Compromisos del estudiante, la familia..."></textarea>
    <label>Próxima cita <span style="font-weight:400;text-transform:none">(opcional)</span></label>
    <input type="date" id="c-cita">
    <div id="c-err" style="display:none" class="warn-box"></div>
    <div class="btn-row" style="margin-top:16px">
      <button class="btn btn-outline" id="btn-cancel-cierre">Cancelar</button>
      <button class="btn btn-success" id="btn-confirm-cierre">✓ Confirmar cierre</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  document.getElementById('btn-cancel-cierre').addEventListener('click',()=>ov.remove());
  document.getElementById('btn-confirm-cierre').addEventListener('click',confirmarCierre);
}

async function confirmarCierre() {
  const res=(document.getElementById('c-res')?.value||'').trim();
  const ac=(document.getElementById('c-ac')?.value||'').trim();
  const cita=document.getElementById('c-cita')?.value||null;
  const errEl=document.getElementById('c-err');
  if(!res){errEl.style.display='block';errEl.textContent='La resolución es obligatoria.';return;}
  const btn=document.getElementById('btn-confirm-cierre');btn.disabled=true;btn.textContent='Cerrando...';
  const {error}=await api.cerrarCaso(S.user.id, S.user.pin_hash,S.casoActual.caso.id,res,ac||null,cita||null);
  if(error){btn.disabled=false;btn.textContent='✓ Confirmar cierre';toast('Error: '+error.message,5000);return;}
  document.getElementById('cierre-modal').remove();
  toast('Caso cerrado exitosamente');
  const {data}=await api.getCasoDetalle(S.user.id, S.user.pin_hash,S.casoActual.caso.id);
  if(data&&!data.error){S.casoActual=data;renderCaso();}
}

// Alias para app.js
export async function vistaCaso(params) {
  const casoId = params?.id || S.casoActual?.caso?.id;
  if (!S.user) { navigate('login'); return; }
  if (!casoId) { navigate('panel'); return; }
  if (casoId && (!S.casoActual || S.casoActual.caso.id !== casoId)) {
    document.getElementById('main').innerHTML = '<div class="loading-spinner">Cargando caso…</div>';
    const { data } = await api.getCasoDetalle(S.user.id, S.user.pin_hash, casoId);
    if (!data?.caso) { navigate('panel'); return; }
    S.casoActual = data;
  }
  renderCaso();
}
