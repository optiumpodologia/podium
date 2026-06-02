async function renderTiposAtencion(container) {
  if (!puedeVerModulo(usuarioActual, 'tipos_atencion')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Tipos de atención</div>
        <div class="page-subtitle">Catálogo de servicios (el profesional los elige al cerrar la ficha)</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalTipoAtencion()">
        <span>+</span> Nuevo tipo
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Color</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-tipos">
          <tr><td colspan="5" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarTiposAtencion();
}

async function cargarTiposAtencion() {
  const { data, error } = await sb.from('tipos_atencion').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  const tbody = document.getElementById('tabla-tipos');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay tipos cargados</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => `
    <tr>
      <td><strong>${t.nombre}</strong></td>
      <td>${formatearPrecio(t.precio)}</td>
      <td><span style="display:inline-block; width:18px; height:18px; background:${t.color}; border-radius:4px; vertical-align:middle;"></span></td>
      <td>${t.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalTipoAtencion('${t.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="eliminarTipoAtencion('${t.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function abrirModalTipoAtencion(id) {
  let tipo = { nombre:'', precio:0, color:'#534AB7', activo:true };
  if (id) {
    const { data } = await sb.from('tipos_atencion').select('*').eq('id', id).single();
    if (data) tipo = data;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar tipo' : 'Nuevo tipo de atención'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-tipo">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre *</label>
          <input type="text" name="nombre" value="${tipo.nombre}" required>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Precio</label>
            <input type="number" name="precio" value="${tipo.precio}" step="0.01" min="0">
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${tipo.activo?'selected':''}>Activo</option>
              <option value="false" ${!tipo.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="input-group">
          <label>Color (para reportes)</label>
          <input type="color" name="color" value="${tipo.color}">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-tipo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    d.precio = parseFloat(d.precio) || 0;

    let res;
    if (id) res = await sb.from('tipos_atencion').update(d).eq('id', id);
    else res = await sb.from('tipos_atencion').insert(d);

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje(id ? 'Actualizado' : 'Creado', 'exito');
    cerrarModal();
    await cargarTiposAtencion();
  });
}

async function eliminarTipoAtencion(id) {
  if (!confirm('¿Eliminar este tipo de atención?')) return;
  const { error } = await sb.from('tipos_atencion').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene fichas asociadas', 'error');
    return;
  }
  mostrarMensaje('Eliminado', 'exito');
  await cargarTiposAtencion();
}
