export const S = {
  view:          'inicio',
  user:          null,       // { id, nombre, rol, area, areas_cobertura, pin_hash }
  casos:         [],
  casoActual:    null,       // { caso, seguimiento }
  panelTab:      'activos',
  filtroGravedad: null,
  filtroArea:    null,
  filtroGrado:   null,       // 'grado-seccion' key for drill-down
  estudiantes:   [],
  usuarios:      [],
  _reporteData:  null,       // for the enviado page
};
