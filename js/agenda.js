// ============================================================
// agenda.js — Agenda por COLUMNAS (casilleros / consultorios)
// ============================================================
//
// Modelo nuevo:
//   - Cada día tiene N columnas fijas (N = consultorios del plan).
//   - Un profesional ocupa una columna ese día.
//   - Quién aparece sale de sus días laborales (patrón fijo) y días
//     especiales (excepciones por fecha). El "no viene" lo saca.
//   - El sistema sienta a cada profesional en el primer casillero libre.
//
// ETAPA 1 (esta entrega):
//   - Dibuja columnas + siembra al vuelo (NO escribe en agenda_dia todavía).
//   - Muestra los turnos existentes de cada profesional en su columna.
//   - Pasado en gris / solo lectura (sin dar turnos).
//   - SIN dar turnos, SIN swap (eso viene en etapas 2 y 3).
// ============================================================

let agendaFechaActual = new Date();

async function renderAgenda(container) {
  agendaFechaActual = new Date();
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Agenda</div>
        <div class="page-subtitle">Gestioná los turnos de tus consultorios</div>
      </div>
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
        </div>

        <div id="agenda-grid-container"></div>
      </div>
    </div>
  `;

  await dibujarAgenda();
  dibujarMiniCalendario();
}

// ============================================================
// MINI CALENDARIO (igual que antes)
// ============================================================
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
  agendaFechaActual.setDate(agendaFechaActual.getDate() + dir);
  dibujarAgenda();
  dibujarMiniCalendario();
}

function agendaIrHoy() {
  agendaFechaActual = new Date();
  dibujarAgenda();
  dibujarMiniCalendario();
}

// ============================================================
// CUÁNTAS COLUMNAS (consultorios del plan)
// ============================================================
async function obtenerCantidadConsultorios() {
  const negId = usuarioActual.negocio_id;
  if (!negId) return 1; // caso raro (super admin no entra acá)

  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('limite_total_consultorios')
    .eq('id', negId)
    .single();

  return Math.max(1, vista?.limite_total_consultorios || 1);
}

// ============================================================
// QUIÉN ATIENDE ESE DÍA (siembra al vuelo, etapa 1)
// Devuelve un array de columnas: [{ columna, profesional } | null...]
// ============================================================
async function calcularProfesionalesDelDia(fecha, cantColumnas) {
  const negId = usuarioActual.negocio_id;
  const fechaStr = fecha.toISOString().split('T')[0];
  const diaSemana = fecha.getDay(); // 0=dom ... 6=sáb

  // Profesionales activos del negocio
  const { data: profesionales } = await sb.from('profesionales')
    .select('id, nombre, color, usuario_id')
    .eq('activo', true)
    .order('nombre');

  if (!profesionales || profesionales.length === 0) return [];

  const ids = profesionales.map(p => p.id);

  // Días laborales que aplican a ESTE día de la semana
  const { data: laborales } = await sb.from('dias_laborales_profesional')
    .select('profesional_id')
    .in('profesional_id', ids)
    .eq('dia_semana', diaSemana);

  // Días especiales de ESTA fecha (no_viene = ausencia, o franja extra)
  const { data: especiales } = await sb.from('dias_especiales_profesional')
    .select('profesional_id, no_viene')
    .in('profesional_id', ids)
    .eq('fecha', fechaStr);

  const ausentes = new Set((especiales || []).filter(e => e.no_viene).map(e => e.profesional_id));
  const vienenEspecial = new Set((especiales || []).filter(e => !e.no_viene).map(e => e.profesional_id));
  const tienenLaboral = new Set((laborales || []).map(l => l.profesional_id));

  // Atiende ese día = (tiene día laboral O viene por día especial) Y no está ausente
  const atienden = profesionales.filter(p =>
    (tienenLaboral.has(p.id) || vienenEspecial.has(p.id)) && !ausentes.has(p.id)
  );

  // Sentarlos en el primer casillero libre (1, 2, 3...) en orden de nombre.
  const columnas = new Array(cantColumnas).fill(null);
  let i = 0;
  for (const prof of atienden) {
    if (i >= cantColumnas) break; // no hay más casilleros
    columnas[i] = { columna: i + 1, profesional: prof };
    i++;
  }
  return columnas;
}

// ============================================================
// DIBUJAR LA AGENDA DEL DÍA
// ============================================================
async function dibujarAgenda() {
  const titulo = document.getElementById('agenda-titulo');
  if (titulo) {
    titulo.textContent = agendaFechaActual.toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  const grilla = document.getElementById('agenda-grid-container');
  grilla.innerHTML = '<div class="vacio" style="padding:2rem;">Cargando...</div>';

  // ¿Es un día pasado? (solo lectura)
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const diaSel = new Date(agendaFechaActual); diaSel.setHours(0,0,0,0);
  const esPasado = diaSel < hoy;

  // Rango horario de la grilla (de config general)
  const { data: config } = await sb.from('configuracion').select('*').eq('id', 1).single();
  const horaInicio = parseInt((config?.hora_apertura || '08:00').split(':')[0]);
  const horaFin = parseInt((config?.hora_cierre || '20:00').split(':')[0]);
  const horas = [];
  for (let h = horaInicio; h <= horaFin; h++) horas.push(h);

  // Columnas del plan + quién atiende ese día
  const cantColumnas = await obtenerCantidadConsultorios();
  const columnas = await calcularProfesionalesDelDia(agendaFechaActual, cantColumnas);

  // Turnos del día (para mostrarlos en la columna de su profesional)
  const fechaInicio = new Date(agendaFechaActual); fechaInicio.setHours(0,0,0,0);
  const fechaFin = new Date(agendaFechaActual); fechaFin.setHours(23,59,59,999);

  const { data: turnos } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido), tipos_atencion(nombre, color)')
    .gte('fecha_hora', fechaInicio.toISOString())
    .lte('fecha_hora', fechaFin.toISOString())
    .order('fecha_hora');

  // Agrupar turnos por profesional
  const turnosPorProf = {};
  (turnos || []).forEach(t => {
    (turnosPorProf[t.profesional_id] = turnosPorProf[t.profesional_id] || []).push(t);
  });

  // ---- Armar la grilla ----
  let html = `<div class="agenda-grid-col ${esPasado ? 'es-pasado' : ''}"
    style="grid-template-columns: 56px repeat(${cantColumnas}, 1fr);">`;

  // Fila de encabezados: esquina vacía + un encabezado por columna
  html += `<div class="agenda-col-esquina"></div>`;
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    if (col && col.profesional) {
      const p = col.profesional;
      const iniciales = (p.nombre || '?').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase();
      html += `
        <div class="agenda-col-head">
          <div class="agenda-col-titulo">Consultorio ${numero}</div>
          <div class="agenda-col-prof">
            <span class="agenda-col-dot" style="background:${p.color || 'var(--primario)'};"></span>
            ${p.nombre}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="agenda-col-head">
          <div class="agenda-col-titulo">Consultorio ${numero}</div>
          <div class="agenda-col-prof libre">— libre —</div>
        </div>
      `;
    }
  });

  // Cuerpo: columna de horas + una columna por consultorio
  const altoTotal = horas.length * 60;

  // Columna de horas
  html += `<div class="agenda-horas-col" style="height:${altoTotal}px;">`;
  horas.forEach(h => {
    html += `<div class="agenda-hora-label">${String(h).padStart(2,'0')}:00</div>`;
  });
  html += `</div>`;

  // Columnas de consultorios
  columnas.forEach((col) => {
    html += `<div class="agenda-consultorio-col" style="height:${altoTotal}px;">`;

    // Líneas de hora de fondo
    horas.forEach((h, idx) => {
      html += `<div class="agenda-linea-hora" style="top:${idx*60}px;"></div>`;
    });

    if (col && col.profesional) {
      // Turnos de este profesional
      const susTurnos = turnosPorProf[col.profesional.id] || [];
      susTurnos.forEach(t => {
        const td = new Date(t.fecha_hora);
        const horaT = td.getHours() + td.getMinutes()/60;
        const top = (horaT - horaInicio) * 60;
        const altura = Math.max(28, (t.duracion_minutos / 60) * 60);
        const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '—';
        const subtitulo = t.tipos_atencion?.nombre || (t.estado === 'agendado' ? 'Pendiente' : '');
        html += `
          <div class="turno-card estado-${t.estado}"
               style="top:${top}px; height:${altura}px;"
               onclick="abrirModalTurno('${t.id}')"
               title="${nombre}">
            <div class="turno-card-nombre">${nombre}</div>
            <div class="turno-card-detalle">${formatearHora(t.fecha_hora)}${subtitulo ? ' · ' + subtitulo : ''}</div>
          </div>
        `;
      });
    } else {
      // Columna libre: estado vacío tipo "Agenda libre"
      html += `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono">🗓️</div>
          <div class="agenda-libre-titulo">Agenda libre</div>
          <div class="agenda-libre-texto">Asigná un día laboral al profesional<br>para que aparezca acá</div>
        </div>
      `;
    }

    html += `</div>`;
  });

  html += `</div>`;

  if (esPasado) {
    html = `<div class="agenda-aviso-pasado">Día pasado · solo lectura</div>` + html;
  }

  grilla.innerHTML = html;
}
