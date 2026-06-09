async function verFichaPaciente(pacienteId) {
  const { data: paciente } = await sb.from('pacientes').select('*').eq('id', pacienteId).single();
  if (!paciente) {
    mostrarMensaje('Paciente no encontrado', 'error');
    return;
  }

  const { data: turnos } = await sb.from('turnos')
    .select('*, tipos_atencion(nombre), profesionales(nombre)')
    .eq('paciente_id', pacienteId)
    .order('fecha_hora', { ascending: false })
    .limit(20);

  let fichas = [];
  if (usuarioActual.rol === 'profesional') {
    const { data } = await sb.from('fichas_atencion')
      .select('*, turnos(fecha_hora), tipos_atencion(nombre)')
      .eq('paciente_id', pacienteId)
      .order('creado_en', { ascending: false });
    fichas = data || [];
  }

  const edad = paciente.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(paciente.fecha_nacimiento)) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Ficha de paciente</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 18px; font-weight: 600;">${paciente.apellido}, ${paciente.nombre}</div>
        <div style="color: var(--texto-secundario); font-size: 13px;">
          ${edad !== null ? `${edad} años · ` : ''}
          ${paciente.dni ? 'DNI ' + paciente.dni : 'Sin DNI'}
        </div>
      </div>

      <table style="width:100%; font-size: 13px; margin-bottom: 1.5rem;">
        ${paciente.telefono ? `<tr><td style="color:var(--texto-secundario); padding:4px 0; width:120px;">Teléfono</td><td>${paciente.telefono}</td></tr>` : ''}
        ${paciente.email ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Email</td><td>${paciente.email}</td></tr>` : ''}
        ${paciente.direccion ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Dirección</td><td>${paciente.direccion}</td></tr>` : ''}
        ${paciente.obra_social ? `<tr><td style="color:var(--texto-secundario); padding:4px 0;">Obra social</td><td>${paciente.obra_social}${paciente.numero_afiliado ? ' · ' + paciente.numero_afiliado : ''}</td></tr>` : ''}
        ${paciente.notas ? `<tr><td style="color:var(--texto-secundario); padding:4px 0; vertical-align:top;">Notas</td><td>${paciente.notas}</td></tr>` : ''}
      </table>

      <div style="margin-bottom: 0.75rem; font-weight: 600; font-size: 14px;">Historial de turnos</div>
      ${turnos && turnos.length > 0 ? `
        <div class="turnos-dia-lista" style="margin-bottom: 1.5rem;">
          ${turnos.map(t => `
            <div class="turno-row" onclick="cerrarModal(); setTimeout(() => abrirModalTurno('${t.id}'), 100);">
              <div class="turno-row-hora">${new Date(t.fecha_hora).toLocaleDateString('es-AR')}</div>
              <div class="turno-row-info">
                <div class="turno-row-nombre">${t.tipos_atencion?.nombre || 'Pendiente'}</div>
                <div class="turno-row-tipo">${t.profesionales?.nombre || ''} · ${formatearHora(t.fecha_hora)}</div>
              </div>
              <span class="badge badge-${t.estado}">${etiquetaEstado(t.estado)}</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="vacio" style="padding: 1rem;">Sin turnos registrados</div>'}

      ${usuarioActual.rol === 'profesional' ? `
        <div style="margin-bottom: 0.75rem; font-weight: 600; font-size: 14px;">Historia clínica</div>
        ${fichas.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${fichas.map(f => `
              <div style="padding: 12px; background: var(--fondo); border-radius: var(--radio);">
                <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 4px;">
                  ${f.turnos ? new Date(f.turnos.fecha_hora).toLocaleDateString('es-AR') : new Date(f.creado_en).toLocaleDateString('es-AR')}
                  ${f.tipos_atencion ? ' · ' + f.tipos_atencion.nombre : ''}
                </div>
                ${f.motivo_consulta ? `<div style="margin-bottom: 4px;"><strong>Motivo:</strong> ${f.motivo_consulta}</div>` : ''}
                ${f.diagnostico ? `<div style="margin-bottom: 4px;"><strong>Diagnóstico:</strong> ${f.diagnostico}</div>` : ''}
                ${f.tratamiento ? `<div style="margin-bottom: 4px;"><strong>Tratamiento:</strong> ${f.tratamiento}</div>` : ''}
                ${f.observaciones ? `<div style="font-size: 12px; color: var(--texto-secundario);">${f.observaciones}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : '<div class="vacio" style="padding: 1rem;">Sin fichas cargadas</div>'}
      ` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

async function abrirFichaAtencion(turnoId, soloLectura = false) {
  if (usuarioActual.rol !== 'profesional') {
    mostrarMensaje('Solo el profesional puede cargar fichas', 'advertencia');
    return;
  }

  const { data: turno } = await sb.from('turnos')
    .select('*, pacientes(nombre, apellido), profesionales(id, usuario_id)')
    .eq('id', turnoId).single();

  if (!turno) { mostrarMensaje('Turno no encontrado', 'error'); return; }

  if (turno.profesionales.usuario_id !== usuarioActual.id) {
    mostrarMensaje('Solo podés cargar fichas de tus propios turnos', 'advertencia');
    return;
  }

  const { data: tipos } = await sb.from('tipos_atencion').select('*').eq('activo', true).order('nombre');
  const { data: fichaExistente } = await sb.from('fichas_atencion')
    .select('*').eq('turno_id', turnoId).maybeSingle();

  const ficha = fichaExistente || {
    tipo_atencion_id: turno.tipo_atencion_id || '',
    motivo_consulta: '', diagnostico: '', tratamiento: '',
    observaciones: '', proxima_visita: ''
  };

  const dis = soloLectura ? 'disabled' : '';

  // --- Cronómetro de atención -----------------------------------------
  // En atención: reloj corriendo = now - hora_inicio_atencion (setInterval).
  // Finalizado: duración total ya calculada (estática). No toca DB.
  const inicioAtencion = turno.hora_inicio_atencion ? new Date(turno.hora_inicio_atencion) : null;
  const mostrarCrono = turno.estado === 'en_atencion' && inicioAtencion && !soloLectura;

  let cronoHTML = '';
  if (mostrarCrono) {
    cronoHTML = `
      <div style="background: var(--fondo); border-left: 3px solid var(--exito); padding: 10px 14px; border-radius: var(--radio); margin-bottom: 1rem; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">⏱</span>
        <div>
          <div style="font-size: 11px; color: var(--texto-secundario); text-transform: uppercase; letter-spacing: .5px;">En atención</div>
          <div id="ficha-cronometro" style="font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; color: var(--exito);">00:00</div>
        </div>
      </div>
    `;
  } else if (turno.estado === 'finalizado' && inicioAtencion && turno.hora_fin_atencion) {
    const totalMin = Math.max(0, Math.round((new Date(turno.hora_fin_atencion) - inicioAtencion) / 60000));
    cronoHTML = `
      <div style="background: var(--fondo); padding: 8px 12px; border-radius: var(--radio); margin-bottom: 1rem; font-size: 13px; color: var(--texto-secundario);">
        ⏱ Duración de la atención: <strong style="color: var(--texto);">${totalMin} min</strong>
      </div>
    `;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${soloLectura ? 'Ficha de atención · solo lectura' : 'Ficha de atención'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-ficha">
      <div class="modal-body">
        <div style="background: var(--fondo); padding: 10px 12px; border-radius: var(--radio); margin-bottom: 1rem; font-size: 13px;">
          <strong>${turno.pacientes?.apellido}, ${turno.pacientes?.nombre}</strong>
          <span style="color: var(--texto-secundario);"> · ${new Date(turno.fecha_hora).toLocaleDateString('es-AR')}</span>
        </div>

        ${cronoHTML}

        <div class="input-group">
          <label>Tipo de atención realizada *</label>
          <select name="tipo_atencion_id" required ${dis}>
            <option value="">Seleccionar...</option>
            ${(tipos||[]).map(t => `
              <option value="${t.id}" ${ficha.tipo_atencion_id === t.id ? 'selected' : ''}>${t.nombre}</option>
            `).join('')}
          </select>
        </div>

        <div class="input-group">
          <label>Motivo de consulta</label>
          <textarea name="motivo_consulta" rows="2" ${dis}>${ficha.motivo_consulta || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Diagnóstico</label>
          <textarea name="diagnostico" rows="2" ${dis}>${ficha.diagnostico || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Tratamiento realizado</label>
          <textarea name="tratamiento" rows="3" ${dis}>${ficha.tratamiento || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Observaciones / evolución</label>
          <textarea name="observaciones" rows="2" ${dis}>${ficha.observaciones || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Próxima visita sugerida</label>
          <input type="date" name="proxima_visita" value="${ficha.proxima_visita || ''}" ${dis}>
        </div>
      </div>
      <div class="modal-footer">
        ${soloLectura ? `
          <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
        ` : `
          <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary-sm">Cerrar ficha y finalizar turno</button>
        `}
      </div>
    </form>
  `);

  // Arranca el cronómetro (si corresponde). Se autolimpia cuando el
  // elemento desaparece (modal cerrado), sin depender de cerrarModal().
  if (mostrarCrono) {
    const fmt = (ms) => {
      const s = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const pad = n => String(n).padStart(2, '0');
      return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    };
    const tick = () => {
      const el = document.getElementById('ficha-cronometro');
      if (!el) { clearInterval(window._fichaCronoInt); return; }
      el.textContent = fmt(Date.now() - inicioAtencion.getTime());
    };
    clearInterval(window._fichaCronoInt);
    tick();
    window._fichaCronoInt = setInterval(tick, 1000);
  }

  if (soloLectura) return;  // en solo-lectura no hay guardado
  document.getElementById('form-ficha').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearInterval(window._fichaCronoInt);
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    Object.keys(d).forEach(k => { if (d[k] === '') d[k] = null; });

    const datos = {
      ...d,
      turno_id: turnoId,
      paciente_id: turno.paciente_id,
      profesional_id: turno.profesional_id
    };

    let res;
    if (fichaExistente) {
      res = await sb.from('fichas_atencion').update(datos).eq('id', fichaExistente.id);
    } else {
      res = await sb.from('fichas_atencion').insert(datos);
    }

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }

    await sb.from('turnos').update({
      estado: 'finalizado',
      tipo_atencion_id: d.tipo_atencion_id,
      hora_fin_atencion: new Date().toISOString()
    }).eq('id', turnoId);

    mostrarMensaje('Ficha guardada y turno finalizado', 'exito');
    cerrarModal();
    const moduloActivo = document.querySelector('.nav-item.active')?.dataset.modulo;
    if (moduloActivo === 'agenda') dibujarAgenda();
    else if (moduloActivo === 'dashboard') renderDashboard(document.getElementById('main'));
  });
}
