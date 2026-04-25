export const esc = s =>
  String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function toast(msg, ms = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove('show'), ms);
}

export async function sha256(m) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(m));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('');
}

export const fmtDate = d =>
  !d ? '—' : new Date(d).toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

export const fmtShort = d =>
  !d ? '—' : new Date(d).toLocaleDateString('es-DO',{day:'2-digit',month:'short',year:'numeric'});

export const hoy = () => new Date().toISOString().split('T')[0];

export const estaVencida = c =>
  c.proxima_cita && c.proxima_cita < hoy() && c.estado !== 'cerrado';

export function calcArea(nivel, grado) {
  const ciclo = ['1ro','2do','3ro'].includes(grado) ? 'ciclo1' : 'ciclo2';
  return `${nivel}_${ciclo}`;
}

export function areaLabel(area) {
  const m = {
    primaria_ciclo1:   'Primaria 1er Ciclo',
    primaria_ciclo2:   'Primaria 2do Ciclo',
    secundaria_ciclo1: 'Secundaria 1er Ciclo',
    secundaria_ciclo2: 'Secundaria 2do Ciclo',
    ambos:             'Todos',
  };
  return m[area] || area || '—';
}

export function badgeEstado(e) {
  const m = {
    abierto:    ['b-abierto',  'Abierto'],
    en_proceso: ['b-proceso',  'En proceso'],
    cerrado:    ['b-cerrado',  'Cerrado'],
  };
  const [cls, txt] = m[e] || ['b-abierto', e];
  return `<span class="badge ${cls}">${txt}</span>`;
}

export function badgeGravedad(g) {
  if (!g) return '';
  const m = { leve:'b-leve', moderado:'b-moderado', grave:'b-grave', urgente:'b-urgente' };
  return `<span class="badge ${m[g]||''}">${g.charAt(0).toUpperCase()+g.slice(1)}</span>`;
}

export function badgeArea(area) {
  const styles = {
    primaria_ciclo1:   'background:#E0F2FE;color:#0369A1',
    primaria_ciclo2:   'background:#DBEAFE;color:#1D4ED8',
    secundaria_ciclo1: 'background:#D1FAE5;color:#065F46',
    secundaria_ciclo2: 'background:#ECFDF5;color:#047857',
  };
  return `<span class="badge" style="${styles[area]||'background:#F1F5F9;color:#475569'}">${areaLabel(area)}</span>`;
}

export const SEG_COLOR = {
  asignacion:  '#C9A84C',
  observacion: '#1E3A5F',
  gravedad:    '#9B1C1C',
  cita:        '#1B6B3A',
  reasignacion:'#5B21B6',
  cierre:      '#065F46',
};
export const SEG_EMOJI = {
  asignacion:  '👤',
  observacion: '💬',
  gravedad:    '⚠️',
  cita:        '📅',
  reasignacion:'🔄',
  cierre:      '✅',
};
