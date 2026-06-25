// ============================================================
// SUPER ADMIN — Panel de control de la plataforma
//   Inicio (resumen) real + secciones en construcción.
//   Los datos agregados se piden por RPC SECURITY DEFINER
//   (admin_resumen), que valida es_super_admin().
// ============================================================

function _adminMoneda(n) {
  const v = Number(n || 0);
  return '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function _adminIco(p, s = 22) {
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

// ---------- INICIO (resumen) ----------
async function renderAdminInicio(container) {
  if (usuarioActual.rol !== 'super_admin') {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Inicio</div>
        <div class="page-subtitle">Resumen general de la plataforma</div>
      </div>
    </div>
    <div id="admin-inicio-cont"><div class="vacio">Cargando resumen...</div></div>
  `;

  let r = null;
  try {
    const { data, error } = await sb.rpc('admin_resumen');
    if (error) throw error;
    r = Array.isArray(data) ? data[0] : data;
  } catch (e) {
    document.getElementById('admin-inicio-cont').innerHTML =
      `<div class="vacio">No se pudo cargar el resumen. ${e.message || ''}</div>`;
    return;
  }
  if (!r) { document.getElementById('admin-inicio-cont').innerHTML = '<div class="vacio">Sin datos</div>'; return; }

  // Proyección de emails a fin de mes (regla de tres sobre el día actual).
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const emailsMes = r.emails_mes || 0;
  const proyeccion = diaActual > 0 ? Math.round(emailsMes / diaActual * diasMes) : emailsMes;

  // Tarjetas de stats
  const stat = (ico, valor, label, color) => `
    <div class="admin-stat">
      <div class="admin-stat-ico" style="--ic:${color};">${ico}</div>
      <div>
        <div class="admin-stat-num">${valor}</div>
        <div class="admin-stat-lbl">${label}</div>
      </div>
    </div>`;

  const stats = `
    <div class="admin-stats">
      ${stat(_adminIco('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/>'), `${r.negocios_activos}<span class="admin-stat-sub"> / ${r.negocios_total}</span>`, 'Negocios activos', '#6D5BD0')}
      ${stat(_adminIco('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'), r.turnos_mes, 'Turnos este mes', '#1F9D6B')}
      ${stat(_adminIco('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'), emailsMes, 'Emails este mes', '#2293B0')}
      ${stat(_adminIco('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'), _adminMoneda(r.mrr), 'Ingresos mensuales (MRR)', '#E08537')}
    </div>`;

  // Tarjeta de emails con proyección
  const cardEmails = `
    <div class="card admin-card">
      <div class="cfg-head"><span class="cfg-head-ico">${_adminIco('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>', 18)}</span> Emails de la plataforma</div>
      <div class="admin-dato-row"><span>Enviados este mes</span><strong>${emailsMes}</strong></div>
      <div class="admin-dato-row"><span>Proyección a fin de mes</span><strong>${proyeccion}</strong></div>
      <div class="cfg-ayuda" style="margin-top:8px;">Compará la proyección con el límite de tu plan de Resend para anticipar si tenés que escalar.</div>
    </div>`;

  // Alertas
  const alertas = [];
  if (r.trials_por_vencer > 0)
    alertas.push({ tipo: 'adv', txt: `${r.trials_por_vencer} negocio(s) con prueba/cortesía por vencer en los próximos 7 días.` });
  if (r.negocios_al_limite > 0)
    alertas.push({ tipo: 'err', txt: `${r.negocios_al_limite} negocio(s) alcanzaron el límite de emails de su plan este mes.` });

  const cardAlertas = `
    <div class="card admin-card">
      <div class="cfg-head"><span class="cfg-head-ico">${_adminIco('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 18)}</span> Alertas</div>
      ${alertas.length
        ? alertas.map(a => `<div class="admin-alerta ${a.tipo}">${a.txt}</div>`).join('')
        : '<div class="cfg-ayuda">Todo en orden. Sin alertas por ahora.</div>'}
    </div>`;

  document.getElementById('admin-inicio-cont').innerHTML = `
    ${stats}
    <div class="admin-grid-2">
      ${cardEmails}
      ${cardAlertas}
    </div>
  `;
}

// ---------- Secciones en construcción ----------
function _adminProx(container, titulo, subtitulo) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${titulo}</div>
        <div class="page-subtitle">${subtitulo}</div>
      </div>
    </div>
    <div class="card">
      <div class="cfg-proximamente">
        <div class="cfg-prox-titulo">En construcción</div>
        <div class="cfg-ayuda" style="max-width:360px; margin:0 auto;">Esta sección la estamos armando. Pronto vas a poder gestionarla desde acá.</div>
      </div>
    </div>
  `;
}

function renderConsumoEmails(c) { _adminProx(c, 'Consumo de emails', 'Monitoreo de envíos de toda la plataforma'); }
function renderSuscripciones(c) { _adminProx(c, 'Suscripciones', 'Planes contratados, ingresos y vencimientos'); }
function renderEstadisticas(c)  { _adminProx(c, 'Estadísticas', 'Crecimiento, turnos y uso de la plataforma'); }
function renderSaludSistema(c)  { _adminProx(c, 'Salud del sistema', 'Estado de los envíos, el cron y los servicios'); }
function renderNotasSoporte(c)  { _adminProx(c, 'Notas / soporte', 'Anotaciones y seguimiento por negocio'); }
