async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Hola, ${usuarioActual.nombre.split(' ')[0]}</div>
        <div class="page-subtitle" id="fecha-hoy"></div>
      </div>
      ${usuarioActual.rol === 'recepcion' ? `
        <button class="btn btn-primary-sm" onclick="abrirModalNuevoTurno()">
          <span>+</span> Nuevo turno
        </button>
      ` : ''}
    </div>

    <div class="stats-grid" id="stats-grid">
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Próximos turnos</div>
        <div id="lista-proximos"></div>
      </div>

      <div class="card">
        <div class="card-title">Alertas</div>
        <div id="lista-alertas"></div>
      </div>
    </div>
  `;

  document.getElementById('fecha-hoy').textContent = formatearFecha(new Date());

  await cargarStatsHoy();
  await cargarProximosTurnos();
  await cargarAlertas();
}

async function cargarStatsHoy() {
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  let query = sb.from('turnos').select('estado', { count: 'exact' })
    .gte('fecha_hora', hoy.toISOString())
    .lt('fecha_hora', manana.toISOString());

  if (usuarioActual.rol === 'profesional') {
    const { data: prof } = await sb.from('profesionales').select('id').eq('usuario_id', usuarioActual.id).single();
    if (prof) query = query.eq('profesional_id', prof.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return;
  }

  const total = data.length;
  const atendidos = data.filter(t => t.estado === 'finalizado').length;
  const enCurso = data.filter(t => ['llego','en_atencion'].includes(t.estado)).length;
  const pendientes = data.filter(t => t.estado === 'agendado').length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Turnos hoy</div>
      <div class="stat-value">${total}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pendientes</div>
      <div class="stat-value">${pendientes}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">En curso</div>
      <div class="stat-value">${enCurso}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Atendidos</div>
      <div class="stat-value">${atendidos}</div>
    </div>
  `;
}

async function cargarProximosTurnos() {
  const ahora = new Date();
  const finDia = new Date();
  finDia.setHours(23,59,59,999);

  let query = sb.from('turnos')
    .select('*, pacientes(nombre, apellido), tipos_atencion(nombre, color)')
    .gte('fecha_hora', ahora.toISOString())
    .lte('fecha_hora', finDia.toISOString())
    .in('estado', ['agendado','llego','en_atencion'])
    .order('fecha_hora')
    .limit(6);

  if (usuarioActual.rol === 'profesional') {
    const { data: prof } = await sb.from('profesionales').select('id').eq('usuario_id', usuarioActual.id).single();
    if (prof) query = query.eq('profesional_id', prof.id);
  }

  const { data, error } = await query;
  if (error) { console.error(error); return; }

  const cont = document.getElementById('lista-proximos');
  if (!data || data.length === 0) {
    cont.innerHTML = '<div class="vacio">No hay más turnos hoy</div>';
    return;
  }

  cont.innerHTML = `<div class="turnos-dia-lista">${data.map(t => `
    <div class="turno-row" onclick="abrirModalTurno('${t.id}')">
      <div class="turno-row-hora">${formatearHora(t.fecha_hora)}</div>
      <div class="turno-row-info">
        <div class="turno-row-nombre">${t.pacientes ? t.pacientes.apellido + ', ' + t.pacientes.nombre : '—'}</div>
        <div class="turno-row-tipo">${t.tipos_atencion ? t.tipos_atencion.nombre : 'Sin tipo'}</div>
      </div>
      <span class="badge badge-${t.estado}">${etiquetaEstado(t.estado)}</span>
    </div>
  `).join('')}</div>`;
}

async function cargarAlertas() {
  const alertas = [];

  if (usuarioActual.rol === 'recepcion') {
    const { data: prods } = await sb.from('productos')
      .select('*')
      .gt('stock_minimo', 0)
      .order('nombre');

    if (prods) {
      const bajoStock = prods.filter(p => p.stock <= p.stock_minimo);
      bajoStock.forEach(p => {
        alertas.push({
          tipo: 'advertencia',
          icon: '📦',
          titulo: 'Stock bajo',
          detalle: `${p.nombre}: ${p.stock} unidad${p.stock !== 1 ? 'es' : ''}`
        });
      });
    }
  }

  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const finHoy = new Date(hoy);
  finHoy.setHours(23,59,59,999);

  const { data: pacientes } = await sb.from('pacientes')
    .select('nombre, apellido, fecha_nacimiento')
    .not('fecha_nacimiento', 'is', null);

  if (pacientes) {
    pacientes.forEach(p => {
      const fn = new Date(p.fecha_nacimiento);
      if (fn.getDate() === hoy.getDate() && fn.getMonth() === hoy.getMonth()) {
        alertas.push({
          tipo: 'info',
          icon: '🎂',
          titulo: 'Cumpleaños hoy',
          detalle: `${p.apellido}, ${p.nombre}`
        });
      }
    });
  }

  const cont = document.getElementById('lista-alertas');
  if (alertas.length === 0) {
    cont.innerHTML = '<div class="vacio" style="padding: 1.5rem;">Sin alertas</div>';
    return;
  }

  cont.innerHTML = alertas.map(a => `
    <div class="turno-row" style="background: var(--${a.tipo}-claro);">
      <div style="font-size: 18px;">${a.icon}</div>
      <div class="turno-row-info">
        <div class="turno-row-nombre" style="color: var(--${a.tipo});">${a.titulo}</div>
        <div class="turno-row-tipo" style="color: var(--${a.tipo});">${a.detalle}</div>
      </div>
    </div>
  `).join('');
}

function etiquetaEstado(estado) {
  return {
    'agendado': 'Agendado',
    'llego': 'Llegó',
    'en_atencion': 'En atención',
    'finalizado': 'Finalizado',
    'cancelado': 'Cancelado',
    'ausente': 'Ausente'
  }[estado] || estado;
}
