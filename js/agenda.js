// ============================================================
// agenda.js — Agenda por COLUMNAS (casilleros / consultorios)
// ============================================================
//
// Modelo:
//   - Cada día tiene N columnas fijas (N = consultorios del plan).
//   - Un profesional ocupa una columna ese día.
//   - La asignación profesional->columna->fecha SE GUARDA en agenda_dia
//     (historia congelada). Una vez guardado un día, no se recalcula.
//
// ETAPA 2 (esta entrega):
//   - Guarda el día en agenda_dia al abrirlo (siembra desde días
//     laborales la 1a vez; después lee de la tabla).
//   - Botón "Agregar profesional" en columna libre -> lo sienta ahí
//     (crea registro en agenda_dia + día especial "viene").
//   - Swap por arrastre: intercambiar dos columnas, solo ese día.
//   - Quitar profesional de una columna (bloquea si tiene turnos).
//   - Pasado en gris / solo lectura.
//
// PENDIENTE etapa 3: dar turnos (click en hueco -> modal pacientes).
// ============================================================

let agendaFechaActual = new Date();
let _agendaCols = [];          // estado del día: [{columna, profesional, registroId} | null]
let _agendaArrastreCol = null; // columna origen durante un drag
let _ttPacientes = [];         // cache de pacientes para el typeahead del alta de turno

async function renderAgenda(container) {
  inyectarEstilosAgenda();
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
            <button class="btn-icon" onclick="agendaCambiarFecha(-1)" title="Anterior">&lsaquo;</button>
            <button class="btn" onclick="agendaIrHoy()">Hoy</button>
            <button class="btn-icon" onclick="agendaCambiarFecha(1)" title="Siguiente">&rsaquo;</button>
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
// MINI CALENDARIO
// ============================================================
function dibujarMiniCalendario() {
  const cont = document.getElementById('mini-calendario');
  if (!cont) return;

  const fecha = new Date(agendaFechaActual);
  const anio = fecha.getFullYear();
  const mes = fecha.getMonth();
  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const diasMes = ultimoDia.getDate();
  let primerDiaSemana = primerDia.getDay();
  primerDiaSemana = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  const nombreMes = primerDia.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <button class="btn-icon" style="width: 24px; height: 24px; font-size: 11px;" onclick="cambiarMesMini(-1)">&lsaquo;</button>
      <div style="font-size: 12px; font-weight: 600; text-transform: capitalize;">${nombreMes}</div>
      <button class="btn-icon" style="width: 24px; height: 24px; font-size: 11px;" onclick="cambiarMesMini(1)">&rsaquo;</button>
    </div>
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 10px;">
      ${['L','M','M','J','V','S','D'].map(d => `<div style="color: var(--texto-tenue); padding: 4px 0;">${d}</div>`).join('')}
  `;

  for (let i = 0; i < primerDiaSemana; i++) html += '<div></div>';

  for (let d = 1; d <= diasMes; d++) {
    const fechaDia = new Date(anio, mes, d);
    const esHoy = fechaDia.getTime() === hoy.getTime();
    const esSeleccionada = fechaDia.toDateString() === agendaFechaActual.toDateString();
    let style = 'padding: 5px 0; font-size: 11px; border-radius: 4px; cursor: pointer;';
    if (esSeleccionada) style += 'background: var(--primario); color: white; font-weight: 600;';
    else if (esHoy) style += 'background: var(--primario-claro); color: var(--primario); font-weight: 600;';
    else style += 'color: var(--texto);';
    html += `<div style="${style}" onclick="seleccionarFechaMini(${anio},${mes},${d})">${d}</div>`;
  }

  html += '</div>';
  cont.innerHTML = html;
}

function seleccionarFechaMini(anio, mes, dia) {
  agendaFechaActual = new Date(anio, mes, dia);
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
// HELPERS
// ============================================================
function agendaFechaStr(fecha) {
  // YYYY-MM-DD en horario local (no UTC, para no correrse de día)
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function obtenerCantidadConsultorios() {
  const negId = usuarioActual.negocio_id;
  if (!negId) return 1;
  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('limite_total_consultorios')
    .eq('id', negId)
    .single();
  return Math.max(1, vista?.limite_total_consultorios || 1);
}

// --- Etapa 3: helpers de horario y disponibilidad ------------------

// 'HH:MM[:SS]' -> minutos desde medianoche
function parseHoraMin(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':');
  return parseInt(h) * 60 + parseInt(m || '0');
}

// minutos -> 'HH:MM'
function minToHora(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// minuto de inicio (local) de un turno dentro de su día
function turnoMinInicio(t) {
  const d = new Date(t.fecha_hora);
  return d.getHours() * 60 + d.getMinutes();
}

// ¿el rango [ini,fin) choca con algún turno que ocupa lugar?
// (cancelado/ausente no bloquean)
function haySolapamiento(ini, fin, turnos) {
  const BLOQUEAN = ['agendado', 'llego', 'en_atencion', 'finalizado'];
  return (turnos || []).some(t => {
    if (!BLOQUEAN.includes(t.estado)) return false;
    const tIni = turnoMinInicio(t);
    const tFin = tIni + (t.duracion_minutos || 0);
    return ini < tFin && tIni < fin;
  });
}

// Devuelve { profId: [{ini,fin}] } con la franja EFECTIVA de cada profesional
// ese día. Prioridad: día especial (no_viene -> [] ; con horas -> esas franjas)
// y si no hay especial, los días laborales fijos de ese día de la semana.
async function mapaFranjasProfes(profIds, fecha) {
  if (!profIds || profIds.length === 0) return {};
  const fechaStr = agendaFechaStr(fecha);
  const diaSemana = fecha.getDay();

  const { data: laborales } = await sb.from('dias_laborales_profesional')
    .select('profesional_id, hora_inicio, hora_fin')
    .in('profesional_id', profIds)
    .eq('dia_semana', diaSemana);

  const { data: especiales } = await sb.from('dias_especiales_profesional')
    .select('profesional_id, no_viene, hora_inicio, hora_fin')
    .in('profesional_id', profIds)
    .eq('fecha', fechaStr);

  const limpia = (arr) => arr
    .map(x => ({ ini: parseHoraMin(x.hora_inicio), fin: parseHoraMin(x.hora_fin) }))
    .filter(f => f.ini != null && f.fin != null && f.fin > f.ini);

  const map = {};
  profIds.forEach(id => {
    const esp = (especiales || []).filter(e => e.profesional_id === id);
    if (esp.some(e => e.no_viene)) { map[id] = []; return; }       // ausente ese día
    const espHoras = esp.filter(e => !e.no_viene && e.hora_inicio && e.hora_fin);
    if (espHoras.length) { map[id] = limpia(espHoras); return; }    // viene con horario especial
    map[id] = limpia((laborales || []).filter(l => l.profesional_id === id)); // patrón fijo
  });
  return map;
}

// Estilos de Etapa 3 (huecos clickeables + typeahead). Se inyectan una sola
// vez, así no hace falta tocar styles.css.
function inyectarEstilosAgenda() {
  if (document.getElementById('estilos-agenda-etapa3')) return;
  const st = document.createElement('style');
  st.id = 'estilos-agenda-etapa3';
  st.textContent = `
    .agenda-franja-band { position:absolute; left:2px; right:2px; background:rgba(83,74,183,0.05); border-radius:4px; z-index:0; pointer-events:none; }
    .agenda-hueco { position:absolute; left:2px; right:2px; z-index:1; cursor:pointer; border-radius:4px; border:1px dashed transparent; display:flex; align-items:center; justify-content:center; transition:background .12s, border-color .12s; }
    .agenda-hueco:hover { background:rgba(83,74,183,0.12); border-color:var(--primario-medio); }
    .agenda-hueco-mas { opacity:0; font-size:16px; font-weight:600; color:var(--primario); }
    .agenda-hueco:hover .agenda-hueco-mas { opacity:1; }
    .agenda-sin-franja { position:absolute; top:8px; left:6px; right:6px; text-align:center; font-size:11px; color:var(--texto-tenue); }
    .tt-resultados { position:absolute; left:0; right:0; top:100%; margin-top:2px; background:#fff; border:1px solid var(--borde); border-radius:var(--radio); box-shadow:var(--sombra-fuerte); z-index:10; max-height:240px; overflow-y:auto; }
    .tt-item { padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--borde-tenue); }
    .tt-item:last-child { border-bottom:none; }
    .tt-item:hover { background:var(--fondo); }
    .tt-vacio { color:var(--texto-tenue); cursor:default; }
  `;
  document.head.appendChild(st);
}

// ============================================================
// CARGAR (o sembrar y guardar) EL DIA
// Devuelve un array de columnas:
//   [{ columna, profesional, registroId } | null, ...]
// ============================================================
async function obtenerDiaAgenda(fecha, cantColumnas, esPasado) {
  const negId = usuarioActual.negocio_id;
  const fechaStr = agendaFechaStr(fecha);

  // 1) Ya está guardado este día?
  const { data: guardado } = await sb.from('agenda_dia')
    .select('id, columna, profesional_id, profesionales(id, nombre, color, usuario_id)')
    .eq('negocio_id', negId)
    .eq('fecha', fechaStr)
    .order('columna');

  const columnas = new Array(cantColumnas).fill(null);

  if (guardado && guardado.length > 0) {
    // Día ya congelado: lo usamos tal cual.
    guardado.forEach(r => {
      const idx = r.columna - 1;
      if (idx >= 0 && idx < cantColumnas && r.profesionales) {
        columnas[idx] = { columna: r.columna, profesional: r.profesionales, registroId: r.id };
      }
    });
    return columnas;
  }

  // 2) No está guardado. Si es pasado, lo dejamos vacío (no inventamos historia).
  if (esPasado) return columnas;

  // 3) Día presente/futuro sin guardar: sembramos desde días laborales/especiales.
  const sembrados = await calcularSiembra(fecha, cantColumnas);

  // 4) Guardamos lo sembrado en agenda_dia (congela el día).
  if (sembrados.length > 0) {
    const filas = sembrados.map(s => ({
      negocio_id: negId,
      fecha: fechaStr,
      columna: s.columna,
      profesional_id: s.profesional.id
    }));
    const { data: insertados, error } = await sb.from('agenda_dia').insert(filas).select('id, columna, profesional_id');
    if (error) {
      // Si falla (ej: otra pestaña sembró en paralelo), releemos lo que haya.
      console.error('siembra:', error);
      const { data: reread } = await sb.from('agenda_dia')
        .select('id, columna, profesional_id, profesionales(id, nombre, color, usuario_id)')
        .eq('negocio_id', negId)
        .eq('fecha', fechaStr)
        .order('columna');
      (reread || []).forEach(r => {
        const idx = r.columna - 1;
        if (idx >= 0 && idx < cantColumnas && r.profesionales) {
          columnas[idx] = { columna: r.columna, profesional: r.profesionales, registroId: r.id };
        }
      });
      return columnas;
    }
    insertados.forEach(ins => {
      const idx = ins.columna - 1;
      const s = sembrados.find(x => x.columna === ins.columna);
      if (s && idx >= 0 && idx < cantColumnas) {
        columnas[idx] = { columna: ins.columna, profesional: s.profesional, registroId: ins.id };
      }
    });
  }

  return columnas;
}

// Calcula quién debería atender ese día desde días laborales + especiales.
// Devuelve [{ columna, profesional }] sentando en el primer casillero libre.
async function calcularSiembra(fecha, cantColumnas) {
  const fechaStr = agendaFechaStr(fecha);
  const diaSemana = fecha.getDay();

  const { data: profesionales } = await sb.from('profesionales')
    .select('id, nombre, color, usuario_id')
    .eq('activo', true)
    .order('nombre');
  if (!profesionales || profesionales.length === 0) return [];

  const ids = profesionales.map(p => p.id);

  const { data: laborales } = await sb.from('dias_laborales_profesional')
    .select('profesional_id')
    .in('profesional_id', ids)
    .eq('dia_semana', diaSemana);

  const { data: especiales } = await sb.from('dias_especiales_profesional')
    .select('profesional_id, no_viene')
    .in('profesional_id', ids)
    .eq('fecha', fechaStr);

  const ausentes = new Set((especiales || []).filter(e => e.no_viene).map(e => e.profesional_id));
  const vienenEspecial = new Set((especiales || []).filter(e => !e.no_viene).map(e => e.profesional_id));
  const tienenLaboral = new Set((laborales || []).map(l => l.profesional_id));

  const atienden = profesionales.filter(p =>
    (tienenLaboral.has(p.id) || vienenEspecial.has(p.id)) && !ausentes.has(p.id)
  );

  const out = [];
  let col = 1;
  for (const prof of atienden) {
    if (col > cantColumnas) break;
    out.push({ columna: col, profesional: prof });
    col++;
  }
  return out;
}

// ============================================================
// DIBUJAR
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

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const diaSel = new Date(agendaFechaActual); diaSel.setHours(0,0,0,0);
  const esPasado = diaSel < hoy;

  const { data: config } = await sb.from('configuracion').select('*')
    .eq('negocio_id', usuarioActual.negocio_id).maybeSingle();
  const horaInicio = parseInt((config?.hora_apertura || '08:00').split(':')[0]);
  const horaFin = parseInt((config?.hora_cierre || '20:00').split(':')[0]);

  const cantColumnas = await obtenerCantidadConsultorios();
  const columnas = await obtenerDiaAgenda(agendaFechaActual, cantColumnas, esPasado);
  _agendaCols = columnas;

  // Turnos del día
  const fechaInicio = new Date(agendaFechaActual); fechaInicio.setHours(0,0,0,0);
  const fechaFin = new Date(agendaFechaActual); fechaFin.setHours(23,59,59,999);
  const { data: turnos } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido), tipos_atencion(nombre, color)')
    .gte('fecha_hora', fechaInicio.toISOString())
    .lte('fecha_hora', fechaFin.toISOString())
    .order('fecha_hora');

  const turnosPorProf = {};
  (turnos || []).forEach(t => {
    (turnosPorProf[t.profesional_id] = turnosPorProf[t.profesional_id] || []).push(t);
  });

  // Duración por defecto del negocio: define la grilla (regla de la izquierda).
  const negocioSlot = parseInt(config?.duracion_turno_minutos) || 45;
  const inicioMin = horaInicio * 60;
  const finMin = horaFin * 60;

  // Slots de la regla (08:00, 08:45, 09:30... según la duración del negocio).
  const slotsRegla = [];
  for (let s = inicioMin; s <= finMin; s += negocioSlot) slotsRegla.push(s);
  const altoTotal = slotsRegla.length * negocioSlot;

  const fechaStrSel = agendaFechaStr(agendaFechaActual);
  const seatedIds = columnas.filter(c => c && c.profesional).map(c => c.profesional.id);
  const mapaFranjas = (!esPasado && seatedIds.length)
    ? await mapaFranjasProfes(seatedIds, agendaFechaActual)
    : {};

  let html = `<div class="agenda-grid-col ${esPasado ? 'es-pasado' : ''}"
    style="grid-template-columns: 56px repeat(${cantColumnas}, 1fr);">`;

  // Encabezados
  html += `<div class="agenda-col-esquina"></div>`;
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    if (col && col.profesional) {
      const p = col.profesional;
      const dragAttrs = esPasado ? '' :
        `draggable="true" ondragstart="agendaDragStart(${numero})" ondragover="event.preventDefault()" ondrop="agendaDrop(${numero})"`;
      html += `
        <div class="agenda-col-head" ${dragAttrs} title="${esPasado ? '' : 'Arrastrá para reordenar'}">
          <div class="agenda-col-titulo">Consultorio ${numero}</div>
          <div class="agenda-col-prof">
            <span class="agenda-col-dot" style="background:${p.color || 'var(--primario)'};"></span>
            ${p.nombre}
          </div>
        </div>
      `;
    } else {
      const dropAttrs = esPasado ? '' : `ondragover="event.preventDefault()" ondrop="agendaDrop(${numero})"`;
      html += `
        <div class="agenda-col-head" ${dropAttrs}>
          <div class="agenda-col-titulo">Consultorio ${numero}</div>
          <div class="agenda-col-prof libre">&mdash; libre &mdash;</div>
        </div>
      `;
    }
  });

  // Columna de horas (un renglón por slot de la duración del negocio)
  html += `<div class="agenda-horas-col" style="height:${altoTotal}px;">`;
  slotsRegla.forEach(s => {
    html += `<div class="agenda-hora-label" style="height:${negocioSlot}px;">${minToHora(s)}</div>`;
  });
  html += `</div>`;

  // Columnas de consultorio
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    html += `<div class="agenda-consultorio-col" style="height:${altoTotal}px;">`;
    slotsRegla.forEach(s => {
      html += `<div class="agenda-linea-hora" style="top:${s - inicioMin}px; height:${negocioSlot}px;"></div>`;
    });

    if (col && col.profesional) {
      const susTurnos = turnosPorProf[col.profesional.id] || [];

      // Etapa 3: disponibilidad y huecos para dar turno (solo presente/futuro)
      if (!esPasado) {
        const franjas = mapaFranjas[col.profesional.id] || [];

        // Banda de fondo = horario en que atiende
        franjas.forEach(fr => {
          const topB = fr.ini - inicioMin;
          const altoB = fr.fin - fr.ini;
          if (altoB > 0) {
            html += `<div class="agenda-franja-band" style="top:${topB}px; height:${altoB}px;"></div>`;
          }
        });

        // Huecos: uno por cada renglón de la grilla del negocio que caiga dentro
        // de la franja del profesional y no choque con un turno. Quedan pegados a
        // la regla de la izquierda (un solo juego de horarios).
        slotsRegla.forEach(t => {
          if (t + negocioSlot > finMin) return;
          const dentro = franjas.some(fr => t >= fr.ini && t + negocioSlot <= fr.fin);
          if (!dentro) return;
          if (haySolapamiento(t, t + negocioSlot, susTurnos)) return;
          const topH = t - inicioMin;
          html += `<div class="agenda-hueco" style="top:${topH}px; height:${negocioSlot}px;"
            title="Dar turno ${minToHora(t)}"
            onclick="abrirModalNuevoTurnoCasillero('${col.profesional.id}', ${numero}, '${fechaStrSel}', ${t})">
            <span class="agenda-hueco-mas">+</span></div>`;
        });

        if (franjas.length === 0) {
          html += `<div class="agenda-sin-franja">Sin horario cargado este día</div>`;
        }
      }

      susTurnos.forEach(t => {
        const td = new Date(t.fecha_hora);
        const horaT = td.getHours() + td.getMinutes()/60;
        const top = (horaT - horaInicio) * 60;
        const altura = Math.max(28, (t.duracion_minutos / 60) * 60);
        const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '-';
        const subtitulo = t.tipos_atencion?.nombre || (t.estado === 'agendado' ? 'Pendiente' : '');
        html += `
          <div class="turno-card estado-${t.estado}"
               style="top:${top}px; height:${altura}px;"
               onclick="abrirModalTurno('${t.id}')"
               title="${nombre}">
            <div class="turno-card-nombre">${nombre}</div>
            <div class="turno-card-detalle">${formatearHora(t.fecha_hora)}${subtitulo ? ' &middot; ' + subtitulo : ''}</div>
          </div>
        `;
      });
    } else {
      html += `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono">&#128197;</div>
          <div class="agenda-libre-titulo">Agenda libre</div>
          <div class="agenda-libre-texto">Agregá un profesional para<br>comenzar a asignar turnos</div>
          ${esPasado ? '' : `<button class="btn btn-primary-sm" style="margin-top:10px;" onclick="agendaAgregarProfesional(${numero})">+ Agregar profesional</button>`}
        </div>
      `;
    }
    html += `</div>`;
  });

  html += `</div>`;

  if (esPasado) {
    html = `<div class="agenda-aviso-pasado">Día pasado &middot; solo lectura</div>` + html;
  }

  grilla.innerHTML = html;
}

// ============================================================
// AGREGAR PROFESIONAL a una columna (día especial "viene" + agenda_dia)
// ============================================================
async function agendaAgregarProfesional(columna) {
  const negId = usuarioActual.negocio_id;
  const fechaStr = agendaFechaStr(agendaFechaActual);

  const yaAsignados = new Set(
    _agendaCols.filter(c => c && c.profesional).map(c => c.profesional.id)
  );

  const { data: profesionales } = await sb.from('profesionales')
    .select('id, nombre, color')
    .eq('activo', true)
    .order('nombre');

  const disponibles = (profesionales || []).filter(p => !yaAsignados.has(p.id));

  if (disponibles.length === 0) {
    mostrarMensaje('No hay profesionales para agregar (todos ya están asignados).', 'advertencia');
    return;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Agregar al Consultorio ${columna}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <form id="form-agregar-prof">
      <div class="modal-body">
        <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 1rem;">
          Lo asignás solo para el ${agendaFechaActual.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}. No cambia sus días laborales fijos.
        </div>
        <div class="input-group">
          <label>Profesional *</label>
          <select name="profesional_id" required>
            <option value="">Seleccionar...</option>
            ${disponibles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Agregar</button>
      </div>
    </form>
  `);

  document.getElementById('form-agregar-prof').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const profId = fd.get('profesional_id');
    if (!profId) return;

    // 1) Registrar en agenda_dia (ocupa la columna ese día)
    const { error: e1 } = await sb.from('agenda_dia').insert({
      negocio_id: negId,
      fecha: fechaStr,
      columna: columna,
      profesional_id: profId
    });
    if (e1) {
      const msg = e1.code === '23505'
        ? 'Esa columna ya está ocupada o el profesional ya está ese día.'
        : e1.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    // 2) Día especial "viene" (excepción registrada). Si ya existía, ignoramos duplicado.
    const { error: e2 } = await sb.from('dias_especiales_profesional').insert({
      negocio_id: negId,
      profesional_id: profId,
      fecha: fechaStr,
      no_viene: false,
      hora_inicio: '09:00',
      hora_fin: '18:00'
    });
    if (e2 && e2.code !== '23505') console.warn('dia especial viene:', e2.message);

    mostrarMensaje('Profesional agregado a este día', 'exito');
    cerrarModal();
    await dibujarAgenda();
  });
}

// ============================================================
// SWAP por arrastre (intercambiar dos columnas, solo ese día)
// ============================================================
function agendaDragStart(columna) {
  _agendaArrastreCol = columna;
}

async function agendaDrop(columnaDestino) {
  const origen = _agendaArrastreCol;
  _agendaArrastreCol = null;
  if (!origen || origen === columnaDestino) return;

  const colA = _agendaCols[origen - 1];
  const colB = _agendaCols[columnaDestino - 1];

  if (!colA || !colA.profesional) return; // arrastrar vacía no hace nada

  // Caso 1: destino vacío -> solo muevo A a la columna destino.
  if (!colB || !colB.profesional) {
    const { error } = await sb.from('agenda_dia')
      .update({ columna: columnaDestino })
      .eq('id', colA.registroId);
    if (error) { mostrarMensaje('Error al mover: ' + error.message, 'error'); }
    await dibujarAgenda();
    return;
  }

  // Caso 2: ambos ocupados -> SWAP usando columna "estacionamiento" (9999)
  // para no chocar con la restricción única (negocio+fecha+columna).
  // (9999 pasa el check columna>=1 y nunca colisiona con columnas reales.)
  let r = await sb.from('agenda_dia').update({ columna: 9999 }).eq('id', colA.registroId);
  if (r.error) { mostrarMensaje('Error en swap: ' + r.error.message, 'error'); await dibujarAgenda(); return; }
  r = await sb.from('agenda_dia').update({ columna: origen }).eq('id', colB.registroId);
  if (r.error) { mostrarMensaje('Error en swap: ' + r.error.message, 'error'); await dibujarAgenda(); return; }
  r = await sb.from('agenda_dia').update({ columna: columnaDestino }).eq('id', colA.registroId);
  if (r.error) { mostrarMensaje('Error en swap: ' + r.error.message, 'error'); await dibujarAgenda(); return; }

  await dibujarAgenda();
}

// ============================================================
// ETAPA 3 — DAR TURNO desde un hueco de la agenda
// ============================================================
// profId    : profesional de esa columna
// columna   : nro de consultorio (para el título)
// fechaStr  : 'YYYY-MM-DD' del día abierto
// startMin  : minuto del hueco clickeado (hora precargada)
// pacientePre (opcional): {id, nombre, apellido} para volver con uno ya elegido
async function abrirModalNuevoTurnoCasillero(profId, columna, fechaStr, startMin, pacientePre) {
  const { data: config } = await sb.from('configuracion')
    .select('duracion_turno_minutos').eq('negocio_id', usuarioActual.negocio_id).maybeSingle();
  const durDefault = parseInt(config?.duracion_turno_minutos) || 45;

  const col = _agendaCols[columna - 1];
  const profNombre = col?.profesional?.nombre || 'Profesional';
  const profDur = durDefault;  // duración única del negocio

  const { data: pacientes } = await sb.from('pacientes')
    .select('id, nombre, apellido, dni')
    .order('apellido').order('nombre');
  _ttPacientes = pacientes || [];

  const fechaLinda = new Date(fechaStr + 'T00:00')
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo turno &middot; Consultorio ${columna}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <form id="form-turno-casillero">
      <div class="modal-body">
        <div style="background: var(--fondo); padding:10px 12px; border-radius: var(--radio); margin-bottom:1rem; font-size:13px;">
          <strong>${profNombre}</strong>
          <span style="color: var(--texto-secundario);"> &middot; ${fechaLinda}</span>
        </div>

        <div class="input-group" style="position:relative;">
          <label>Paciente *</label>
          <input type="text" id="tt-paciente-input" autocomplete="off"
            placeholder="Buscar por apellido, nombre o DNI..."
            value="${pacientePre ? (pacientePre.apellido + ', ' + pacientePre.nombre) : ''}"
            oninput="ttFiltrarPacientes(this.value)">
          <input type="hidden" name="paciente_id" id="tt-paciente-id" value="${pacientePre ? pacientePre.id : ''}">
          <div id="tt-resultados" class="tt-resultados" style="display:none;"></div>
          <div style="margin-top:6px;">
            <button type="button" class="btn" style="font-size:12px; padding:4px 8px;"
              onclick="ttNuevoPacienteDesdeTurno('${profId}', ${columna}, '${fechaStr}', ${startMin})">+ Nuevo paciente</button>
          </div>
        </div>

        <div style="font-size:13px; color: var(--texto-secundario); margin-bottom:1rem;">
          Horario: <strong style="color: var(--texto);">${minToHora(startMin)}</strong>
          &middot; duración <strong style="color: var(--texto);">${profDur} min</strong>
          <span style="color: var(--texto-tenue);">(termina ${minToHora(startMin + profDur)})</span>
        </div>

        <div class="input-group">
          <label>Notas (opcional)</label>
          <textarea name="notas" rows="2" placeholder="Ej: primera vez, necesita silla..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Crear turno</button>
      </div>
    </form>
  `);

  document.getElementById('form-turno-casillero').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pacienteId = fd.get('paciente_id');
    const hora = minToHora(startMin);   // hora fija = la del hueco
    const dur = profDur;                // duración fija = la del profesional
    const notas = (fd.get('notas') || '').trim() || null;

    if (!pacienteId) { mostrarMensaje('Elegí un paciente de la lista.', 'advertencia'); return; }

    const ini = startMin;
    const fin = ini + dur;

    // 1) ¿Entra en la franja del profesional ese día?
    const mapa = await mapaFranjasProfes([profId], new Date(fechaStr + 'T00:00'));
    const franjas = mapa[profId] || [];
    if (franjas.length === 0) {
      mostrarMensaje('Ese profesional no atiende ese día.', 'error'); return;
    }
    if (!franjas.some(f => ini >= f.ini && fin <= f.fin)) {
      const txt = franjas.map(f => `${minToHora(f.ini)}-${minToHora(f.fin)}`).join(', ');
      mostrarMensaje(`El turno no entra en su horario (${txt}).`, 'error'); return;
    }

    // 2) ¿Choca con otro turno suyo ese día?
    const di = new Date(fechaStr + 'T00:00'); di.setHours(0, 0, 0, 0);
    const df = new Date(fechaStr + 'T00:00'); df.setHours(23, 59, 59, 999);
    const { data: existentes } = await sb.from('turnos')
      .select('fecha_hora, duracion_minutos, estado')
      .eq('profesional_id', profId)
      .gte('fecha_hora', di.toISOString())
      .lte('fecha_hora', df.toISOString());
    if (haySolapamiento(ini, fin, existentes)) {
      mostrarMensaje('Se superpone con otro turno de ese profesional.', 'error'); return;
    }

    // 3) Insertar
    const fechaHora = new Date(`${fechaStr}T${hora}:00`);
    const { error } = await sb.from('turnos').insert({
      negocio_id: usuarioActual.negocio_id,
      paciente_id: pacienteId,
      profesional_id: profId,
      fecha_hora: fechaHora.toISOString(),
      duracion_minutos: dur,
      estado: 'agendado',
      notas: notas,
      creado_por: usuarioActual.id
    });
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

    mostrarMensaje('Turno creado', 'exito');
    cerrarModal();
    await dibujarAgenda();
  });
}

// --- Typeahead de pacientes ---------------------------------------
function ttFiltrarPacientes(q) {
  const cont = document.getElementById('tt-resultados');
  const hidden = document.getElementById('tt-paciente-id');
  if (hidden) hidden.value = '';           // si reescribe, se deselecciona
  if (!cont) return;

  const term = (q || '').toLowerCase().trim();
  if (!term) { cont.style.display = 'none'; cont.innerHTML = ''; return; }

  const res = _ttPacientes.filter(p =>
    `${p.apellido} ${p.nombre} ${p.dni || ''}`.toLowerCase().includes(term)
  ).slice(0, 8);

  cont.innerHTML = res.length === 0
    ? `<div class="tt-item tt-vacio">Sin resultados</div>`
    : res.map(p => `
        <div class="tt-item" onclick="ttElegirPaciente('${p.id}')">
          <strong>${p.apellido}, ${p.nombre}</strong>
          ${p.dni ? `<span style="color:var(--texto-secundario);"> &middot; ${p.dni}</span>` : ''}
        </div>
      `).join('');
  cont.style.display = 'block';
}

function ttElegirPaciente(id) {
  const p = _ttPacientes.find(x => x.id === id);
  if (!p) return;
  const input = document.getElementById('tt-paciente-input');
  const hidden = document.getElementById('tt-paciente-id');
  const cont = document.getElementById('tt-resultados');
  if (input) input.value = `${p.apellido}, ${p.nombre}`;
  if (hidden) hidden.value = id;
  if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
}

// --- Alta rápida de paciente (vuelve al turno con el paciente elegido) ---
function ttNuevoPacienteDesdeTurno(profId, columna, fechaStr, startMin) {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo paciente</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <form id="form-nuevo-pac-turno">
      <div class="modal-body">
        <div class="form-row">
          <div class="input-group">
            <label>Apellido *</label>
            <input type="text" name="apellido" required>
          </div>
          <div class="input-group">
            <label>Nombre *</label>
            <input type="text" name="nombre" required>
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>DNI</label>
            <input type="text" name="dni">
          </div>
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn"
          onclick="abrirModalNuevoTurnoCasillero('${profId}', ${columna}, '${fechaStr}', ${startMin})">Volver</button>
        <button type="submit" class="btn btn-primary-sm">Crear y usar</button>
      </div>
    </form>
  `);

  document.getElementById('form-nuevo-pac-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const datos = Object.fromEntries(fd.entries());
    Object.keys(datos).forEach(k => { if (datos[k] === '') datos[k] = null; });
    datos.negocio_id = usuarioActual.negocio_id;

    const { data, error } = await sb.from('pacientes')
      .insert(datos).select('id, nombre, apellido').single();
    if (error) { mostrarMensaje('Error al crear paciente: ' + error.message, 'error'); return; }

    mostrarMensaje('Paciente creado', 'exito');
    abrirModalNuevoTurnoCasillero(profId, columna, fechaStr, startMin, data);
  });
}
