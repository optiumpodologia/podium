async function abrirModalNuevoTurno(fechaHoraInicial) {
  if (usuarioActual.rol !== 'recepcion') {
    mostrarMensaje('Solo recepción puede crear turnos', 'advertencia');
    return;
  }

  const { data: pacientes } = await sb.from('pacientes').select('id, nombre, apellido').order('apellido');
  const { data: profesionales } = await sb.from('profesionales').select('id, nombre').eq('activo', true).order('nombre');
  const { data: config } = await sb.from('configuracion').select('duracion_turno_minutos').eq('id', 1).single();
  const duracionDefault = config?.duracion_turno_minutos || 45;

  if (!profesionales || profesionales.length === 0) {
    mostrarMensaje('Primero cargá un profesional', 'advertencia');
    return;
  }

  let fechaDefault = '', horaDefault = '';
  if (fechaHoraInicial) {
    const d = new Date(fechaHoraInicial);
    fechaDefault = d.toISOString().split('T')[0];
    horaDefault = d.toTimeString().slice(0,5);
  } else {
    fechaDefault = fechaParaInput(new Date());
    horaDefault = '09:00';
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo turno</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-turno">
      <div class="modal-body">
        <div class="input-group">
          <label>Paciente *</label>
          <select name="paciente_id" required>
            <option value="">Seleccionar...</option>
            ${(pacientes||[]).map(p => `
              <option value="${p.id}">${p.apellido}, ${p.nombre}</option>
            `).join('')}
          </select>
          <div style="margin-top: 6px;">
            <button type="button" class="btn" style="font-size: 12px; padding: 4px 8px;"
              onclick="cerrarModal(); abrirModalPaciente()">+ Nuevo paciente</button>
          </div>
        </div>

        <div class="input-group">
          <label>Profesional *</label>
          <select name="profesional_id" required>
            <option value="">Seleccionar...</option>
            ${profesionales.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Fecha *</label>
            <input type="date" name="fecha" value="${fechaDefault}" required>
          </div>
          <div class="input-group">
            <label>Hora *</label>
            <input type="time" name="hora" value="${horaDefault}" required>
          </div>
        </div>

        <div class="input-group">
          <label>Notas (opcional)</label>
          <textarea name="notas" rows="2" placeholder="Ej: viene por primera vez, necesita silla, etc."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Crear turno</button>
      </div>
    </form>
  `);

  document.getElementById('form-turno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    const fechaHora = new Date(`${d.fecha}T${d.hora}`);

    const turno = {
      paciente_id: d.paciente_id,
      profesional_id: d.profesional_id,
      fecha_hora: fechaHora.toISOString(),
      duracion_minutos: duracionDefault,
      notas: d.notas || null,
      creado_por: usuarioActual.id
    };

    const { error } = await sb.from('turnos').insert(turno);
    if (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      return;
    }

    mostrarMensaje('Turno creado correctamente', 'exito');
    cerrarModal();

    const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
    if (moduloActivo === 'agenda') dibujarAgenda();
    else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
  });
}

async function abrirModalTurno(turnoId) {
  const { data: turno, error } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido, telefono, dni), tipos_atencion(nombre, precio, color), profesionales(nombre)')
    .eq('id', turnoId)
    .single();

  if (error || !turno) {
    mostrarMensaje('No se pudo cargar el turno', 'error');
    return;
  }

  const esRecepcion = usuarioActual.rol === 'recepcion';
  const esProfesional = usuarioActual.rol === 'profesional';

  let accionesEstado = '';
  if (turno.estado === 'agendado' && esRecepcion) {
    accionesEstado = `
      <button class="btn btn-primary-sm" onclick="cambiarEstadoTurno('${turno.id}','llego')">✓ Marcar que llegó</button>
      <button class="btn" onclick="cambiarEstadoTurno('${turno.id}','cancelado')">Cancelar turno</button>
      <button class="btn" onclick="cambiarEstadoTurno('${turno.id}','ausente')">No vino</button>
    `;
  } else if (turno.estado === 'llego' && esProfesional) {
    accionesEstado = `
      <button class="btn btn-primary-sm" onclick="iniciarAtencion('${turno.id}')">▶ Iniciar atención</button>
    `;
  } else if (turno.estado === 'llego' && esRecepcion) {
    accionesEstado = `
      <div style="color: var(--exito); font-size: 13px;">⏳ Esperando que el profesional inicie la atención</div>
    `;
  } else if (turno.estado === 'en_atencion' && esProfesional) {
    accionesEstado = `
      <button class="btn btn-primary-sm" onclick="abrirFichaAtencion('${turno.id}')">📋 Cerrar ficha y finalizar</button>
    `;
  } else if (turno.estado === 'en_atencion' && esRecepcion) {
    accionesEstado = `
      <div style="color: var(--advertencia); font-size: 13px;">⚙ Paciente en consultorio</div>
    `;
  } else if (turno.estado === 'finalizado' && esProfesional) {
    accionesEstado = `
      <button class="btn" onclick="abrirFichaAtencion('${turno.id}')">Ver/editar ficha</button>
    `;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Turno</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom: 1rem;">
        <span class="badge badge-${turno.estado}">${etiquetaEstado(turno.estado)}</span>
      </div>

      <table style="width: 100%; font-size: 13px;">
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0; width: 110px;">Paciente</td>
          <td><strong>${turno.pacientes ? turno.pacientes.apellido + ', ' + turno.pacientes.nombre : '—'}</strong></td>
        </tr>
        ${turno.pacientes?.telefono ? `
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0;">Teléfono</td>
          <td>${turno.pacientes.telefono}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0;">Profesional</td>
          <td>${turno.profesionales?.nombre || '—'}</td>
        </tr>
        ${turno.tipos_atencion ? `
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0;">Atención realizada</td>
          <td>${turno.tipos_atencion.nombre}${turno.tipos_atencion.precio ? ' · ' + formatearPrecio(turno.tipos_atencion.precio) : ''}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0;">Fecha</td>
          <td>${formatearFecha(turno.fecha_hora)}</td>
        </tr>
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0;">Horario</td>
          <td>${formatearHora(turno.fecha_hora)} (${turno.duracion_minutos} min)</td>
        </tr>
        ${turno.notas ? `
        <tr>
          <td style="color: var(--texto-secundario); padding: 6px 0; vertical-align: top;">Notas</td>
          <td>${turno.notas}</td>
        </tr>
        ` : ''}
      </table>

      ${accionesEstado ? `
        <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--borde-tenue); display: flex; gap: 8px; flex-wrap: wrap;">
          ${accionesEstado}
        </div>
      ` : ''}
    </div>
    <div class="modal-footer">
      ${esRecepcion && !['finalizado'].includes(turno.estado) ? `
        <button class="btn btn-danger" onclick="eliminarTurno('${turno.id}')">Eliminar</button>
      ` : ''}
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

async function iniciarAtencion(turnoId) {
  const ahora = new Date().toISOString();
  const { error } = await sb.from('turnos').update({
    estado: 'en_atencion',
    hora_inicio_atencion: ahora
  }).eq('id', turnoId);

  if (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
    return;
  }

  mostrarMensaje('Atención iniciada', 'exito');
  cerrarModal();
  setTimeout(() => abrirFichaAtencion(turnoId), 200);
}

async function cambiarEstadoTurno(turnoId, nuevoEstado) {
  const ahora = new Date().toISOString();
  const updates = { estado: nuevoEstado };
  if (nuevoEstado === 'llego') updates.hora_llegada = ahora;
  if (nuevoEstado === 'en_atencion') updates.hora_inicio_atencion = ahora;
  if (nuevoEstado === 'finalizado') updates.hora_fin_atencion = ahora;

  const { error } = await sb.from('turnos').update(updates).eq('id', turnoId);
  if (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
    return;
  }

  mostrarMensaje('Estado actualizado', 'exito');
  cerrarModal();

  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda') dibujarAgenda();
  else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
}

async function eliminarTurno(turnoId) {
  if (!confirm('¿Eliminar este turno?')) return;
  const { error } = await sb.from('turnos').delete().eq('id', turnoId);
  if (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
    return;
  }
  mostrarMensaje('Turno eliminado', 'exito');
  cerrarModal();
  const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
  if (moduloActivo === 'agenda') dibujarAgenda();
  else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
}
