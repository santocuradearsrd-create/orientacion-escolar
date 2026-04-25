import { fmtDate, fmtShort, SEG_COLOR, SEG_EMOJI } from './utils.js';

// ── Shared helpers ───────────────────────────────────────────

function header(doc, titulo, sub) {
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(201, 168, 76);
  doc.rect(0, 28, 210, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 20, 14);
  if (sub) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(232, 201, 106);
    doc.text(sub, 20, 22);
  }
  return 40;
}

function makeLn(doc, lw) {
  return function ln(t, bold, sz, col) {
    doc.setFontSize(sz || 11);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    col ? doc.setTextColor(...col) : doc.setTextColor(0, 0, 0);
    const ls = doc.splitTextToSize(String(t || '—'), lw);
    if (this.y + ls.length * 6 > 280) { doc.addPage(); this.y = 20; }
    doc.text(ls, 20, this.y);
    this.y += ls.length * 6 + 3;
  };
}

// ── Borrador (docente) ───────────────────────────────────────

export function pdfBorrador(datos, estNombre) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const ctx = { y: header(doc, 'REPORTE DE CASO — SANTO CURA DE ARS', 'BORRADOR · ' + new Date().toLocaleDateString('es-DO')) };
  const ln  = (t, bold, sz, col) => {
    doc.setFontSize(sz || 11);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    col ? doc.setTextColor(...col) : doc.setTextColor(0, 0, 0);
    const ls = doc.splitTextToSize(String(t || '—'), 170);
    if (ctx.y + ls.length * 6 > 280) { doc.addPage(); ctx.y = 20; }
    doc.text(ls, 20, ctx.y);
    ctx.y += ls.length * 6 + 3;
  };

  ln('DATOS DEL DOCENTE', true, 12); ctx.y += 2;
  ln(`Docente: ${datos.docente_nombre}  |  Materia: ${datos.docente_materia}`);
  ln(`Grado / Sección: ${datos.docente_grado} ${datos.docente_seccion}  |  Estudiante: ${estNombre}`);
  ctx.y += 4;
  ln('DESCRIPCIÓN DE LA SITUACIÓN', true, 12); ctx.y += 2;
  ln(datos.descripcion_situacion);
  ctx.y += 4;
  ln('ACCIONES TOMADAS', true, 12); ctx.y += 2;
  ln(datos.acciones_tomadas);
  if (datos.es_actitud_repetida) {
    ctx.y += 4;
    ln(`⚠ Actitud repetida — ${datos.veces_repetida} veces aproximadamente`, false, 11, [183, 28, 28]);
  }
  if (datos.observaciones_adicionales) {
    ctx.y += 4;
    ln('OBSERVACIONES ADICIONALES', true, 12); ctx.y += 2;
    ln(datos.observaciones_adicionales);
  }
  ctx.y += 12;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, ctx.y, 190, ctx.y);
  ctx.y += 8;
  ln('Firma del docente: ____________________________', false, 10, [100, 100, 100]);

  doc.save(`borrador_${new Date().toISOString().substring(0, 10)}.pdf`);
}

// ── Caso completo ────────────────────────────────────────────

export function pdfCaso(casoData) {
  const c   = casoData.caso;
  const seg = casoData.seguimiento || [];
  const estNom = c.estudiante_nombre_bd || c.estudiante_nombre_manual || '—';
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const ctx = { y: header(doc, 'REPORTE DE CASO — SANTO CURA DE ARS',
    `Generado: ${new Date().toLocaleDateString('es-DO')} · Estado: ${c.estado.toUpperCase()}`) };

  const ln = (t, bold, sz, col) => {
    doc.setFontSize(sz || 11);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    col ? doc.setTextColor(...col) : doc.setTextColor(0, 0, 0);
    const ls = doc.splitTextToSize(String(t || '—'), 170);
    if (ctx.y + ls.length * 6 > 280) { doc.addPage(); ctx.y = 20; }
    doc.text(ls, 20, ctx.y);
    ctx.y += ls.length * 6 + 3;
  };

  ln(`ESTUDIANTE: ${estNom}`, true, 14);
  ln(`${c.docente_grado} ${c.docente_seccion} · Nivel: ${c.nivel_caso} · Área: ${c.area}`, false, 10, [100, 100, 100]);
  ctx.y += 4;
  ln('DATOS DEL REPORTE', true, 12); ctx.y += 2;
  ln(`Docente: ${c.docente_nombre}  |  Materia: ${c.docente_materia}`);
  ln(`Fecha: ${fmtDate(c.created_at)}`);
  if (c.gravedad) ln(`Gravedad: ${c.gravedad.toUpperCase()}`, false, 11, [183, 28, 28]);
  if (c.asignado_nombre) ln(`Psicólogo/a: ${c.asignado_nombre}`);
  ctx.y += 4;
  ln('DESCRIPCIÓN', true, 12); ctx.y += 2; ln(c.descripcion_situacion);
  ctx.y += 4;
  ln('ACCIONES TOMADAS', true, 12); ctx.y += 2; ln(c.acciones_tomadas);
  if (c.es_actitud_repetida) {
    ctx.y += 4;
    ln(`⚠ Actitud repetida — ${c.veces_repetida} veces`, false, 11, [183, 28, 28]);
  }
  if (c.observaciones_adicionales) {
    ctx.y += 4; ln('OBSERVACIONES', true, 12); ctx.y += 2; ln(c.observaciones_adicionales);
  }
  if (c.estado === 'cerrado') {
    ctx.y += 4; ln('RESOLUCIÓN', true, 12); ctx.y += 2; ln(c.resolucion || '—');
    if (c.acuerdos) { ctx.y += 4; ln('ACUERDOS', true, 12); ctx.y += 2; ln(c.acuerdos); }
    if (c.proxima_cita) { ctx.y += 4; ln(`Próxima cita: ${fmtShort(c.proxima_cita)}`); }
  }
  if (seg.length) {
    ctx.y += 6; ln('HISTORIAL DE GESTIÓN', true, 12); ctx.y += 2;
    seg.forEach(s => {
      ln(`[${(s.tipo||'').toUpperCase()}] ${s.contenido}`, false, 10);
      ln(`${s.usuario_nombre || 'Sistema'}  ·  ${fmtDate(s.created_at)}`, false, 9, [120, 120, 120]);
      ctx.y += 2;
    });
  }

  doc.save(`caso_${estNom.replace(/\s+/g, '_')}_${new Date().toISOString().substring(0, 10)}.pdf`);
}
