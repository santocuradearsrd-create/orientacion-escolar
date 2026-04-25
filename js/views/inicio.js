import { navigate } from '../router.js';

export function renderInicio() {
  document.getElementById('main').innerHTML = `
  <div class="card card-grad" style="text-align:center;padding:40px 20px;margin-bottom:16px">
    <div style="font-size:52px;margin-bottom:12px">🏫</div>
    <div style="font-size:26px;font-weight:700;color:#fff;margin-bottom:4px;letter-spacing:-.01em">Sistema de Orientación</div>
    <div style="font-size:13px;color:var(--g3)">Centro Educativo Santo Cura de Ars</div>
  </div>
  <div class="inicio-grid">
    <button class="inicio-card inicio-card-docente" id="btn-reporte">
      <span class="inicio-ico">📋</span>
      <span class="inicio-tit">Enviar reporte</span>
      <span class="inicio-sub">Para docentes · sin cuenta requerida</span>
    </button>
    <button class="inicio-card inicio-card-panel" id="btn-panel">
      <span class="inicio-ico">🔐</span>
      <span class="inicio-tit">Panel del sistema</span>
      <span class="inicio-sub">Orientación · Coordinación · Dirección</span>
    </button>
  </div>`;

  document.getElementById('btn-reporte').addEventListener('click', () => navigate('reporte'));
  document.getElementById('btn-panel').addEventListener('click', () => navigate('login'));
}
