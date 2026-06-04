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

  const { data: config } = await sb.from('configuracion').select('*').eq('id', 1).single();
  const horaInicio = parseInt((config?.hora_apertura || '08:00').split(':')[0]);
  const horaFin = parseInt((config?.hora_cierre || '20:00').split(':')[0]);
  const horas = [];
  for (let h = horaInicio; h <= horaFin; h++) horas.push(h);

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
            ${esPasado ? '' : `<button class="agenda-col-quitar" title="Quitar de este día" onclick="agendaQuitarProfesional(${numero})">&times;</button>`}
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

  const altoTotal = horas.length * 60;

  // Columna de horas
  html += `<div class="agenda-horas-col" style="height:${altoTotal}px;">`;
  horas.forEach(h => {
    html += `<div class="agenda-hora-label">${String(h).padStart(2,'0')}:00</div>`;
  });
  html += `</div>`;

  // Columnas de consultorio
  columnas.forEach((col, idx) => {
    const numero = idx + 1;
    html += `<div class="agenda-consultorio-col" style="height:${altoTotal}px;">`;
    horas.forEach((h, i) => {
      html += `<div class="agenda-linea-hora" style="top:${i*60}px;"></div>`;
    });

    if (col && col.profesional) {
      const susTurnos = turnosPorProf[col.profesional.id] || [];
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
// QUITAR PROFESIONAL de una columna (bloquea si tiene turnos)
// ============================================================
async function agendaQuitarProfesional(columna) {
  const col = _agendaCols[columna - 1];
  if (!col || !col.profesional) return;

  const fechaInicio = new Date(agendaFechaActual); fechaInicio.setHours(0,0,0,0);
  const fechaFin = new Date(agendaFechaActual); fechaFin.setHours(23,59,59,999);

  const { count } = await sb.from('turnos')
    .select('*', { count: 'exact', head: true })
    .eq('profesional_id', col.profesional.id)
    .gte('fecha_hora', fechaInicio.toISOString())
    .lte('fecha_hora', fechaFin.toISOString());

  if (count && count > 0) {
    mostrarMensaje(`No se puede quitar a ${col.profesional.nombre}: tiene ${count} turno${count !== 1 ? 's' : ''} ese día.`, 'error');
    return;
  }

  if (!confirm(`¿Quitar a ${col.profesional.nombre} del Consultorio ${columna} este día?`)) return;

  const { error } = await sb.from('agenda_dia').delete().eq('id', col.registroId);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

  // Limpiamos un eventual día especial "viene" de ese profe ese día (no toca "no_viene" ni laborales fijos).
  await sb.from('dias_especiales_profesional')
    .delete()
    .eq('profesional_id', col.profesional.id)
    .eq('fecha', agendaFechaStr(agendaFechaActual))
    .eq('no_viene', false);

  mostrarMensaje('Profesional quitado de este día', 'exito');
  await dibujarAgenda();
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
