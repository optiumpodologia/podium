async function renderConsultorios(container) {
  if (!puedeVerModulo(usuarioActual, 'consultorios')) {
    container.innerHTML = '<div class="vacio">Acceso restringido</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Consultorios</div>
        <div class="page-subtitle">Espacios físicos del negocio</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalConsultorio()">
        <span>+</span> Nuevo consultorio
      </button>
    </div>

    <div id="info-plan" style="margin-bottom: 1rem;"></div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>Horarios</th>
            <th>Profesionales</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-consultorios">
          <tr><td colspan="6" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarInfoPlan();
  await cargarConsultorios();
}

async function cargarInfoPlan() {
  if (usuarioActual.rol === 'super_admin') return;

  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('*')
    .eq('id', usuarioActual.negocio_id)
    .single();

  if (!vista) return;

  const cont = document.getElementById('info-plan');
  const limiteTotal = vista.limite_total_consultorios;
  const usados = vista.consultorios_actuales;
  const restantes = limiteTotal - usados;

  cont.innerHTML = `
    <div class="card" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: var(--info-claro); border-color: var(--info);">
      <div>
        <div style="font-size: 13px; font-weight: 600; color: var(--info);">Plan ${vista.plan}</div>
        <div style="font-size: 12px; color: var(--info); margin-top: 2px;">
          Consultorios: ${usados}/${limiteTotal} · ${restantes > 0 ? `${restantes} disponibles` : 'Límite alcanzado'}
          · Profesionales máx por consultorio: ${vista.max_profesionales_por_consultorio}
        </div>
      </div>
    </div>
  `;
}

async function cargarConsultorios() {
  const { data, error } = await sb.from('consultorios')
    .select('*')
    .order('nombre');

  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }

  const tbody = document.getElementById('tabla-consultorios');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="vacio">No hay consultorios. Creá el primero.</td></tr>';
    return;
  }

  const filas = [];
  for (const c of data) {
    const { count } = await sb.from('profesionales_consultorios')
      .select('*', { count: 'exact', head: true })
      .eq('consultorio_id', c.id);

    filas.push(`
      <tr>
        <td><strong>${c.nombre}</strong></td>
        <td>${c.direccion || '—'}</td>
        <td>${c.hora_apertura?.slice(0,5) || '09:00'} - ${c.hora_cierre?.slice(0,5) || '18:00'}</td>
        <td>${count || 0}</td>
        <td>${c.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
        <td>
          <div class="tabla-acciones">
            <button class="btn-icon" onclick="abrirModalConsultorio('${c.id}')" title="Editar">✎</button>
            <button class="btn-icon" onclick="gestionarProfesionalesConsultorio('${c.id}')" title="Profesionales">👨‍⚕</button>
          </div>
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = filas.join('');
}

async function abrirModalConsultorio(id) {
  if (!id) {
    const { data: vista } = await sb.from('vista_uso_negocios')
      .select('*')
      .eq('id', usuarioActual.negocio_id)
      .single();

    if (vista && vista.consultorios_actuales >= vista.limite_total_consultorios) {
      mostrarMensaje(`Llegaste al límite del plan ${vista.plan}: ${vista.limite_total_consultorios} consultorios. Cambiá de plan o agregá consultorios extras.`, 'error');
      return;
    }
  }

  let c = { nombre:'', direccion:'', telefono:'', hora_apertura:'09:00', hora_cierre:'18:00', activo:true };
  if (id) {
    const { data } = await sb.from('consultorios').select('*').eq('id', id).single();
    if (data) c = data;
  }

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar consultorio' : 'Nuevo consultorio'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-consultorio">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre *</label>
          <input type="text" name="nombre" value="${c.nombre}" required placeholder="Ej: Sucursal Centro">
        </div>
        <div class="input-group">
          <label>Dirección</label>
          <input type="text" name="direccion" value="${c.direccion || ''}" placeholder="Av. Corrientes 1234">
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${c.telefono || ''}">
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${c.activo?'selected':''}>Activo</option>
              <option value="false" ${!c.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Hora apertura</label>
            <input type="time" name="hora_apertura" value="${c.hora_apertura?.slice(0,5) || '09:00'}">
          </div>
          <div class="input-group">
            <label>Hora cierre</label>
            <input type="time" name="hora_cierre" value="${c.hora_cierre?.slice(0,5) || '18:00'}">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear consultorio'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-consultorio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    if (!d.direccion) d.direccion = null;
    if (!d.telefono) d.telefono = null;

    let res;
    if (id) {
      res = await sb.from('consultorios').update(d).eq('id', id);
    } else {
      d.negocio_id = usuarioActual.negocio_id;
      res = await sb.from('consultorios').insert(d);
    }

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje(id ? 'Consultorio actualizado' : 'Consultorio creado', 'exito');
    cerrarModal();
    await cargarInfoPlan();
    await cargarConsultorios();
  });
}

async function gestionarProfesionalesConsultorio(consultorioId) {
  const { data: consultorio } = await sb.from('consultorios').select('*').eq('id', consultorioId).single();
  const { data: profesionales } = await sb.from('profesionales')
    .select('*')
    .eq('activo', true)
    .order('nombre');
  const { data: asignaciones } = await sb.from('profesionales_consultorios')
    .select('profesional_id')
    .eq('consultorio_id', consultorioId);

  const { data: vista } = await sb.from('vista_uso_negocios')
    .select('max_profesionales_por_consultorio')
    .eq('id', usuarioActual.negocio_id)
    .single();
  const maxProfs = vista?.max_profesionales_por_consultorio || 999;

  const idsAsignados = new Set((asignaciones || []).map(a => a.profesional_id));

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Profesionales de ${consultorio.nombre}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="font-size: 12px; color: var(--texto-secundario); margin-bottom: 1rem;">
        Marcá los profesionales que trabajan en este consultorio. Máximo ${maxProfs} según tu plan.
        <br><strong id="contador-asignados">Asignados: ${idsAsignados.size}/${maxProfs}</strong>
      </div>

      ${(profesionales || []).length === 0 ? `
        <div class="vacio">No hay profesionales cargados todavía</div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${profesionales.map(p => `
            <label style="display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--borde); border-radius: var(--radio); cursor: pointer;">
              <input type="checkbox" class="check-prof"
                data-prof-id="${p.id}"
                ${idsAsignados.has(p.id) ? 'checked' : ''}
                onchange="toggleProfConsultorio('${p.id}', '${consultorioId}', this.checked, ${maxProfs})">
              <div>
                <div style="font-weight: 600;">${p.nombre}</div>
                <div style="font-size: 12px; color: var(--texto-secundario);">${p.especialidad || ''}</div>
              </div>
            </label>
          `).join('')}
        </div>
      `}
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `);
}

async function toggleProfConsultorio(profId, consultorioId, checked, maxProfs) {
  if (checked) {
    const { count } = await sb.from('profesionales_consultorios')
      .select('*', { count: 'exact', head: true })
      .eq('consultorio_id', consultorioId);

    if (count >= maxProfs) {
      mostrarMensaje(`Llegaste al límite de ${maxProfs} profesionales por consultorio. Mejorá tu plan para tener más.`, 'error');
      document.querySelector(`[data-prof-id="${profId}"]`).checked = false;
      return;
    }

    const { error } = await sb.from('profesionales_consultorios').insert({
      profesional_id: profId,
      consultorio_id: consultorioId
    });
    if (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      document.querySelector(`[data-prof-id="${profId}"]`).checked = false;
      return;
    }
  } else {
    const { error } = await sb.from('profesionales_consultorios')
      .delete()
      .eq('profesional_id', profId)
      .eq('consultorio_id', consultorioId);
    if (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      document.querySelector(`[data-prof-id="${profId}"]`).checked = true;
      return;
    }
  }

  const { count: nuevoCount } = await sb.from('profesionales_consultorios')
    .select('*', { count: 'exact', head: true })
    .eq('consultorio_id', consultorioId);

  const contador = document.getElementById('contador-asignados');
  if (contador) contador.textContent = `Asignados: ${nuevoCount}/${maxProfs}`;
}
