async function renderConfiguracion(container) {
  if (!puedeVerModulo(usuarioActual, 'configuracion')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  const { data: config } = await sb.from('configuracion')
    .select('*').eq('negocio_id', usuarioActual.negocio_id).maybeSingle();

  // Íconos chiquitos (estilo línea) usados en esta pantalla.
  const icoNegocio = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>';
  const icoAgenda = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  const icoLogo = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

  const logoActual = config?.logo_url
    ? `<img src="${config.logo_url}" alt="Logo">`
    : icoLogo;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Configuración</div>
        <div class="page-subtitle">Ajustes generales del negocio</div>
      </div>
    </div>

    <div class="cfg-grid">

      <!-- ================= IZQUIERDA: NEGOCIO ================= -->
      <div class="card">
        <div class="cfg-head"><span class="cfg-head-ico">${icoNegocio}</span> Negocio</div>

        <form id="form-config">
          <div class="input-group">
            <label>Nombre e identidad del negocio</label>
            <div class="cfg-identidad">
              <div class="cfg-logo-preview" id="cfg-logo-preview">${logoActual}</div>
              <input type="text" name="nombre_consultorio" placeholder="Nombre del negocio"
                     value="${config?.nombre_consultorio || ''}">
              <button type="button" class="btn" id="cfg-logo-btn">Cambiar logo</button>
              <input type="file" id="cfg-logo-input" accept="image/*" style="display:none">
            </div>
            <small class="cfg-ayuda">El nombre y el logo aparecen arriba a la izquierda para todos los usuarios del negocio.</small>
          </div>

          <div class="cfg-sep"></div>

          <div class="input-group">
            <label>Duración de cada turno (minutos) *</label>
            <input type="number" name="duracion_turno_minutos" value="${config?.duracion_turno_minutos || 45}" min="10" max="240" required>
            <small class="cfg-ayuda">Todos los turnos nuevos van a tener esta duración.</small>
          </div>

          <div class="form-row">
            <div class="input-group">
              <label>Hora de apertura</label>
              <input type="time" name="hora_apertura" value="${config?.hora_apertura?.slice(0,5) || '09:00'}">
            </div>
            <div class="input-group">
              <label>Hora de cierre</label>
              <input type="time" name="hora_cierre" value="${config?.hora_cierre?.slice(0,5) || '18:00'}">
            </div>
          </div>

          <button type="submit" class="btn btn-primary-sm cfg-guardar">Guardar cambios</button>
          <div class="cfg-ayuda" style="text-align:center; margin-top:8px;">Los cambios se aplican de forma inmediata.</div>
        </form>
      </div>

      <!-- ================= DERECHA: DISPONIBILIDAD ================= -->
      <div class="card">
        <div class="cfg-head"><span class="cfg-head-ico">${icoAgenda}</span> Disponibilidad</div>

        <div class="cfg-bloque-titulo">Días laborales</div>
        <div class="cfg-ayuda" style="margin-bottom:12px;">Seleccioná los días en los que atendés habitualmente.</div>
        <div id="dias-laborales-lista">Cargando...</div>

        <div class="cfg-sep"></div>

        <div class="cfg-bloque-titulo cfg-bloque-flex">
          <span>Feriados</span>
          <button class="btn cfg-mini" onclick="abrirModalFeriado()">+ Agregar</button>
        </div>
        <div class="cfg-ayuda" style="margin-bottom:12px;">Los feriados se bloquean automáticamente en la agenda.</div>
        <div id="feriados-lista">Cargando...</div>
      </div>

    </div>
  `;

  // ----- Guardar datos del negocio -----
  document.getElementById('form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    const payload = {
      negocio_id: usuarioActual.negocio_id,
      nombre_consultorio: d.nombre_consultorio || null,
      duracion_turno_minutos: parseInt(d.duracion_turno_minutos),
      hora_apertura: d.hora_apertura,
      hora_cierre: d.hora_cierre,
      actualizado_en: new Date().toISOString()
    };

    const { error } = await sb.from('configuracion')
      .upsert(payload, { onConflict: 'negocio_id' });
    if (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      return;
    }
    // Reflejar el nombre arriba a la izquierda, en vivo (sin refrescar).
    const txt = document.getElementById('sidebar-logo-text');
    if (txt) txt.textContent = d.nombre_consultorio || 'Podología';
    mostrarMensaje('Configuración guardada', 'exito');
  });

  // ----- Subir / cambiar logo del negocio -----
  document.getElementById('cfg-logo-btn').addEventListener('click', () => {
    document.getElementById('cfg-logo-input').click();
  });

  document.getElementById('cfg-logo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    mostrarMensaje('Procesando logo...', 'info');
    try {
      const path = `${usuarioActual.negocio_id}/logo.jpg`;
      const url = await logoSubir(file, path);

      const { error } = await sb.from('configuracion')
        .upsert({
          negocio_id: usuarioActual.negocio_id,
          logo_url: url,
          actualizado_en: new Date().toISOString()
        }, { onConflict: 'negocio_id' });
      if (error) { mostrarMensaje('Error al guardar logo: ' + error.message, 'error'); return; }

      // Preview en la tarjeta.
      document.getElementById('cfg-logo-preview').innerHTML = `<img src="${url}" alt="Logo">`;
      // Logo arriba a la izquierda, en vivo.
      const ic = document.getElementById('sidebar-logo-icon');
      if (ic) ic.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;

      mostrarMensaje('Logo actualizado', 'exito');
    } catch (err) {
      mostrarMensaje('Error: ' + (err.message || err), 'error');
    } finally {
      e.target.value = '';
    }
  });

  await cargarDiasLaborales();
  await cargarFeriados();
}

async function cargarDiasLaborales() {
  const { data } = await sb.from('dias_laborales').select('*').order('dia_semana');
  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const cont = document.getElementById('dias-laborales-lista');
  cont.innerHTML = `
    <div class="cfg-dias">
      ${[1,2,3,4,5,6,0].map(d => {
        const dia = (data || []).find(x => x.dia_semana === d);
        const activo = dia?.activo || false;
        return `
          <label class="cfg-dia ${activo ? 'on' : ''}">
            <input type="checkbox" ${activo ? 'checked' : ''} onchange="toggleDiaLaboral(${d}, this.checked)">
            <span>${nombres[d].slice(0,3)}</span>
          </label>
        `;
      }).join('')}
    </div>
  `;
}

async function toggleDiaLaboral(diaSemana, activo) {
  const { data: existente } = await sb.from('dias_laborales')
    .select('*').eq('dia_semana', diaSemana).maybeSingle();

  if (existente) {
    await sb.from('dias_laborales').update({ activo }).eq('id', existente.id);
  } else {
    await sb.from('dias_laborales').insert({
      negocio_id: usuarioActual.negocio_id,
      dia_semana: diaSemana,
      hora_inicio: '09:00',
      hora_fin: '18:00',
      activo
    });
  }
  await cargarDiasLaborales();
}

async function cargarFeriados() {
  const { data } = await sb.from('feriados').select('*').order('fecha');
  const cont = document.getElementById('feriados-lista');

  if (!data || data.length === 0) {
    cont.innerHTML = '<div class="vacio" style="padding: 1rem;">Sin feriados cargados</div>';
    return;
  }

  const icoCal = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
  const icoTacho = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  cont.innerHTML = data.map(f => {
    const fecha = new Date(f.fecha + 'T00:00');
    const corta = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const larga = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `
      <div class="cfg-feriado">
        <div class="cfg-feriado-ico">${icoCal}</div>
        <div class="cfg-feriado-info">
          <div class="cfg-feriado-nombre">${f.descripcion || corta}</div>
          <div class="cfg-feriado-sub">${larga}</div>
        </div>
        <button class="cfg-feriado-del" onclick="eliminarFeriado('${f.id}')" title="Eliminar">${icoTacho}</button>
      </div>
    `;
  }).join('');
}

function abrirModalFeriado() {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Agregar feriado</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-feriado">
      <div class="modal-body">
        <div class="input-group">
          <label>Fecha *</label>
          <input type="date" name="fecha" required>
        </div>
        <div class="input-group">
          <label>Descripción</label>
          <input type="text" name="descripcion" placeholder="Ej: Día del trabajador">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">Agregar</button>
      </div>
    </form>
  `);

  document.getElementById('form-feriado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    if (!d.descripcion) d.descripcion = null;

    const { error } = await sb.from('feriados').insert({
      ...d,
      negocio_id: usuarioActual.negocio_id
    });
    if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
    mostrarMensaje('Feriado agregado', 'exito');
    cerrarModal();
    await cargarFeriados();
  });
}

async function eliminarFeriado(id) {
  if (!confirm('¿Eliminar este feriado?')) return;
  await sb.from('feriados').delete().eq('id', id);
  mostrarMensaje('Feriado eliminado', 'exito');
  await cargarFeriados();
}
