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
let _miProfesional = null;     // (rol profesional) su propio registro de profesionales, para saludo y filtro

// --- Chat recepción <-> consultorio (tabla mensajes) ---
let _msgPollId = null;         // setInterval del poll de no leídos; se limpia al salir de la agenda
let _msgProfIdActual = null;   // profesional_id del usuario profesional (cache, para ENVIAR)
let _msgHiloProfId = null;     // (gestor) profesional cuyo hilo está abierto en el selector
let _msgUltUrgentes = 0;       // baseline de llamadas (urgentes) sin leer, para no repetir el sonido

async function renderAgenda(container) {
  if (_msgPollId) { clearInterval(_msgPollId); _msgPollId = null; }  // no acumular polls al re-renderizar
  inyectarEstilosAgenda();
  agendaFechaActual = new Date();
  const esProf = usuarioActual.rol === 'profesional';
  container.innerHTML = `
    <div class="agenda-layout">
      <div class="agenda-sidebar">
        <div class="card" style="padding: 12px;">
          <div id="mini-calendario"></div>
        </div>
        ${esProf
          ? '<div class="card prof-saludo-card" id="agenda-prof-saludo"></div>'
          : `
        <div class="card" style="padding: 14px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 10px;">Profesionales disponibles</div>
          <div id="agenda-profes-dia"></div>
        </div>`}
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

        <div class="leyenda">
          <span class="leyenda-chip lc-agendado">Agendado</span>
          <span class="leyenda-chip lc-llego">Llegó</span>
          <span class="leyenda-chip lc-en_atencion">En atención</span>
          <span class="leyenda-chip lc-finalizado">Finalizado</span>
          <span class="leyenda-chip lc-cobrado">Cobrado</span>
        </div>
      </div>

      <div class="agenda-panel-derecho">
        <div class="card" style="padding: 16px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 14px;">Resumen del día</div>
          <div id="agenda-resumen-dia"></div>
        </div>
        <div class="card" style="padding: 16px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 10px;">Notas</div>
          <div class="notas-add">
            <input id="nota-nueva" class="notas-input" maxlength="280" placeholder="Agregar nota..."
                   onkeydown="if(event.key==='Enter'){event.preventDefault();agregarNotaAgenda();}">
            <button class="notas-add-btn" onclick="agregarNotaAgenda()" title="Agregar nota">+</button>
          </div>
          <div id="agenda-notas" class="notas-lista"></div>
        </div>
        <div class="card" style="padding: 16px;">
          <div class="msg-card-head" onclick="toggleMensajes()">
            <span class="card-title" style="font-size: 14px;">Mensajes</span>
            <span id="msg-badge" class="msg-badge" style="display:none;"></span>
            <span id="msg-chevron" class="msg-chevron">&rsaquo;</span>
          </div>
          <div id="msg-cuerpo" class="msg-cuerpo" style="display:none;"></div>
        </div>
      </div>
    </div>
  `;

  await dibujarAgenda();
  dibujarMiniCalendario();
  cargarNotasAgenda();
  initMensajes();
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
    .prof-saludo-card { padding:16px; }
    .prof-saludo-hola { font-size:17px; font-weight:700; color:var(--texto); }
    .agenda-franja-band { position:absolute; left:2px; right:2px; background:rgba(109,91,208,0.05); border-radius:4px; z-index:0; pointer-events:none; }
    .agenda-hueco { position:absolute; left:2px; right:2px; z-index:1; cursor:pointer; border-radius:4px; border:1px dashed var(--primario-medio); background:rgba(109,91,208,0.04); box-sizing:border-box; display:flex; align-items:center; justify-content:center; transition:background .12s, border-color .12s; }
    .agenda-hueco:hover { background:rgba(109,91,208,0.16); border-style:solid; }
    .agenda-hueco-mas { opacity:0.45; font-size:15px; font-weight:600; color:var(--primario); }
    .agenda-hueco:hover .agenda-hueco-mas { opacity:1; }
    .agenda-sin-franja { position:absolute; top:8px; left:6px; right:6px; text-align:center; font-size:11px; color:var(--texto-tenue); }
    .tt-resultados { position:absolute; left:0; right:0; top:100%; margin-top:2px; background:#fff; border:1px solid var(--borde); border-radius:var(--radio); box-shadow:var(--sombra-fuerte); z-index:10; max-height:240px; overflow-y:auto; }
    .tt-item { padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--borde-tenue); }
    .tt-item:last-child { border-bottom:none; }
    .tt-item:hover { background:var(--fondo); }
    .tt-vacio { color:var(--texto-tenue); cursor:default; }

    /* Botones de acción por celda (siempre visibles) */
    .turno-acciones { position:absolute; top:3px; right:3px; display:flex; gap:1px; z-index:3; }
    .turno-accion-btn { width:22px; height:22px; border:none; border-radius:5px; background:transparent; color:inherit; cursor:pointer; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; opacity:0.7; transition:opacity .1s, background .1s, color .1s; }
    .turno-accion-btn:hover { opacity:1; background:rgba(0,0,0,0.08); }
    .turno-accion-btn:active { background:rgba(0,0,0,0.14); }
    .turno-accion-btn.peligro { color:var(--peligro); }
    .turno-accion-btn.peligro:hover { background:var(--peligro-claro); }
    .turno-accion-btn.exito { color:var(--exito); }
    .turno-accion-btn.exito:hover { background:var(--exito-claro); }
    .turno-accion-btn.violeta { color:var(--primario); }
    .turno-accion-btn.violeta:hover { background:var(--primario-claro); }
    /* El cuerpo de la tarjeta también responde al hover, para separar su zona de click de la de los íconos */
    .turno-card { transition:filter .1s, box-shadow .1s; }
    .turno-card:hover { filter:brightness(0.97); box-shadow:inset 0 0 0 2px rgba(0,0,0,0.10); }
    /* Chip de sobreturno (opción B: no parte la columna) */
    .turno-sobre-chip { position:absolute; left:3px; bottom:3px; background:#7c3aed; color:#fff; font-size:10px; font-weight:600; padding:2px 7px; border-radius:9px; cursor:pointer; z-index:3; transition:filter .08s; }
    .turno-sobre-chip:hover { filter:brightness(1.15); }
    .turno-sobre-suelto { bottom:auto; z-index:4; }
    .turno-card.es-sobreturno { border-left:3px solid #7c3aed; }
    .turno-card.estado-cobrado { background:#ECECEC; border-left:3px solid #777; color:#555; }
    /* Celda bloqueada (no disponible) */
    .agenda-bloqueo { position:absolute; left:2px; right:2px; background:#3a3a3a; color:#fff; border-radius:4px; z-index:2; display:flex; align-items:center; justify-content:center; gap:8px; font-size:11px; font-weight:600; }
    .agenda-hueco-bloq { position:absolute; top:3px; right:3px; width:21px; height:21px; border:1px solid rgba(0,0,0,0.12); border-radius:5px; background:rgba(255,255,255,0.9); cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; color:#666; z-index:2; transition:background .08s, color .08s; }
    .agenda-hueco-bloq:hover { background:var(--peligro); color:#fff; border-color:var(--peligro); }
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
    .select('id, columna, profesional_id, profesionales(id, nombre, color, usuario_id, foto_url)')
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
        .select('id, columna, profesional_id, profesionales(id, nombre, color, usuario_id, foto_url)')
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

  // --- Feriado: si la fecha está cargada como feriado del negocio, el día
  // queda CERRADO. No se dibujan horarios ni el botón de agregar profesional,
  // así no se pueden sumar profesionales ni cargar turnos ese día. ---
  const fechaSelStr = agendaFechaStr(agendaFechaActual);
  const { data: feriadosHoy } = await sb.from('feriados')
    .select('descripcion')
    .eq('negocio_id', usuarioActual.negocio_id)
    .eq('fecha', fechaSelStr);
  const feriado = (feriadosHoy && feriadosHoy.length) ? feriadosHoy[0] : null;
  if (feriado) {
    grilla.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:var(--primario-claro);color:var(--primario);display:flex;align-items:center;justify-content:center;margin-bottom:1rem;">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/><path d="M3 10h18"/><path d="m17 17 4 4"/><path d="m21 17-4 4"/></svg>
        </div>
        <div style="font-size:18px;font-weight:600;color:var(--texto);margin-bottom:4px;">Feriado</div>
        <div style="font-size:14px;color:var(--texto-secundario);">${feriado.descripcion ? feriado.descripcion + ' · ' : ''}La agenda está cerrada este día.</div>
      </div>`;
    renderPanelDia([], []);
    return;
  }

  let cantColumnas = await obtenerCantidadConsultorios();
  let columnas = await obtenerDiaAgenda(agendaFechaActual, cantColumnas, esPasado);
  _agendaCols = columnas;

  // --- Rol profesional: ve SOLO su propia columna + saludo arriba del calendario ---
  const esProfesional = usuarioActual.rol === 'profesional';
  if (esProfesional) {
    if (!_miProfesional) {
      const { data } = await sb.from('profesionales')
        .select('id, nombre, color, foto_url, usuario_id')
        .eq('usuario_id', usuarioActual.id)
        .maybeSingle();
      _miProfesional = data || null;
    }
    // Saludo personalizado (se muestra trabaje o no ese día).
    const cont = document.getElementById('agenda-prof-saludo');
    if (cont && _miProfesional) {
      const primerNombre = (_miProfesional.nombre || '').trim().split(/\s+/)[0] || '';
      cont.innerHTML = `<div class="prof-saludo-hola">¡Hola, ${primerNombre}!</div>`;
    }
    // Filtrar a su casillero (si trabaja ese día); si no, queda en una sola columna vacía.
    const miCol = columnas.find(c => c && c.profesional && c.profesional.usuario_id === usuarioActual.id);
    columnas = [miCol || null];
    cantColumnas = 1;
    _agendaCols = columnas;
  }

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

  // Bloqueos del día (celdas "no disponible"), agrupados por profesional.
  const { data: bloqueos } = await sb.from('bloqueos_agenda')
    .select('*')
    .eq('fecha', agendaFechaStr(agendaFechaActual));
  const bloqueosPorProf = {};
  (bloqueos || []).forEach(b => {
    (bloqueosPorProf[b.profesional_id] = bloqueosPorProf[b.profesional_id] || []).push(b);
  });

  // ¿Este usuario gestiona la agenda (puede recibir/bloquear/cobrar/sobreturno)?
  const esGestor = ['negocio', 'recepcion'].includes(usuarioActual.rol);

  // ¿Puede CREAR turnos? Negocio, Recepción y Profesional Full (no el profesional común).
  // La RLS igual bloquea de fondo; esto solo evita mostrarle una acción que va a rebotar.
  const puedeCrearTurno = puede(usuarioActual, 'crear_turno');

  // Paso de la grilla (regla de la izquierda) = duración por defecto del negocio.
  const negocioSlot = parseInt(config?.duracion_turno_minutos) || 45;

  const fechaStrSel = agendaFechaStr(agendaFechaActual);
  const seatedIds = columnas.filter(c => c && c.profesional).map(c => c.profesional.id);
  const mapaFranjas = (!esPasado && seatedIds.length)
    ? await mapaFranjasProfes(seatedIds, agendaFechaActual)
    : {};

  // Rango vertical de la grilla: arranca en la apertura del negocio pero se ESTIRA
  // para cubrir las franjas de los profesionales y los turnos del día. Si alguien
  // atiende (o tiene un turno) más tarde que el cierre, la agenda igual lo muestra.
  let inicioMin = horaInicio * 60;
  let finMin = horaFin * 60;
  const extenderRango = (ini, fin) => {
    while (ini < inicioMin) inicioMin -= negocioSlot;   // hacia atrás, manteniendo la grilla alineada
    if (fin > finMin) finMin = fin;
  };
  Object.values(mapaFranjas).forEach(fr => fr.forEach(f => extenderRango(f.ini, f.fin)));
  (turnos || []).forEach(t => {
    const ti = turnoMinInicio(t);
    extenderRango(ti, ti + (t.duracion_minutos || 0));
  });

  // Slots de la regla (09:00, 09:40... según la duración del negocio).
  const slotsRegla = [];
  for (let s = inicioMin; s <= finMin; s += negocioSlot) slotsRegla.push(s);
  const altoTotal = slotsRegla.length * negocioSlot;

  let html = `<div class="agenda-grid-col ${esPasado ? 'es-pasado' : ''}"
    style="grid-template-columns: 56px repeat(${cantColumnas}, minmax(0, 1fr)); width:100%; max-width:${56 + cantColumnas * 220}px;">`;

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
      const susBloqueos = bloqueosPorProf[col.profesional.id] || [];
      const bloqueadosMin = new Set(susBloqueos.map(b => b.hora_min));

      // Separar turnos normales de sobreturnos (estos van como chip, no como tarjeta)
      const normales = susTurnos.filter(t => !t.es_sobreturno);
      const sobres = susTurnos.filter(t => t.es_sobreturno);
      const sobrePorMin = {};
      sobres.forEach(s => { const m = turnoMinInicio(s); (sobrePorMin[m] = sobrePorMin[m] || []).push(s); });

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
        // de la franja del profesional y no choque con un turno ni esté bloqueado.
        // Solo para quien puede crear turnos; el profesional común no ve el "+".
        if (puedeCrearTurno) slotsRegla.forEach(t => {
          if (t + negocioSlot > finMin) return;
          const dentro = franjas.some(fr => t >= fr.ini && t + negocioSlot <= fr.fin);
          if (!dentro) return;
          if (bloqueadosMin.has(t)) return;
          if (haySolapamiento(t, t + negocioSlot, normales)) return;  // los sobreturnos NO bloquean el slot
          const topH = t - inicioMin;
          html += `<div class="agenda-hueco" style="top:${topH}px; height:${negocioSlot}px;"
            title="Dar turno ${minToHora(t)}"
            onclick="abrirModalNuevoTurnoCasillero('${col.profesional.id}', ${numero}, '${fechaStrSel}', ${t})">
            <span class="agenda-hueco-mas">+</span>
            ${esGestor ? `<button class="agenda-hueco-bloq" title="Bloquear este horario" onclick="event.stopPropagation(); crearBloqueo('${col.profesional.id}','${fechaStrSel}',${t})">&#8709;</button>` : ''}
            </div>`;
        });

        if (franjas.length === 0) {
          html += `<div class="agenda-sin-franja">Sin horario cargado este día</div>`;
        }
      }

      // Celdas bloqueadas ("No disponible")
      susBloqueos.forEach(b => {
        const topB = b.hora_min - inicioMin;
        html += `<div class="agenda-bloqueo" style="top:${topB}px; height:${negocioSlot}px;">
          <span>No disponible</span>
          ${(!esPasado && esGestor) ? `<button class="turno-accion-btn peligro" onclick="event.stopPropagation(); quitarBloqueo('${b.id}')" title="Quitar bloqueo">&#128465;</button>` : ''}
        </div>`;
      });

      // Tarjeta de cada turno normal (con botones y, si hay, chip de sobreturno)
      const minConCard = new Set();
      normales.forEach(t => {
        minConCard.add(turnoMinInicio(t));
        html += tarjetaTurnoHTML(t, numero, fechaStrSel, sobrePorMin[turnoMinInicio(t)] || [], esPasado, inicioMin);
      });

      // Sobreturnos huérfanos (se borró el turno base): NO ocupan el slot.
      // Quedan como chip violeta chico en su horario; el "+ dar turno" sigue
      // disponible para dar un turno completo si alguien canceló.
      Object.keys(sobrePorMin).forEach(mStr => {
        const m = parseInt(mStr);
        if (minConCard.has(m)) return;  // si hay base, ya va como chip en la tarjeta
        const topS = m - inicioMin;
        sobrePorMin[m].forEach(t => {
          const nom = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : 'Sobreturno';
          html += `<div class="turno-sobre-chip turno-sobre-suelto" style="top:${topS}px;"
            title="Sobreturno (sin turno base)"
            onclick="event.stopPropagation(); verSobreturnos('${t.profesional_id}','${t.fecha_hora}')">${nom}</div>`;
        });
      });
    } else {
      const icoAgenda = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18"/><path d="M8 2.5v4M16 2.5v4"/></svg>';
      html += esProfesional
        ? `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono">${icoAgenda}</div>
          <div class="agenda-libre-titulo">Sin agenda hoy</div>
          <div class="agenda-libre-texto">No trabajás este día</div>
        </div>
      `
        : `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono">${icoAgenda}</div>
          <div class="agenda-libre-titulo">Agenda libre</div>
          <div class="agenda-libre-texto">Agregá un profesional para<br>comenzar a asignar turnos</div>
          ${(!esPasado && esGestor) ? `<button class="btn btn-primary-sm" style="margin-top:10px;" onclick="agendaAgregarProfesional(${numero})">+ Agregar profesional</button>` : ''}
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

  // Paneles laterales (profesionales del día + resumen) — usan datos ya cargados.
  renderPanelDia(columnas, turnos);
}

// ============================================================
// PANELES LATERALES (Paso 2 del rediseño)
//   Izquierda: profesionales asignados ese día.
//   Derecha:   resumen del día (contadores de los turnos ya cargados).
// ============================================================
function iniciales(nombre) {
  const p = (nombre || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

// Icono de línea para los tiles del resumen (hereda el color del recuadro).
function svgMini(paths) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:block">${paths}</svg>`;
}

function renderPanelDia(columnas, turnos) {
  // --- Profesionales del día (panel izquierdo) ---
  const cont = document.getElementById('agenda-profes-dia');
  if (cont) {
    const profes = (columnas || []).filter(c => c && c.profesional).map(c => c.profesional);
    cont.innerHTML = profes.length === 0
      ? `<div class="panel-vacio">No hay profesionales asignados a este día.</div>`
      : profes.map(p => {
          const color = (p.color && /^#[0-9a-f]{6}$/i.test(p.color)) ? p.color : '#6D5BD0';
          return `
            <div class="prof-dia-row">
              ${avatarHTML(p.nombre, color, p.foto_url, 36)}
              <div class="prof-dia-info">
                <div class="prof-dia-nombre">${p.nombre}</div>
                <div class="prof-dia-rol">Profesional</div>
              </div>
              <span class="agenda-col-dot" style="background:${color};"></span>
            </div>`;
        }).join('');
  }

  // --- Resumen del día (panel derecho) ---
  const res = document.getElementById('agenda-resumen-dia');
  if (res) {
    const ts = turnos || [];
    const en = (...estados) => ts.filter(t => estados.includes(t.estado)).length;
    const total = ts.filter(t => t.estado !== 'cancelado').length;
    const pendientes = en('agendado', 'llego', 'en_atencion');
    const atendidos = en('finalizado', 'cobrado');
    const ausencias = en('ausente');
    const sobreturnos = ts.filter(t => t.es_sobreturno && t.estado !== 'cancelado').length;
    const tile = (icono, clase, num, label, full) => `
      <div class="tile-stat${full ? ' tile-full' : ''}">
        <div class="tile-icono ${clase}">${icono}</div>
        <div>
          <div class="tile-num">${num}</div>
          <div class="tile-label">${label}</div>
        </div>
      </div>`;
    res.innerHTML = `<div class="resumen-grid">
      ${tile(svgMini('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'), '', total, 'Turnos')}
      ${tile(svgMini('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'), 'advertencia', pendientes, 'Pendientes')}
      ${tile(svgMini('<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>'), 'exito', atendidos, 'Atendidos')}
      ${tile(svgMini('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>'), 'info', ausencias, 'Ausencias')}
      ${tile(svgMini('<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>'), '', sobreturnos, 'Sobreturnos', true)}
    </div>`;
  }
}

// ============================================================
// NOTAS PERMANENTES (panel derecho) — tabla notas_agenda, por negocio
//   Agregar (input), cada nota es un cuadro, X para borrar,
//   clic en el texto edita inline y guarda al salir (vaciar = borrar).
// ============================================================
let _notasAgenda = [];

function escHtmlNota(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function cargarNotasAgenda() {
  const cont = document.getElementById('agenda-notas');
  if (!cont) return;
  const { data, error } = await sb.from('notas_agenda')
    .select('id, texto')
    .eq('usuario_id', usuarioActual.id)
    .order('creado_en', { ascending: true });
  if (error) { cont.innerHTML = `<div class="notas-vacio">No se pudieron cargar las notas.</div>`; return; }
  _notasAgenda = data || [];
  pintarNotasAgenda();
}

function pintarNotasAgenda() {
  const cont = document.getElementById('agenda-notas');
  if (!cont) return;
  if (_notasAgenda.length === 0) {
    cont.innerHTML = `<div class="notas-vacio">Sin notas. Sumá recordatorios o lista de espera.</div>`;
    return;
  }
  cont.innerHTML = _notasAgenda.map(n => `
    <div class="nota-box" data-id="${n.id}">
      <div class="nota-box-texto" onclick="editarNotaAgenda('${n.id}')" title="Tocá para editar">${escHtmlNota(n.texto)}</div>
      <button class="nota-box-x" onclick="eliminarNotaAgenda('${n.id}')" title="Eliminar">&times;</button>
    </div>`).join('');
}

async function agregarNotaAgenda() {
  const inp = document.getElementById('nota-nueva');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  const { error } = await sb.from('notas_agenda')
    .insert({ negocio_id: usuarioActual.negocio_id, usuario_id: usuarioActual.id, texto });
  if (error) { mostrarMensaje('No se pudo agregar la nota: ' + error.message, 'error'); return; }
  inp.value = '';
  await cargarNotasAgenda();
}

async function eliminarNotaAgenda(id) {
  const { error } = await sb.from('notas_agenda').delete().eq('id', id);
  if (error) { mostrarMensaje('No se pudo eliminar: ' + error.message, 'error'); return; }
  _notasAgenda = _notasAgenda.filter(n => n.id !== id);
  pintarNotasAgenda();
}

function editarNotaAgenda(id) {
  const box = document.querySelector(`.nota-box[data-id="${id}"]`);
  const nota = _notasAgenda.find(n => n.id === id);
  if (!box || !nota) return;
  box.classList.add('editando');
  box.innerHTML = `<textarea class="nota-box-edit" rows="2" maxlength="280">${escHtmlNota(nota.texto)}</textarea>`;
  const ta = box.querySelector('textarea');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('blur', async () => {
    const nuevo = ta.value.trim();
    if (!nuevo) { await eliminarNotaAgenda(id); return; }       // vaciar = borrar
    if (nuevo !== nota.texto) {
      const { error } = await sb.from('notas_agenda')
        .update({ texto: nuevo, actualizado_en: new Date().toISOString() }).eq('id', id);
      if (error) { mostrarMensaje('No se pudo guardar: ' + error.message, 'error'); }
      else { nota.texto = nuevo; }
    }
    pintarNotasAgenda();
  }, { once: true });
}

// ============================================================
// CHAT recepción <-> consultorio (tabla mensajes)
//   - Card "Mensajes" en el panel derecho, cerrada por defecto.
//   - Gestor (negocio/recepción): selector de profesional + hilo; envía de_recepcion=true.
//   - Profesional: su único hilo con recepción; envía de_recepcion=false.
//   - La RLS de mensajes ya aísla por negocio y por hilo: para LEER no filtramos
//     a mano; para ENVIAR como profesional sí necesitamos su profesional_id.
//   - Badge "no leídos" con poll liviano cada 30s (sin Realtime). El poll se
//     auto-apaga si la agenda ya no está en pantalla (#msg-badge fuera del DOM).
//   - NUNCA abrimos popups automáticos: el profesional decide cuándo mirar
//     (para que el mensaje no quede a la vista del paciente).
// ============================================================
function esGestorMsg() {
  return ['negocio', 'recepcion'].includes(usuarioActual.rol);
}

async function initMensajes() {
  await contarNoLeidos();
  _msgUltUrgentes = await contarUrgentesNoLeidos();  // arranca sin sonar por llamadas viejas
  if (_msgPollId) { clearInterval(_msgPollId); _msgPollId = null; }
  _msgPollId = setInterval(_msgPoll, 30000);
}

function _msgPoll() {
  // Si la agenda ya no está en pantalla, el poll se apaga solo.
  if (!document.getElementById('msg-badge')) {
    if (_msgPollId) { clearInterval(_msgPollId); _msgPollId = null; }
    return;
  }
  refrescarMensajes();
}

// Refresca badge y detecta llamadas nuevas (suena la campanita una vez por llamada).
async function refrescarMensajes() {
  await contarNoLeidos();
  const u = await contarUrgentesNoLeidos();
  if (u > _msgUltUrgentes) { sonarCampanita(); destacarBadge(); }
  _msgUltUrgentes = u;
}

// Cuenta los mensajes entrantes sin leer y actualiza el badge.
// Entrante = lo que mandó el OTRO lado: el profesional recibe de_recepcion=true;
// el gestor recibe de_recepcion=false.
async function contarNoLeidos() {
  const badge = document.getElementById('msg-badge');
  if (!badge) return 0;
  const gestor = esGestorMsg();
  const { count } = await sb.from('mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('leido', false)
    .eq('de_recepcion', !gestor);
  const n = count || 0;
  if (n > 0) {
    badge.textContent = gestor ? `${n} sin leer` : 'nuevo mensaje';
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
  return n;
}

function toggleMensajes() {
  const cuerpo = document.getElementById('msg-cuerpo');
  const chevron = document.getElementById('msg-chevron');
  if (!cuerpo) return;
  const abierto = cuerpo.style.display !== 'none';
  if (abierto) {
    cuerpo.style.display = 'none';
    if (chevron) chevron.classList.remove('abierto');
  } else {
    cuerpo.style.display = '';
    if (chevron) chevron.classList.add('abierto');
    renderCuerpoMensajes();
  }
}

function barraEnvioMsgHTML() {
  return `
    <div class="msg-envio">
      <button class="msg-campanita-btn" onclick="enviarLlamada()" title="Llamar la atención (suena del otro lado)">&#128276;</button>
      <input id="msg-input" class="msg-input" maxlength="500" placeholder="Escribir mensaje..."
             onkeydown="if(event.key==='Enter'){event.preventDefault();enviarMensaje();}">
      <button class="msg-enviar-btn" onclick="enviarMensaje()" title="Enviar">&#10148;</button>
    </div>`;
}

async function renderCuerpoMensajes() {
  const cuerpo = document.getElementById('msg-cuerpo');
  if (!cuerpo) return;

  if (esGestorMsg()) {
    const { data: profes } = await sb.from('profesionales')
      .select('id, nombre')
      .eq('negocio_id', usuarioActual.negocio_id)
      .order('nombre');
    const lista = profes || [];
    if (lista.length === 0) {
      cuerpo.innerHTML = `<div class="notas-vacio">No hay profesionales para mensajear.</div>`;
      return;
    }
    if (!_msgHiloProfId || !lista.some(p => p.id === _msgHiloProfId)) _msgHiloProfId = lista[0].id;
    const opciones = lista.map(p =>
      `<option value="${p.id}"${p.id === _msgHiloProfId ? ' selected' : ''}>${escHtmlNota(p.nombre)}</option>`).join('');
    cuerpo.innerHTML = `
      <select class="msg-selector" onchange="gestorCambiarProfesional(this.value)">${opciones}</select>
      <div id="msg-hilo" class="msg-hilo"></div>
      ${barraEnvioMsgHTML()}`;
    cargarHilo(_msgHiloProfId);
  } else {
    // Profesional: necesito mi profesional_id (una vez) para poder ENVIAR.
    if (!_msgProfIdActual) {
      const { data: yo } = await sb.from('profesionales')
        .select('id').eq('usuario_id', usuarioActual.id).maybeSingle();
      _msgProfIdActual = yo ? yo.id : null;
    }
    if (!_msgProfIdActual) {
      cuerpo.innerHTML = `<div class="notas-vacio">Tu usuario no está vinculado a una agenda de profesional.</div>`;
      return;
    }
    cuerpo.innerHTML = `
      <div id="msg-hilo" class="msg-hilo"></div>
      ${barraEnvioMsgHTML()}`;
    cargarHilo(_msgProfIdActual);
  }
}

function gestorCambiarProfesional(profId) {
  _msgHiloProfId = profId;
  cargarHilo(profId);
}

async function cargarHilo(profId) {
  const hilo = document.getElementById('msg-hilo');
  if (!hilo || !profId) return;
  const { data, error } = await sb.from('mensajes')
    .select('id, de_recepcion, texto, creado_en')
    .eq('profesional_id', profId)
    .order('creado_en', { ascending: true });
  if (error) { hilo.innerHTML = `<div class="notas-vacio">No se pudieron cargar los mensajes.</div>`; return; }
  pintarHilo(data || []);
  await marcarLeidos(profId);
}

function pintarHilo(lista) {
  const hilo = document.getElementById('msg-hilo');
  if (!hilo) return;
  if (lista.length === 0) {
    hilo.innerHTML = `<div class="notas-vacio">Sin mensajes todavía.</div>`;
    return;
  }
  const gestor = esGestorMsg();
  hilo.innerHTML = lista.map(m => {
    // "mío" = lo mandé yo. Color por AUTOR (recepción vs profesional); lado por dueño.
    const mio = gestor ? m.de_recepcion : !m.de_recepcion;
    const lado = mio ? 'msg-mio' : 'msg-otro';
    const quien = m.de_recepcion ? 'msg-recepcion' : 'msg-profesional';
    return `
      <div class="msg-burbuja ${lado} ${quien}">
        <div class="msg-texto">${escHtmlNota(m.texto)}</div>
        <div class="msg-hora">${formatearHora(m.creado_en)}</div>
      </div>`;
  }).join('');
  hilo.scrollTop = hilo.scrollHeight;
}

// Marca como leídos los entrantes de ESE hilo y refresca el badge.
async function marcarLeidos(profId) {
  await sb.from('mensajes')
    .update({ leido: true })
    .eq('profesional_id', profId)
    .eq('de_recepcion', !esGestorMsg())
    .eq('leido', false);
  contarNoLeidos();
}

async function enviarMensaje() {
  const inp = document.getElementById('msg-input');
  if (!inp) return;
  const texto = inp.value.trim();
  if (!texto) return;
  const gestor = esGestorMsg();
  const profId = gestor ? _msgHiloProfId : _msgProfIdActual;
  if (!profId) { mostrarMensaje('No hay un hilo activo.', 'advertencia'); return; }
  const { error } = await sb.from('mensajes').insert({
    negocio_id: usuarioActual.negocio_id,
    profesional_id: profId,
    de_recepcion: gestor,
    texto
  });
  if (error) { mostrarMensaje('No se pudo enviar: ' + error.message, 'error'); return; }
  inp.value = '';
  await cargarHilo(profId);
}

// --- Campanita (llamada de atención con sonido) -----------------------
// Cuenta las llamadas (urgente=true) entrantes sin leer.
async function contarUrgentesNoLeidos() {
  const { count } = await sb.from('mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('leido', false)
    .eq('de_recepcion', !esGestorMsg())
    .eq('urgente', true);
  return count || 0;
}

async function enviarLlamada() {
  const gestor = esGestorMsg();
  const profId = gestor ? _msgHiloProfId : _msgProfIdActual;
  if (!profId) { mostrarMensaje('No hay un hilo activo.', 'advertencia'); return; }
  const { error } = await sb.from('mensajes').insert({
    negocio_id: usuarioActual.negocio_id,
    profesional_id: profId,
    de_recepcion: gestor,
    texto: '\u{1F514} Llamada de atención',
    urgente: true
  });
  if (error) { mostrarMensaje('No se pudo llamar: ' + error.message, 'error'); return; }
  sonarCampanita();                 // feedback inmediato para quien llama
  mostrarMensaje('Llamada enviada', 'exito');
  await cargarHilo(profId);
}

// Beep corto de dos tonos con Web Audio (sin archivo de audio).
// Algunos navegadores exigen una interacción previa antes de permitir sonido.
function sonarCampanita() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0); o.stop(t0 + 0.18);
    });
    setTimeout(() => ctx.close(), 700);
  } catch (e) { /* navegador bloqueó el audio: se ignora */ }
}

function destacarBadge() {
  const badge = document.getElementById('msg-badge');
  if (!badge) return;
  badge.classList.remove('pulso');
  void badge.offsetWidth;   // reinicia la animación si ya estaba puesta
  badge.classList.add('pulso');
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
// esSobreturno: si true, crea un sobreturno (mismo horario, sin chequeo de choque)
async function abrirModalNuevoTurnoCasillero(profId, columna, fechaStr, startMin, pacientePre, esSobreturno) {
  esSobreturno = !!esSobreturno;
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
      <div class="modal-titulo">${esSobreturno ? 'Sobreturno' : 'Nuevo turno'} &middot; Consultorio ${columna}</div>
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
              onclick="ttNuevoPacienteDesdeTurno('${profId}', ${columna}, '${fechaStr}', ${startMin}, ${esSobreturno})">+ Nuevo paciente</button>
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

    // 2) ¿Choca con otro turno suyo ese día? (un sobreturno SÍ puede superponerse)
    const di = new Date(fechaStr + 'T00:00'); di.setHours(0, 0, 0, 0);
    const df = new Date(fechaStr + 'T00:00'); df.setHours(23, 59, 59, 999);
    const { data: existentes } = await sb.from('turnos')
      .select('fecha_hora, duracion_minutos, estado, es_sobreturno')
      .eq('profesional_id', profId)
      .gte('fecha_hora', di.toISOString())
      .lte('fecha_hora', df.toISOString());
    // Un sobreturno (secundario) no impide dar un turno completo en ese horario.
    const ocupanSlot = (existentes || []).filter(e => !e.es_sobreturno);
    if (!esSobreturno && haySolapamiento(ini, fin, ocupanSlot)) {
      mostrarMensaje('Se superpone con otro turno de ese profesional.', 'error'); return;
    }

    // 3) Insertar
    const fechaHora = new Date(`${fechaStr}T${hora}:00`);

    // Un solo sobreturno por horario/profesional.
    if (esSobreturno) {
      const { count } = await sb.from('turnos')
        .select('id', { count: 'exact', head: true })
        .eq('profesional_id', profId)
        .eq('fecha_hora', fechaHora.toISOString())
        .eq('es_sobreturno', true);
      if ((count || 0) >= 1) {
        mostrarMensaje('Ya hay un sobreturno en ese horario.', 'advertencia'); return;
      }
    }

    const { error } = await sb.from('turnos').insert({
      negocio_id: usuarioActual.negocio_id,
      paciente_id: pacienteId,
      profesional_id: profId,
      fecha_hora: fechaHora.toISOString(),
      duracion_minutos: dur,
      estado: 'agendado',
      es_sobreturno: esSobreturno,
      notas: notas,
      creado_por: usuarioActual.id
    });
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

    mostrarMensaje(esSobreturno ? 'Sobreturno creado' : 'Turno creado', 'exito');
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
function ttNuevoPacienteDesdeTurno(profId, columna, fechaStr, startMin, esSobreturno) {
  esSobreturno = !!esSobreturno;
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
          onclick="abrirModalNuevoTurnoCasillero('${profId}', ${columna}, '${fechaStr}', ${startMin}, null, ${esSobreturno})">Volver</button>
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
    abrirModalNuevoTurnoCasillero(profId, columna, fechaStr, startMin, data, esSobreturno);
  });
}

// ============================================================
// TARJETA DE TURNO + BOTONES DE ACCIÓN POR ESTADO/ROL
// ============================================================
// Dibuja la tarjeta del turno en la columna, con su tira de íconos.
// El click en el cuerpo abre el modal de turno completo; los íconos
// hacen las acciones rápidas (con stopPropagation para no abrir el modal).
function tarjetaTurnoHTML(t, numero, fechaStr, sobres, esPasado, inicioMin, esHuerfano) {
  const top = turnoMinInicio(t) - inicioMin;
  const altura = Math.max(28, (t.duracion_minutos / 60) * 60);
  const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '-';
  const subtitulo = t.tipos_atencion?.nombre || (t.estado === 'agendado' ? 'Pendiente' : '');
  const tieneSobre = !!(sobres && sobres.length);
  const acciones = esPasado ? '' : accionesTurnoHTML(t, numero, fechaStr, tieneSobre);
  let chip = '';
  if (tieneSobre) {
    const s = sobres[0];
    const nombreSobre = s.pacientes ? `${s.pacientes.apellido}, ${s.pacientes.nombre.split(' ')[0]}` : 'Sobreturno';
    chip = `<div class="turno-sobre-chip" title="Ver sobreturno"
         onclick="event.stopPropagation(); verSobreturnos('${t.profesional_id}','${t.fecha_hora}')">${nombreSobre}</div>`;
  }
  const claseSobre = (esHuerfano || t.es_sobreturno) ? ' es-sobreturno' : '';
  return `
    <div class="turno-card estado-${t.estado}${claseSobre}"
         style="top:${top}px; height:${altura}px;"
         onclick="abrirModalTurno('${t.id}')"
         title="${nombre}">
      <div class="turno-card-nombre">${nombre}</div>
      <div class="turno-card-detalle">${formatearHora(t.fecha_hora)}${subtitulo ? ' &middot; ' + subtitulo : ''}</div>
      ${acciones}
      ${chip}
    </div>
  `;
}

// Devuelve la tira de íconos según estado del turno y rol del usuario.
// yaTieneSobre: si el turno base ya tiene un sobreturno, no se ofrece dar otro.
function accionesTurnoHTML(t, numero, fechaStr, yaTieneSobre) {
  const rol = usuarioActual.rol;
  const esProf = rol === 'profesional';
  const esGestor = rol === 'negocio' || rol === 'recepcion';
  const puedeSobre = !t.es_sobreturno && !yaTieneSobre;
  const stop = 'event.stopPropagation();';
  const sv = (p) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICO = {
    ojo:    sv('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
    ficha:  sv('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/>'),
    check:  sv('<polyline points="20 6 9 17 4 12"/>'),
    mas:    sv('<line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>'),
    tacho:  sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    volver: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    cobro:  sv('<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')
  };
  const btn = (icono, titulo, fn, extra) =>
    `<button class="turno-accion-btn ${extra || ''}" title="${titulo}" onclick="${stop}${fn}">${icono}</button>`;
  const out = [];

  // Ojo = vista rápida del paciente (contexto antes de atender)
  if (t.paciente_id) out.push(btn(ICO.ojo, 'Vista rápida del paciente', `verFichaPaciente('${t.paciente_id}')`));

  if (esGestor) {
    if (t.estado === 'agendado') {
      out.push(btn(ICO.check, 'Recibir paciente', `cambiarEstadoTurno('${t.id}','llego')`));
      if (puedeSobre) out.push(btn(ICO.mas, 'Dar sobreturno', `abrirModalNuevoTurnoCasillero('${t.profesional_id}', ${numero}, '${fechaStr}', ${turnoMinInicio(t)}, null, true)`, 'violeta'));
      out.push(btn(ICO.tacho, 'Eliminar turno', `eliminarTurno('${t.id}')`, 'peligro'));
    } else if (t.estado === 'llego') {
      out.push(btn(ICO.volver, 'Cancelar recepción', `cambiarEstadoTurno('${t.id}','agendado')`));
      if (puedeSobre) out.push(btn(ICO.mas, 'Dar sobreturno', `abrirModalNuevoTurnoCasillero('${t.profesional_id}', ${numero}, '${fechaStr}', ${turnoMinInicio(t)}, null, true)`, 'violeta'));
    } else if (t.estado === 'finalizado') {
      out.push(btn(ICO.cobro, 'Cobrar', `(typeof abrirCobro==='function' ? abrirCobro('${t.id}') : mostrarMensaje('El cobro se activa en el próximo paso','advertencia'))`, 'exito'));
    }
  }

  if (esProf) {
    if (t.estado === 'llego') {
      out.push(btn(ICO.ficha, 'Iniciar atención', `iniciarAtencion('${t.id}')`));
    } else if (t.estado === 'en_atencion') {
      out.push(btn(ICO.ficha, 'Seguir ficha', `abrirFichaAtencion('${t.id}')`));
    } else if (t.estado === 'finalizado') {
      out.push(btn(ICO.ficha, 'Ver ficha', `abrirFichaAtencion('${t.id}')`));
    } else if (t.estado === 'cobrado') {
      out.push(btn(ICO.ficha, 'Ver ficha', `abrirFichaAtencion('${t.id}', true)`));
    }
  }

  return out.length ? `<div class="turno-acciones">${out.join('')}</div>` : '';
}

// ============================================================
// SOBRETURNOS — panel de un horario (opción B)
// ============================================================
async function verSobreturnos(profId, fechaHoraISO) {
  const { data: lista } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido)')
    .eq('profesional_id', profId)
    .eq('fecha_hora', fechaHoraISO)
    .eq('es_sobreturno', true)
    .order('creado_en');

  const f = new Date(fechaHoraISO);
  const diaT = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const hoyD = new Date(); const diaHoy = new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate());
  const esPasado = diaT < diaHoy;

  const col = _agendaCols.find(c => c && c.profesional && c.profesional.id === profId);
  const numero = col ? col.columna : 1;
  const startMin = f.getHours() * 60 + f.getMinutes();
  const fechaStr = agendaFechaStr(f);

  const items = (lista || []).length === 0
    ? '<div class="vacio" style="padding:1rem;">Sin sobreturnos</div>'
    : lista.map(t => `
        <div class="turno-row" style="cursor:default; position:relative;">
          <div class="turno-row-info">
            <div class="turno-row-nombre">${t.pacientes ? t.pacientes.apellido + ', ' + t.pacientes.nombre : '-'}</div>
            <div class="turno-row-tipo">
              <span class="badge badge-${t.estado}">${etiquetaEstado(t.estado)}</span>
              ${(usuarioActual.rol === 'profesional' && t.estado === 'agendado')
                ? ' <span style="font-size:11px; color:var(--texto-tenue);">· esperando que recepción reciba al paciente</span>' : ''}
            </div>
          </div>
          <div style="position:relative; min-width:90px;">
            ${esPasado ? '' : accionesTurnoHTML(t, numero, fechaStr, true)}
          </div>
        </div>
      `).join('');

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Sobreturno &middot; ${minToHora(startMin)}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="turnos-dia-lista">${items}</div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

// ============================================================
// BLOQUEAR / LIBERAR un horario (celda "no disponible")
// ============================================================
async function crearBloqueo(profId, fechaStr, horaMin) {
  const { error } = await sb.from('bloqueos_agenda').insert({
    negocio_id: usuarioActual.negocio_id,
    profesional_id: profId,
    fecha: fechaStr,
    hora_min: horaMin,
    creado_por: usuarioActual.id
  });
  if (error) { mostrarMensaje('Error al bloquear: ' + error.message, 'error'); return; }
  await dibujarAgenda();
}

async function quitarBloqueo(id) {
  const { error } = await sb.from('bloqueos_agenda').delete().eq('id', id);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  await dibujarAgenda();
}
