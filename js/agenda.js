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
let _agendaHoyConstruido = null; // 'YYYY-MM-DD' del día real en que se montó la agenda (para refrescar si pasa la medianoche)
let _agendaCols = [];          // estado del día: [{columna, profesional, registroId} | null]
let _agendaArrastreCol = null; // columna origen durante un drag
let _ttPacientes = [];         // cache de pacientes para el typeahead del alta de turno
let _miProfesional = null;     // (rol profesional) su propio registro de profesionales, para saludo y filtro

// Escala vertical de la grilla: píxeles por minuto. >1 = celdas más altas.
const ESCALA_AGENDA = 1.3;

// --- Chat recepción <-> consultorio (tabla mensajes) ---
let _msgPollId = null;         // setInterval del poll de no leídos; se limpia al salir de la agenda
let _msgProfIdActual = null;   // profesional_id del usuario profesional (cache, para ENVIAR)
let _msgHiloProfId = null;     // (gestor) profesional cuyo hilo está abierto en el selector
let _msgUltUrgentes = 0;       // baseline de llamadas (urgentes) sin leer, para no repetir el sonido

async function renderAgenda(container) {
  if (_msgPollId) { clearInterval(_msgPollId); _msgPollId = null; }  // no acumular polls al re-renderizar
  inyectarEstilosAgenda();
  agendaFechaActual = new Date();
  _agendaHoyConstruido = agendaFechaStr(new Date());
  const esProf = usuarioActual.rol === 'profesional';

  const cardMiniCal = `
        <div class="card" style="padding: 12px;">
          <div id="mini-calendario"></div>
        </div>`;
  const cardDarTurno = puede(usuarioActual, 'crear_turno') ? `
        <button class="ag-dar-turno-btn" onclick="abrirAgendarTurnos()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
          Dar turno
        </button>` : '';
  const cardSaludo = `<div class="card prof-saludo-card" id="agenda-prof-saludo"></div>`;
  const cardProfesDia = `
        <div class="card" style="padding: 14px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 10px;">Profesionales disponibles</div>
          <div id="agenda-profes-dia"></div>
        </div>`;
  const cardResumen = `
        <div class="card" style="padding: 16px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 14px;">Resumen del día</div>
          <div id="agenda-resumen-dia"></div>
        </div>`;
  const cardNotas = `
        <div class="card" style="padding: 16px;">
          <div class="card-title" style="font-size: 14px; margin-bottom: 10px;">Notas</div>
          <div class="notas-add">
            <input id="nota-nueva" class="notas-input" maxlength="280" placeholder="Agregar nota..."
                   onkeydown="if(event.key==='Enter'){event.preventDefault();agregarNotaAgenda();}">
            <button class="notas-add-btn" onclick="agregarNotaAgenda()" title="Agregar nota">+</button>
          </div>
          <div id="agenda-notas" class="notas-lista"></div>
        </div>`;
  const cardMensajes = `
        <div class="card" style="padding: 16px;">
          <div class="msg-card-head" onclick="toggleMensajes()">
            <span class="card-title" style="font-size: 14px; display:flex; align-items:center; gap:7px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primario);"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>Mensajes</span>
            <span id="msg-badge" class="msg-badge" style="display:none;"></span>
            <span id="msg-chevron" class="msg-chevron">&rsaquo;</span>
          </div>
          <div id="msg-cuerpo" class="msg-cuerpo" style="display:none;"></div>
        </div>`;

  // Profesional: saludo → calendario → notas a la izquierda; Resumen + Mensajes a la derecha.
  // Gestor: calendario → profesionales a la izquierda; Resumen + Notas + Mensajes a la derecha.
  const sidebarHtml = esProf ? (cardSaludo + cardMiniCal + cardDarTurno + cardNotas) : (cardSaludo + cardMiniCal + cardDarTurno + cardProfesDia + cardNotas);
  const panelDerechoHtml = cardResumen + cardMensajes;

  container.innerHTML = `
    <div class="agenda-layout">
      <div class="agenda-sidebar">${sidebarHtml}</div>

      <div class="agenda-wrap">
        <div class="agenda-controles">
          <div class="agenda-nav-fecha">
            <button class="btn-icon" onclick="agendaCambiarFecha(-1)" title="Anterior">&lsaquo;</button>
            <button class="btn" onclick="agendaIrHoy()">Hoy</button>
            <button class="btn-icon" onclick="agendaCambiarFecha(1)" title="Siguiente">&rsaquo;</button>
          </div>
          <div class="agenda-fecha-titulo" id="agenda-titulo"></div>
        </div>

        <div class="agenda-centro">
          <div id="agenda-grid-container"></div>
          ${esProf ? '<div id="agenda-sobre-panel" class="sobre-panel"></div>' : ''}
        </div>
      </div>

      <div class="agenda-panel-derecho">${panelDerechoHtml}</div>
    </div>
  `;

  await dibujarAgenda();
  dibujarMiniCalendario();
  cargarNotasAgenda();
  initMensajes();
}

// ============================================================
// REENTRADA a la agenda persistente
// Se llama cuando se vuelve a la sección y el DOM ya estaba montado.
// No re-fetchea nada salvo que sea estrictamente necesario:
//   - Reanuda el poll de mensajes si se hubiera cortado.
//   - Si pasó la medianoche desde que se montó (el "hoy" cambió) y el usuario
//     estaba parado en ese viejo hoy, salta al nuevo día. Si estaba mirando
//     otra fecha a propósito, se respeta y no se toca.
// ============================================================
function reentrarAgenda() {
  if (!_msgPollId) initMensajes();

  const hoyStr = agendaFechaStr(new Date());
  if (_agendaHoyConstruido && _agendaHoyConstruido !== hoyStr) {
    const estabaEnViejoHoy = agendaFechaStr(agendaFechaActual) === _agendaHoyConstruido;
    _agendaHoyConstruido = hoyStr;
    if (estabaEnViejoHoy) agendaIrHoy();
  }
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
// Devuelve true si la jornada del día ya cerró: pasaron 2hs del último turno
// (o es un día pasado). Sirve para decidir cuándo un "agendado" pasa a ausente.
function calcularJornadaCerrada(turnos, esPasado) {
  const GRACIA_MS = 2 * 60 * 60 * 1000;
  let ultimoFin = 0;
  (turnos || []).forEach(t => {
    if (t.estado === 'cancelado' || !t.fecha_hora) return;
    const fin = new Date(t.fecha_hora).getTime() + (t.duracion_minutos || 30) * 60000;
    if (!isNaN(fin) && fin > ultimoFin) ultimoFin = fin;
  });
  if (esPasado) return true;
  return ultimoFin > 0 && Date.now() > ultimoFin + GRACIA_MS;
}

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
    .prof-saludo-card { padding:14px; background:linear-gradient(135deg, var(--primario-claro) 0%, #fff 85%); }
    .prof-saludo-row { display:flex; align-items:center; gap:11px; }
    .prof-saludo-foto { width:44px; height:44px; border-radius:13px; object-fit:cover; flex-shrink:0; box-shadow:0 5px 12px -5px rgba(109,91,208,0.55); }
    .prof-saludo-foto-ico { background:linear-gradient(135deg, var(--primario) 0%, #8676E0 100%); color:#fff; display:flex; align-items:center; justify-content:center; }
    .prof-saludo-hola { font-size:16px; font-weight:700; color:var(--texto); letter-spacing:-0.01em; }
    .prof-saludo-sub { font-size:12px; color:var(--texto-secundario); margin-top:1px; }
    .agenda-franja-band { position:absolute; left:2px; right:2px; background:rgba(109,91,208,0.05); border-radius:4px; z-index:0; pointer-events:none; }
    .agenda-hueco { position:absolute; left:2px; right:2px; z-index:1; cursor:pointer; border-radius:4px; border:1px dashed var(--primario-medio); background:rgba(109,91,208,0.04); box-sizing:border-box; display:flex; align-items:center; justify-content:center; transition:background .12s, border-color .12s; }
    .agenda-celda-libre { position:absolute; left:2px; right:2px; z-index:0; border-radius:5px; background:rgba(109,91,208,0.07); }
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
    .turno-sobre-chip { position:absolute; right:3px; bottom:3px; max-width:calc(100% - 12px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:var(--primario-claro); color:var(--primario); border:1px solid var(--primario-medio); font-size:10px; font-weight:600; padding:2px 7px; border-radius:9px; cursor:pointer; z-index:3; transition:filter .08s; }
    .turno-sobre-chip:hover { filter:brightness(1.15); }
    .turno-sobre-suelto { bottom:auto; z-index:4; }
    .turno-card.es-sobreturno { border-left:3px solid #7c3aed; }
    /* Celda bloqueada (no disponible) */
    .agenda-bloqueo { position:absolute; left:2px; right:2px; background:#3a3a3a; color:#fff; border-radius:4px; z-index:2; display:flex; align-items:center; justify-content:center; gap:8px; font-size:11px; font-weight:600; }
    .agenda-hueco-bloq { position:absolute; top:3px; right:3px; width:21px; height:21px; border:1px solid rgba(0,0,0,0.12); border-radius:5px; background:rgba(255,255,255,0.9); cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0; color:#666; z-index:2; transition:background .08s, color .08s; }
    .agenda-hueco-bloq:hover { background:var(--peligro); color:#fff; border-color:var(--peligro); }
    /* Botón "Dar turno" del sidebar (estilo siempre presente, sin esperar al modal) */
    .ag-dar-turno-btn { display:flex; align-items:center; justify-content:center; gap:9px; width:100%; background:var(--primario); color:#fff; border:none; border-radius:13px; padding:13px; font:inherit; font-size:14.5px; font-weight:700; cursor:pointer; box-shadow:0 6px 16px -8px rgba(83,74,183,.8); transition:filter .12s; }
    .ag-dar-turno-btn:hover { filter:brightness(1.06); }
    .ag-dar-turno-btn svg { stroke:#fff; }
    /* Columnas adaptables: la grilla llena el centro; las columnas se achican
       (tope 220) para que entren más; por debajo del mínimo, scroll horizontal. */
    .agenda-centro > #agenda-grid-container { flex:1 1 auto; min-width:0; overflow-x:auto; }
    /* Con 5+ consultorios, el panel derecho se angosta para darle aire a la grilla. */
    .agenda-layout.ag-muchas-cols { grid-template-columns: 232px minmax(0, 1fr) 240px; }
    /* Día pasado: conserva los colores de estado (con un leve apagado para que
       se note que es viejo) y permite el clic (vista rápida). */
    .agenda-grid-col.es-pasado { filter: grayscale(0.3); opacity: 0.94; pointer-events: auto; }
    /* El estado ya se entiende por el color/etiqueta; no hace falta tachar el nombre. */
    .turno-card.estado-ausente, .turno-card.estado-cancelado { text-decoration: none; }
    /* Compactar el contenido para que nombre + detalle + chip de sobreturno
       entren en tarjetas cortas sin desbordarse (alto = duración del turno). */
    .turno-card { padding: 5px 9px; }
    .turno-card-nombre { line-height: 1.2; }
    .turno-card-detalle { line-height: 1.2; font-size: 10.5px; }
    .turno-sobre-chip { font-size: 9px; padding: 1px 6px; bottom: 2px; right: 2px; max-width: calc(100% - 10px); }
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
    // Sumar (sin quitar nada) a los que deberían atender hoy/futuro y aún no
    // están sentados, en las columnas libres. El pasado no se toca.
    if (!esPasado) await topUpSiembra(columnas, fecha, cantColumnas, negId, fechaStr);
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

// Lista ordenada de profesionales que DEBERÍAN atender ese día
// (trabajan ese día de la semana o tienen un "viene" especial, y no están
// ausentes por un "no viene"). Fuente única para sembrar y para el top-up.
async function profesionalesQueAtienden(fecha) {
  const fechaStr = agendaFechaStr(fecha);
  const diaSemana = fecha.getDay();

  const { data: profesionales } = await sb.from('profesionales')
    .select('id, nombre, color, usuario_id, foto_url')
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

  return profesionales.filter(p =>
    (tienenLaboral.has(p.id) || vienenEspecial.has(p.id)) && !ausentes.has(p.id)
  );
}

// Calcula quién debería atender ese día y los sienta desde el primer casillero.
// Devuelve [{ columna, profesional }].
async function calcularSiembra(fecha, cantColumnas) {
  const atienden = await profesionalesQueAtienden(fecha);
  const out = [];
  let col = 1;
  for (const prof of atienden) {
    if (col > cantColumnas) break;
    out.push({ columna: col, profesional: prof });
    col++;
  }
  return out;
}

// TOP-UP de siembra (solo presente/futuro): sienta en las columnas libres a
// los profesionales que deberían atender este día y todavía no están sentados.
// No quita a nadie y respeta los "no viene". Si no hay columnas libres, no
// consulta nada. Persiste en agenda_dia para que la asignación quede estable.
async function topUpSiembra(columnas, fecha, cantColumnas, negId, fechaStr) {
  const libres = [];
  for (let i = 0; i < cantColumnas; i++) if (!columnas[i]) libres.push(i + 1);
  if (!libres.length) return;

  const atienden = await profesionalesQueAtienden(fecha);
  if (!atienden.length) return;

  const sentados = new Set(columnas.filter(c => c && c.profesional).map(c => c.profesional.id));
  const faltan = atienden.filter(p => !sentados.has(p.id));
  if (!faltan.length) return;

  const aSentar = [];
  for (const prof of faltan) {
    const col = libres.shift();
    if (!col) break;
    aSentar.push({ columna: col, profesional: prof });
  }
  if (!aSentar.length) return;

  const filas = aSentar.map(s => ({
    negocio_id: negId, fecha: fechaStr, columna: s.columna, profesional_id: s.profesional.id
  }));
  const { data: insertados, error } = await sb.from('agenda_dia')
    .insert(filas).select('id, columna, profesional_id');
  if (error) { console.warn('top-up siembra:', error.message); return; }
  (insertados || []).forEach(ins => {
    const s = aSentar.find(x => x.columna === ins.columna);
    const idx = ins.columna - 1;
    if (s && idx >= 0 && idx < cantColumnas) {
      columnas[idx] = { columna: ins.columna, profesional: s.profesional, registroId: ins.id };
    }
  });
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
  const esHoy = diaSel.getTime() === hoy.getTime();
  const esFuturo = diaSel > hoy;

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
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3.5rem 2rem;text-align:center;">
        <svg width="170" height="150" viewBox="0 0 170 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:1.25rem;">
          <circle cx="30" cy="36" r="4" fill="var(--advertencia)" opacity="0.85"/>
          <circle cx="142" cy="46" r="5" fill="var(--exito)" opacity="0.8"/>
          <circle cx="150" cy="108" r="3.5" fill="var(--advertencia)" opacity="0.7"/>
          <circle cx="22" cy="112" r="3" fill="var(--primario)" opacity="0.6"/>
          <rect x="24" y="88" width="9" height="9" rx="2.5" fill="var(--info)" opacity="0.8" transform="rotate(22 28 92)"/>
          <rect x="136" y="86" width="9" height="9" rx="2.5" fill="var(--primario-medio)" transform="rotate(-16 140 90)"/>
          <path d="M44 16 l3 6 l-3 6 l-3 -6 z" fill="var(--primario-medio)"/>
          <path d="M126 20 l2.5 5 l-2.5 5 l-2.5 -5 z" fill="var(--advertencia)" opacity="0.7"/>
          <path d="M152 68 l1.6 4.2 l4.2 1.6 l-4.2 1.6 l-1.6 4.2 l-1.6 -4.2 l-4.2 -1.6 l4.2 -1.6 z" fill="var(--primario)" opacity="0.55"/>
          <path d="M18 64 l1.3 3.4 l3.4 1.3 l-3.4 1.3 l-1.3 3.4 l-1.3 -3.4 l-3.4 -1.3 l3.4 -1.3 z" fill="var(--exito)" opacity="0.55"/>
          <rect x="55" y="48" width="60" height="62" rx="13" fill="#fff" stroke="var(--primario)" stroke-width="3"/>
          <path d="M55 65 H115" stroke="var(--primario)" stroke-width="3"/>
          <rect x="70" y="40" width="4.5" height="15" rx="2.25" fill="var(--primario)"/>
          <rect x="95.5" y="40" width="4.5" height="15" rx="2.25" fill="var(--primario)"/>
          <path d="M85 72 L88.5 81.1 L98.3 81.7 L90.7 87.9 L93.2 97.3 L85 92 L76.8 97.3 L79.3 87.9 L71.7 81.7 L81.5 81.1 Z" fill="var(--primario-claro)" stroke="var(--primario)" stroke-width="2.4" stroke-linejoin="round"/>
        </svg>
        <div style="font-size:22px;font-weight:700;color:var(--primario);letter-spacing:-0.01em;margin-bottom:6px;">${feriado.descripcion || 'Feriado'}</div>
        <div style="font-size:15px;font-weight:600;color:var(--texto);margin-bottom:4px;">Consultorio cerrado</div>
        <div style="font-size:13px;color:var(--texto-secundario);">No se asignan turnos en esta fecha.</div>
      </div>`;
    renderPanelDia([], []);
    return;
  }

  // --- Día no laboral del negocio: si el día de la semana no está activo en la
  // configuración de "Días laborales", el negocio está CERRADO ese día. Solo
  // aplica si el negocio configuró al menos un día activo. ---
  const { data: diasLab } = await sb.from('dias_laborales')
    .select('dia_semana, activo')
    .eq('negocio_id', usuarioActual.negocio_id);
  const hayConfigDias = diasLab && diasLab.some(d => d.activo);
  const diaSemanaSel = agendaFechaActual.getDay();
  const diaActivo = diasLab && diasLab.some(d => d.dia_semana === diaSemanaSel && d.activo);
  if (hayConfigDias && !diaActivo) {
    grilla.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3.5rem 2rem;text-align:center;">
        <svg width="170" height="150" viewBox="0 0 170 150" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:1.25rem;">
          <path d="M44 34 l1.7 4.4 l4.4 1.7 l-4.4 1.7 l-1.7 4.4 l-1.7 -4.4 l-4.4 -1.7 l4.4 -1.7 z" fill="var(--primario)" opacity="0.5"/>
          <path d="M130 52 l1.3 3.4 l3.4 1.3 l-3.4 1.3 l-1.3 3.4 l-1.3 -3.4 l-3.4 -1.3 l3.4 -1.3 z" fill="var(--advertencia)" opacity="0.6"/>
          <circle cx="124" cy="34" r="3" fill="var(--primario-medio)"/>
          <circle cx="36" cy="104" r="3.5" fill="var(--exito)" opacity="0.6"/>
          <path d="M88 45 A33 33 0 1 0 88 111 A26 26 0 1 1 88 45 Z" fill="var(--primario-claro)" stroke="var(--primario)" stroke-width="3" stroke-linejoin="round"/>
        </svg>
        <div style="font-size:22px;font-weight:700;color:var(--primario);letter-spacing:-0.01em;margin-bottom:6px;">Cerrado</div>
        <div style="font-size:15px;font-weight:600;color:var(--texto);margin-bottom:4px;">Hoy el negocio descansa</div>
        <div style="font-size:13px;color:var(--texto-secundario);">No se atiende este día.</div>
      </div>`;
    renderPanelDia([], []);
    return;
  }

  let cantColumnas = await obtenerCantidadConsultorios();
  let columnas = await obtenerDiaAgenda(agendaFechaActual, cantColumnas, esPasado);
  _agendaCols = columnas;

  // --- Saludo arriba del calendario (todos los roles) ---
  const esProfesional = usuarioActual.rol === 'profesional';
  if (esProfesional && !_miProfesional) {
    const { data } = await sb.from('profesionales')
      .select('id, nombre, color, foto_url, usuario_id')
      .eq('usuario_id', usuarioActual.id)
      .maybeSingle();
    _miProfesional = data || null;
  }
  const contSaludo = document.getElementById('agenda-prof-saludo');
  if (contSaludo) {
    const primerNombre = (usuarioActual.nombre || '').trim().split(/\s+/)[0] || '';
    const fotoSaludo = (esProfesional && _miProfesional && _miProfesional.foto_url) ? _miProfesional.foto_url : null;
    const avatarSaludo = fotoSaludo
      ? `<img src="${fotoSaludo}" alt="" class="prof-saludo-foto">`
      : `<div class="prof-saludo-foto prof-saludo-foto-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;
    contSaludo.innerHTML = `
      <div class="prof-saludo-row">
        ${avatarSaludo}
        <div>
          <div class="prof-saludo-hola">¡Hola, ${primerNombre}!</div>
          <div class="prof-saludo-sub">Que tengas un buen día &#128156;</div>
        </div>
      </div>`;
  }

  // --- Rol profesional: ve SOLO su propia columna ---
  if (esProfesional) {
    const miCol = columnas.find(c => c && c.profesional && c.profesional.usuario_id === usuarioActual.id);
    columnas = [miCol || null];
    cantColumnas = 1;
    _agendaCols = columnas;
  }

  // Con 5+ columnas, el panel derecho se angosta para darle aire a la grilla.
  document.querySelector('.agenda-layout')?.classList.toggle('ag-muchas-cols', cantColumnas >= 5);

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

  // Jornada cerrada: un turno sin recibir se considera AUSENTE recién cuando ya
  // pasaron ~2hs del último turno del día (no apenas vence su horario).
  const jornadaCerrada = calcularJornadaCerrada(turnos, esPasado);

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
  const altoTotal = slotsRegla.length * negocioSlot * ESCALA_AGENDA;

  let html = `<div class="agenda-grid-col ${esPasado ? 'es-pasado' : ''} ${esProfesional ? 'vista-consultorio' : 'vista-recepcion'}"
    style="grid-template-columns: 56px repeat(${cantColumnas}, minmax(150px, 220px)); width:100%;">`;

  // Encabezados. Con un solo consultorio, el número va en el cuadrado de la
  // esquina (arriba de los horarios). Con varios, va en cada columna.
  const unaColumna = cantColumnas === 1;
  html += `<div class="agenda-col-esquina">${unaColumna ? '<span class="agenda-col-num">1</span>' : ''}</div>`;
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    const numBadge = unaColumna ? '' : `<span class="agenda-col-num">${numero}</span>`;
    if (col && col.profesional) {
      const p = col.profesional;
      const dragAttrs = esPasado ? '' :
        `draggable="true" ondragstart="agendaDragStart(${numero})" ondragover="event.preventDefault()" ondrop="agendaDrop(${numero})"`;
      html += `
        <div class="agenda-col-head" ${dragAttrs} title="${esPasado ? '' : 'Arrastrá para reordenar'}">
          ${numBadge}
          <span class="agenda-col-prof">
            <span class="agenda-col-dot" style="background:${p.color || 'var(--primario)'};"></span>${p.nombre}
          </span>
        </div>
      `;
    } else {
      const dropAttrs = esPasado ? '' : `ondragover="event.preventDefault()" ondrop="agendaDrop(${numero})"`;
      html += `
        <div class="agenda-col-head" ${dropAttrs}>
          ${numBadge}
          <span class="agenda-col-prof libre">&mdash; libre &mdash;</span>
        </div>
      `;
    }
  });

  // Columna de horas (un renglón por slot de la duración del negocio)
  html += `<div class="agenda-horas-col" style="height:${altoTotal}px;">`;
  slotsRegla.forEach(s => {
    html += `<div class="agenda-hora-label" style="height:${negocioSlot * ESCALA_AGENDA}px;">${minToHora(s)}</div>`;
  });
  html += `</div>`;

  // Columnas de consultorio
  const sobresPanel = [];
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    html += `<div class="agenda-consultorio-col" style="height:${altoTotal}px;">`;
    slotsRegla.forEach(s => {
      html += `<div class="agenda-linea-hora" style="top:${(s - inicioMin) * ESCALA_AGENDA}px; height:${negocioSlot * ESCALA_AGENDA}px;"></div>`;
    });

    if (col && col.profesional) {
      const susTurnos = turnosPorProf[col.profesional.id] || [];
      const susBloqueos = bloqueosPorProf[col.profesional.id] || [];
      const bloqueadosMin = new Set(susBloqueos.map(b => b.hora_min));

      // Separar turnos normales de sobreturnos (estos van como chip, no como tarjeta)
      // Los cancelados no se muestran ni ocupan el slot (quedan guardados para stats).
      const normales = susTurnos.filter(t => !t.es_sobreturno && t.estado !== 'cancelado');
      const sobres = susTurnos.filter(t => t.es_sobreturno && t.estado !== 'cancelado');
      sobres.forEach(s => sobresPanel.push({ turno: s, numero }));
      const sobrePorMin = {};
      sobres.forEach(s => { const m = turnoMinInicio(s); (sobrePorMin[m] = sobrePorMin[m] || []).push(s); });

      // Etapa 3: disponibilidad y huecos para dar turno (solo presente/futuro)
      if (!esPasado) {
        const franjas = mapaFranjas[col.profesional.id] || [];

        // Celdas violetas por slot, SEPARADAS entre sí (un bloque por renglón
        // de la grilla que caiga dentro de la franja y no choque con un turno).
        // Para quien puede crear turno son huecos clickeables con "+";
        // para el profesional, solo el bloque (sin "+").
        slotsRegla.forEach(t => {
          if (t + negocioSlot > finMin) return;
          const dentro = franjas.some(fr => t >= fr.ini && t + negocioSlot <= fr.fin);
          if (!dentro) return;
          if (bloqueadosMin.has(t)) return;
          if (haySolapamiento(t, t + negocioSlot, normales)) return;  // los sobreturnos NO bloquean el slot
          const topH = (t - inicioMin) * ESCALA_AGENDA + 2;
          const altoH = negocioSlot * ESCALA_AGENDA - 4;
          const btnBloq = esGestor
            ? `<button class="agenda-hueco-bloq" title="Bloquear este horario" onclick="event.stopPropagation(); crearBloqueo('${col.profesional.id}','${fechaStrSel}',${t})">&#8709;</button>`
            : '';
          if (puedeCrearTurno) {
            // HOY y FUTURO: dar turno (+) y, para gestores, bloquear horario
            html += `<div class="agenda-hueco" style="top:${topH}px; height:${altoH}px;"
              title="Dar turno ${minToHora(t)}"
              onclick="abrirModalNuevoTurnoCasillero('${col.profesional.id}', ${numero}, '${fechaStrSel}', ${t})">
              <span class="agenda-hueco-mas">+</span>
              ${btnBloq}
              </div>`;
          } else {
            // Sin permiso para crear turno: celda libre (con bloqueo si es gestor)
            html += `<div class="agenda-celda-libre" style="top:${topH}px; height:${altoH}px;">${btnBloq}</div>`;
          }
        });

        if (franjas.length === 0) {
          html += `<div class="agenda-sin-franja">Sin horario cargado este día</div>`;
        }
      }

      // Celdas bloqueadas ("No disponible")
      susBloqueos.forEach(b => {
        const topB = (b.hora_min - inicioMin) * ESCALA_AGENDA;
        html += `<div class="agenda-bloqueo" style="top:${topB}px; height:${negocioSlot * ESCALA_AGENDA}px;">
          <span>No disponible</span>
          ${(!esPasado && esGestor) ? `<button class="turno-accion-btn peligro" onclick="event.stopPropagation(); quitarBloqueo('${b.id}')" title="Quitar bloqueo">&#128465;</button>` : ''}
        </div>`;
      });

      // Tarjeta de cada turno normal (con botones y, si hay, chip de sobreturno)
      const minConCard = new Set();
      normales.forEach(t => {
        minConCard.add(turnoMinInicio(t));
        html += tarjetaTurnoHTML(t, numero, fechaStrSel, sobrePorMin[turnoMinInicio(t)] || [], esPasado, esHoy, inicioMin, false, jornadaCerrada);
      });

      // Sobreturnos huérfanos (se borró el turno base): NO ocupan el slot.
      // Quedan como chip violeta chico en su horario; el "+ dar turno" sigue
      // disponible para dar un turno completo si alguien canceló.
      Object.keys(sobrePorMin).forEach(mStr => {
        const m = parseInt(mStr);
        if (minConCard.has(m)) return;  // si hay base, ya va como chip en la tarjeta
        const topS = (m - inicioMin) * ESCALA_AGENDA;
        sobrePorMin[m].forEach(t => {
          const nom = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : 'Sobreturno';
          if (esProf) {
            html += `<div class="turno-sobre-chip turno-sobre-suelto chip-info estado-${t.estado}" style="top:${topS}px;"
              title="Sobreturno (sin turno base)">${nom}</div>`;
          } else {
            html += `<div class="turno-sobre-chip turno-sobre-suelto estado-${t.estado}" style="top:${topS}px;"
              title="Sobreturno (sin turno base)"
              onclick="event.stopPropagation(); verSobreturnos('${t.profesional_id}','${t.fecha_hora}')">${nom}</div>`;
          }
        });
      });
    } else {
      // Sol cálido para el profesional que no trabaja ese día.
      const ilustDiaLibre = '<svg width="112" height="104" viewBox="0 0 118 110" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mateGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9D2F6"/><stop offset="1" stop-color="#9385DB"/></linearGradient></defs><circle cx="68" cy="56" r="38" fill="var(--primario-claro)" opacity="0.45"/><path d="M50 66 C40 63 31 65 25 71" stroke="var(--exito)" stroke-width="2" stroke-linecap="round"/><path d="M37 64 C33 57 35 50 41 48 C44 54 43 61 37 64 Z" fill="var(--exito-claro)" stroke="var(--exito)" stroke-width="1.7" stroke-linejoin="round"/><path d="M26 72 C21 72 17 68 16 63 C22 62 26 66 26 72 Z" fill="var(--exito-claro)" stroke="var(--exito)" stroke-width="1.7" stroke-linejoin="round"/><path d="M62 41 L82 12" stroke="var(--primario)" stroke-width="3.4" stroke-linecap="round"/><path d="M55 40 C47 46 45 56 45 65 C45 79 56 90 68 90 C80 90 91 79 91 65 C91 56 89 46 81 40 Z" fill="url(#mateGrad)" stroke="var(--primario)" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="68" cy="40" rx="13" ry="3.6" fill="#8979CE"/></svg>';
      // Calendario con + invitando a sumar profesional (gestor).
      const ilustArmarDia = '<svg width="92" height="86" viewBox="0 0 92 86" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="62" cy="20" r="3.5" fill="var(--advertencia)" opacity="0.75"/><circle cx="14" cy="56" r="3" fill="var(--exito)" opacity="0.7"/><rect x="22" y="20" width="48" height="50" rx="12" fill="#fff" stroke="var(--primario)" stroke-width="3"/><path d="M22 34 H70" stroke="var(--primario)" stroke-width="3"/><rect x="34" y="13" width="4.5" height="13" rx="2.25" fill="var(--primario)"/><rect x="53.5" y="13" width="4.5" height="13" rx="2.25" fill="var(--primario)"/><circle cx="46" cy="52" r="13" fill="var(--primario-claro)"/><path d="M46 45 V59 M39 52 H53" stroke="var(--primario)" stroke-width="3" stroke-linecap="round"/></svg>';
      html += esProfesional
        ? `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono" style="opacity:1;margin-bottom:10px;">${ilustDiaLibre}</div>
          <div class="agenda-libre-titulo">Sin agenda hoy</div>
          <div class="agenda-libre-texto">No trabajás este día. ¡Que tengas un buen descanso!</div>
        </div>
      `
        : `
        <div class="agenda-libre-estado">
          <div class="agenda-libre-icono" style="opacity:1;margin-bottom:10px;">${ilustArmarDia}</div>
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

  // Panel lateral de sobreturnos (solo vista profesional): se administran al lado.
  const panelSobre = document.getElementById('agenda-sobre-panel');
  if (panelSobre) {
    if (!sobresPanel.length) {
      panelSobre.innerHTML = `<div class="sobre-panel-titulo">Sobreturnos</div>
        <div class="sobre-panel-vacio">No hay sobreturnos para este día.</div>`;
    } else {
      const items = sobresPanel
        .slice()
        .sort((a, b) => turnoMinInicio(a.turno) - turnoMinInicio(b.turno))
        .map(it => {
          const s = it.turno;
          const nom = s.pacientes ? `${s.pacientes.apellido}, ${s.pacientes.nombre.split(' ')[0]}` : 'Sobreturno';
          const sub = s.tipos_atencion?.nombre || (s.estado === 'agendado' ? 'Pendiente' : '');
          const acc = esPasado ? '' : accionesTurnoHTML(s, it.numero, fechaStrSel, false);
          return `<div class="sobre-item estado-${s.estado}" onclick="abrirModalTurno('${s.id}')" title="${nom}">
            <div class="sobre-item-nombre">${nom}</div>
            <div class="sobre-item-hora">${formatearHora(s.fecha_hora)}${sub ? ' &middot; ' + sub : ''}</div>
            ${acc}
          </div>`;
        }).join('');
      panelSobre.innerHTML = `<div class="sobre-panel-titulo">Sobreturnos</div>${items}`;
    }
  }

  // Paneles laterales (profesionales del día + resumen) — usan datos ya cargados.
  renderPanelDia(columnas, turnos, esPasado);
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

function renderPanelDia(columnas, turnos, esPasado) {
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
    // "Ausente" = nunca se recibió y la jornada ya cerró (2hs post último turno, o día pasado).
    const jornadaCerrada = calcularJornadaCerrada(ts, esPasado);
    const esAusente = (t) => t.estado === 'ausente' || (t.estado === 'agendado' && !t.es_sobreturno && jornadaCerrada);
    const total = ts.filter(t => t.estado !== 'cancelado').length;
    const pendientes = ts.filter(t => ['agendado', 'llego', 'en_atencion'].includes(t.estado) && !esAusente(t)).length;
    const atendidos = ts.filter(t => ['finalizado', 'cobrado'].includes(t.estado)).length;
    const ausencias = ts.filter(t => esAusente(t)).length;
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

  const { data: profRow } = await sb.from('profesionales').select('nombre, foto_url').eq('id', profId).maybeSingle();
  const profFoto = profRow?.foto_url || null;
  const inicProf = (profNombre || 'P').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'P';

  let fechaLinda = new Date(fechaStr + 'T00:00')
    .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  fechaLinda = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);
  const hIni = minToHora(startMin);
  const hFin = minToHora(startMin + profDur);

  const NTI = (p, w = 16) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ntico = {
    cal:   '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    dur:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M9 2h6"/>',
    flag:  '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    user:  '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    userp: '<circle cx="9" cy="8" r="4"/><path d="M3 21c0-3.6 3-5.5 6-5.5"/><path d="M16 11h6M19 8v6"/>',
    nota:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    lista: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    cons:  '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>',
    prof:  '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>',
    mas:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  const titulo = esSobreturno ? 'Sobreturno' : 'Nuevo turno';
  const avatarHero = profFoto
    ? `<img src="${profFoto}" alt="" class="nt-foto">`
    : `<div class="nt-foto nt-foto-ini">${inicProf}</div>`;

  abrirModal(`
    <style>
      .modal { max-width: 800px; }
      .nt-body { background:#fff; }
      .nt-hero { position:relative; overflow:hidden; display:flex; align-items:center; gap:18px; background:linear-gradient(120deg,#F3F0FE,#ECE8FB); border:1px solid var(--borde-tenue); border-radius:16px; padding:18px 20px; margin-bottom:22px; }
      .nt-foot { position:absolute; right:18px; top:50%; transform:translateY(-50%); width:130px; height:130px; color:var(--primario); opacity:.13; pointer-events:none; }
      .nt-foto { width:74px; height:74px; flex:none; border-radius:50%; object-fit:cover; box-shadow:0 2px 10px rgba(83,74,183,.25); }
      .nt-foto-ini { background:linear-gradient(135deg,#C9BEF6,#9E8DE8); color:#fff; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; }
      .nt-hero-nombre { font-size:21px; font-weight:700; color:var(--texto); }
      .nt-hero-rol { font-size:13px; font-weight:600; color:var(--primario); margin-top:1px; }
      .nt-hero-fecha { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--texto-secundario); margin:7px 0 11px; }
      .nt-pills { display:flex; gap:9px; flex-wrap:wrap; }
      .nt-pill { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid var(--borde-tenue); border-radius:10px; padding:7px 12px; font-size:12.5px; font-weight:600; color:var(--texto); }
      .nt-pill svg { color:var(--primario); }

      .nt-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px 24px; align-items:start; }
      .nt-sec-lbl { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; margin-bottom:10px; }
      .nt-sec-lbl svg { color:var(--primario); }
      .nt-search { position:relative; }
      .nt-search .nt-sico { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--texto-tenue); }
      .nt-search input { width:100%; padding:11px 12px 11px 36px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13.5px; }
      .nt-search input:focus { border-color:var(--primario-medio); outline:none; }
      .tt-resultados { position:absolute; left:0; right:0; top:100%; margin-top:4px; background:#fff; border:1px solid var(--borde-tenue); border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.12); z-index:30; max-height:220px; overflow-y:auto; }
      .nt-nuevo { display:inline-flex; align-items:center; gap:7px; margin-top:10px; background:var(--exito-claro); color:var(--exito); border:1px dashed var(--exito); border-radius:10px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; }
      .nt-info { display:flex; align-items:center; gap:11px; background:rgba(83,74,183,.05); border:1px solid var(--borde-tenue); border-radius:13px; padding:14px 15px; font-size:12.5px; color:var(--texto-secundario); }
      .nt-info-ico { width:34px; height:34px; flex:none; border-radius:9px; background:var(--primario-claro); color:var(--primario); display:flex; align-items:center; justify-content:center; }
      .nt-info.sel { background:var(--exito-claro); border-color:rgba(31,157,107,.3); color:#0B5E3E; }
      .nt-info.sel .nt-info-ico { background:rgba(31,157,107,.16); color:var(--exito); }

      .nt-textarea { width:100%; min-height:120px; resize:vertical; padding:11px 12px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13.5px; }
      .nt-textarea:focus { border-color:var(--primario-medio); outline:none; }
      .nt-count { text-align:right; font-size:11px; color:var(--texto-secundario); margin-top:4px; }

      .nt-resumen { background:var(--fondo); border:1px solid var(--borde-tenue); border-radius:13px; padding:15px 17px; }
      .nt-resumen-tit { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; margin-bottom:12px; }
      .nt-resumen-tit svg { color:var(--primario); }
      .nt-rfila { display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; padding:6px 0; }
      .nt-rfila-lbl { display:flex; align-items:center; gap:8px; color:var(--texto-secundario); }
      .nt-rfila-lbl svg { color:var(--texto-tenue); }
      .nt-rfila-val { font-weight:600; color:var(--texto); text-align:right; }
      .nt-estado { display:inline-flex; align-items:center; font-size:11.5px; font-weight:600; color:#6B4A12; background:#FCEAD6; border-radius:20px; padding:3px 11px; }

      .nt-foot-right { margin-left:auto; display:flex; gap:10px; }
      .nt-crear { display:inline-flex; align-items:center; gap:8px; }
    </style>

    <div class="modal-header">
      <div class="modal-titulo" style="display:flex; align-items:center; gap:9px;">${NTI(ntico.cal, 18)} ${titulo}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <form id="form-turno-casillero">
      <div class="modal-body nt-body">

        <div class="nt-hero">
          <svg class="nt-foot" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M44 92 C 36 78, 40 60, 56 54 C 70 49, 92 48, 96 60 C 99 70, 90 78, 78 79"/>
            <path d="M78 79 C 74 86, 56 90, 48 86 C 42 83, 42 88, 44 92"/>
            <path d="M30 96 C 38 86, 50 86, 58 90"/>
            <path d="M40 90 C 34 84, 35 76, 42 73"/>
            <path d="M48 89 C 45 81, 49 74, 56 72"/>
          </svg>
          ${avatarHero}
          <div>
            <div class="nt-hero-nombre">${profNombre}</div>
            <div class="nt-hero-rol">Profesional · Consultorio ${columna}</div>
            <div class="nt-hero-fecha">${NTI(ntico.cal, 15)} ${fechaLinda}</div>
            <div class="nt-pills">
              <span class="nt-pill">${NTI(ntico.reloj, 14)} ${hIni} hs</span>
              <span class="nt-pill">${NTI(ntico.dur, 14)} ${profDur} min</span>
              <span class="nt-pill">${NTI(ntico.flag, 14)} Finaliza ${hFin}</span>
            </div>
          </div>
        </div>

        <div class="nt-grid">
          <div>
            <div class="nt-sec-lbl">${NTI(ntico.user)} Paciente</div>
            <div class="nt-search">
              <span class="nt-sico">${NTI(ntico.busca, 16)}</span>
              <input type="text" id="tt-paciente-input" autocomplete="off"
                placeholder="Buscar por apellido, nombre o DNI..."
                value="${pacientePre ? (pacientePre.apellido + ', ' + pacientePre.nombre) : ''}"
                oninput="ttFiltrarPacientes(this.value)">
              <input type="hidden" name="paciente_id" id="tt-paciente-id" value="${pacientePre ? pacientePre.id : ''}">
              <div id="tt-resultados" class="tt-resultados" style="display:none;"></div>
            </div>
            <button type="button" class="nt-nuevo"
              onclick="ttNuevoPacienteDesdeTurno('${profId}', ${columna}, '${fechaStr}', ${startMin}, ${esSobreturno})">${NTI(ntico.mas, 16)} Nuevo paciente</button>

            <div class="nt-sec-lbl" style="margin-top:22px;">${NTI(ntico.nota)} Notas de la cita <span style="font-weight:400; color:var(--texto-secundario);">(opcional)</span></div>
            <textarea name="notas" class="nt-textarea" maxlength="200" placeholder="Ej: primera consulta, control, observaciones…" oninput="document.getElementById('nt-notas-count').textContent=this.value.length"></textarea>
            <div class="nt-count"><span id="nt-notas-count">0</span>/200</div>
          </div>

          <div>
            <div class="nt-info" id="tt-info">
              <div class="nt-info-ico">${NTI(ntico.userp, 16)}</div>
              <div>Seleccioná un paciente existente<br>o registrá uno nuevo.</div>
            </div>

            <div class="nt-resumen" style="margin-top:18px;">
              <div class="nt-resumen-tit">${NTI(ntico.lista)} Resumen del turno</div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.cons, 15)} Consultorio</span><span class="nt-rfila-val">${columna}</span></div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.prof, 15)} Profesional</span><span class="nt-rfila-val">${profNombre}</span></div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.cal, 15)} Fecha</span><span class="nt-rfila-val">${fechaLinda}</span></div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.reloj, 15)} Horario</span><span class="nt-rfila-val">${hIni} hs</span></div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.dur, 15)} Duración</span><span class="nt-rfila-val">${profDur} min</span></div>
              <div class="nt-rfila"><span class="nt-rfila-lbl">${NTI(ntico.reloj, 15)} Estado</span><span class="nt-estado">${esSobreturno ? 'Sobreturno' : 'Pendiente de confirmación'}</span></div>
            </div>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <div class="nt-foot-right">
          <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary-sm nt-crear">${NTI(ntico.check, 16)} ${esSobreturno ? 'Crear sobreturno' : 'Crear turno'}</button>
        </div>
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
  const info = document.getElementById('tt-info');
  if (info) {
    info.classList.add('sel');
    info.innerHTML = `<div class="nt-info-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>${p.apellido}, ${p.nombre}</strong>${p.dni ? `<br>DNI ${p.dni}` : ''}</div>`;
  }
}

// --- Alta rápida de paciente (vuelve al turno con el paciente elegido) ---
function ttNuevoPacienteDesdeTurno(profId, columna, fechaStr, startMin, esSobreturno) {
  esSobreturno = !!esSobreturno;
  const fNum = `this.value=this.value.replace(/[^0-9]/g,'')`;
  const fTel = `this.value=this.value.replace(/[^0-9 ]/g,'')`;
  const fNom = `this.value=this.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü ]/g,'').replace(/^ +/,'')`;
  const npi = (p, w = 16) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const NPICO = {
    userplus: '<circle cx="9" cy="8" r="4"/><path d="M3 21c0-3.8 3-5.8 6-5.8"/><path d="M16 11h6M19 8v6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>',
    dni:  '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4"/>',
    tel:  '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7A2 2 0 0 1 22 16.9z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  abrirModal(`
    <style>
      .modal { max-width: 720px; }
      .np-header { display:flex; align-items:center; gap:15px; }
      .np-header-ico { width:52px; height:52px; flex:none; border-radius:14px; background:var(--primario-claro); color:var(--primario); display:flex; align-items:center; justify-content:center; }
      .np-titulo { font-size:21px; font-weight:700; color:var(--texto); line-height:1.15; }
      .np-sub { font-size:13px; color:var(--texto-secundario); margin-top:2px; }
      .np-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 22px; }
      .np-field label { display:block; font-size:12.5px; color:var(--texto-secundario); margin-bottom:6px; }
      .np-field label b { color:var(--peligro); font-weight:600; }
      .np-iw { position:relative; }
      .np-iw .np-fico { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--texto-tenue); display:flex; }
      .np-iw input { width:100%; padding:12px 13px 12px 38px; border:1px solid var(--borde-tenue); border-radius:11px; font:inherit; font-size:14px; background:#fff; transition:border-color .12s; }
      .np-iw input:focus { border-color:var(--primario-medio); outline:none; }
      .np-banner { display:flex; align-items:center; gap:13px; background:rgba(83,74,183,.05); border:1px solid var(--borde-tenue); border-radius:13px; padding:14px 16px; margin-top:20px; }
      .np-banner-ico { width:38px; height:38px; flex:none; border-radius:10px; background:#fff; border:1px solid var(--borde-tenue); color:var(--primario); display:flex; align-items:center; justify-content:center; }
      .np-banner-tit { font-size:13px; font-weight:600; color:var(--texto); }
      .np-banner-sub { font-size:12px; color:var(--texto-secundario); }
      .np-foot-right { margin-left:auto; display:flex; gap:10px; }
      .np-crear { display:inline-flex; align-items:center; gap:8px; }
    </style>

    <div class="modal-header">
      <div class="np-header">
        <div class="np-header-ico">${npi(NPICO.userplus, 24)}</div>
        <div>
          <div class="np-titulo">Nuevo paciente</div>
          <div class="np-sub">Completá los datos para registrar al paciente</div>
        </div>
      </div>
      <button class="modal-cerrar" onclick="cerrarModal()">&times;</button>
    </div>
    <form id="form-nuevo-pac-turno">
      <div class="modal-body">
        <div class="np-grid">
          <div class="np-field"><label>Apellido <b>*</b></label><div class="np-iw"><span class="np-fico">${npi(NPICO.user)}</span><input type="text" name="apellido" required placeholder="Ej: Lopez" oninput="${fNom}"></div></div>
          <div class="np-field"><label>Nombre <b>*</b></label><div class="np-iw"><span class="np-fico">${npi(NPICO.user)}</span><input type="text" name="nombre" required placeholder="Ej: Juana" oninput="${fNom}"></div></div>
          <div class="np-field"><label>DNI</label><div class="np-iw"><span class="np-fico">${npi(NPICO.dni)}</span><input type="text" name="dni" inputmode="numeric" placeholder="Ej: 33123456" oninput="${fNum}"></div></div>
          <div class="np-field"><label>WhatsApp</label><div class="np-iw"><span class="np-fico">${npi(NPICO.tel)}</span><input type="text" name="celular" inputmode="numeric" placeholder="Ej: 11 2345 6789" oninput="${fTel}"></div></div>
        </div>

        <div class="np-banner">
          <div class="np-banner-ico">${npi(NPICO.shield, 18)}</div>
          <div>
            <div class="np-banner-tit">Estos datos serán guardados en la ficha del paciente</div>
            <div class="np-banner-sub">Podrás modificarlos más adelante.</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="np-foot-right">
          <button type="button" class="btn"
            onclick="abrirModalNuevoTurnoCasillero('${profId}', ${columna}, '${fechaStr}', ${startMin}, null, ${esSobreturno})">Volver</button>
          <button type="submit" class="btn btn-primary-sm np-crear">${npi(NPICO.check, 16)} Crear y usar</button>
        </div>
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
function tarjetaTurnoHTML(t, numero, fechaStr, sobres, esPasado, esHoy, inicioMin, esHuerfano, jornadaCerrada) {
  const top = (turnoMinInicio(t) - inicioMin) * ESCALA_AGENDA;
  const altura = Math.max(52, t.duracion_minutos * ESCALA_AGENDA);
  const nombre = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre.split(' ')[0]}` : '-';
  // Sin recibir + jornada ya cerrada (2hs post último turno, o día pasado) => AUSENTE.
  const esAusentePasado = t.estado === 'agendado' && !t.es_sobreturno && jornadaCerrada;
  const estadoVisual = esAusentePasado ? 'ausente' : t.estado;
  const subtitulo = estadoVisual === 'ausente' ? 'Ausente' : (t.tipos_atencion?.nombre || (t.estado === 'agendado' ? 'Pendiente' : ''));
  const tieneSobre = !!(sobres && sobres.length);
  // HOY: acciones completas. Pasado/futuro: solo vista rápida (ojo).
  const acciones = esHoy ? accionesTurnoHTML(t, numero, fechaStr, tieneSobre) : accionesSoloVistaHTML(t);
  let chip = '';
  if (tieneSobre) {
    const s = sobres[0];
    const nombreSobre = s.pacientes ? `${s.pacientes.apellido}, ${s.pacientes.nombre.split(' ')[0]}` : 'Sobreturno';
    if (usuarioActual.rol === 'profesional') {
      // Profesional: el chip es informativo. Las acciones van por el panel de sobreturnos.
      chip = `<div class="turno-sobre-chip chip-info estado-${s.estado}" title="${nombreSobre}">${nombreSobre}</div>`;
    } else {
      chip = `<div class="turno-sobre-chip estado-${s.estado}" title="Ver sobreturno"
           onclick="event.stopPropagation(); verSobreturnos('${t.profesional_id}','${t.fecha_hora}')">${nombreSobre}</div>`;
    }
  }
  const claseSobre = (esHuerfano || t.es_sobreturno) ? ' es-sobreturno' : '';
  return `
    <div class="turno-card estado-${estadoVisual}${claseSobre}"
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

// Solo el botón de vista rápida (para días pasados/futuros: no operativos).
function accionesSoloVistaHTML(t) {
  if (!t.paciente_id) return '';
  const ojo = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return `<div class="turno-acciones"><button class="turno-accion-btn" title="Vista rápida del paciente" onclick="event.stopPropagation(); verFichaPaciente('${t.paciente_id}')">${ojo}</button></div>`;
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
    rayo:   sv('<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>'),
    tacho:  sv('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    volver: sv('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
    cobro:  sv('<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>')
  };
  const btn = (icono, titulo, fn, extra) =>
    `<button class="turno-accion-btn ${extra || ''}" title="${titulo}" onclick="${stop}${fn}">${icono}</button>`;
  const out = [];

  // Ojo = vista rápida del paciente (contexto antes de atender)
  if (t.paciente_id) out.push(btn(ICO.ojo, 'Vista rápida del paciente', `verFichaPaciente('${t.paciente_id}')`));

  if (esGestor) {
    if (t.estado === 'agendado') {
      out.push(btn(ICO.check, 'Recibir paciente', `cambiarEstadoTurno('${t.id}','llego')`));
      if (puedeSobre) out.push(btn(ICO.rayo, 'Dar sobreturno', `abrirModalNuevoTurnoCasillero('${t.profesional_id}', ${numero}, '${fechaStr}', ${turnoMinInicio(t)}, null, true)`));
      out.push(btn(ICO.tacho, 'Cancelar o eliminar turno', `quitarTurno('${t.id}')`));
    } else if (t.estado === 'llego') {
      out.push(btn(ICO.volver, 'Cancelar recepción', `cambiarEstadoTurno('${t.id}','agendado')`));
      if (puedeSobre) out.push(btn(ICO.rayo, 'Dar sobreturno', `abrirModalNuevoTurnoCasillero('${t.profesional_id}', ${numero}, '${fechaStr}', ${turnoMinInicio(t)}, null, true)`));
    } else if (t.estado === 'finalizado') {
      out.push(btn(ICO.cobro, 'Cobrar', `(typeof abrirCobro==='function' ? abrirCobro('${t.id}') : mostrarMensaje('El cobro se activa en el próximo paso','advertencia'))`));
    }
  }

  if (esProf) {
    if (t.estado === 'llego') {
      out.push(btn(ICO.ficha, 'Iniciar atención', `iniciarAtencion('${t.id}')`));
    } else if (t.estado === 'en_atencion') {
      out.push(btn(ICO.ficha, 'Seguir ficha', `abrirFichaAtencion('${t.id}')`));
    } else if (t.estado === 'finalizado') {
      out.push(btn(ICO.ficha, 'Ver ficha', `abrirFichaAtencion('${t.id}', true)`));
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
    .neq('estado', 'cancelado')
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

// ============================================================
// PASO 2a — MODAL "DAR TURNO"  (agendar aparte del panel del día)
// ------------------------------------------------------------
// Liviano y autocontenido: calendario + tarjetas de profesionales
// (con stats libres/tomados/sobreturnos) + columna de UN profesional.
// Acciones: dar turno, dar sobreturno, cancelar turno.
// No usa el grilla pesado del panel ni drag/swap/bloqueos.
// El panel del día (persistente) sigue intacto; si lo agendado cae en
// la fecha que el panel está mostrando, se refresca solo.
// ============================================================

let _agModal = { fecha: null, profId: null, dur: 45, abierto: false };
let _agFiltro = { estado: 'todos' };                 // todos | libre | tomado | sobre
let _agProx = { scope: 'todos', cargando: false };   // scope del buscador "próximo disponible"
let _agProxProfes = [];                              // lista de profesionales activos (para el selector)
let _agPanelOculto = true;                           // riel izquierdo oculto/visible
let _agProfes = [];          // [{id,nombre,color,foto_url, libres,tomados,sobres, atiende}]
let _agTurnosProf = {};      // profId -> [turnos del día]
let _agFranjasProf = {};     // profId -> [{ini,fin}]
let _agBloqueosProf = {};    // profId -> Set(hora_min)
let _agTtPacientes = [];     // cache typeahead

function _agIco(p, w = 16) {
  return `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}
const _AGI = {
  cal:   '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user:  '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  mas:   '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  x:     '<path d="M18 6 6 18M6 6l12 12"/>',
  flecha:'<path d="m15 18-6-6 6-6"/>',
  flechaDer:'<path d="m9 18 6-6-6-6"/>',
  rayo:  '<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>',
  ojo:   '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  ban:   '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'
};

function _agInyectarEstilos() {
  if (document.getElementById('estilos-agendar-modal')) return;
  const st = document.createElement('style');
  st.id = 'estilos-agendar-modal';
  st.textContent = `
    /* Ventana flotante "Dar turno" (no bloquea la agenda de atrás) */
    .agw-frame { position:fixed; top:74px; left:20px; z-index:90; width:820px; max-width:96vw; height:min(900px, calc(100vh - 24px)); display:flex; flex-direction:column; background:#fff; border:1px solid var(--borde); border-radius:16px; box-shadow:0 24px 60px -18px rgba(20,20,40,.45); overflow:hidden; }
    .agw-head { flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 16px; background:linear-gradient(120deg,#F3F0FE,#ECE8FB); border-bottom:1px solid var(--borde-tenue); cursor:move; user-select:none; }
    .agw-head-left { display:flex; align-items:center; gap:8px; }
    .agw-panel-toggle { width:28px; height:28px; border:none; border-radius:8px; background:rgba(109,91,208,0.12); color:var(--primario); cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; transition:background .1s; }
    .agw-panel-toggle:hover { background:rgba(109,91,208,0.22); }
    /* Panel izquierdo colapsado: ventana más angosta y grilla a 2 columnas. */
    .agw-frame.agw-anim { transition: width .26s ease, left .26s ease; }
    .agw-frame.ag-sin-panel { width:606px; }
    .agw-title { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:700; color:var(--texto); }
    .agw-title svg { color:var(--primario); }
    .agw-head-actions { display:flex; align-items:center; gap:12px; }
    .agw-hint { font-size:11px; color:var(--texto-secundario); }
    .agw-close { width:30px; height:30px; border:none; border-radius:8px; background:transparent; font-size:20px; line-height:1; color:var(--texto-secundario); cursor:pointer; }
    .agw-close:hover { background:rgba(0,0,0,.07); color:var(--texto); }
    .agw-body { flex:1 1 auto; min-height:0; padding:14px; overflow:hidden; }
    .ag-body { display:flex; align-items:stretch; height:100%; min-height:0; }
    .ag-rail-nuevo { flex:0 0 auto; width:200px; margin-right:14px; display:flex; flex-direction:column; gap:14px; min-height:0; overflow:hidden auto; transition: width .26s ease, margin-right .26s ease, opacity .2s ease; }
    .ag-rail-nuevo .ag-card { width:200px; box-sizing:border-box; }
    .ag-sin-panel .ag-rail-nuevo { width:0; margin-right:0; opacity:0; }
    .ag-rail { flex:0 0 auto; width:200px; margin-right:14px; display:flex; flex-direction:column; gap:14px; min-height:0; overflow:hidden auto; }
    /* Riel nuevo: secciones */
    .ag-sec-titulo { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--texto-secundario); margin:0 0 9px; display:flex; align-items:center; gap:6px; }
    .ag-sec-titulo svg { color:var(--primario); }
    /* Próximo disponible */
    .ag-prox-scope { width:100%; font:inherit; font-size:12.5px; padding:7px 9px; border:1px solid var(--borde); border-radius:9px; background:#fff; color:var(--texto); cursor:pointer; }
    .ag-prox-buscar { width:100%; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:7px; font:inherit; font-size:12.5px; font-weight:600; padding:8px; border:none; border-radius:9px; background:var(--primario); color:#fff; cursor:pointer; transition:filter .1s; }
    .ag-prox-buscar:hover { filter:brightness(1.06); }
    .ag-prox-buscar:disabled { opacity:.6; cursor:default; }
    .ag-prox-list { display:flex; flex-direction:column; gap:6px; margin-top:10px; max-height:230px; overflow:hidden auto; }
    .ag-prox-item { display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:7px 9px; border:1px solid var(--borde-tenue); border-radius:9px; background:#fff; cursor:pointer; transition:background .1s, border-color .1s; }
    .ag-prox-item:hover { background:var(--primario-claro); border-color:var(--primario-medio); }
    .ag-prox-hora { font-size:13px; font-weight:700; color:var(--primario); min-width:42px; }
    .ag-prox-meta { display:flex; flex-direction:column; min-width:0; }
    .ag-prox-dia { font-size:11px; color:var(--texto-secundario); text-transform:capitalize; }
    .ag-prox-prof { font-size:12px; font-weight:600; color:var(--texto); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ag-prox-msg { font-size:12px; color:var(--texto-secundario); padding:6px 2px; }
    /* Filtro de estado de hueco (segmentado) */
    .ag-filtro-seg { display:flex; flex-direction:column; gap:5px; }
    .ag-filtro-btn { display:flex; align-items:center; gap:8px; width:100%; text-align:left; font:inherit; font-size:12.5px; font-weight:600; padding:8px 10px; border:1px solid var(--borde-tenue); border-radius:9px; background:#fff; color:var(--texto-secundario); cursor:pointer; transition:all .1s; }
    .ag-filtro-btn:hover { border-color:var(--primario-medio); }
    .ag-filtro-btn.activo { background:var(--primario-claro); border-color:var(--primario-medio); color:var(--primario); }
    .ag-filtro-dot { width:9px; height:9px; border-radius:50%; flex:none; }
    .ag-filtro-dot.libre { background:var(--exito); }
    .ag-filtro-dot.tomado { background:var(--primario); }
    .ag-filtro-dot.sobre { background:var(--advertencia); }
    .ag-filtro-dot.todos { background:linear-gradient(90deg, var(--exito) 33%, var(--primario) 33% 66%, var(--advertencia) 66%); }
    .ag-slots-vacio { font-size:12.5px; color:var(--texto-secundario); padding:14px 4px; text-align:center; }
    .ag-card { background:#fff; border:1px solid var(--borde-tenue); border-radius:14px; padding:12px; }
    .ag-minical-wrap { padding:10px 12px; flex:none; }
    .ag-cards { display:flex; flex-direction:column; gap:9px; }
    .ag-cards-vacio { font-size:12.5px; color:var(--texto-secundario); padding:8px 4px; }
    .ag-prof-card { display:flex; align-items:center; gap:11px; background:#fff; border:1px solid var(--borde-tenue); border-radius:13px; padding:11px 12px; cursor:pointer; transition:border-color .12s, box-shadow .12s, background .12s; text-align:left; }
    .ag-prof-card:hover { border-color:var(--primario-medio); box-shadow:0 4px 14px -8px rgba(83,74,183,.5); }
    .ag-prof-card.sel { border-color:var(--primario); background:linear-gradient(120deg,#F5F2FE,#FFFFFF); box-shadow:0 4px 14px -8px rgba(83,74,183,.6); }
    .ag-prof-foto { width:42px; height:42px; flex:none; border-radius:50%; object-fit:cover; }
    .ag-prof-foto-ini { background:linear-gradient(135deg,#C9BEF6,#9E8DE8); color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; }
    .ag-prof-info { min-width:0; flex:1; }
    .ag-prof-nombre { font-size:13px; font-weight:700; color:var(--texto); white-space:normal; line-height:1.2; overflow-wrap:anywhere; }
    .ag-prof-stats { display:flex; gap:6px; margin-top:5px; flex-wrap:wrap; }
    .ag-stat { display:inline-flex; align-items:center; justify-content:center; min-width:24px; font-size:11.5px; font-weight:700; border-radius:7px; padding:2px 7px; }
    .ag-stat.libres { background:var(--exito-claro); color:var(--exito); }
    .ag-stat.tomados { background:var(--primario-claro); color:var(--primario); }
    .ag-stat.sobres { background:var(--advertencia-claro); color:var(--advertencia); }
    .ag-prof-dot { width:9px; height:9px; border-radius:50%; flex:none; }

    .ag-main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; min-height:0; }
    .ag-main-empty { min-height:320px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:var(--texto-secundario); gap:12px; }
    .ag-main-empty svg { color:var(--primario); opacity:.45; }

    .ag-col-head { display:flex; align-items:center; gap:9px; margin-bottom:10px; }
    .ag-col-head .ag-prof-dot { width:11px; height:11px; }
    .ag-col-head-nombre { font-size:16px; font-weight:700; color:var(--texto); }
    .ag-col-head-fecha { font-size:12.5px; color:var(--texto-secundario); }
    .ag-slots { display:flex; flex-direction:column; gap:6px; flex:1 1 auto; min-height:0; overflow:hidden auto; }
    .ag-slot { display:flex; align-items:center; gap:9px; border-radius:10px; padding:9px 11px; border:1px solid var(--borde-tenue); }
    .ag-slot-hora { font-size:13px; font-weight:700; color:var(--texto); width:42px; flex:none; }
    /* Libre = verde */
    .ag-slot-libre { border-style:dashed; border-color:#9FD9BE; background:rgba(31,157,107,.05); cursor:pointer; transition:background .12s, border-color .12s; }
    .ag-slot-libre:hover { background:rgba(31,157,107,.13); border-style:solid; border-color:var(--exito); }
    .ag-slot-libre .ag-slot-txt { color:var(--exito); font-weight:600; font-size:13px; display:flex; align-items:center; gap:7px; flex:1; }
    /* Tomado = violeta */
    .ag-slot-tomado { background:var(--primario-claro); border-color:var(--primario-medio); border-left:3px solid var(--primario); }
    .ag-slot-pac { flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--texto); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ag-slot-acc { display:flex; gap:4px; flex:none; margin-left:auto; }
    .ag-slot-btn { width:28px; height:28px; border:none; border-radius:8px; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--texto-secundario); transition:background .1s, color .1s; }
    .ag-slot-btn.sobre:hover { background:#ececf2; color:var(--texto); }
    .ag-slot-btn.sobre.activo { background:#eef0f4; color:var(--texto); box-shadow:inset 0 0 0 1.5px #c9c9d4; }
    .ag-slot-btn.sobre.activo:hover { background:#e3e3ea; }
    .ag-slot-btn.cancel:hover { background:var(--peligro-claro); color:var(--peligro); }
    .ag-slot-btn.ver:hover { background:var(--primario-claro); color:var(--primario); }
    .ag-slot-btn.bloq:hover { background:#ececf2; color:#555; }
    .ag-slot-btn[disabled] { opacity:.3; cursor:default; }
    /* Bloqueado = "No disponible" */
    .ag-slot-bloqueado { background:#f1f1f4; }
    /* Sobreturno = sub-fila naranja, sangrada bajo su turno */
    .ag-slot-sobre { background:var(--advertencia-claro); border-color:#F1C79B; border-left:3px solid var(--advertencia); margin-left:16px; }
    .ag-sobre-ico { color:var(--advertencia); display:flex; align-items:center; width:42px; flex:none; }
    .ag-sobre-tag { font-size:10px; font-weight:700; color:var(--advertencia); background:#fff; border:1px solid #F1C79B; border-radius:8px; padding:1px 6px; margin-left:7px; }
    .ag-chip { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; background:var(--advertencia-claro); color:var(--advertencia); border:1px solid #F1C79B; border-radius:9px; padding:2px 9px; margin-left:6px; }
    .ag-sin-franja { font-size:12.5px; color:var(--texto-secundario); padding:14px 2px; }

    /* Sub-panel de alta */
    .ag-alta-hero { display:flex; align-items:center; gap:13px; background:linear-gradient(120deg,#F3F0FE,#ECE8FB); border:1px solid var(--borde-tenue); border-radius:14px; padding:14px 16px; margin-bottom:16px; }
    .ag-alta-hero-nombre { font-size:16px; font-weight:700; color:var(--texto); }
    .ag-alta-hero-sub { font-size:12.5px; color:var(--texto-secundario); margin-top:2px; }
    .ag-alta-tag { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; background:#FCEAD6; color:#8a5a17; border-radius:20px; padding:3px 10px; margin-left:8px; }
    .ag-sec-lbl { display:flex; align-items:center; gap:8px; font-size:13.5px; font-weight:600; margin-bottom:9px; }
    .ag-sec-lbl svg { color:var(--primario); }
    .ag-search { position:relative; }
    .ag-search .ag-sico { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--texto-tenue); }
    .ag-search input { width:100%; padding:11px 12px 11px 36px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13.5px; box-sizing:border-box; }
    .ag-search input:focus { border-color:var(--primario-medio); outline:none; }
    .ag-tt-res { position:absolute; left:0; right:0; top:100%; margin-top:4px; background:#fff; border:1px solid var(--borde-tenue); border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.12); z-index:30; max-height:230px; overflow-y:auto; }
    .ag-tt-item { padding:9px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--borde-tenue); }
    .ag-tt-item:last-child { border-bottom:none; }
    .ag-tt-item:hover { background:var(--fondo); }
    .ag-tt-vacio { color:var(--texto-secundario); cursor:default; }
    .ag-alta-notas { width:100%; min-height:80px; resize:vertical; padding:10px 12px; border:1px solid var(--borde-tenue); border-radius:10px; font:inherit; font-size:13px; box-sizing:border-box; margin-top:14px; }
    .ag-alta-notas:focus { border-color:var(--primario-medio); outline:none; }
    .ag-alta-acc { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
  `;
  document.head.appendChild(st);
}

// --- Apertura -------------------------------------------------
async function abrirAgendarTurnos() {
  if (!puede(usuarioActual, 'crear_turno')) return;
  _agInyectarEstilos();

  // Si ya está abierta, no duplicar (es una ventana, no un modal).
  if (document.getElementById('agendar-win')) return;

  _agModal = { fecha: new Date(), profId: null, dur: 45, abierto: true, movida: false };

  const win = document.createElement('div');
  win.id = 'agendar-win';
  win.className = 'agw-frame';
  win.innerHTML = `
    <div class="agw-head" id="agw-head">
      <div class="agw-head-left">
        <button class="agw-panel-toggle" id="ag-panel-toggle" title="Mostrar panel" onclick="agendarTogglePanel()"></button>
        <div class="agw-title">${_agIco(_AGI.cal, 17)} Dar turno</div>
      </div>
      <div class="agw-head-actions">
        <span class="agw-hint">Arrastrá para mover</span>
        <button class="agw-close" title="Cerrar" onclick="cerrarAgendarTurnos()">&times;</button>
      </div>
    </div>
    <div class="agw-body">
      <div class="ag-body">
        <div class="ag-rail-nuevo">
          <div class="ag-card">
            <div class="ag-sec-titulo">${_agIco(_AGI.reloj, 14)} Próximo disponible</div>
            <select class="ag-prox-scope" id="ag-prox-scope" onchange="agendarProxScope(this.value)"></select>
            <button class="ag-prox-buscar" id="ag-prox-buscar" onclick="agendarBuscarProximo()">${_agIco(_AGI.busca, 15)} Buscar</button>
            <div class="ag-prox-list" id="ag-prox-list"></div>
          </div>
          <div class="ag-card">
            <div class="ag-sec-titulo">${_agIco(_AGI.cal, 14)} Mostrar</div>
            <div class="ag-filtro-seg" id="ag-filtro-seg"></div>
          </div>
        </div>
        <div class="ag-rail">
          <div class="ag-card ag-minical-wrap"><div id="ag-minical"></div></div>
          <div id="ag-cards" class="ag-cards"></div>
        </div>
        <div id="ag-main" class="ag-main"></div>
      </div>
    </div>`;
  document.body.appendChild(win);
  _agPanelOculto = true;     // arranca oculto (decisión del usuario)
  _agAplicarPanel();
  _agCentrarVentana();
  // La transición se activa después de posicionar, así abrir no "desliza".
  setTimeout(() => document.getElementById('agendar-win')?.classList.add('agw-anim'), 80);
  _agHabilitarArrastre();

  // cache de pacientes para el typeahead (una vez por apertura)
  const { data: pac } = await sb.from('pacientes').select('id, nombre, apellido, dni').order('apellido').order('nombre');
  _agTtPacientes = pac || [];

  agendarMiniCal();
  agendarRenderFiltro();
  await agendarInitProx();
  await agendarCargarDia();
}

function cerrarAgendarTurnos() {
  _agModal.abierto = false;
  document.getElementById('agendar-win')?.remove();
}

// Oculta/muestra el riel izquierdo (flechita de la barra de título).
function agendarTogglePanel() {
  _agPanelOculto = !_agPanelOculto;
  _agAplicarPanel();
}

function _agAplicarPanel() {
  const win = document.getElementById('agendar-win');
  if (!win) return;
  // Mantenemos el borde derecho fijo: el panel crece/colapsa hacia la IZQUIERDA
  // (de 0 a 200px) en sincronía con el ancho de la ventana, así el calendario y
  // los horarios no se mueven. 606 = 820 - (200 panel + 14 separación).
  const r = win.getBoundingClientRect();
  const derecha = r.left + r.width;
  win.classList.toggle('ag-sin-panel', _agPanelOculto);
  const nuevoAncho = _agPanelOculto ? 606 : 820;
  win.style.left = Math.max(8, Math.round(derecha - nuevoAncho)) + 'px';
  win.style.right = 'auto';
  const btn = document.getElementById('ag-panel-toggle');
  if (btn) {
    btn.innerHTML = _agIco(_agPanelOculto ? _AGI.flechaDer : _AGI.flecha, 18);
    btn.title = _agPanelOculto ? 'Mostrar panel' : 'Ocultar panel';
  }
}

// Arrastre de la ventana flotante (desktop). Los listeners de movimiento se
// agregan al apretar y se sueltan al soltar, así no quedan colgados.
// Centra la ventana al abrir. Si es muy alta, la deja pegada arriba (margen 24).
function _agCentrarVentana() {
  const win = document.getElementById('agendar-win');
  if (!win || _agModal.movida) return;
  requestAnimationFrame(() => {
    if (_agModal.movida) return;
    const r = win.getBoundingClientRect();
    const left = Math.max(16, Math.round((window.innerWidth - r.width) / 2));
    const top = Math.max(24, Math.round((window.innerHeight - r.height) / 2));
    win.style.left = left + 'px';
    win.style.top = top + 'px';
    win.style.right = 'auto';
  });
}

function _agHabilitarArrastre() {
  const win = document.getElementById('agendar-win');
  const head = document.getElementById('agw-head');
  if (!win || !head) return;
  head.addEventListener('mousedown', (e) => {
    if (e.target.closest('.agw-close, .agw-panel-toggle')) return;
    _agModal.movida = true;   // a partir de acá no se auto-centra
    const r = win.getBoundingClientRect();
    win.style.left = r.left + 'px';
    win.style.top = r.top + 'px';
    win.style.right = 'auto';
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    document.body.style.userSelect = 'none';
    const mover = (ev) => {
      const w = win.offsetWidth;
      let x = Math.max(8, Math.min(ev.clientX - ox, window.innerWidth - w - 8));
      let y = Math.max(8, Math.min(ev.clientY - oy, window.innerHeight - 44));
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    };
    const soltar = () => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    e.preventDefault();
  });
}

// --- Mini calendario propio del modal -------------------------
function agendarMiniCal() {
  const cont = document.getElementById('ag-minical');
  if (!cont) return;
  const fecha = new Date(_agModal.fecha);
  const anio = fecha.getFullYear(), mes = fecha.getMonth();
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const primerDia = new Date(anio, mes, 1);
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  let pds = primerDia.getDay(); pds = pds === 0 ? 6 : pds - 1;
  const nombreMes = primerDia.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <button class="btn-icon" style="width:24px; height:24px; font-size:11px;" onclick="agendarCambiarMes(-1)">&lsaquo;</button>
      <div style="font-size:12px; font-weight:600; text-transform:capitalize;">${nombreMes}</div>
      <button class="btn-icon" style="width:24px; height:24px; font-size:11px;" onclick="agendarCambiarMes(1)">&rsaquo;</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center; font-size:10px;">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div style="color:var(--texto-tenue); padding:4px 0;">${d}</div>`).join('')}`;
  for (let i = 0; i < pds; i++) html += '<div></div>';
  for (let d = 1; d <= diasMes; d++) {
    const fd = new Date(anio, mes, d);
    const esHoy = fd.getTime() === hoy.getTime();
    const esSel = fd.toDateString() === _agModal.fecha.toDateString();
    let s = 'padding:5px 0; font-size:11px; border-radius:4px; cursor:pointer;';
    if (esSel) s += 'background:var(--primario); color:#fff; font-weight:600;';
    else if (esHoy) s += 'background:var(--primario-claro); color:var(--primario); font-weight:600;';
    else s += 'color:var(--texto);';
    html += `<div style="${s}" onclick="agendarSelFecha(${anio},${mes},${d})">${d}</div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
}

function agendarCambiarMes(dir) {
  const f = new Date(_agModal.fecha);
  f.setMonth(f.getMonth() + dir);
  _agModal.fecha = f;
  agendarMiniCal();
}

function agendarSelFecha(anio, mes, dia) {
  _agModal.fecha = new Date(anio, mes, dia);
  _agModal.profId = null;
  agendarMiniCal();
  agendarCargarDia();
}

// --- Carga del día: profesionales que atienden + stats --------
async function agendarCargarDia() {
  const cards = document.getElementById('ag-cards');
  const main = document.getElementById('ag-main');
  if (!cards || !main) return;
  cards.innerHTML = `<div class="ag-cards-vacio">Cargando…</div>`;
  main.innerHTML = `<div class="ag-main-empty">${_agIco(_AGI.reloj, 40)}<div>Cargando agenda…</div></div>`;

  const fecha = new Date(_agModal.fecha);
  const fechaStr = agendaFechaStr(fecha);

  // Duración del negocio (paso de la grilla)
  const { data: conf } = await sb.from('configuracion')
    .select('duracion_turno_minutos').eq('negocio_id', usuarioActual.negocio_id).maybeSingle();
  _agModal.dur = parseInt(conf?.duracion_turno_minutos) || 45;

  // Feriado del negocio → cerrado
  const { data: fer } = await sb.from('feriados')
    .select('descripcion').eq('negocio_id', usuarioActual.negocio_id).eq('fecha', fechaStr);
  if (fer && fer.length) { _agDiaCerrado(fer[0].descripcion || 'Feriado'); return; }

  // Día no laboral del negocio
  const { data: diasLab } = await sb.from('dias_laborales')
    .select('dia_semana, activo').eq('negocio_id', usuarioActual.negocio_id);
  const hayConfig = diasLab && diasLab.some(d => d.activo);
  const diaActivo = diasLab && diasLab.some(d => d.dia_semana === fecha.getDay() && d.activo);
  if (hayConfig && !diaActivo) { _agDiaCerrado('El negocio no atiende este día'); return; }

  // Profesionales activos + franjas del día
  const { data: profes } = await sb.from('profesionales')
    .select('id, nombre, color, foto_url, activo').eq('activo', true).order('nombre');
  const lista = profes || [];
  const ids = lista.map(p => p.id);
  const mapaFr = ids.length ? await mapaFranjasProfes(ids, fecha) : {};

  // Turnos del día (todos) + bloqueos
  const di = new Date(fecha); di.setHours(0, 0, 0, 0);
  const df = new Date(fecha); df.setHours(23, 59, 59, 999);
  const { data: turnos } = await sb.from('turnos')
    .select('id, profesional_id, paciente_id, fecha_hora, duracion_minutos, estado, es_sobreturno, pacientes(nombre, apellido)')
    .gte('fecha_hora', di.toISOString()).lte('fecha_hora', df.toISOString()).order('fecha_hora');
  const { data: bloqueos } = await sb.from('bloqueos_agenda').select('id, profesional_id, hora_min').eq('fecha', fechaStr);

  _agTurnosProf = {}; _agFranjasProf = {}; _agBloqueosProf = {};
  (turnos || []).forEach(t => (_agTurnosProf[t.profesional_id] = _agTurnosProf[t.profesional_id] || []).push(t));
  ids.forEach(id => { _agFranjasProf[id] = mapaFr[id] || []; });
  ids.forEach(id => { _agBloqueosProf[id] = new Map(); });
  (bloqueos || []).forEach(b => { (_agBloqueosProf[b.profesional_id] = _agBloqueosProf[b.profesional_id] || new Map()).set(b.hora_min, b.id); });

  // Solo los que atienden ese día (franja > 0)
  _agProfes = lista
    .filter(p => (_agFranjasProf[p.id] || []).length > 0)
    .map(p => {
      const c = _agComputarSlots(p.id);
      return { ...p, libres: c.libres, tomados: c.tomados, sobres: c.sobres };
    });

  // Render tarjetas
  if (_agProfes.length === 0) {
    cards.innerHTML = `<div class="ag-cards-vacio">Ningún profesional atiende este día.</div>`;
    main.innerHTML = `<div class="ag-main-empty">${_agIco(_AGI.cal, 40)}<div>No hay profesionales disponibles<br>en la fecha elegida.</div></div>`;
    return;
  }
  // Si no hay un profesional válido elegido, seleccionamos el primero automáticamente.
  if (!_agModal.profId || !_agProfes.some(p => p.id === _agModal.profId)) {
    _agModal.profId = _agProfes[0].id;
  }
  cards.innerHTML = _agProfes.map(p => _agCardProfHTML(p)).join('');
  agendarRenderColumna();
}

function _agDiaCerrado(txt) {
  const cards = document.getElementById('ag-cards');
  const main = document.getElementById('ag-main');
  if (cards) cards.innerHTML = `<div class="ag-cards-vacio">Día cerrado.</div>`;
  if (main) main.innerHTML = `<div class="ag-main-empty">${_agIco(_AGI.cal, 40)}<div style="font-weight:600; color:var(--texto);">${txt}</div><div>No se dan turnos en esta fecha.</div></div>`;
  _agProfes = [];
}

// Calcula slots libres / tomados / sobreturnos para un profesional ese día
function _agComputarSlots(profId) {
  const franjas = _agFranjasProf[profId] || [];
  const turnos = _agTurnosProf[profId] || [];
  const bloq = _agBloqueosProf[profId] || new Map();
  const slot = _agModal.dur;
  const normales = turnos.filter(t => !t.es_sobreturno);
  const sobres = turnos.filter(t => t.es_sobreturno && t.estado !== 'cancelado');

  const slots = [];
  let libres = 0;
  franjas.forEach(fr => {
    for (let t = fr.ini; t + slot <= fr.fin; t += slot) {
      if (bloq.has(t)) { slots.push({ min: t, estado: 'bloq', bloqueoId: bloq.get(t) }); continue; }
      if (haySolapamiento(t, t + slot, normales)) continue; // ocupado: la tarjeta del turno se dibuja aparte
      slots.push({ min: t, estado: 'libre' });
      libres++;
    }
  });
  const tomados = normales.filter(t => ['agendado', 'llego', 'en_atencion', 'finalizado'].includes(t.estado)).length;
  return { slots, libres, tomados, sobres: sobres.length, franjas };
}

function _agCardProfHTML(p) {
  const ini = (p.nombre || 'P').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'P';
  const foto = p.foto_url
    ? `<img src="${p.foto_url}" alt="" class="ag-prof-foto">`
    : `<div class="ag-prof-foto ag-prof-foto-ini">${ini}</div>`;
  const sel = _agModal.profId === p.id ? ' sel' : '';
  return `
    <button class="ag-prof-card${sel}" onclick="agendarSelProf('${p.id}')">
      ${foto}
      <div class="ag-prof-info">
        <div class="ag-prof-nombre">${p.nombre}</div>
        <div class="ag-prof-stats">
          <span class="ag-stat libres" title="Libres">${p.libres}</span>
          <span class="ag-stat tomados" title="Tomados">${p.tomados}</span>
          <span class="ag-stat sobres" title="Sobreturnos">${p.sobres}</span>
        </div>
      </div>
    </button>`;
}

function agendarSelProf(profId) {
  _agModal.profId = profId;
  // refrescar resaltado de tarjetas
  const cards = document.getElementById('ag-cards');
  if (cards) cards.innerHTML = _agProfes.map(p => _agCardProfHTML(p)).join('');
  agendarRenderColumna();
}

// === Riel izquierdo: filtro "Mostrar" =========================
function agendarRenderFiltro() {
  const cont = document.getElementById('ag-filtro-seg');
  if (!cont) return;
  const ops = [
    { k: 'todos', txt: 'Todos', dot: 'todos' },
    { k: 'libre', txt: 'Libres', dot: 'libre' },
    { k: 'tomado', txt: 'Con turno', dot: 'tomado' },
    { k: 'sobre', txt: 'Sobreturnos', dot: 'sobre' }
  ];
  cont.innerHTML = ops.map(o => `
    <button class="ag-filtro-btn${_agFiltro.estado === o.k ? ' activo' : ''}" onclick="agendarSetFiltro('${o.k}')">
      <span class="ag-filtro-dot ${o.dot}"></span>${o.txt}
    </button>`).join('');
}

function agendarSetFiltro(estado) {
  _agFiltro.estado = estado;
  agendarRenderFiltro();
  agendarRenderColumna();
}

// === Riel izquierdo: "Próximo disponible" =====================
// Llena el selector de alcance con los profesionales activos.
async function agendarInitProx() {
  const { data: profes } = await sb.from('profesionales')
    .select('id, nombre').eq('activo', true).order('nombre');
  _agProxProfes = profes || [];
  const sel = document.getElementById('ag-prox-scope');
  if (sel) {
    sel.innerHTML = `<option value="todos">Cualquier profesional</option>` +
      _agProxProfes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    sel.value = _agProx.scope;
  }
}

function agendarProxScope(v) { _agProx.scope = v; }

// 'YYYY-MM-DD' -> Date local (mediodía, evita corrimientos de zona horaria)
function _proxFecha(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

// Busca los primeros huecos libres en los próximos días para el alcance elegido.
async function agendarBuscarProximo() {
  const btn = document.getElementById('ag-prox-buscar');
  const list = document.getElementById('ag-prox-list');
  if (!list || _agProx.cargando) return;
  _agProx.cargando = true;
  if (btn) btn.disabled = true;
  list.innerHTML = `<div class="ag-prox-msg">Buscando…</div>`;

  const DIAS = 21;            // ventana de búsqueda
  const TOPE = 12;            // máximo de resultados
  const slot = _agModal.dur || 45;
  const negId = usuarioActual.negocio_id;

  const scopeProfes = _agProx.scope === 'todos'
    ? _agProxProfes
    : _agProxProfes.filter(p => p.id === _agProx.scope);
  const profIds = scopeProfes.map(p => p.id);
  const nombrePorId = {};
  scopeProfes.forEach(p => { nombrePorId[p.id] = p.nombre; });

  const cerrar = () => { _agProx.cargando = false; if (btn) btn.disabled = false; };
  if (profIds.length === 0) { list.innerHTML = `<div class="ag-prox-msg">Sin profesionales.</div>`; cerrar(); return; }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(hoy); fin.setDate(fin.getDate() + DIAS - 1); fin.setHours(23, 59, 59, 999);
  const hoyStr = agendaFechaStr(hoy);
  const finStr = agendaFechaStr(fin);
  const ahoraMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();

  // Lecturas en bloque para toda la ventana (pocas consultas).
  const [fersR, diasLabNegR, labProfR, espProfR, turnosR, bloqsR] = await Promise.all([
    sb.from('feriados').select('fecha').eq('negocio_id', negId).gte('fecha', hoyStr).lte('fecha', finStr),
    sb.from('dias_laborales').select('dia_semana, activo').eq('negocio_id', negId),
    sb.from('dias_laborales_profesional').select('profesional_id, dia_semana, hora_inicio, hora_fin').in('profesional_id', profIds),
    sb.from('dias_especiales_profesional').select('profesional_id, fecha, no_viene, hora_inicio, hora_fin').in('profesional_id', profIds).gte('fecha', hoyStr).lte('fecha', finStr),
    sb.from('turnos').select('profesional_id, fecha_hora, duracion_minutos, estado, es_sobreturno').gte('fecha_hora', hoy.toISOString()).lte('fecha_hora', fin.toISOString()).neq('estado', 'cancelado'),
    sb.from('bloqueos_agenda').select('profesional_id, fecha, hora_min').gte('fecha', hoyStr).lte('fecha', finStr)
  ]);

  const feriadoSet = new Set((fersR.data || []).map(f => f.fecha));
  const negConfig = (diasLabNegR.data || []).some(d => d.activo);
  const negActivo = (dow) => !negConfig || (diasLabNegR.data || []).some(d => d.dia_semana === dow && d.activo);

  const limpia = (arr) => (arr || []).map(x => ({ ini: parseHoraMin(x.hora_inicio), fin: parseHoraMin(x.hora_fin) }))
    .filter(f => f.ini != null && f.fin != null && f.fin > f.ini);
  const labMap = {};
  (labProfR.data || []).forEach(l => { (labMap[l.profesional_id + '|' + l.dia_semana] = labMap[l.profesional_id + '|' + l.dia_semana] || []).push(l); });
  const espMap = {};
  (espProfR.data || []).forEach(e => { (espMap[e.profesional_id + '|' + e.fecha] = espMap[e.profesional_id + '|' + e.fecha] || []).push(e); });
  const turnoMap = {};
  (turnosR.data || []).forEach(t => { if (t.es_sobreturno) return; const fs = agendaFechaStr(new Date(t.fecha_hora)); (turnoMap[t.profesional_id + '|' + fs] = turnoMap[t.profesional_id + '|' + fs] || []).push(t); });
  const bloqMap = {};
  (bloqsR.data || []).forEach(b => { const k = b.profesional_id + '|' + b.fecha; (bloqMap[k] = bloqMap[k] || new Set()).add(b.hora_min); });

  const franjasDe = (profId, fechaStr, dow) => {
    const esp = espMap[profId + '|' + fechaStr] || [];
    if (esp.some(e => e.no_viene)) return [];
    const espH = esp.filter(e => !e.no_viene && e.hora_inicio && e.hora_fin);
    if (espH.length) return limpia(espH);
    return limpia(labMap[profId + '|' + dow] || []);
  };

  const resultados = [];
  for (let i = 0; i < DIAS && resultados.length < TOPE * 3; i++) {
    const d = new Date(hoy); d.setDate(d.getDate() + i);
    const fechaStr = agendaFechaStr(d);
    const dow = d.getDay();
    if (feriadoSet.has(fechaStr) || !negActivo(dow)) continue;
    const esHoy = (i === 0);
    profIds.forEach(pid => {
      const franjas = franjasDe(pid, fechaStr, dow);
      if (!franjas.length) return;
      const ocup = turnoMap[pid + '|' + fechaStr] || [];
      const bset = bloqMap[pid + '|' + fechaStr] || new Set();
      franjas.forEach(fr => {
        for (let m = fr.ini; m + slot <= fr.fin; m += slot) {
          if (esHoy && m <= ahoraMin) continue;       // no ofrecer horas pasadas de hoy
          if (bset.has(m)) continue;
          if (haySolapamiento(m, m + slot, ocup)) continue;
          resultados.push({ fechaStr, fecha: d, min: m, profId: pid, prof: nombrePorId[pid] });
        }
      });
    });
  }

  resultados.sort((a, b) => (a.fechaStr < b.fechaStr ? -1 : a.fechaStr > b.fechaStr ? 1 : a.min - b.min));
  const top = resultados.slice(0, TOPE);

  if (top.length === 0) {
    list.innerHTML = `<div class="ag-prox-msg">No se encontraron huecos en los próximos ${DIAS} días.</div>`;
  } else {
    list.innerHTML = top.map(r => {
      const dia = r.fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
      return `
        <button class="ag-prox-item" onclick="agendarIrAProximo('${r.fechaStr}','${r.profId}',${r.min})">
          <span class="ag-prox-hora">${minToHora(r.min)}</span>
          <span class="ag-prox-meta">
            <span class="ag-prox-dia">${dia}</span>
            <span class="ag-prox-prof">${r.prof}</span>
          </span>
        </button>`;
    }).join('');
  }
  cerrar();
}

// Salta al día/profesional del hueco elegido y abre el alta en ese horario.
async function agendarIrAProximo(fechaStr, profId, min) {
  _agModal.fecha = _proxFecha(fechaStr);
  _agModal.profId = profId;
  _agFiltro.estado = 'todos';
  agendarRenderFiltro();
  agendarMiniCal();
  await agendarCargarDia();
  agendarClickHueco(min, false);
}

// --- Columna de UN profesional --------------------------------
function agendarRenderColumna() {
  const main = document.getElementById('ag-main');
  if (!main) return;
  const prof = _agProfes.find(p => p.id === _agModal.profId);
  if (!prof) return;

  const { slots, franjas } = _agComputarSlots(_agModal.profId);
  const turnos = _agTurnosProf[_agModal.profId] || [];
  const normales = turnos.filter(t => !t.es_sobreturno && t.estado !== 'cancelado');
  const sobres = turnos.filter(t => t.es_sobreturno && t.estado !== 'cancelado');
  const sobrePorMin = {};
  sobres.forEach(s => { const m = turnoMinInicio(s); (sobrePorMin[m] = sobrePorMin[m] || []).push(s); });

  let fechaLinda = new Date(_agModal.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  fechaLinda = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);

  // Unimos slots libres + turnos tomados en una sola lista ordenada por minuto
  const filas = [];
  slots.forEach(s => { if (s.estado === 'libre') filas.push({ min: s.min, tipo: 'libre' }); else if (s.estado === 'bloq') filas.push({ min: s.min, tipo: 'bloq', bloqueoId: s.bloqueoId }); });
  normales.forEach(t => filas.push({ min: turnoMinInicio(t), tipo: 'tomado', turno: t }));
  filas.sort((a, b) => a.min - b.min || (a.tipo === 'tomado' ? -1 : 1));

  // Filtro "Mostrar" (riel izquierdo): todos | libre | tomado | sobre
  const fEstado = _agFiltro.estado;
  const forzarSobre = (fEstado === 'sobre');
  let filasVis = filas;
  if (fEstado === 'libre') filasVis = filas.filter(f => f.tipo === 'libre');
  else if (fEstado === 'tomado') filasVis = filas.filter(f => f.tipo === 'tomado');
  else if (fEstado === 'sobre') filasVis = filas.filter(f => f.tipo === 'tomado' && (sobrePorMin[f.min] || []).length);

  let cuerpo = '';
  if (franjas.length === 0) {
    cuerpo = `<div class="ag-sin-franja">Este profesional no tiene horario cargado para esta fecha.</div>`;
  } else if (filasVis.length === 0) {
    const vacioMsg = fEstado === 'libre' ? 'No quedan horarios libres.'
      : fEstado === 'tomado' ? 'No hay turnos tomados.'
      : fEstado === 'sobre' ? 'No hay sobreturnos.'
      : 'Sin horarios disponibles.';
    cuerpo = `<div class="ag-slots-vacio">${vacioMsg}</div>`;
  } else {
    cuerpo = filasVis.map(f => {
      const hora = minToHora(f.min);
      if (f.tipo === 'libre') {
        return `
          <div class="ag-slot ag-slot-libre" onclick="agendarClickHueco(${f.min}, false)">
            <span class="ag-slot-hora">${hora}</span>
            <span class="ag-slot-txt">${_agIco(_AGI.mas, 16)} Dar turno</span>
            <span class="ag-slot-acc">
              <button class="ag-slot-btn bloq" title="Bloquear este horario" onclick="event.stopPropagation(); agendarBloquear(${f.min})">${_agIco(_AGI.ban, 15)}</button>
            </span>
          </div>`;
      }
      if (f.tipo === 'bloq') {
        return `
          <div class="ag-slot ag-slot-bloqueado">
            <span class="ag-slot-hora" style="color:#999;">${hora}</span>
            <span class="ag-slot-pac" style="font-weight:500; color:#888;">No disponible</span>
            <span class="ag-slot-acc">
              ${f.bloqueoId ? `<button class="ag-slot-btn ver" title="Liberar horario" onclick="agendarDesbloquear('${f.bloqueoId}')">${_agIco(_AGI.x, 15)}</button>` : ''}
            </span>
          </div>`;
      }
      // tomado
      const t = f.turno;
      const pac = t.pacientes ? `${t.pacientes.apellido}, ${(t.pacientes.nombre || '').split(' ')[0]}` : 'Paciente';
      const sobreDeEste = sobrePorMin[f.min] || [];
      const tieneSobre = sobreDeEste.length >= 1;
      const puedeCancelar = ['agendado'].includes(t.estado);
      const ojoMain = t.paciente_id
        ? `<button class="ag-slot-btn ver" title="Vista rápida del paciente" onclick="verFichaPaciente('${t.paciente_id}')">${_agIco(_AGI.ojo, 15)}</button>` : '';
      // ⚡: si ya hay sobreturno, se resalta y al clickearlo despliega; si no, da sobreturno.
      const btnRayo = tieneSobre
        ? `<button class="ag-slot-btn sobre activo" title="Ver sobreturno" onclick="agendarToggleSobre('${t.id}')">${_agIco(_AGI.rayo, 15)}</button>`
        : `<button class="ag-slot-btn sobre" title="Dar sobreturno" onclick="agendarClickHueco(${f.min}, true)">${_agIco(_AGI.rayo, 15)}</button>`;
      let html = `
        <div class="ag-slot ag-slot-tomado">
          <span class="ag-slot-hora">${hora}</span>
          <span class="ag-slot-pac">${pac}</span>
          <span class="ag-slot-acc">
            ${ojoMain}
            ${btnRayo}
            <button class="ag-slot-btn cancel" title="${puedeCancelar ? 'Cancelar turno' : 'Solo se cancelan turnos agendados'}" ${puedeCancelar ? '' : 'disabled'} onclick="agendarCancelarTurno('${t.id}')">${_agIco(_AGI.x, 15)}</button>
          </span>
        </div>`;
      // Sobreturno(s): ocultos hasta clickear el rayo.
      if (tieneSobre) {
        html += `<div class="ag-sobre-wrap" id="ag-sobre-${t.id}" style="display:${forzarSobre ? '' : 'none'};">`;
        sobreDeEste.forEach(s => {
          const sp = s.pacientes ? `${s.pacientes.apellido}, ${(s.pacientes.nombre || '').split(' ')[0]}` : 'Sobreturno';
          const ojoS = s.paciente_id
            ? `<button class="ag-slot-btn ver" title="Vista rápida del paciente" onclick="verFichaPaciente('${s.paciente_id}')">${_agIco(_AGI.ojo, 14)}</button>` : '';
          html += `
            <div class="ag-slot ag-slot-sobre">
              <span class="ag-slot-hora ag-sobre-ico">${_agIco(_AGI.rayo, 14)}</span>
              <span class="ag-slot-pac">${sp}<span class="ag-sobre-tag">sobreturno</span></span>
              <span class="ag-slot-acc">
                ${ojoS}
                <button class="ag-slot-btn cancel" title="Eliminar sobreturno" onclick="agendarCancelarTurno('${s.id}')">${_agIco(_AGI.x, 14)}</button>
              </span>
            </div>`;
        });
        html += `</div>`;
      }
      return html;
    }).join('');
  }

  main.innerHTML = `
    <div class="ag-col-head">
      <span class="ag-prof-dot" style="background:${prof.color || 'var(--primario)'};"></span>
      <div>
        <div class="ag-col-head-nombre">${prof.nombre}</div>
        <div class="ag-col-head-fecha">${fechaLinda}</div>
      </div>
    </div>
    <div class="ag-slots">${cuerpo}</div>`;
}

// --- Sub-panel de alta (paciente + confirmar) -----------------
function agendarClickHueco(min, esSobre) {
  const main = document.getElementById('ag-main');
  const prof = _agProfes.find(p => p.id === _agModal.profId);
  if (!main || !prof) return;

  const hora = minToHora(min);
  const horaFin = minToHora(min + _agModal.dur);
  let fechaLinda = new Date(_agModal.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  fechaLinda = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);
  const ini = (prof.nombre || 'P').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'P';
  const foto = prof.foto_url
    ? `<img src="${prof.foto_url}" alt="" class="ag-prof-foto">`
    : `<div class="ag-prof-foto ag-prof-foto-ini">${ini}</div>`;
  const tag = esSobre ? `<span class="ag-alta-tag">${_agIco(_AGI.rayo, 12)} Sobreturno</span>` : '';

  main.innerHTML = `
    <div class="ag-alta-hero">
      ${foto}
      <div>
        <div class="ag-alta-hero-nombre">${prof.nombre}${tag}</div>
        <div class="ag-alta-hero-sub">${fechaLinda} · ${hora}–${horaFin} hs · ${_agModal.dur} min</div>
      </div>
    </div>
    <div class="ag-sec-lbl">${_agIco(_AGI.user)} Paciente</div>
    <div class="ag-search">
      <span class="ag-sico">${_agIco(_AGI.busca, 16)}</span>
      <input type="text" id="ag-tt-input" autocomplete="off" placeholder="Buscar por apellido, nombre o DNI…" oninput="agendarTtFiltrar(this.value)">
      <input type="hidden" id="ag-tt-id" value="">
      <div id="ag-tt-res" class="ag-tt-res" style="display:none;"></div>
    </div>
    <textarea id="ag-alta-notas" class="ag-alta-notas" maxlength="200" placeholder="Notas de la cita (opcional)…"></textarea>
    <div class="ag-alta-acc">
      <button class="btn" onclick="agendarRenderColumna()">Volver</button>
      <button class="btn btn-primary-sm" style="display:inline-flex; align-items:center; gap:8px;" onclick="agendarConfirmar(${min}, ${esSobre ? 'true' : 'false'})">${_agIco(_AGI.check, 16)} ${esSobre ? 'Crear sobreturno' : 'Crear turno'}</button>
    </div>`;
  setTimeout(() => document.getElementById('ag-tt-input')?.focus(), 30);
}

function agendarTtFiltrar(q) {
  const cont = document.getElementById('ag-tt-res');
  const hidden = document.getElementById('ag-tt-id');
  if (hidden) hidden.value = '';
  if (!cont) return;
  const term = (q || '').toLowerCase().trim();
  if (!term) { cont.style.display = 'none'; cont.innerHTML = ''; return; }
  const res = _agTtPacientes.filter(p => `${p.apellido} ${p.nombre} ${p.dni || ''}`.toLowerCase().includes(term)).slice(0, 8);
  cont.innerHTML = res.length === 0
    ? `<div class="ag-tt-item ag-tt-vacio">Sin resultados</div>`
    : res.map(p => `<div class="ag-tt-item" onclick="agendarTtElegir('${p.id}')"><strong>${p.apellido}, ${p.nombre}</strong>${p.dni ? `<span style="color:var(--texto-secundario);"> · ${p.dni}</span>` : ''}</div>`).join('');
  cont.style.display = 'block';
}

function agendarTtElegir(id) {
  const p = _agTtPacientes.find(x => x.id === id);
  if (!p) return;
  const input = document.getElementById('ag-tt-input');
  const hidden = document.getElementById('ag-tt-id');
  const cont = document.getElementById('ag-tt-res');
  if (input) input.value = `${p.apellido}, ${p.nombre}`;
  if (hidden) hidden.value = id;
  if (cont) { cont.style.display = 'none'; cont.innerHTML = ''; }
}

// --- Crear turno / sobreturno (validación propia + insert) ----
async function agendarConfirmar(min, esSobre) {
  const profId = _agModal.profId;
  const pacienteId = document.getElementById('ag-tt-id')?.value || '';
  const notas = (document.getElementById('ag-alta-notas')?.value || '').trim() || null;
  if (!profId) return;
  if (!pacienteId) { mostrarMensaje('Elegí un paciente de la lista.', 'advertencia'); return; }

  const fecha = new Date(_agModal.fecha);
  const fechaStr = agendaFechaStr(fecha);
  const dur = _agModal.dur;
  const ini = min, fin = min + dur;

  // 1) Entra en la franja del profesional
  const franjas = _agFranjasProf[profId] || [];
  if (!franjas.some(f => ini >= f.ini && fin <= f.fin)) {
    mostrarMensaje('El turno no entra en el horario del profesional.', 'error'); return;
  }
  // 2) Solapamiento (sobreturno puede superponerse)
  const normales = (_agTurnosProf[profId] || []).filter(t => !t.es_sobreturno);
  if (!esSobre && haySolapamiento(ini, fin, normales)) {
    mostrarMensaje('Se superpone con otro turno de ese profesional.', 'error'); return;
  }
  const fechaHora = new Date(`${fechaStr}T${minToHora(min)}:00`);
  // 3) Un solo sobreturno por horario
  if (esSobre) {
    const { count } = await sb.from('turnos').select('id', { count: 'exact', head: true })
      .eq('profesional_id', profId).eq('fecha_hora', fechaHora.toISOString()).eq('es_sobreturno', true);
    if ((count || 0) >= 1) { mostrarMensaje('Ya hay un sobreturno en ese horario.', 'advertencia'); return; }
  }

  const { error } = await sb.from('turnos').insert({
    negocio_id: usuarioActual.negocio_id,
    paciente_id: pacienteId,
    profesional_id: profId,
    fecha_hora: fechaHora.toISOString(),
    duracion_minutos: dur,
    estado: 'agendado',
    es_sobreturno: !!esSobre,
    notas: notas,
    creado_por: usuarioActual.id
  });
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

  mostrarMensaje(esSobre ? 'Sobreturno creado' : 'Turno creado', 'exito');
  await agendarCargarDia();   // recalcula stats + columna
  _agSyncPanel(fechaStr);     // si el panel muestra esta fecha, lo refresca
}

async function agendarCancelarTurno(turnoId) {
  if (!await confirmarModal({ titulo: 'Cancelar turno', texto: '¿Cancelar este turno?', textoSi: 'Cancelar turno', textoNo: 'Volver', peligro: true })) return;
  const { error } = await sb.from('turnos').update({ estado: 'cancelado' }).eq('id', turnoId);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Turno cancelado', 'exito');
  const fechaStr = agendaFechaStr(new Date(_agModal.fecha));
  await agendarCargarDia();
  _agSyncPanel(fechaStr);
}

// Mini-modal: al quitar un turno desde la agenda, el usuario elige entre
// cancelar (marca cancelado, avisa al paciente, queda en su historial) o
// eliminar (borra sin avisar, para turnos cargados por error).
function quitarTurno(turnoId) {
  const ICO_AZUL = '#6D5BD0';
  const svgCal = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ICO_AZUL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m17 16-4 4"/><path d="m13 16 4 4"/></svg>`;
  const svgMail = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${ICO_AZUL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  const svgTacho = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${ICO_AZUL}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  const svgMailW = svgMail.replace(ICO_AZUL, '#ffffff').replace('width="20" height="20"', 'width="16" height="16"');
  const svgTachoR = svgTacho.replace(ICO_AZUL, '#e5484d').replace('width="20" height="20"', 'width="16" height="16"');
  const svgFlecha = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4f5b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;

  const fila = (icono, titulo, desc, borde) => `
    <div style="display:flex; align-items:flex-start; gap:14px; padding:16px 0;${borde ? ' border-bottom:1px solid #e9e9f0;' : ''}">
      <div style="flex:none; width:42px; height:42px; border-radius:50%; background:#ede9fb; display:flex; align-items:center; justify-content:center;">${icono}</div>
      <div>
        <div style="font-weight:700; color:#1f2330; margin-bottom:3px;">${titulo}</div>
        <div style="font-size:13px; color:#8a90a2; line-height:1.5;">${desc}</div>
      </div>
    </div>`;

  const btnBase = 'display:inline-flex; align-items:center; justify-content:center; gap:8px; font-size:14px; font-weight:600; padding:11px 18px; border-radius:10px; cursor:pointer;';

  abrirModal(`
    <div style="padding:24px;">
      <div style="display:flex; align-items:flex-start; gap:16px;">
        <div style="flex:none; width:52px; height:52px; border-radius:50%; background:#ede9fb; display:flex; align-items:center; justify-content:center;">${svgCal}</div>
        <div style="flex:1;">
          <div style="font-size:21px; font-weight:700; color:#1f2330;">Quitar turno</div>
          <div style="font-size:14px; color:#8a90a2; margin-top:3px;">¿Qué querés hacer con este turno?</div>
        </div>
        <button onclick="cerrarModal()" style="flex:none; background:none; border:none; cursor:pointer; color:#9aa0b0; font-size:24px; line-height:1; padding:0;">&times;</button>
      </div>

      <div style="margin:20px 0; background:#f6f6fa; border-radius:14px; padding:2px 18px;">
        ${fila(svgMail, 'Cancelar turno', 'Se marca como cancelado, se notifica al paciente por email y queda registrado en su historial.', true)}
        ${fila(svgTacho, 'Eliminar sin avisar', 'Se elimina por completo sin enviar notificación. Usalo solo si lo cargaste por error.', false)}
      </div>

      <div style="display:flex; gap:10px; align-items:center;">
        <button onclick="cerrarModal()" style="${btnBase} background:#fff; color:#3a3f4b; border:1px solid #e2e2ea;">${svgFlecha} Volver</button>
        <button onclick="_quitarTurnoAccion('${turnoId}','eliminar')" style="${btnBase} background:#fff; color:#e5484d; border:1px solid #f1c4c6;">${svgTachoR} Eliminar sin avisar</button>
        <button onclick="_quitarTurnoAccion('${turnoId}','cancelar')" style="${btnBase} flex:1; background:#6D5BD0; color:#fff; border:1px solid #6D5BD0;">${svgMailW} Cancelar turno</button>
      </div>
    </div>
  `);
}

async function _quitarTurnoAccion(turnoId, modo) {
  if (modo === 'cancelar') {
    const res = await pedirMotivoCancelacion();
    if (res === false) return;               // volvió atrás: el modal de quitar sigue abierto
    cerrarModal();
    const { error } = await sb.from('turnos')
      .update({ estado: 'cancelado', motivo_cancelacion: res.motivo || null, notificar_cancelacion: res.notificar })
      .eq('id', turnoId);
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
    mostrarMensaje(res.notificar ? 'Turno cancelado. Se le avisó al paciente.' : 'Turno cancelado.', 'exito');
  } else {
    cerrarModal();
    if (!await confirmarModal({ titulo: 'Eliminar turno', texto: 'Se borra el turno sin avisar al paciente. ¿Continuar?', textoSi: 'Eliminar', textoNo: 'Volver', peligro: true })) return;
    const { error } = await sb.from('turnos').delete().eq('id', turnoId);
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
    mostrarMensaje('Turno eliminado', 'exito');
  }
  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda' && typeof dibujarAgenda === 'function') dibujarAgenda();
  else if (moduloActivo === 'dashboard' && typeof renderDashboard === 'function') renderDashboard(document.getElementById('main'));
}

// Mini-modal (overlay propio, no pisa otros modales) para registrar el motivo
// de una cancelación y decidir si se notifica al paciente. Devuelve
// { motivo, notificar } al confirmar, o false si el usuario vuelve atrás.
// Reutilizable desde la agenda y la ficha del paciente.
function pedirMotivoCancelacion() {
  return new Promise((resolve) => {
    const previo = document.getElementById('mc-layer');
    if (previo) previo.remove();

    const SVG = (p, w = 20, sw = 1.9) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    const icCalX = SVG('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m17 16-4 4"/><path d="m13 16 4 4"/>', 24);
    const icPers = SVG('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>', 18);
    const icBan  = SVG('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', 18);
    const icCal  = SVG('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', 18);
    const icSalud = SVG('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>', 18);
    const icOtro = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
    const icTacho = SVG('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 16, 2);
    const icWarn = SVG('<path d="m21.7 18-9-15a1.5 1.5 0 0 0-2.6 0l-9 15A1.5 1.5 0 0 0 2.4 20h18.2a1.5 1.5 0 0 0 1.3-2Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>', 18);

    const OPCIONES = [
      { v: 'El paciente avisó', ic: icPers },
      { v: 'No puede asistir',  ic: icBan },
      { v: 'Reprogramado',      ic: icCal },
      { v: 'Motivo de salud',   ic: icSalud },
    ];
    const opt = (v, ic, otro = false) => `
      <div class="mc-opt" data-motivo="${otro ? '__otro__' : v}" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1.5px solid #ececf3; border-radius:12px; cursor:pointer; transition:border-color .1s, background .1s;">
        <span style="flex:none; width:34px; height:34px; border-radius:50%; background:#f0eefb; display:flex; align-items:center; justify-content:center; color:#6D5BD0;">${ic}</span>
        <span style="flex:1; font-size:14.5px; font-weight:600; color:#2a2e3a;">${otro ? 'Otro motivo' : v}</span>
        <span class="mc-radio" style="flex:none; width:20px; height:20px; border-radius:50%; border:2px solid #cfcfdb; background:#fff; transition:.1s;"></span>
      </div>`;

    const layer = document.createElement('div');
    layer.id = 'mc-layer';
    layer.innerHTML = `
      <div class="cm-overlay">
        <div class="cm-box" style="max-width:480px; padding:0; text-align:left; max-height:92vh; overflow-y:auto;">
          <div style="padding:22px 24px 0;">
            <div style="display:flex; align-items:flex-start; gap:14px;">
              <span style="flex:none; width:48px; height:48px; border-radius:50%; background:#ede9fb; display:flex; align-items:center; justify-content:center; color:#6D5BD0;">${icCalX}</span>
              <div style="flex:1;">
                <div style="font-size:19px; font-weight:700; color:#1f2330;">Cancelar turno</div>
                <div style="font-size:13.5px; color:#8a90a2; margin-top:3px; line-height:1.5;">El turno se cancelará y, si lo dejás activado, el paciente será notificado por email. Esta acción quedará registrada en el historial.</div>
              </div>
              <button class="mc-no" style="flex:none; background:none; border:none; cursor:pointer; color:#9aa0b0; font-size:22px; line-height:1; padding:0;">&times;</button>
            </div>
            <div style="font-size:13px; font-weight:700; color:#3a3f4b; margin:18px 0 10px;">Motivo <span style="font-weight:500; color:#9aa0b0;">(opcional)</span></div>
            <div style="display:flex; flex-direction:column; gap:9px;">
              ${OPCIONES.map(o => opt(o.v, o.ic)).join('')}
              ${opt('', icOtro, true)}
            </div>
            <div id="mc-txtwrap" style="display:none; margin-top:9px;">
              <textarea id="mc-texto" maxlength="200" rows="3" placeholder="Escribí el motivo de la cancelación..." style="width:100%; box-sizing:border-box; border:1.5px solid #d9d2f6; border-radius:11px; padding:11px; font:inherit; font-size:14px; resize:vertical;" oninput="document.getElementById('mc-cont').textContent = this.value.length + '/200';"></textarea>
              <div style="text-align:right; font-size:12px; color:#9aa0b0; margin-top:3px;"><span id="mc-cont">0/200</span></div>
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:16px; padding:13px 14px; border:1px solid #ececf3; border-radius:12px;">
              <div style="flex:1;">
                <div style="font-size:14px; font-weight:600; color:#2a2e3a;">Notificar al paciente por email</div>
                <div style="font-size:12.5px; color:#9aa0b0; margin-top:2px;">Se enviará un email avisando sobre la cancelación.</div>
              </div>
              <label class="cfg-switch"><input type="checkbox" id="mc-notificar" checked><span class="cfg-slider"></span></label>
            </div>
            <div style="display:flex; gap:10px; margin-top:14px; padding:12px 14px; background:#fdf6e3; border:1px solid #f5e6b8; border-radius:11px;">
              <span style="color:#c79a1e; flex:none;">${icWarn}</span>
              <div style="font-size:12.5px; color:#8a7a3f; line-height:1.5;"><strong style="color:#7a6a2f;">Esta acción liberará el horario en la agenda.</strong> El paciente conservará el registro de la cancelación en su historial.</div>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:10px; padding:16px 24px 22px;">
            <button class="btn mc-no">Volver</button>
            <button class="btn cm-si-peligro mc-si" style="display:inline-flex; align-items:center; gap:7px;">${icTacho} Cancelar turno</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(layer);

    let esOtro = false, motivoSel = '';
    const txtWrap = layer.querySelector('#mc-txtwrap');
    const ta = layer.querySelector('#mc-texto');
    layer.querySelectorAll('.mc-opt').forEach(o => {
      o.onclick = () => {
        layer.querySelectorAll('.mc-opt').forEach(x => {
          const sel = x === o;
          x.style.borderColor = sel ? '#6D5BD0' : '#ececf3';
          x.style.background = sel ? '#faf9ff' : '#fff';
          const r = x.querySelector('.mc-radio');
          r.style.borderColor = sel ? '#6D5BD0' : '#cfcfdb';
          r.style.background = sel ? '#6D5BD0' : '#fff';
          r.style.boxShadow = sel ? 'inset 0 0 0 3px #fff' : 'none';
        });
        esOtro = o.dataset.motivo === '__otro__';
        motivoSel = esOtro ? '' : o.dataset.motivo;
        txtWrap.style.display = esOtro ? 'block' : 'none';
        if (esOtro) ta.focus();
      };
    });

    const cerrar = (val) => { layer.remove(); resolve(val); };
    layer.querySelectorAll('.mc-no').forEach(b => b.onclick = () => cerrar(false));
    layer.querySelector('.mc-si').onclick = () => {
      const motivo = esOtro ? ta.value.trim() : motivoSel;
      const notificar = layer.querySelector('#mc-notificar').checked;
      cerrar({ motivo, notificar });
    };
    layer.querySelector('.cm-overlay').onclick = (e) => {
      if (e.target.classList.contains('cm-overlay')) cerrar(false);
    };
  });
}

// ===== Reprogramar turno: mover a otra fecha / hora / profesional =====
async function abrirModalReprogramar(turnoId, pacienteId) {
  const { data: t } = await sb.from('turnos')
    .select('id, fecha_hora, duracion_minutos, profesional_id, pacientes(nombre, apellido), profesionales(nombre)')
    .eq('id', turnoId).maybeSingle();
  if (!t) { mostrarMensaje('Turno no encontrado', 'error'); return; }

  const { data: profesionales } = await sb.from('profesionales')
    .select('id, nombre').eq('activo', true).order('nombre');

  const fechaAct = new Date(t.fecha_hora);
  const fechaStr = agendaFechaStr(fechaAct);
  const horaStr = minToHora(turnoMinInicio(t));
  const pac = t.pacientes ? `${t.pacientes.apellido}, ${t.pacientes.nombre}` : 'Paciente';
  const profAct = t.profesionales?.nombre || '';
  let fechaLinda = fechaAct.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  fechaLinda = fechaLinda.charAt(0).toUpperCase() + fechaLinda.slice(1);

  const opts = (profesionales || []).map(p =>
    `<option value="${p.id}"${p.id === t.profesional_id ? ' selected' : ''}>${p.nombre}</option>`).join('');

  const volver = pacienteId ? `_reprogramarVolver('${pacienteId}')` : 'cerrarModal()';

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Reprogramar turno</div>
      <button class="modal-cerrar" onclick="${volver}">×</button>
    </div>
    <div class="modal-body">
      <div style="background:#f6f6fa; border-radius:11px; padding:12px 14px; margin-bottom:16px; font-size:13.5px; color:#5a5f6b; line-height:1.5;">
        <strong style="color:#2a2e3a;">${pac}</strong><br>
        Turno actual: ${fechaLinda} a las ${horaStr} hs con ${profAct}
      </div>
      <div class="input-group">
        <label>Profesional</label>
        <select id="rp-prof">${opts}</select>
      </div>
      <div class="form-row">
        <div class="input-group"><label>Nueva fecha</label><input type="date" id="rp-fecha" value="${fechaStr}"></div>
        <div class="input-group"><label>Nueva hora</label><input type="time" id="rp-hora" value="${horaStr}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="${volver}">Volver</button>
      <button class="btn btn-primary-sm" onclick="_reprogramarConfirmar('${turnoId}', ${t.duracion_minutos}, '${pacienteId || ''}')">Reprogramar</button>
    </div>
  `);
}

function _reprogramarVolver(pacienteId) {
  if (pacienteId && typeof verFichaPaciente === 'function') {
    verFichaPaciente(pacienteId).then(() => { if (typeof fichaTab === 'function') fichaTab('consultas'); });
  } else {
    cerrarModal();
  }
}

async function _reprogramarConfirmar(turnoId, dur, pacienteId) {
  const profId = document.getElementById('rp-prof').value;
  const fechaStr = document.getElementById('rp-fecha').value;
  const hora = document.getElementById('rp-hora').value;
  if (!fechaStr || !hora) { mostrarMensaje('Completá fecha y hora.', 'advertencia'); return; }

  const ini = parseHoraMin(hora);
  const fin = ini + dur;

  // 1) ¿El profesional atiende ese día y el turno entra en su horario?
  const mapa = await mapaFranjasProfes([profId], new Date(fechaStr + 'T00:00'));
  const franjas = mapa[profId] || [];
  if (franjas.length === 0) { mostrarMensaje('Ese profesional no atiende ese día.', 'error'); return; }
  if (!franjas.some(f => ini >= f.ini && fin <= f.fin)) {
    const txt = franjas.map(f => `${minToHora(f.ini)}-${minToHora(f.fin)}`).join(', ');
    mostrarMensaje(`El turno no entra en su horario (${txt}).`, 'error'); return;
  }

  // 2) ¿Choca con otro turno suyo ese día? (excluye el propio turno)
  const di = new Date(fechaStr + 'T00:00'); di.setHours(0, 0, 0, 0);
  const df = new Date(fechaStr + 'T00:00'); df.setHours(23, 59, 59, 999);
  const { data: existentes } = await sb.from('turnos')
    .select('fecha_hora, duracion_minutos, estado, es_sobreturno')
    .eq('profesional_id', profId)
    .neq('id', turnoId)
    .gte('fecha_hora', di.toISOString())
    .lte('fecha_hora', df.toISOString());
  const ocupanSlot = (existentes || []).filter(e => !e.es_sobreturno);
  if (haySolapamiento(ini, fin, ocupanSlot)) {
    mostrarMensaje('Se superpone con otro turno de ese profesional.', 'error'); return;
  }

  // 3) Actualizar (mismo turno, nueva fecha/hora/profesional)
  const fechaHora = new Date(`${fechaStr}T${hora}:00`);
  const { error } = await sb.from('turnos')
    .update({ fecha_hora: fechaHora.toISOString(), profesional_id: profId, actualizado_en: new Date().toISOString() })
    .eq('id', turnoId);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

  mostrarMensaje('Turno reprogramado', 'exito');
  if (pacienteId) {
    await verFichaPaciente(pacienteId);
    if (typeof fichaTab === 'function') fichaTab('consultas');
  } else {
    cerrarModal();
    const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
    if (moduloActivo === 'agenda' && typeof dibujarAgenda === 'function') dibujarAgenda();
  }
}

// Si el panel persistente está mostrando la misma fecha, lo redibuja.
function _agSyncPanel(fechaStr) {
  try {
    if (typeof agendaFechaActual !== 'undefined' && agendaFechaStr(agendaFechaActual) === fechaStr) {
      dibujarAgenda();
    }
  } catch (e) {}
}

// Despliega u oculta el sobreturno de un turno (lo abre el rayo resaltado).
function agendarToggleSobre(turnoId) {
  const el = document.getElementById('ag-sobre-' + turnoId);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// Bloquea un horario del profesional seleccionado (queda "No disponible").
async function agendarBloquear(min) {
  const profId = _agModal.profId;
  if (!profId) return;
  const fechaStr = agendaFechaStr(new Date(_agModal.fecha));
  const { error } = await sb.from('bloqueos_agenda').insert({
    negocio_id: usuarioActual.negocio_id,
    profesional_id: profId,
    fecha: fechaStr,
    hora_min: min,
    creado_por: usuarioActual.id
  });
  if (error) { mostrarMensaje('Error al bloquear: ' + error.message, 'error'); return; }
  mostrarMensaje('Horario bloqueado', 'exito');
  await agendarCargarDia();
  _agSyncPanel(fechaStr);
}

// Libera un horario previamente bloqueado.
async function agendarDesbloquear(bloqueoId) {
  const { error } = await sb.from('bloqueos_agenda').delete().eq('id', bloqueoId);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje('Horario liberado', 'exito');
  const fechaStr = agendaFechaStr(new Date(_agModal.fecha));
  await agendarCargarDia();
  _agSyncPanel(fechaStr);
}
