// ============================================================
// planes.js — ABM de Planes de suscripción (solo Super Admin)
// ============================================================
//
// Perillas del plan (lo que se "vende" y se limita):
//   - max_consultorios            : espacios físicos
//   - max_profesionales           : TOTAL de profesionales por negocio
//                                   (no por consultorio; cuenta registros
//                                    de la agenda, incluido el full sin login)
//   - max_recepcion               : usuarios de recepción
//   Admin (dueño) es SIEMPRE 1: es estructural, no es una perilla.
//
// El `id` es TEXTO (ej: 'free', 'plan_1'), no uuid. En el ALTA se define
// (autocompletado desde el nombre); en la EDICIÓN queda fijo, porque lo
// referencian los negocios.
//
// Requiere en la base las columnas max_profesionales y max_recepcion
// (te paso el SQL aparte). El cobro/cortesía NO vive acá: vive en el negocio.
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
            <th>Consultorios</th>
            <th>Profesionales</th>
            <th>Recepción</th>
            <th>Emails/mes</th>
            <th>Precio mensual</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-planes">
          <tr><td colspan="8" class="vacio">Cargando...</td></tr>
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
    tbody.innerHTML = '<tr><td colspan="8" class="vacio">No hay planes cargados. Creá el primero.</td></tr>';
    return;
  }

  // Muestra un número, o "sin límite" si está vacío (null).
  const num = (n) => (n === null || n === undefined || n === '') ? '<span style="color:var(--texto-tenue);">sin límite</span>' : n;

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>
        <strong>${p.nombre}</strong>
        <div style="font-size: 12px; color: var(--texto-secundario);">
          ${p.id}${p.descripcion ? ' · ' + p.descripcion : ''}
        </div>
      </td>
      <td>${num(p.max_consultorios)}</td>
      <td>${num(p.max_profesionales)}</td>
      <td>${num(p.max_recepcion)}</td>
      <td>${num(p.max_emails_mes)}</td>
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
    max_consultorios: '', max_profesionales: '', max_recepcion: '',
    max_emails_mes: '',
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
              ? 'Se completa solo a partir del nombre. Podés ajustarlo (sin espacios ni acentos). No se podrá cambiar después.'
              : 'Identifica al plan en la base y en los negocios que ya lo usan; por eso queda fijo.'}
          </small>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Máx. consultorios *</label>
            <input type="number" name="max_consultorios" value="${plan.max_consultorios ?? ''}" min="0" required
              ${esNuevo ? 'oninput="sugerirProfesionales(this.value)"' : ''}>
          </div>
          <div class="input-group">
            <label>Máx. profesionales (total)</label>
            <input type="number" name="max_profesionales" id="input-max-prof" value="${plan.max_profesionales ?? ''}" min="0"
              ${esNuevo ? 'oninput="this.dataset.editadoManual=\'1\'"' : ''} placeholder="Sin límite">
            <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
              Total por negocio. Se sugiere 4 por consultorio (editable).
            </small>
          </div>
        </div>

        <div class="form-row">
          <div class="input-group">
            <label>Máx. usuarios de recepción</label>
            <input type="number" name="max_recepcion" value="${plan.max_recepcion ?? ''}" min="0" placeholder="1">
            <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
              El admin (dueño) es siempre 1 y no se configura.
            </small>
          </div>
          <div class="input-group">
            <label>Máx. emails por mes</label>
            <input type="number" name="max_emails_mes" value="${plan.max_emails_mes ?? ''}" min="0" placeholder="Sin límite">
            <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
              Tope de emails (recordatorios, avisos) del negocio por mes. Vacío = sin límite.
            </small>
          </div>
        </div>

        <div class="form-row">
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
      max_consultorios: aEnteroONull(d.max_consultorios),
      max_profesionales: aEnteroONull(d.max_profesionales),
      max_recepcion: aEnteroONull(d.max_recepcion),
      max_emails_mes: aEnteroONull(d.max_emails_mes),
      precio_mensual: aDecimalOCero(d.precio_mensual),
      precio_consultorio_extra: aDecimalOCero(d.precio_consultorio_extra),
      orden: aEnteroONull(d.orden) ?? 0,
      activo: d.activo === 'true'
    };

    let res;
    if (id) {
      // En edición el id queda fijo: no lo mandamos.
      res = await sb.from('planes').update(datos).eq('id', id).select();
    } else {
      const codigo = normalizarCodigoPlan(d.codigo);
      if (!codigo) { mostrarMensaje('El código interno no puede quedar vacío', 'error'); return; }
      datos.id = codigo;
      res = await sb.from('planes').insert(datos).select();
    }

    if (res.error) {
      // 23505 = clave primaria duplicada (código de plan repetido)
      const msg = res.error.code === '23505'
        ? 'Ya existe un plan con ese código interno. Cambiá el código.'
        : res.error.message;
      mostrarMensaje('Error: ' + msg, 'error');
      return;
    }

    // Sin error pero sin filas devueltas = la base no aplicó el cambio
    // (típicamente permisos/RLS en la tabla planes). Avisamos de verdad.
    if (!res.data || res.data.length === 0) {
      mostrarMensaje('No se pudo guardar: la base no aplicó el cambio. Revisá permisos/RLS de la tabla planes.', 'error');
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
function sugerirCodigoPlan(nombre) {
  const input = document.getElementById('input-codigo-plan');
  if (input && !input.dataset.editadoManual) {
    input.value = normalizarCodigoPlan(nombre);
  }
}

// Mientras se cargan los consultorios (solo en el alta), sugiere el tope de
// profesionales = 4 por consultorio. Si el usuario ya tocó el campo, no lo pisa.
function sugerirProfesionales(consultorios) {
  const input = document.getElementById('input-max-prof');
  if (input && !input.dataset.editadoManual) {
    const n = parseInt(consultorios);
    input.value = (Number.isFinite(n) && n > 0) ? n * 4 : '';
  }
}
