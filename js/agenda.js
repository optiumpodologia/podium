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

    <div class="agenda-layout">
      <div class="agenda-sidebar">
        <div class="card" style="padding: 12px;">
          <div id="mini-calendario"></div>
        </div>
        <div class="card" style="padding: 12px;">
          <div class="card-title" style="font-size: 13px; margin-bottom: 8px;">Leyenda</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div class="leyenda-item"><div class="leyenda-color" style="background: #F1EFE8; border-left: 3px solid #888780;"></div><span style="font-size: 12px;">Agendado</span></div>
            <div class="leyenda-item"><div class="leyenda-color" style="background: #9FE1CB; border-left: 3px solid #0F6E56;"></div><span style="font-size: 12px;">Llegó</span></div>
            <div class="leyenda-item"><div class="leyenda-color" style="background: #FAC775; border-left: 3px solid #854F0B;"></div><span style="font-size: 12px;">En atención</span></div>
            <div class="leyenda-item"><div class="leyenda-color" style="background: #B5D4F4; border-left: 3px solid #0C447C;"></div><span style="font-size: 12px;">Finalizado</span></div>
          </div>
        </div>
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
      </div>
    </div>
  `;

  await dibujarAgenda();
  dibujarMiniCalendario();
}

function dibujarMiniCalendario() {
  const cont = document.getElementById('mini-calendario');
  if (!cont) return;

  const fecha = new Date(agendaFechaActual);
  const año = fecha.getFullYear();
  const mes = fecha.getMonth();
  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  const primerDia = new Date(año, mes, 1);
  const ultimoDia = new Date(año, mes + 1, 0);
  const diasMes = ultimoDia.getDate();
  let primerDiaSemana = primerDia.getDay();
  primerDiaSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const nombreMes = primerDia.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <button class="btn-icon" style="width: 24px; height: 24px; font-size: 11px;" onclick="cambiarMesMini(-1)">‹</button>
      <div style="font-size: 12px; font-weight: 600; text-transform: capitalize;">${nombreMes}</div>
      <button class="btn-icon" style="width: 24px; height: 24px; font-size: 11px;" onclick="cambiarMesMini(1)">›</button>
    </div>
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 10px;">
      ${['L','M','M','J','V','S','D'].map(d => `<div style="color: var(--texto-tenue); padding: 4px 0;">${d}</div>`).join('')}
  `;

  for (let i = 0; i < primerDiaSemana; i++) html += '<div></div>';

  for (let d = 1; d <= diasMes; d++) {
    const fechaDia = new Date(año, mes, d);
    const esHoy = fechaDia.getTime() === hoy.getTime();
    const esSeleccionada = fechaDia.toDateString() === agendaFechaActual.toDateString();
    let style = 'padding: 5px 0; font-size: 11px; border-radius: 4px; cursor: pointer;';
    if (esSeleccionada) style += 'background: var(--primario); color: white; font-weight: 600;';
    else if (esHoy) style += 'background: var(--primario-claro); color: var(--primario); font-weight: 600;';
    else style += 'color: var(--texto);';
    html += `<div style="${style}" onclick="seleccionarFechaMini(${año},${mes},${d})">${d}</div>`;
  }

  html += '</div>';
  cont.innerHTML = html;
}

function seleccionarFechaMini(año, mes, dia) {
  agendaFechaActual = new Date(año, mes, dia);
  dibujarAgenda();
  dibujarMiniCalendario();
}

function cambiarMesMini(dir) {
  const f = new Date(agendaFechaActual);
  f.setMonth(f.getMonth() + dir);
  agendaFechaActual = f;
  dibujarMiniCalendario();
}

function agendaCambiarFecha(dir) {
  const dias = agendaVista === 'semana' ? 7 : 1;
  agendaFechaActual.setDate(agendaFechaActual.getDate() + dir * dias);
  dibujarAgenda();
  dibujarMiniCalendario();
}

function agendaIrHoy() {
  agendaFechaActual = new Date();
  dibujarAgenda();
  dibujarMiniCalendario();
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

  const { data: config } = await sb.from('configuracion').select('*').eq('id', 1).single();
  const horaInicio = parseInt((config?.hora_apertura || '09:00').split(':')[0]);
  const horaFin = parseInt((config?.hora_cierre || '18:00').split(':')[0]);

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
        const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '—';
        const subtitulo = t.tipos_atencion?.nombre || (t.estado === 'agendado' ? 'Pendiente' : '');

        html += `
          <div class="turno-card estado-${t.estado}"
               style="top: ${top}px; height: ${altura}px;"
               onclick="event.stopPropagation(); abrirModalTurno('${t.id}')"
               title="${nombre}">
            <div class="turno-card-nombre">${nombre}</div>
            <div class="turno-card-detalle">${formatearHora(t.fecha_hora)}${subtitulo ? ' · ' + subtitulo : ''}</div>
          </div>
        `;
      });
    }

    html += `</div>`;
  });

  html += `</div>`;
  grilla.innerHTML = html;
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
