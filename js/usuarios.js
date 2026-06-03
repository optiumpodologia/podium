async function renderUsuarios(container) {
  if (!puedeVerModulo(usuarioActual, 'usuarios')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  const esSuperAdmin = usuarioActual.rol === 'super_admin';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Usuarios</div>
        <div class="page-subtitle">${esSuperAdmin ? 'Gestión global de accesos' : 'Empleados que pueden entrar al sistema'}</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalNuevoUsuario()">
        <span>+</span> Nuevo usuario
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            ${esSuperAdmin ? '<th>Negocio</th>' : ''}
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-usuarios">
          <tr><td colspan="${esSuperAdmin ? 6 : 5}" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarUsuarios();
}

async function cargarUsuarios() {
  const esSuperAdmin = usuarioActual.rol === 'super_admin';
  const { data, error } = await sb.from('usuarios').select('*, negocios(nombre)').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); console.error(error); return; }

  const tbody = document.getElementById('tabla-usuarios');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${esSuperAdmin ? 6 : 5}" class="vacio">No hay usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u => {
    const rolBadge = {
      'super_admin': '<span class="badge" style="background:#26215C; color:white;">Super Admin</span>',
      'negocio': '<span class="badge" style="background:#534AB7; color:white;">Negocio</span>',
      'recepcion': '<span class="badge badge-llego">Recepción</span>',
      'profesional': '<span class="badge badge-en_atencion">Profesional</span>'
    }[u.rol] || u.rol;

    const esYo = u.id === usuarioActual.id;

    return `
    <tr>
      <td><strong>${u.nombre}</strong>${esYo ? ' <span style="font-size:11px; color:var(--texto-tenue);">(vos)</span>' : ''}</td>
      <td>${u.email}</td>
      <td>${rolBadge}</td>
      ${esSuperAdmin ? `<td>${u.negocios?.nombre || '—'}</td>` : ''}
      <td>${u.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          ${!esYo ? `
            <button class="btn-icon" onclick="toggleUsuarioActivo('${u.id}', ${!u.activo})" title="${u.activo ? 'Desactivar' : 'Activar'}" style="color: ${u.activo ? 'var(--peligro)' : 'var(--exito)'};">
              ${u.activo ? '🚫' : '✓'}
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

async function abrirModalNuevoUsuario() {
  const esSuperAdmin = usuarioActual.rol === 'super_admin';

  let negociosOptions = '';
  if (esSuperAdmin) {
    const { data: negocios } = await sb.from('negocios').select('id, nombre').eq('activo', true).order('nombre');
    negociosOptions = (negocios || []).map(n =>
      `<option value="${n.id}">${n.nombre}</option>`
    ).join('');
  }

  const rolOptions = esSuperAdmin
    ? `
      <option value="negocio">Negocio (dueño)</option>
      <option value="recepcion">Recepción</option>
      <option value="profesional">Profesional</option>
      <option value="super_admin">Super Admin (uso interno Optium)</option>
    `
    : `
      <option value="profesional">Profesional</option>
      <option value="recepcion">Recepción</option>
    `;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo usuario</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-nuevo-usuario">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre completo *</label>
          <input type="text" name="nombre" required placeholder="Ej: María González">
        </div>

        <div class="input-group">
          <label>Email *</label>
          <input type="email" name="email" required placeholder="usuario@email.com">
        </div>

        <div class="input-group">
          <label>Contraseña *</label>
          <input type="text" name="password" required minlength="6" placeholder="Mínimo 6 caracteres">
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            Anotala bien, se la vas a pasar al usuario para que entre por primera vez.
          </small>
        </div>

        <div class="input-group">
          <label>Rol *</label>
          <select name="rol" required id="select-rol-nuevo" onchange="toggleNegocioSelect()">
            ${rolOptions}
          </select>
        </div>

        ${esSuperAdmin ? `
          <div class="input-group" id="grupo-negocio">
            <label>Negocio *</label>
            <select name="negocio_id" id="select-negocio">
              ${negociosOptions}
            </select>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-crear-usuario">Crear usuario</button>
      </div>
    </form>
  `);

  document.getElementById('form-nuevo-usuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    // --- Topes del plan: recepción (según plan) y admin (siempre 1 por negocio) ---
    const negocioObjetivo = esSuperAdmin ? d.negocio_id : usuarioActual.negocio_id;
    if (d.rol === 'recepcion' || d.rol === 'negocio') {
      const tope = await topeUsuariosNegocio(negocioObjetivo, d.rol);
      if (tope && tope.alcanzado) {
        const msg = d.rol === 'negocio'
          ? 'Ese negocio ya tiene su usuario dueño (admin). Solo se permite 1.'
          : `Llegaste al límite de usuarios de recepción del plan (${tope.max}). Para sumar más, cambiá de plan.`;
        mostrarMensaje(msg, 'error');
        return;
      }
    }

    const btn = document.getElementById('btn-crear-usuario');
    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Sesión expirada');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: d.email.trim().toLowerCase(),
          password: d.password,
          nombre: d.nombre.trim(),
          rol: d.rol,
          negocio_id: d.negocio_id || null
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error desconocido');
      }

      mostrarMensaje('Usuario creado correctamente', 'exito');
      cerrarModal();
      await cargarUsuarios();
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Crear usuario';
    }
  });
}

function toggleNegocioSelect() {
  const rol = document.getElementById('select-rol-nuevo').value;
  const grupo = document.getElementById('grupo-negocio');
  if (!grupo) return;
  if (rol === 'super_admin') {
    grupo.style.display = 'none';
    document.getElementById('select-negocio').required = false;
  } else {
    grupo.style.display = 'block';
    document.getElementById('select-negocio').required = true;
  }
}

async function toggleUsuarioActivo(id, activar) {
  const accion = activar ? 'activar' : 'desactivar';
  if (!confirm(`¿Seguro que querés ${accion} este usuario?`)) return;

  const { error } = await sb.from('usuarios').update({ activo: activar }).eq('id', id);
  if (error) {
    mostrarMensaje('Error: ' + error.message, 'error');
    return;
  }
  mostrarMensaje(activar ? 'Usuario activado' : 'Usuario desactivado', 'exito');
  await cargarUsuarios();
}

// Calcula el tope de usuarios para un negocio según el rol que se quiere crear.
// - rol 'negocio' (admin/dueño): siempre máximo 1, no depende del plan.
// - rol 'recepcion': máximo del plan (max_recepcion); null = sin límite.
// Devuelve { max, actual, alcanzado } o null si no aplica.
async function topeUsuariosNegocio(negocioId, rol) {
  if (!negocioId) return null;

  if (rol === 'negocio') {
    const { count } = await sb.from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('negocio_id', negocioId).eq('rol', 'negocio');
    return { max: 1, actual: count || 0, alcanzado: (count || 0) >= 1 };
  }

  // recepción: tope del plan del negocio
  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('plan').eq('id', negocioId).single();
  if (!vista) return null;

  const { data: plan } = await sb.from('planes')
    .select('max_recepcion').eq('id', vista.plan).single();

  const max = plan?.max_recepcion;
  if (max === null || max === undefined) return { max: null, actual: 0, alcanzado: false };

  const { count } = await sb.from('usuarios')
    .select('*', { count: 'exact', head: true })
    .eq('negocio_id', negocioId).eq('rol', 'recepcion');
  return { max, actual: count || 0, alcanzado: (count || 0) >= max };
}
