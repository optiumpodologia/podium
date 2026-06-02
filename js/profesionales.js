async function renderProfesionales(container) {
  if (!puedeVerModulo(usuarioActual, 'profesionales')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Profesionales</div>
        <div class="page-subtitle" id="prof-count">Cargando...</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalProfesional()">
        <span>+</span> Nuevo profesional
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Matrícula</th>
            <th>Teléfono</th>
            <th>Color</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-profesionales">
          <tr><td colspan="6" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarProfesionales();
}

async function cargarProfesionales() {
  const { data, error } = await sb.from('profesionales').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  document.getElementById('prof-count').textContent =
    `${data.length} profesional${data.length !== 1 ? 'es' : ''}`;

  const tbody = document.getElementById('tabla-profesionales');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="vacio">No hay profesionales cargados</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.matricula || '—'}</td>
      <td>${p.telefono || '—'}</td>
      <td>
        <span style="display:inline-block; width:18px; height:18px; background:${p.color}; border-radius:4px; vertical-align:middle;"></span>
      </td>
      <td>${p.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalProfesional('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="eliminarProfesional('${p.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function abrirModalProfesional(id) {
  let prof = { nombre:'', matricula:'', telefono:'', color:'#534AB7', activo:true, usuario_id:'' };
  if (id) {
    const { data } = await sb.from('profesionales').select('*').eq('id', id).single();
    if (data) prof = data;
  }

  const { data: usuarios } = await sb.from('usuarios')
    .select('id, nombre, email')
    .eq('rol', 'profesional');

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar profesional' : 'Nuevo profesional'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-profesional">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre completo *</label>
          <input type="text" name="nombre" value="${prof.nombre}" required>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Matrícula</label>
            <input type="text" name="matricula" value="${prof.matricula || ''}">
          </div>
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${prof.telefono || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Color en agenda</label>
            <input type="color" name="color" value="${prof.color}">
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${prof.activo?'selected':''}>Activo</option>
              <option value="false" ${!prof.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="input-group">
          <label>Usuario vinculado (opcional)</label>
          <select name="usuario_id">
            <option value="">Sin usuario</option>
            ${(usuarios||[]).map(u => `<option value="${u.id}" ${prof.usuario_id===u.id?'selected':''}>${u.nombre} (${u.email})</option>`).join('')}
          </select>
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            Si el profesional va a usar la app, vinculá su usuario acá.
          </small>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-profesional').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    if (!d.usuario_id) d.usuario_id = null;
    if (!d.matricula) d.matricula = null;
    if (!d.telefono) d.telefono = null;

    let res;
    if (id) res = await sb.from('profesionales').update(d).eq('id', id);
    else res = await sb.from('profesionales').insert(d);

    if (res.error) {
      mostrarMensaje('Error: ' + res.error.message, 'error');
      return;
    }
    mostrarMensaje(id ? 'Actualizado' : 'Creado', 'exito');
    cerrarModal();
    await cargarProfesionales();
  });
}

async function eliminarProfesional(id) {
  if (!confirm('¿Eliminar este profesional?')) return;
  const { error } = await sb.from('profesionales').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene turnos asociados', 'error');
    return;
  }
  mostrarMensaje('Eliminado', 'exito');
  await cargarProfesionales();
}
