import { S }           from '../state.js';
import { api }          from '../api.js';
import { navigate }     from '../router.js';
import { toast, esc, badgeEstado, badgeGravedad, badgeArea, estaVencida, fmtDate, fmtShort, areaLabel } from '../utils.js';
import { updateBadge }  from '../nav.js';

export async function renderPanel() {
  document.getElementById('main').innerHTML = `
  <div style="text-align:center;padding:60px 20px;color:var(--sub)">
    <div style="font-size:32px;margin-bottom:12px">⏳</div>
    <div>Cargando casos...</div>
  </div>`;
  const { data, error } = await api.getCasos(S.user.id, S.user.pin_hash, null);
  if (error || !Array.isArray(data)) {
    document.getElementById('main').innerHTML = `
    <div class="card" style="text-align:center;padding:40px;color:var(--sub)">
      Error de conexión.
      <button class="btn btn-outline btn-sm" id="btn-retry" style="margin-left:8px">Reintentar</button>
    </div>`;
    document.getElementById('btn-retry').addEventListener('click', renderPanel);
    return;
  }
  S.casos = data;
  updateBadge(data);
  if (S.filtroGrado) renderCursoDetalle(S.filtroGrado);
  else renderPanelPrincipal();
}

function renderPanelPrincipal() {
  const activos  = S.casos.filter(x => x.estado !== 'cerrado');
  const cerrados = S.casos.filter(x => x.estado === 'cerrado');
  const base     = S.panelTab === 'historial' ? cerrados : activos;
  const filtrados = base
    .filter(x => !S.filtroGravedad || x.gravedad === S.filtroGravedad)
    .filter(x => !S.filtroArea    || x.area     === S.filtroArea);
  const grupos = {};
  filtrados.forEach(x => {
    const k = `${x.docente_grado}-${x.docente_seccion}`;
    if (!grupos[k]) grupos[k] = {grado:x.docente_grado,seccion:x.docente_seccion,key:k,area:x.area,abiertos:0,proceso:0,cerr:0,urgentes:0,vencidas:0};
    if (x.estado==='abierto') grupos[k].abiertos++;
    else if (x.estado==='en_proceso') grupos[k].proceso++;
    else grupos[k].cerr++;
    if (x.gravedad==='urgente') grupos[k].urgentes++;
    if (estaVencida(x)) grupos[k].vencidas++;
  });
  const orden=['1ro','2do','3ro','4to','5to','6to'];
  const gs=Object.values(grupos).sort((a,b)=>{const d=orden.indexOf(a.grado)-orden.indexOf(b.grado);return d||a.seccion.localeCompare(b.seccion);});
  const nAbiertos=activos.filter(x=>x.estado==='abierto').length;
  const nProceso=activos.filter(x=>x.estado==='en_proceso').length;
  const nUrgentes=activos.filter(x=>x.gravedad==='urgente').length;
  const nVencidas=activos.filter(estaVencida).length;
  const puedeExcel=S.user.rol==='direccion'||S.user.rol==='admin';
  const areasVis=[...new Set(S.casos.map(c=>c.area))];
  const multiArea=['admin','direccion'].includes(S.user.rol)||S.user.area==='ambos'||(S.user.areas_cobertura||[]).length>0;

  document.getElementById('main').innerHTML = `
  <div class="card" style="padding:18px 20px;margin-bottom:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:17px;font-weight:700">${esc(S.user.nombre)}</div>
        <div style="font-size:12px;color:var(--sub)">${esc(S.user.rol)}${S.user.area&&S.user.area!=='ambos'?' · '+areaLabel(S.user.area):''}${(S.user.areas_cobertura||[]).length?' &nbsp;<span style="color:var(--g1)">+'+S.user.areas_cobertura.length+' cobertura</span>':''}</div>
      </div>
      ${puedeExcel?`<button class="btn btn-outline btn-sm" id="btn-excel">📊 Excel</button> <button class="btn btn-outline btn-sm" id="btn-ir-admin">⚙ Gestión</button>`:''}
    </div>
    <div class="stat-cards">
      <div class="stat"><div class="stat-num" style="color:var(--na)">${nAbiertos}</div><div class="stat-lbl">Abiertos</div></div>
      <div class="stat"><div class="stat-num" style="color:var(--az)">${nProceso}</div><div class="stat-lbl">En proceso</div></div>
      <div class="stat"><div class="stat-num" style="color:var(--ve)">${cerrados.length}</div><div class="stat-lbl">Cerrados</div></div>
      ${nUrgentes>0?`<div class="stat" style="border-color:#FCA5A5"><div class="stat-num" style="color:var(--ro)">${nUrgentes}</div><div class="stat-lbl">Urgentes</div></div>`:''}
      ${nVencidas>0?`<div class="stat" style="border-color:#FECDD3"><div class="stat-num" style="color:#9F1239">${nVencidas}</div><div class="stat-lbl">Citas venc.</div></div>`:''}
    </div>
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${S.panelTab==='activos'?'active':''}" id="tab-activos">Casos activos <span class="badge b-abierto">${activos.length}</span></div>
      <div class="tab ${S.panelTab==='historial'?'active':''}" id="tab-historial">Historial <span class="badge b-cerrado">${cerrados.length}</span></div>
    </div>
  </div>
  ${S.panelTab==='activos'?`<div class="chips" id="chips-g">
    <div class="chip ${!S.filtroGravedad?'active':''}" data-g="">Todos</div>
    <div class="chip ${S.filtroGravedad==='urgente'?'active':''}" data-g="urgente">🔴 Urgente</div>
    <div class="chip ${S.filtroGravedad==='grave'?'active':''}" data-g="grave">🟠 Grave</div>
    <div class="chip ${S.filtroGravedad==='moderado'?'active':''}" data-g="moderado">🟡 Moderado</div>
    <div class="chip ${S.filtroGravedad==='leve'?'active':''}" data-g="leve">🟢 Leve</div>
  </div>`:''}
  ${multiArea&&areasVis.length>1?`<div class="chips" id="chips-a">
    <div class="chip ${!S.filtroArea?'active':''}" data-a="">Todas las áreas</div>
    ${areasVis.map(a=>`<div class="chip ${S.filtroArea===a?'active':''}" data-a="${a}">${areaLabel(a)}</div>`).join('')}
  </div>`:''}
  <div class="search-wrap"><span class="search-ico">🔍</span><input type="text" id="search-global" placeholder="Buscar por nombre del estudiante..."></div>
  <div id="panel-grid">
    ${gs.length===0
      ?`<div class="card" style="text-align:center;color:var(--sub);padding:40px">${S.panelTab==='historial'?'Sin casos cerrados aún.':'Sin casos activos.'}</div>`
      :`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">${gs.map(cursoCard).join('')}</div>`}
  </div>`;

  document.getElementById('tab-activos').addEventListener('click',()=>{S.panelTab='activos';S.filtroGravedad=null;S.filtroArea=null;renderPanelPrincipal();});
  document.getElementById('tab-historial').addEventListener('click',()=>{S.panelTab='historial';S.filtroGravedad=null;S.filtroArea=null;renderPanelPrincipal();});
  document.querySelectorAll('#chips-g .chip').forEach(el=>el.addEventListener('click',()=>{S.filtroGravedad=el.dataset.g||null;renderPanelPrincipal();}));
  document.querySelectorAll('#chips-a .chip').forEach(el=>el.addEventListener('click',()=>{S.filtroArea=el.dataset.a||null;renderPanelPrincipal();}));
  document.getElementById('btn-excel')?.addEventListener('click',exportarExcel);
  document.getElementById('btn-ir-admin')?.addEventListener('click',()=>navigate('admin'));
  document.getElementById('search-global').addEventListener('input',function(){buscarGlobal(this.value,base);});
  document.querySelectorAll('.curso-card[data-key]').forEach(el=>el.addEventListener('click',()=>{S.filtroGrado=el.dataset.key;renderCursoDetalle(el.dataset.key);}));
}

function cursoCard(g) {
  return `<div class="curso-card" data-key="${g.key}">
    <div class="curso-num">${esc(g.grado)}</div>
    <div class="curso-sec">Sección ${esc(g.seccion)}</div>
    ${badgeArea(g.area)}
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">
      ${g.abiertos>0?`<span class="badge b-abierto">${g.abiertos} abierto${g.abiertos!==1?'s':''}</span>`:''}
      ${g.proceso>0?`<span class="badge b-proceso">${g.proceso} proceso</span>`:''}
      ${g.cerr>0?`<span class="badge b-cerrado">${g.cerr} cerrado${g.cerr!==1?'s':''}</span>`:''}
    </div>
    ${g.urgentes>0?`<div style="margin-top:6px;font-size:11px;font-weight:700;color:var(--ro)">🔴 ${g.urgentes} urgente${g.urgentes>1?'s':''}</div>`:''}
    ${g.vencidas>0?`<div style="margin-top:3px;font-size:11px;font-weight:700;color:#9F1239">📅 cita vencida</div>`:''}
  </div>`;
}

function renderCursoDetalle(gradoKey) {
  const [grad,sec] = gradoKey.split('-');
  const base  = S.panelTab==='historial'
    ? S.casos.filter(x => x.estado==='cerrado')
    : S.casos.filter(x => x.estado!=='cerrado');
  const todos = S.casos.filter(x => `${x.docente_grado}-${x.docente_seccion}`===gradoKey);
  const casos = base.filter(x  => `${x.docente_grado}-${x.docente_seccion}`===gradoKey);

  document.getElementById('main').innerHTML=`
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn btn-outline btn-sm" id="btn-back">&#8592; Volver</button>
    <div>
      <div style="font-size:18px;font-weight:700">${esc(grad)} — Sección ${esc(sec)}</div>
      <div style="font-size:12px;color:var(--sub)">${_countLabel(casos)}</div>
    </div>
  </div>
  <div class="search-wrap"><span class="search-ico">🔍</span>
    <input type="text" id="search-curso" placeholder="Buscar estudiante...">
  </div>
  <div id="lista-casos">
    ${casos.length===0
      ? '<div class="card" style="text-align:center;color:var(--sub);padding:40px">Sin casos.</div>'
      : _renderGruposEstudiante(casos)}
  </div>`;

  document.getElementById('btn-back').addEventListener('click',()=>{S.filtroGrado=null;renderPanelPrincipal();});
  document.getElementById('search-curso').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    const filtrados = q
      ? casos.filter(x => (x.estudiante_nombre_bd||x.estudiante_nombre_manual||'').toLowerCase().includes(q))
      : casos;
    document.getElementById('lista-casos').innerHTML = filtrados.length===0
      ? '<div class="card" style="text-align:center;color:var(--sub);padding:30px">Sin resultados.</div>'
      : _renderGruposEstudiante(filtrados);
    attachCasosEvents();
  });
  attachCasosEvents();
}

// Agrupa casos por estudiante, ordena por activos desc luego urgencia
function _renderGruposEstudiante(casos) {
  const grupos = {};
  const GRAV = { urgente:0, grave:1, moderado:2, leve:3 };

  casos.forEach(x => {
    const nom = x.estudiante_nombre_bd || x.estudiante_nombre_manual || '—';
    if (!grupos[nom]) grupos[nom] = [];
    grupos[nom].push(x);
  });

  // Ordenar casos dentro de cada grupo: urgentes primero → más reciente
  Object.values(grupos).forEach(arr => {
    arr.sort((a,b) => {
      const ga = GRAV[a.gravedad]??4, gb = GRAV[b.gravedad]??4;
      if (ga!==gb) return ga-gb;
      return new Date(b.created_at)-new Date(a.created_at);
    });
  });

  // Ordenar estudiantes: más casos activos desc → peor gravedad → más reciente
  const sorted = Object.entries(grupos).sort(([,a],[,b]) => {
    const actA = a.filter(x=>x.estado!=='cerrado').length;
    const actB = b.filter(x=>x.estado!=='cerrado').length;
    if (actB!==actA) return actB-actA;
    const gravA = Math.min(...a.map(x=>GRAV[x.gravedad]??4));
    const gravB = Math.min(...b.map(x=>GRAV[x.gravedad]??4));
    if (gravA!==gravB) return gravA-gravB;
    return new Date(b[0].created_at)-new Date(a[0].created_at);
  });

  return sorted.map(([nom, arr]) => {
    const activos   = arr.filter(x=>x.estado!=='cerrado').length;
    const urgentes  = arr.filter(x=>x.gravedad==='urgente').length;
    const graves    = arr.filter(x=>x.gravedad==='grave').length;
    const vencidos  = arr.filter(estaVencida).length;

    const alertas = [
      urgentes ? `<span class="badge b-urgente">${urgentes} urgente${urgentes>1?'s':''}</span>` : '',
      graves   ? `<span class="badge b-grave">${graves} grave${graves>1?'s':''}</span>` : '',
      vencidos ? `<span class="badge" style="background:#FEF3C7;color:#92400E">⏰ cita vencida</span>` : '',
    ].filter(Boolean).join('');

    return `
    <div class="est-grupo">
      <div class="est-grupo-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="est-nom">👤 ${esc(nom)}</span>
          <span class="badge" style="background:#1E3A5F;color:#fff">${arr.length} caso${arr.length>1?'s':''}</span>
          ${activos ? `<span class="badge b-proceso">${activos} activo${activos>1?'s':''}</span>` : ''}
          ${alertas}
        </div>
      </div>
      <div class="est-casos">
        ${arr.map(casoBadge).join('')}
      </div>
    </div>`;
  }).join('');
}

function _countLabel(casos) {
  const ests = new Set(casos.map(x=>x.estudiante_nombre_bd||x.estudiante_nombre_manual||'—')).size;
  return `${casos.length} caso${casos.length!==1?'s':''} · ${ests} estudiante${ests!==1?'s':''}`;
}

function attachCasosEvents() {
  document.querySelectorAll('.caso-row[data-id]').forEach(el=>el.addEventListener('click',()=>verCaso(el.dataset.id)));
}


export function casoBadge(x) {
  const venc=estaVencida(x);
  const cls=`caso-row estado-${x.estado==='en_proceso'?'proceso':x.estado}`;
  return `<div class="${cls}" data-id="${x.id}">
    <div style="display:flex;align-items:flex-start;gap:6px;flex-wrap:wrap;margin-bottom:5px">
      ${badgeEstado(x.estado)} ${badgeGravedad(x.gravedad)} ${badgeArea(x.area)}
      <span class="caso-est">${esc(x.estudiante_nombre_bd||x.estudiante_nombre_manual||'—')}</span>
      ${venc?`<span class="caso-vencida">📅 Cita vencida ${fmtShort(x.proxima_cita)}</span>`:''}
    </div>
    <div class="caso-meta">${esc(x.docente_nombre)} · ${esc(x.docente_materia)} · ${fmtDate(x.created_at)}</div>
    <div class="caso-desc">${esc(x.descripcion_situacion)}</div>
  </div>`;
}

function buscarGlobal(q,base) {
  const el=document.getElementById('panel-grid');
  if(!el) return;
  if(!q.trim()){renderPanelPrincipal();return;}
  const lista=base.filter(x=>(x.estudiante_nombre_bd||x.estudiante_nombre_manual||'').toLowerCase().includes(q.toLowerCase()));
  el.innerHTML=lista.length===0?`<div class="card" style="text-align:center;color:var(--sub);padding:30px">Sin resultados.</div>`:lista.map(casoBadge).join('');
  attachCasosEvents();
}

async function verCaso(id) {
  const {data,error}=await api.getCasoDetalle(S.user.pin_hash,id);
  if(error||data?.error){toast('Error al cargar el caso');return;}
  S.casoActual=data;
  navigate('caso');
}

function exportarExcel() {
  if(!S.casos?.length){toast('Sin casos para exportar');return;}
  const wb=XLSX.utils.book_new();
  const h=['Estudiante','Grado','Sección','Nivel','Área','Docente','Materia','Estado','Gravedad','Repetida','Veces','Asignado a','Fecha reporte','Fecha cierre'];
  const rows=[h,...S.casos.map(c=>[c.estudiante_nombre_bd||c.estudiante_nombre_manual||'—',c.docente_grado,c.docente_seccion,c.nivel_caso,areaLabel(c.area),c.docente_nombre,c.docente_materia,c.estado,c.gravedad||'—',c.es_actitud_repetida?'Sí':'No',c.veces_repetida||0,c.asignado_nombre||'—',(c.created_at||'').substring(0,16),(c.cerrado_at||'').substring(0,16)])];
  const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=h.map(()=>({wch:18}));
  XLSX.utils.book_append_sheet(wb,ws,'Casos');
  XLSX.writeFile(wb,`orientacion_${new Date().toISOString().substring(0,10)}.xlsx`);
  toast('Excel descargado');
}
