// ============================================================
// planes.js — ABM de Planes de suscripción (solo Super Admin)
// ============================================================
//
// Permite cargar y editar los planes del SaaS desde la pantalla,
// en vez de hacerlo por SQL. Trabaja sobre la tabla `planes` que
// ya existe en Supabase.
//
// IMPORTANTE — antes de usar este módulo hay que correr UNA vez el
// SQL que agrega la columna `max_usuarios` a la tabla `planes`
// (te lo paso aparte). Sin esa columna, crear/editar un plan da error.
//
// El `id` de un plan es TEXTO (ej: 'free', 'plan_1'), no un uuid.
// Es el identificador que usan los negocios para saber qué plan tienen.
// Por eso: en el ALTA se puede definir/ajustar; en la EDICIÓN queda fijo.
// ============================================================

async function renderPlanes(container) {
  if (usuarioActual.rol !== 'super_admin') {
    container.innerHTML = '<div class="vacio">Acceso restringido (solo Super Admin)</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Planes</div>
        <div class="page-subtitle">Planes de suscripción del sistema Podium SaaS</div>
      </div>
      <button class="btn btn-primary-sm" onclick="abrirModalPlan()">
        <span>+</span> Nuevo plan
      </button>
    </div>

    <div class="card">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuarios</th>
            <th>Consultorios</th>
            <th>Prof. / consult.</th>
            <th>Precio mensual</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-planes">
          <tr><td colspan="7" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarPlanes();
}

async function cargarPlanes() {
  const { data, error } = await sb.from('planes').select('*').order('orden').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); console.error(error); return; }

  const tbody = document.getElementById('tabla-planes');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay planes cargados. Creá el primero.</td></tr>';
    return;
  }

  // Muestra un número, o "—" si está vacío (null = sin límite).
  const num = (n) => (n === null || n === undefined || n === '') ? '<span style="color:var(--texto-tenue);">sin límite</span>' : n;

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>
        <strong>${p.nombre}</strong>
        <div style="font-size: 12px; color: var(--texto-secundario);">
          ${p.id}${p.descripcion ? ' · ' + p.descripcion : ''}
        </div>
      </td>
      <td>${num(p.max_usuarios)}</td>
      <td>${num(p.max_consultorios)}</td>
      <td>${num(p.max_profesionales_por_consultorio)}</td>
      <td>${formatearPrecio(p.precio_mensual)}</td>
      <td>${p.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="abrirModalPlan('${p.id}')" title="Editar">✎</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function abrirModalPlan(id) {
  let plan = {
    id: '', nombre: '', descripcion: '',
    max_usuarios: '', max_consultorios: '', max_profesionales_por_consultorio: '',
    precio_mensual: 0, precio_consultorio_extra: 0,
    orden: 0, activo: true
  };
  if (id) {
    const { data } = await sb.from('planes').select('*').eq('id', id).single();
    if (data) plan = data;
  }

  const esNuevo = !id;

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${id ? 'Editar plan' : 'Nuevo plan'}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-plan">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre del plan *</label>
          <input type="text" name="nombre" value="${plan.nombre}" required
            ${esNuevo ? 'oninput="sugerirCodigoPlan(this.value)"' : ''}
            placeholder="Ej: Plan Profesional">
        </div>

        <div class="input-group">
          <label>Código interno ${esNuevo ? '*' : '(no se puede cambiar)'}</label>
          <input type="text" name="codigo" id="input-codigo-plan"
            value="${plan.id}" ${esNuevo ? 'required oninput="this.dataset.editadoManual=\'1\'"' : 'readonly'}
            style="${esNuevo ? '' : 'background: var(--fondo); color: var(--texto-secundario);'}"
            placeholder="ej: plan_1">
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            ${esNuevo
              ? 'Se completa solo a partir del nombre. Podés ajustarlo (sin espacios ni acentos). Es el identificador interno y no se podrá cambiar después.'
              : 'Identifica al plan en la base y en los negocios que ya lo usan; por eso queda fijo.'}
          </small>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Máx. usuarios</label>
            <input type="number" name="max_usuarios" value="${plan.max_usuarios ?? ''}" min="0" placeholder="Sin límite">
          </div>
          <div class="input-group">
            <label>Máx. consultorios *</label>
            <input type="number" name="max_consultorios" value="${plan.max_consultorios ?? ''}" min="0" required>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Máx. profesionales por consultorio *</label>
            <input type="number" name="max_profesionales_por_consultorio" value="${plan.max_profesionales_por_consultorio ?? ''}" min="0" required>
          </div>
          <div class="input-group">
            <label>Orden en la lista</label>
            <input type="number" name="orden" value="${plan.orden ?? 0}" min="0">
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Precio mensual</label>
            <input type="number" name="precio_mensual" value="${plan.precio_mensual ?? 0}" step="0.01" min="0">
          </div>
          <div class="input-group">
            <label>Precio consultorio extra</label>
            <input type="number" name="precio_consultorio_extra" value="${plan.precio_consultorio_extra ?? 0}" step="0.01" min="0">
          </div>
        </div>

        <div class="input-group">
          <label>Descripción</label>
          <textarea name="descripcion" rows="2" placeholder="Ej: Para consultorios chicos, una sola sucursal">${plan.descripcion || ''}</textarea>
        </div>

        <div class="input-group">
          <label>Estado</label>
          <select name="activo">
            <option value="true" ${plan.activo ? 'selected' : ''}>Activo</option>
            <option value="false" ${!plan.activo ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm">${id ? 'Guardar' : 'Crear plan'}</button>
      </div>
    </form>
  `);

  document.getElementById('form-plan').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    const aEnteroONull = (v) => (v === '' || v === null || v === undefined) ? null : parseInt(v);
    const aDecimalOCero = (v) => parseFloat(v) || 0;

    const datos = {
      nombre: d.nombre.trim(),
      descripcion: d.descripcion ? d.descripcion.trim() : null,
      max_usuarios: aEnteroONull(d.max_usuarios),
      max_consultorios: aEnteroONull(d.max_consultorios),
      max_profesionales_por_consultorio: aEnteroONull(d.max_profesionales_por_consultorio),
      precio_mensual: aDecimalOCero(d.precio_mensual),
      precio_consultorio_extra: aDecimalOCero(d.precio_consultorio_extra),
      orden: aEnteroONull(d.orden) ?? 0,
      activo: d.activo === 'true'
    };

    let res;
    if (id) {
      // En edición el id queda fijo: no lo mandamos.
      res = await sb.from('planes').update(datos).eq('id', id);
    } else {
      const codigo = normalizarCodigoPlan(d.codigo);
      if (!codigo) { mostrarMensaje('El código interno no puede quedar vacío', 'error'); return; }
      datos.id = codigo;
      res = await sb.from('planes').insert(datos);
    }

    if (res.error) {
      // 23505 = clave primaria duplicada (código de plan repetido)
      const msg = res.error.code === '23505'
        ? 'Ya existe un plan con ese código interno. Cambiá el código.'
        : res.error.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    mostrarMensaje(id ? 'Plan actualizado' : 'Plan creado', 'exito');
    cerrarModal();
    await cargarPlanes();
  });
}

// Convierte texto libre en un código interno válido:
// minúsculas, sin acentos, sin espacios. "Plan Pro Max" -> "plan_pro_max"
function normalizarCodigoPlan(texto) {
  return (texto || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // todo lo no alfanumérico -> _
    .replace(/^_+|_+$/g, '');     // saca _ del principio y del final
}

// Mientras se escribe el nombre (solo en el alta), propone el código.
// Si el usuario ya tocó el campo código a mano, lo respeta y no lo pisa.
function sugerirCodigoPlan(nombre) {
  const input = document.getElementById('input-codigo-plan');
  if (input && !input.dataset.editadoManual) {
    input.value = normalizarCodigoPlan(nombre);
  }
}
