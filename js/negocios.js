async function renderNegocios(container) {
  if (usuarioActual.rol !== 'super_admin') {
    container.innerHTML = '<div class="vacio">Acceso restringido (solo Super Admin)</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Negocios</div>
        <div class="page-subtitle">Gestión de consultorios / clientes del sistema</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalNegocio()">
        <span>+</span> Nuevo negocio
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Plan</th>
            <th>Alta</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-negocios">
          <tr><td colspan="5" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarNegocios();
}

async function cargarNegocios() {
  const { data, error } = await sb.from('negocios').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); return; }

  const tbody = document.getElementById('tabla-negocios');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay negocios</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(n => {
    const planBadge = {
      'free': '<span class="badge" style="background:#f1efe8; color:#444;">Free</span>',
      'pro': '<span class="badge badge-llego">Pro</span>',
      'premium': '<span class="badge" style="background:#CECBF6; color:#3C3489;">Premium</span>'
    }[n.plan] || n.plan;

    return `
    <tr>
      <td><strong>${n.nombre}</strong></td>
      <td>${planBadge}</td>
      <td>${new Date(n.fecha_alta).toLocaleDateString('es-AR')}</td>
      <td>${n.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalNegocio('${n.id}')" title="Editar">✎</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

async function abrirModalNegocio(id) {
  let negocio = { nombre:'', plan:'free', activo:true, notas:'' };
  if (id) {
    const { data } = await sb.from('negocios').select('*').eq('id', id).single();
    if (data) negocio = data;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar negocio' : 'Nuevo negocio'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-negocio">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre del negocio *</label>
          <input type="text" name="nombre" value="${negocio.nombre}" required>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Plan</label>
            <select name="plan">
              <option value="free" ${negocio.plan==='free'?'selected':''}>Free</option>
              <option value="pro" ${negocio.plan==='pro'?'selected':''}>Pro</option>
              <option value="premium" ${negocio.plan==='premium'?'selected':''}>Premium</option>
            </select>
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${negocio.activo?'selected':''}>Activo</option>
              <option value="false" ${!negocio.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="input-group">
          <label>Notas internas</label>
          <textarea name="notas" rows="2">${negocio.notas || ''}</textarea>
        </div>
        ${!id ? `
          <div style="background: var(--info-claro); color: var(--info); padding: 10px 12px; border-radius: var(--radio); font-size: 12px; margin-top: 1rem;">
            Después de crear el negocio, andá a "Usuarios" y creá la cuenta de recepción para este negocio.
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear negocio'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-negocio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    if (!d.notas) d.notas = null;

    let res;
    if (id) res = await sb.from('negocios').update(d).eq('id', id);
    else res = await sb.from('negocios').insert(d);

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje(id ? 'Actualizado' : 'Negocio creado', 'exito');
    cerrarModal();
    await cargarNegocios();
  });
}
