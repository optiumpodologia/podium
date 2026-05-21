let agendaFechaActual = new Date();
let agendaVista = 'semana';

async function renderAgenda(container) {
  agendaFechaActual = new Date();
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Agenda</div>
        <div class="page-subtitle" id="agenda-rango"></div>
      </div>
      ${usuarioActual.rol === 'recepcion' ? `
        <button class="btn btn-primary-sm" onclick="abrirModalNuevoTurno()">
          <span>+</span> Nuevo turno
        </button>
      ` : ''}
    </div>

    <div class="agenda-wrap">
      <div class="agenda-controles">
        <div class="agenda-nav-fecha">
          <button class="btn-icon" onclick="agendaCambiarFecha(-1)" title="Anterior">‹</button>
          <button class="btn" onclick="agendaIrHoy()">Hoy</button>
          <button class="btn-icon" onclick="agendaCambiarFecha(1)" title="Siguiente">›</button>
        </div>
        <div class="agenda-fecha-titulo" id="agenda-titulo"></div>
        <div class="agenda-vistas">
          <button class="btn-vista ${agendaVista==='dia'?'active':''}" onclick="agendaCambiarVista('dia')">Día</button>
          <button class="btn-vista ${agendaVista==='semana'?'active':''}" onclick="agendaCambiarVista('semana')">Semana</button>
        </div>
      </div>

      <div id="agenda-grid-container"></div>

      <div class="leyenda" id="leyenda-tipos"></div>
    </div>
  `;

  await dibujarAgenda();
}

function agendaCambiarFecha(dir) {
  const dias = agendaVista === 'semana' ? 7 : 1;
  agendaFechaActual.setDate(agendaFechaActual.getDate() + dir * dias);
  dibujarAgenda();
}

function agendaIrHoy() {
  agendaFechaActual = new Date();
  dibujarAgenda();
}

function agendaCambiarVista(vista) {
  agendaVista = vista;
  document.querySelectorAll('.btn-vista').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase().startsWith(vista[0]));
  });
  dibujarAgenda();
}

async function dibujarAgenda() {
  let fechaInicio, fechaFin, dias;

  if (agendaVista === 'semana') {
    const d = new Date(agendaFechaActual);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dow);
    fechaInicio = new Date(d);
    fechaInicio.setHours(0,0,0,0);
    fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + 6);
    fechaFin.setHours(23,59,59,999);
    dias = [];
    for (let i = 0; i < 6; i++) {
      const dia = new Date(fechaInicio);
      dia.setDate(dia.getDate() + i);
      dias.push(dia);
    }
  } else {
    fechaInicio = new Date(agendaFechaActual);
    fechaInicio.setHours(0,0,0,0);
    fechaFin = new Date(fechaInicio);
    fechaFin.setHours(23,59,59,999);
    dias = [new Date(fechaInicio)];
  }

  document.getElementById('agenda-titulo').textContent = formatearRangoAgenda(fechaInicio, fechaFin, agendaVista);

  const { data: diasLab } = await sb.from('dias_laborales').select('*').eq('activo', true);
  let horaInicio = 8, horaFin = 19;
  if (diasLab && diasLab.length > 0) {
    horaInicio = Math.min(...diasLab.map(d => parseInt(d.hora_inicio.split(':')[0])));
    horaFin = Math.max(...diasLab.map(d => parseInt(d.hora_fin.split(':')[0])));
  }

  let query = sb.from('turnos')
    .select('*, pacientes(nombre, apellido), tipos_atencion(nombre, color)')
    .gte('fecha_hora', fechaInicio.toISOString())
    .lte('fecha_hora', fechaFin.toISOString())
    .order('fecha_hora');

  if (usuarioActual.rol === 'profesional') {
    const { data: prof } = await sb.from('profesionales').select('id').eq('usuario_id', usuarioActual.id).single();
    if (prof) query = query.eq('profesional_id', prof.id);
  }

  const { data: turnos, error } = await query;
  if (error) console.error(error);

  const hoyStr = new Date().toDateString();
  const horas = [];
  for (let h = horaInicio; h <= horaFin; h++) horas.push(h);

  const grilla = document.getElementById('agenda-grid-container');
  const colCount = dias.length;

  let html = `<div class="agenda-grid ${agendaVista==='dia'?'vista-dia':''}" style="grid-template-columns: 60px repeat(${colCount}, 1fr);">`;

  html += `<div></div>`;
  dias.forEach(d => {
    const esHoy = d.toDateString() === hoyStr;
    html += `
      <div class="agenda-header-dia ${esHoy?'hoy':''}">
        <div class="agenda-dia-nombre">${d.toLocaleDateString('es-AR',{weekday:'short'})}${esHoy?' · hoy':''}</div>
        <div class="agenda-dia-numero">${d.getDate()}</div>
      </div>
    `;
  });

  html += `<div class="agenda-col-horas" style="height: ${horas.length * 60}px;">`;
  horas.forEach(h => {
    html += `<div class="agenda-hora">${String(h).padStart(2,'0')}:00</div>`;
  });
  html += `</div>`;

  dias.forEach(dia => {
    const esHoy = dia.toDateString() === hoyStr;
    const dateStr = dia.toISOString().split('T')[0];
    html += `<div class="agenda-col-dia ${esHoy?'hoy':''}" style="height: ${horas.length * 60}px;">`;

    horas.forEach((h, idx) => {
      html += `<div class="agenda-celda-hora" style="top: ${idx*60}px;"
        onclick="${usuarioActual.rol==='recepcion'?`abrirModalNuevoTurno('${dateStr}T${String(h).padStart(2,'0')}:00')`:''}"></div>`;
    });

    if (turnos) {
      turnos.filter(t => {
        const td = new Date(t.fecha_hora);
        return td.toDateString() === dia.toDateString();
      }).forEach(t => {
        const td = new Date(t.fecha_hora);
        const horaT = td.getHours() + td.getMinutes()/60;
        const top = (horaT - horaInicio) * 60;
        const altura = Math.max(28, (t.duracion_minutos / 60) * 60);
        const tipoColor = t.tipos_atencion?.color || '#534AB7';
        const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '—';
        const tipoNombre = t.tipos_atencion?.nombre || 'Sin tipo';

        html += `
          <div class="turno-card estado-${t.estado}"
               style="top: ${top}px; height: ${altura}px; ${!['llego','en_atencion','finalizado','cancelado','ausente'].includes(t.estado) ? `background: ${tipoColor}22; border-left-color: ${tipoColor};` : ''}"
               onclick="event.stopPropagation(); abrirModalTurno('${t.id}')"
               title="${nombre} - ${tipoNombre}">
            <div class="turno-card-nombre">${nombre}</div>
            <div class="turno-card-detalle">${formatearHora(t.fecha_hora)} · ${tipoNombre}</div>
          </div>
        `;
      });
    }

    html += `</div>`;
  });

  html += `</div>`;
  grilla.innerHTML = html;

  const { data: tipos } = await sb.from('tipos_atencion').select('nombre, color').eq('activo', true);
  if (tipos) {
    document.getElementById('leyenda-tipos').innerHTML = tipos.map(t => `
      <div class="leyenda-item">
        <div class="leyenda-color" style="background: ${t.color}22; border-left-color: ${t.color};"></div>
        ${t.nombre}
      </div>
    `).join('');
  }
}

function formatearRangoAgenda(inicio, fin, vista) {
  if (vista === 'dia') {
    return inicio.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
  const m1 = inicio.toLocaleDateString('es-AR', { month: 'short' });
  const m2 = fin.toLocaleDateString('es-AR', { month: 'short' });
  if (m1 === m2) {
    return `${inicio.getDate()} al ${fin.getDate()} de ${inicio.toLocaleDateString('es-AR',{month:'long'})} ${fin.getFullYear()}`;
  }
  return `${inicio.getDate()} ${m1} - ${fin.getDate()} ${m2} ${fin.getFullYear()}`;
}
