import { registerView, renderView } from './router.js';
import { initNav, updateNav }       from './nav.js';

import { renderInicio }                      from './views/inicio.js';
import { renderLogin }                       from './views/login.js';
import { renderReporte, renderEnviado }      from './views/reporte.js';
import { renderPanel }                       from './views/panel.js';
import { vistaCaso }                         from './views/caso.js';
import { vistaAdmin }                        from './views/admin.js';

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
