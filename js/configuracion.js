async function renderConfiguracion(container) {
  if (!puedeVerModulo(usuarioActual, 'configuracion')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  const { data: config } = await sb.from('configuracion').select('*').eq('id', 1).single();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Configuración</div>
        <div class="page-subtitle">Ajustes generales del consultorio</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Turnos</div>
      <form id="form-config">
        <div class="input-group">
          <label>Nombre del consultorio</label>
          <input type="text" name="nombre_consultorio" value="${config?.nombre_consultorio || ''}">
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Duración de cada turno (minutos) *</label>
            <input type="number" name="duracion_turno_minutos" value="${config?.duracion_turno_minutos || 45}" min="10" max="240" required>
            <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
              Todos los turnos nuevos van a tener esta duración.
            </small>
          </div>
          <div class="input-group">
            <label>&nbsp;</label>
            <div style="display: flex; gap: 8px;">
              <div style="flex: 1;">
                <label style="font-size: 11px; color: var(--texto-secundario);">Hora apertura</label>
                <input type="time" name="hora_apertura" value="${config?.hora_apertura?.slice(0,5) || '09:00'}">
              </div>
              <div style="flex: 1;">
                <label style="font-size: 11px; color: var(--texto-secundario);">Hora cierre</label>
                <input type="time" name="hora_cierre" value="${config?.hora_cierre?.slice(0,5) || '18:00'}">
              </div>
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary-sm">Guardar cambios</button>
      </form>
    </div>

    <div class="card">
      <div class="card-title">Días laborales</div>
      <div id="dias-laborales-lista">Cargando...</div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Feriados</span>
        <button class="btn" onclick="abrirModalFeriado()" style="font-size: 12px; padding: 4px 10px;">+ Agregar</button>
      </div>
      <div id="feriados-lista">Cargando...</div>
    </div>
  `;

  document.getElementById('form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.duracion_turno_minutos = parseInt(d.duracion_turno_minutos);

    const { error } = await sb.from('configuracion').update(d).eq('id', 1);
    if (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      return;
    }
    mostrarMensaje('Configuración guardada', 'exito');
  });

  await cargarDiasLaborales();
  await cargarFeriados();
}

async function cargarDiasLaborales() {
  const { data } = await sb.from('dias_laborales').select('*').order('dia_semana');
  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  const cont = document.getElementById('dias-laborales-lista');
  cont.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
      ${[0,1,2,3,4,5,6].map(d => {
        const dia = (data || []).find(x => x.dia_semana === d);
        const activo = dia?.activo || false;
        return `
          <label style="display: flex; flex-direction: column; align-items: center; padding: 10px; border: 1px solid var(--borde); border-radius: var(--radio); cursor: pointer; background: ${activo ? 'var(--primario-claro)' : 'white'};">
            <input type="checkbox" ${activo ? 'checked' : ''} onchange="toggleDiaLaboral(${d}, this.checked)" style="margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: ${activo ? '600' : '400'};">${nombres[d].slice(0,3)}</span>
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

  cont.innerHTML = `<table class="tabla">
    <thead><tr><th>Fecha</th><th>Descripción</th><th></th></tr></thead>
    <tbody>${data.map(f => `
      <tr>
        <td>${new Date(f.fecha + 'T00:00').toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'long', year:'numeric' })}</td>
        <td>${f.descripcion || '—'}</td>
        <td style="text-align:right;">
          <button class="btn-icon" onclick="eliminarFeriado('${f.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
        </td>
      </tr>
    `).join('')}</tbody>
  </table>`;
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

    const { error } = await sb.from('feriados').insert(d);
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
