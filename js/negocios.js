async function renderNegocios(container) {
  if (!puedeVerModulo(usuarioActual, 'negocios')) {
    container.innerHTML = '<div class="vacio">Acceso restringido (solo Super Admin)</div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Negocios</div>
        <div class="page-subtitle">Clientes del sistema Podium SaaS</div>
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
            <th>Consultorios</th>
            <th>Profesionales</th>
            <th>Cobro</th>
            <th>Estado</th>
            <th style="text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody id="tabla-negocios">
          <tr><td colspan="7" class="vacio">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  await cargarNegocios();
}

async function cargarNegocios() {
  // La pantalla lee de la vista (uso real: consultorios/profesionales vs límites del plan).
  const { data, error } = await sb.from('vista_uso_negocios').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); console.error(error); return; }

  const tbody = document.getElementById('tabla-negocios');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay negocios</td></tr>';
    return;
  }

  // La vista no trae la info de cobro (sin_cobro / gratis_hasta), así que la pedimos
  // aparte de la tabla `negocios` y la cruzamos por id. Evita tener que editar la vista.
  const { data: cobros } = await sb.from('negocios').select('id, sin_cobro, gratis_hasta');
  const mapaCobro = {};
  (cobros || []).forEach(c => { mapaCobro[c.id] = c; });

  tbody.innerHTML = data.map(n => {
    const planBadge = {
      'free': '<span class="badge" style="background:#F1EFE8; color:#444;">Free</span>',
      'plan_1': '<span class="badge badge-llego">Plan 1</span>',
      'plan_2': '<span class="badge" style="background:#FAEEDA; color:#854F0B;">Plan 2</span>',
      'plan_3': '<span class="badge" style="background:#FBEAF0; color:#993556;">Plan 3</span>',
      'premium': '<span class="badge" style="background:#CECBF6; color:#3C3489;">Premium</span>'
    }[n.plan] || n.plan;

    const consultoriosTexto = `${n.consultorios_actuales}/${n.limite_total_consultorios}`;

    return `
    <tr>
      <td><strong>${n.nombre}</strong></td>
      <td>${planBadge}</td>
      <td>${consultoriosTexto}</td>
      <td>${n.profesionales_actuales}</td>
      <td>${estadoCobroBadge(mapaCobro[n.id])}</td>
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

// Devuelve el "chip" de cobro para la tabla:
//   - sin cortesía           -> Paga
//   - cortesía sin fecha     -> Cortesía (indefinida)
//   - cortesía con fecha futura -> Cortesía hasta DD/MM/AAAA
//   - cortesía con fecha pasada -> Cortesía vencida (en rojo)
function estadoCobroBadge(cobro) {
  if (!cobro || !cobro.sin_cobro) {
    return '<span class="badge" style="background:#E1F5EE; color:#0F6E56;">Paga</span>';
  }

  if (!cobro.gratis_hasta) {
    return '<span class="badge" style="background:#EEEDFE; color:#534AB7;">Cortesía</span>';
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const hasta = new Date(cobro.gratis_hasta + 'T00:00');
  const fechaTxt = hasta.toLocaleDateString('es-AR');

  if (hasta < hoy) {
    return `<span class="badge badge-cancelado">Cortesía vencida</span>
            <div style="font-size:11px; color:var(--peligro); margin-top:2px;">venció ${fechaTxt}</div>`;
  }

  return `<span class="badge" style="background:#EEEDFE; color:#534AB7;">Cortesía</span>
          <div style="font-size:11px; color:var(--texto-secundario); margin-top:2px;">hasta ${fechaTxt}</div>`;
}

async function abrirModalNegocio(id) {
  let negocio = { nombre:'', plan:'free', activo:true, notas:'', consultorios_extras:0, sin_cobro:false, gratis_hasta:'' };
  if (id) {
    const { data } = await sb.from('negocios').select('*').eq('id', id).single();
    if (data) negocio = data;
  }

  const { data: planes } = await sb.from('planes').select('*').eq('activo', true).order('orden');

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
        <div class="input-group">
          <label>Plan</label>
          <select name="plan">
            ${(planes || []).map(p => `
              <option value="${p.id}" ${negocio.plan===p.id?'selected':''}>${p.nombre} - ${p.descripcion}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="input-group">
            <label>Consultorios extras (adicionales al plan)</label>
            <input type="number" name="consultorios_extras" value="${negocio.consultorios_extras || 0}" min="0">
          </div>
          <div class="input-group">
            <label>Estado</label>
            <select name="activo">
              <option value="true" ${negocio.activo?'selected':''}>Activo</option>
              <option value="false" ${!negocio.activo?'selected':''}>Inactivo</option>
            </select>
          </div>
        </div>

        <div class="input-group" style="border-top: 1px solid var(--borde-tenue); padding-top: 1rem; margin-top: 0.5rem;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="sin_cobro" ${negocio.sin_cobro ? 'checked' : ''} onchange="toggleCortesiaFecha(this.checked)">
            <span>Cortesía (sin cobro)</span>
          </label>
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            El negocio usa su plan completo, pero no paga.
          </small>
        </div>

        <div class="input-group" id="grupo-gratis-hasta" style="display:${negocio.sin_cobro ? 'block' : 'none'};">
          <label>Gratis hasta</label>
          <input type="date" name="gratis_hasta" value="${negocio.gratis_hasta || ''}">
          <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">
            Dejala vacía para cortesía sin vencimiento.
          </small>
        </div>

        <div class="input-group">
          <label>Notas internas</label>
          <textarea name="notas" rows="2">${negocio.notas || ''}</textarea>
        </div>
        ${!id ? `
          <div style="background: var(--info-claro); color: var(--info); padding: 10px 12px; border-radius: var(--radio); font-size: 12px; margin-top: 1rem;">
            <strong>Importante:</strong> después de crear el negocio:
            <ol style="margin: 6px 0 0 16px;">
              <li>Andá a "Usuarios" y creá el admin del consultorio</li>
              <li>El admin va a entrar y crear su primer consultorio</li>
            </ol>
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
    d.consultorios_extras = parseInt(d.consultorios_extras) || 0;
    if (!d.notas) d.notas = null;

    // Cortesía: el checkbox manda 'on' si está tildado y nada si no, así que
    // lo leemos directo del elemento y lo guardamos como verdadero/falso.
    const sinCobro = e.target.sin_cobro.checked;
    d.sin_cobro = sinCobro;
    // La fecha solo tiene sentido si hay cortesía; si no, queda vacía (null).
    d.gratis_hasta = (sinCobro && d.gratis_hasta) ? d.gratis_hasta : null;

    let res;
    if (id) res = await sb.from('negocios').update(d).eq('id', id);
    else res = await sb.from('negocios').insert(d);

    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje(id ? 'Actualizado' : 'Negocio creado', 'exito');
    cerrarModal();
    await cargarNegocios();
  });
}

// Muestra/oculta el campo "Gratis hasta" según el tilde de cortesía.
function toggleCortesiaFecha(checked) {
  const g = document.getElementById('grupo-gratis-hasta');
  if (g) g.style.display = checked ? 'block' : 'none';
}
