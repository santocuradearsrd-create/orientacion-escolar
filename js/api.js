import { sb } from './config.js';

// Retry wrapper with exponential backoff on network errors
const wait   = n => new Promise(r => setTimeout(r, n));
const isNet  = e => { const m = (e?.message||'').toLowerCase(); return m.includes('failed')||m.includes('network')||m.includes('fetch'); };

export async function rpc(fn, params, tries = 3, ms = 1200) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await sb.rpc(fn, params);
      if (r.error && i < tries - 1 && isNet(r.error)) { await wait(ms * (i + 1)); continue; }
      return r;
    } catch (e) {
      if (i < tries - 1) { await wait(ms * (i + 1)); continue; }
      return { data: null, error: { message: 'Error de red: ' + e.message } };
    }
  }
}

export const api = {

  // ── Auth ──────────────────────────────────────────────────
  login: (usuario, pin_hash) =>
    rpc('orient_login', { p_usuario: usuario, p_pin_hash: pin_hash }),

  // ── Estudiantes (tabla compartida, vía RPC para evitar RLS) ─
  getEstudiantes: () =>
    rpc('orient_get_estudiantes', {}),

  // ── Psicólogos disponibles por área (incluye cobertura) ───
  getPsicologosArea: area =>
    rpc('orient_get_psicologos_area', { p_area: area }),

  // ── Envío de caso (público, sin auth) ────────────────────
  enviarCaso: datos =>
    rpc('orient_enviar_caso', { p_datos: datos }),

  // ── Casos ─────────────────────────────────────────────────
  getCasos: (pin_hash, estado = null) => {
    const params = { p_pin_hash: pin_hash };
    if (estado) params.p_estado = estado;
    return rpc('orient_get_casos', params);
  },

  getCasoDetalle: (pin_hash, caso_id) =>
    rpc('orient_get_caso_detalle', { p_pin_hash: pin_hash, p_caso_id: caso_id }),

  // ── Gestión ───────────────────────────────────────────────
  agregarObservacion: (usuario_id, pin_hash, caso_id, tipo, contenido) =>
    rpc('orient_agregar_observacion', {
      p_usuario_id: usuario_id, p_pin_hash: pin_hash,
      p_caso_id:    caso_id,    p_tipo:     tipo, p_contenido: contenido,
    }),

  asignarCaso: (pin_hash, caso_id, asignado_a, nota = null) =>
    rpc('orient_asignar_caso', {
      p_pin_hash: pin_hash, p_caso_id: caso_id,
      p_asignado_a: asignado_a, p_nota: nota,
    }),

  cerrarCaso: (pin_hash, caso_id, resolucion, acuerdos = null, proxima_cita = null) =>
    rpc('orient_cerrar_caso', {
      p_pin_hash:    pin_hash, p_caso_id:      caso_id,
      p_resolucion:  resolucion, p_acuerdos:   acuerdos,
      p_proxima_cita: proxima_cita,
    }),

  // ── Admin ─────────────────────────────────────────────────
  getUsuarios: pin_hash =>
    rpc('orient_get_usuarios', { p_pin_hash: pin_hash }),

  upsertUsuario: (pin_hash, id, datos) => {
    const params = { p_pin_hash: pin_hash, p_datos: datos };
    if (id) params.p_id = id;
    return rpc('orient_upsert_usuario', params);
  },

  // Cobertura combinada: activa/desactiva áreas extra para un psicólogo
  setCobertura: (pin_hash, usuario_id, areas) =>
    rpc('orient_set_cobertura', {
      p_pin_hash: pin_hash, p_usuario_id: usuario_id, p_areas: areas,
    }),

  upsertEstudiantes: (pin_hash, filas) =>
    rpc('orient_upsert_estudiantes', { p_pin_hash: pin_hash, p_filas: filas }),

  gestionEstudiantes: (pin_hash, accion, grado = null, seccion = null, grado_dest = null) =>
    rpc('orient_gestion_estudiantes', {
      p_pin_hash: pin_hash, p_accion: accion,
      p_grado: grado, p_seccion: seccion, p_grado_dest: grado_dest,
    }),
};
