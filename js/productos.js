async function renderProductos(container) {
  if (!puedeVerModulo(usuarioActual, 'productos')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Productos</div>
        <div class="page-subtitle">Inventario para venta al paciente</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalProducto()">
        <span>+</span> Nuevo producto
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-productos">
          <tr><td colspan="5" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarProductos();
}

async function cargarProductos() {
  const { data, error } = await sb.from('productos').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  const tbody = document.getElementById('tabla-productos');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay productos cargados</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(p => {
    const stockBajo = p.stock_minimo > 0 && p.stock <= p.stock_minimo;
    return `
    <tr>
      <td>
        <strong>${p.nombre}</strong>
        ${p.descripcion ? `<div style="font-size: 12px; color: var(--texto-secundario);">${p.descripcion}</div>` : ''}
      </td>
      <td>${formatearPrecio(p.precio)}</td>
      <td>
        ${p.stock}
        ${stockBajo ? '<span class="badge badge-cancelado" style="margin-left: 6px;">Bajo</span>' : ''}
      </td>
      <td>${p.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalProducto('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="eliminarProducto('${p.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

async function abrirModalProducto(id) {
  let prod = { nombre:'', descripcion:'', precio:0, stock:0, stock_minimo:0, activo:true };
  if (id) {
    const { data } = await sb.from('productos').select('*').eq('id', id).single();
    if (data) prod = data;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar producto' : 'Nuevo producto'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-producto">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre *</label>
          <input type="text" name="nombre" value="${prod.nombre}" required>
        </div>
        <div class="input-group">
          <label>Descripción</label>
          <textarea name="descripcion" rows="2">${prod.descripcion || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Precio *</label>
            <input type="number" name="precio" value="${prod.precio}" step="0.01" min="0" required>
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${prod.activo?'selected':''}>Activo</option>
              <option value="false" ${!prod.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Stock actual</label>
            <input type="number" name="stock" value="${prod.stock}" min="0">
          </div>
          <div class="input-group">
            <label>Stock mínimo (alerta)</label>
            <input type="number" name="stock_minimo" value="${prod.stock_minimo}" min="0">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    d.precio = parseFloat(d.precio) || 0;
    d.stock = parseInt(d.stock) || 0;
    d.stock_minimo = parseInt(d.stock_minimo) || 0;
    if (!d.descripcion) d.descripcion = null;

    let res;
    if (id) res = await sb.from('productos').update(d).eq('id', id);
    else res = await sb.from('productos').insert({ ...d, negocio_id: usuarioActual.negocio_id });

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje(id ? 'Actualizado' : 'Creado', 'exito');
    cerrarModal();
    await cargarProductos();
  });
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  const { error } = await sb.from('productos').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene ventas asociadas', 'error');
    return;
  }
  mostrarMensaje('Eliminado', 'exito');
  await cargarProductos();
}
