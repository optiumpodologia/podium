async function renderPacientes(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Pacientes</div>
        <div class="page-subtitle" id="pacientes-count">Cargando...</div>
      </div>
      ${usuarioActual.rol === 'recepcion' ? `
        <button class="btn btn-primary-sm" onclick="abrirModalPaciente()">
          <span>+</span> Nuevo paciente
        </button>
      ` : ''}
    </div>

    <div class="card">
      <div style="margin-bottom: 1rem;">
        <input type="text" id="buscar-paciente" placeholder="Buscar por nombre, apellido o DNI..."
          style="width: 100%; max-width: 400px; padding: 9px 12px; border: 1px solid var(--borde); border-radius: var(--radio);"
          oninput="filtrarPacientes()">
      </div>

      <table class="tabla">
        <thead>
          <tr>
            <th>Apellido y nombre</th>
            <th>DNI</th>
            <th>Teléfono</th>
            <th>Obra social</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-pacientes">
          <tr><td colspan="5" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarPacientes();
}

let _pacientesCache = [];

async function cargarPacientes() {
  const { data, error } = await sb.from('pacientes')
    .select('*')
    .order('apellido')
    .order('nombre');

  if (error) {
    mostrarMensaje('Error al cargar pacientes', 'error');
    console.error(error);
    return;
  }

  _pacientesCache = data || [];
  document.getElementById('pacientes-count').textContent =
    `${_pacientesCache.length} paciente${_pacientesCache.length !== 1 ? 's' : ''}`;
  dibujarPacientes(_pacientesCache);
}

function filtrarPacientes() {
  const q = document.getElementById('buscar-paciente').value.toLowerCase().trim();
  if (!q) return dibujarPacientes(_pacientesCache);
  const filtrados = _pacientesCache.filter(p => {
    const txt = `${p.apellido} ${p.nombre} ${p.dni || ''}`.toLowerCase();
    return txt.includes(q);
  });
  dibujarPacientes(filtrados);
}

function dibujarPacientes(lista) {
  const tbody = document.getElementById('tabla-pacientes');
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="vacio">No hay pacientes</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.apellido}, ${p.nombre}</strong></td>
      <td>${p.dni || '—'}</td>
      <td>${p.telefono || '—'}</td>
      <td>${p.obra_social || '—'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="verFichaPaciente('${p.id}')" title="Ver ficha">📋</button>
          ${usuarioActual.rol === 'recepcion' ? `
            <button class="btn-icon" onclick="abrirModalPaciente('${p.id}')" title="Editar">✎</button>
            <button class="btn-icon" onclick="eliminarPaciente('${p.id}')" title="Eliminar" style="color: var(--peligro);">×</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function abrirModalPaciente(id) {
  let paciente = {
    nombre: '', apellido: '', dni: '', fecha_nacimiento: '',
    telefono: '', email: '', direccion: '', obra_social: '',
    numero_afiliado: '', notas: ''
  };

  if (id) {
    const { data } = await sb.from('pacientes').select('*').eq('id', id).single();
    if (data) paciente = data;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar paciente' : 'Nuevo paciente'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-paciente">
      <div class="modal-body">
        <div class="form-row">
          <div class="input-group">
            <label>Apellido *</label>
            <input type="text" name="apellido" value="${paciente.apellido}" required>
          </div>
          <div class="input-group">
            <label>Nombre *</label>
            <input type="text" name="nombre" value="${paciente.nombre}" required>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>DNI</label>
            <input type="text" name="dni" value="${paciente.dni || ''}">
          </div>
          <div class="input-group">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fecha_nacimiento" value="${paciente.fecha_nacimiento || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${paciente.telefono || ''}">
          </div>
          <div class="input-group">
            <label>Email</label>
            <input type="email" name="email" value="${paciente.email || ''}">
          </div>
        </div>

        <div class="input-group">
          <label>Dirección</label>
          <input type="text" name="direccion" value="${paciente.direccion || ''}">
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Obra social</label>
            <input type="text" name="obra_social" value="${paciente.obra_social || ''}">
          </div>
          <div class="input-group">
            <label>N° de afiliado</label>
            <input type="text" name="numero_afiliado" value="${paciente.numero_afiliado || ''}">
          </div>
        </div>

        <div class="input-group">
          <label>Notas</label>
          <textarea name="notas" rows="2">${paciente.notas || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear paciente'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-paciente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const datos = Object.fromEntries(fd.entries());
    Object.keys(datos).forEach(k => { if (datos[k] === '') datos[k] = null; });

    let res;
    if (id) {
      res = await sb.from('pacientes').update(datos).eq('id', id);
    } else {
      res = await sb.from('pacientes').insert({ ...datos, negocio_id: usuarioActual.negocio_id });
    }

    if (res.error) {
      mostrarMensaje('Error al guardar: ' + res.error.message, 'error');
      return;
    }

    mostrarMensaje(id ? 'Paciente actualizado' : 'Paciente creado', 'exito');
    cerrarModal();
    await cargarPacientes();
  });
}

async function eliminarPaciente(id) {
  if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
  const { error } = await sb.from('pacientes').delete().eq('id', id);
  if (error) {
    mostrarMensaje('No se puede eliminar: tiene turnos asociados', 'error');
    return;
  }
  mostrarMensaje('Paciente eliminado', 'exito');
  await cargarPacientes();
}
