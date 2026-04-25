import { registerView, renderView } from './router.js?v=3';
import { initNav, updateNav }       from './nav.js?v=3';

import { renderInicio }                      from './views/inicio.js?v=3';
import { renderLogin }                       from './views/login.js?v=3';
import { renderReporte, renderEnviado }      from './views/reporte.js?v=3';
import { renderPanel }                       from './views/panel.js?v=3';
import { vistaCaso }                         from './views/caso.js?v=3';
import { vistaAdmin }                        from './views/admin.js?v=3';

registerView('inicio',   renderInicio);
registerView('login',    renderLogin);
registerView('reporte',  renderReporte);
registerView('enviado',  renderEnviado);
registerView('panel',    renderPanel);
registerView('caso',     vistaCaso);
registerView('admin',    vistaAdmin);

initNav();
updateNav();
renderView();
