import { fmtDate, fmtShort, areaLabel } from './utils.js';

// jsPDF no soporta emojis — usar texto plano
const WARN_TXT = '(*) ACTITUD REPETIDA';

const NIVEL_LABEL = { primaria: 'Primaria', secundaria: 'Secundaria' };
const TIPO_LABEL  = {
  asignacion:   'ASIGNACION',
  observacion:  'OBSERVACION',
  gravedad:     'GRAVEDAD',
  cita:         'CITA',
  reasignacion: 'REASIGNACION',
  cierre:       'CIERRE',
};

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

function mkLn(doc, ctx) {
  return function ln(t, bold = false, sz = 11, col = null) {
    doc.setFontSize(sz);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    col ? doc.setTextColor(...col) : doc.setTextColor(30, 30, 30);
    const ls = doc.splitTextToSize(String(t ?? '--'), 170);
    if (ctx.y + ls.length * 6 > 278) { doc.addPage(); ctx.y = 20; }
    doc.text(ls, 20, ctx.y);
    ctx.y += ls.length * 6 + 3;
  };
}

function hrule(doc, ctx, gap = 6) {
  ctx.y += gap;
  doc.setDrawColor(220, 220, 220);
  doc.line(20, ctx.y, 190, ctx.y);
  ctx.y += gap;
}

function firmas(doc, ctx, labels) {
  hrule(doc, ctx, 12);
  const colW = 170 / labels.length;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  labels.forEach((lbl, i) => {
    const x = 20 + i * colW;
    doc.setDrawColor(160, 160, 160);
    doc.line(x, ctx.y, x + colW - 8, ctx.y);
    doc.text(lbl, x, ctx.y + 5);
  });
  ctx.y += 18;
}

export function pdfBorrador(datos, estNombre) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const ctx = { y: header(doc,
    'REPORTE DE CASO — SANTO CURA DE ARS',
    'BORRADOR · ' + new Date().toLocaleDateString('es-DO')) };
  const ln = mkLn(doc, ctx);

  ln('DATOS DEL DOCENTE', true, 12); ctx.y += 2;
  ln('Docente:    ' + datos.docente_nombre);
  ln('Materia:    ' + datos.docente_materia);
  ln('Grado/Sec:  ' + datos.docente_grado + ' -- ' + datos.docente_seccion);
  ln('Estudiante: ' + estNombre);

  hrule(doc, ctx);
  ln('DESCRIPCION DE LA SITUACION', true, 12); ctx.y += 2;
  ln(datos.descripcion_situacion);

  hrule(doc, ctx);
  ln('ACCIONES TOMADAS POR EL DOCENTE', true, 12); ctx.y += 2;
  ln(datos.acciones_tomadas);

  if (datos.es_actitud_repetida) {
    ctx.y += 4;
    ln(WARN_TXT + ' -- aproximadamente ' + datos.veces_repetida + ' veces', false, 11, [183, 28, 28]);
  }

  if (datos.observaciones_adicionales) {
    hrule(doc, ctx);
    ln('OBSERVACIONES ADICIONALES', true, 12); ctx.y += 2;
    ln(datos.observaciones_adicionales);
  }

  firmas(doc, ctx, ['Firma del docente', 'Fecha']);
  doc.save('borrador_caso_' + new Date().toISOString().substring(0, 10) + '.pdf');
}

export function pdfCaso(casoData) {
  const c      = casoData.caso;
  const seg    = casoData.seguimiento || [];
  const estNom = c.estudiante_nombre_bd || c.estudiante_nombre_manual || '--';
  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF();
  const ctx    = { y: header(doc,
    'REPORTE DE CASO — SANTO CURA DE ARS',
    'Generado: ' + new Date().toLocaleDateString('es-DO') + '  |  Estado: ' + c.estado.toUpperCase()) };
  const ln = mkLn(doc, ctx);

  ln('ESTUDIANTE: ' + estNom, true, 14);
  ln(
    c.docente_grado + ' ' + c.docente_seccion + '  |  ' +
    (NIVEL_LABEL[c.nivel_caso] || c.nivel_caso) + '  |  ' +
    areaLabel(c.area),
    false, 10, [100, 100, 100]
  );

  hrule(doc, ctx);
  ln('DATOS DEL REPORTE', true, 12); ctx.y += 2;
  ln('Docente:     ' + c.docente_nombre);
  ln('Materia:     ' + c.docente_materia);
  ln('Fecha:       ' + fmtDate(c.created_at));
  if (c.gravedad) ln('Gravedad:    ' + c.gravedad.toUpperCase(), false, 11, [183, 28, 28]);
  if (c.asignado_nombre) ln('Psicologo/a: ' + c.asignado_nombre);

  hrule(doc, ctx);
  ln('DESCRIPCION DE LA SITUACION', true, 12); ctx.y += 2;
  ln(c.descripcion_situacion);

  hrule(doc, ctx);
  ln('ACCIONES TOMADAS POR EL DOCENTE', true, 12); ctx.y += 2;
  ln(c.acciones_tomadas);

  if (c.es_actitud_repetida) {
    ctx.y += 4;
    ln(WARN_TXT + ' -- ' + c.veces_repetida + ' veces', false, 11, [183, 28, 28]);
  }

  if (c.observaciones_adicionales) {
    hrule(doc, ctx);
    ln('OBSERVACIONES ADICIONALES', true, 12); ctx.y += 2;
    ln(c.observaciones_adicionales);
  }

  if (c.estado === 'cerrado') {
    hrule(doc, ctx);
    ln('RESOLUCION / INTERVENCION REALIZADA', true, 12); ctx.y += 2;
    ln(c.resolucion || '--');
    if (c.acuerdos) {
      ctx.y += 4;
      ln('ACUERDOS ALCANZADOS', true, 12); ctx.y += 2;
      ln(c.acuerdos);
    }
    if (c.proxima_cita) {
      ctx.y += 4;
      ln('Fecha de seguimiento: ' + fmtShort(c.proxima_cita));
    }
  }

  if (seg.length) {
    hrule(doc, ctx);
    ln('HISTORIAL DE GESTION', true, 12); ctx.y += 2;
    seg.forEach(s => {
      const tipo = TIPO_LABEL[s.tipo] || (s.tipo || '').toUpperCase();
      ln('[' + tipo + ']  ' + s.contenido, false, 10);
      ln((s.usuario_nombre || 'Sistema') + '  |  ' + fmtDate(s.created_at),
        false, 9, [130, 130, 130]);
      ctx.y += 2;
    });
  }

  firmas(doc, ctx, ['Psicologo/a orientador/a', 'Coordinacion / Direccion', 'Fecha']);
  doc.save('caso_' + estNom.replace(/\s+/g, '_') + '_' + new Date().toISOString().substring(0, 10) + '.pdf');
}
