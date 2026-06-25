// ============================================================
// negocios.js — Clientes del SaaS (solo Super Admin)
//   Lista de negocios + detalle con solapas Datos / Usuarios.
//   Los usuarios de cada negocio se gestionan acá adentro.
//   Los super admin internos se crean con "+ Super admin".
//   (Reutiliza topeUsuariosNegocio() definido en usuarios.js y
//    la Edge Function crear-usuario.)
// ============================================================

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
      <div style="display:flex; gap:8px;">
        <button class="btn" onclick="abrirNuevoSuperAdmin()" title="Crear un super admin interno de Optium">+ Super admin</button>
        <button class="btn btn-primary-sm" onclick="abrirModalNegocio()">
          <span>+</span> Nuevo negocio
        </button>
      </div>
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
  const { data, error } = await sb.from('vista_uso_negocios').select('*').order('nombre');
  if (error) { mostrarMensaje('Error al cargar', 'error'); console.error(error); return; }

  const tbody = document.getElementById('tabla-negocios');
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vacio">No hay negocios</td></tr>';
    return;
  }

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
    <tr class="fila-clickable" onclick="abrirModalNegocio('${n.id}')">
      <td><strong>${n.nombre}</strong></td>
      <td>${planBadge}</td>
      <td>${consultoriosTexto}</td>
      <td>${n.profesionales_actuales}</td>
      <td>${estadoCobroBadge(mapaCobro[n.id])}</td>
      <td>${n.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
      <td>
        <div class="tabla-acciones">
          <button class="btn-icon" onclick="event.stopPropagation(); abrirModalNegocio('${n.id}')" title="Abrir">✎</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

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

// ============================================================
// DETALLE DEL NEGOCIO (con solapas Datos / Usuarios)
// ============================================================
async function abrirModalNegocio(id, tabInicial) {
  // Negocio NUEVO: formulario simple (sin solapas). Los usuarios se cargan
  // después, cuando el negocio ya existe.
  if (!id) {
    return _negModalNuevo();
  }

  const { data: negocio } = await sb.from('negocios').select('*').eq('id', id).single();
  if (!negocio) { mostrarMensaje('Negocio no encontrado', 'error'); return; }
  const { data: planes } = await sb.from('planes').select('*').eq('activo', true).order('orden');

  window._neg = { id, negocio, planes };

  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">${negocio.nombre}</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <div class="doc-tabs">
      <button class="doc-tab" data-negtab="datos" onclick="_negTab('datos')">Datos</button>
      <button class="doc-tab" data-negtab="usuarios" onclick="_negTab('usuarios')">Usuarios</button>
    </div>
    <div id="neg-tab-cont"></div>
  `);

  _negTab(tabInicial === 'usuarios' ? 'usuarios' : 'datos');
}

function _negTab(tab) {
  document.querySelectorAll('#modal-container .doc-tab').forEach(b => {
    b.classList.toggle('doc-tab-on', b.dataset.negtab === tab);
  });
  if (tab === 'usuarios') _negTabUsuarios();
  else _negTabDatos();
}

// ---------- Solapa DATOS ----------
function _negTabDatos() {
  const { negocio, planes, id } = window._neg;
  const cont = document.getElementById('neg-tab-cont');
  cont.innerHTML = `
    <form id="form-negocio">
      <div class="modal-body">
        <div class="input-group">
          <label>Nombre del negocio *</label>
          <input type="text" name="nombre" value="${negocio.nombre || ''}" required>
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
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
        <button type="submit" class="btn btn-primary-sm">Guardar</button>
      </div>
    </form>
  `;

  document.getElementById('form-negocio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    d.activo = d.activo === 'true';
    d.consultorios_extras = parseInt(d.consultorios_extras) || 0;
    if (!d.notas) d.notas = null;
    const sinCobro = e.target.sin_cobro.checked;
    d.sin_cobro = sinCobro;
    d.gratis_hasta = (sinCobro && d.gratis_hasta) ? d.gratis_hasta : null;

    const res = await sb.from('negocios').update(d).eq('id', id);
    if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
    mostrarMensaje('Actualizado', 'exito');
    cerrarModal();
    await cargarNegocios();
  });
}

// ---------- Solapa USUARIOS ----------
function _negTabUsuarios() {
  const { id } = window._neg;
  const cont = document.getElementById('neg-tab-cont');
  cont.innerHTML = `
    <div class="modal-body">
      <div class="cfg-bloque-flex" style="margin-bottom:12px;">
        <div class="cfg-ayuda">Usuarios con acceso a este negocio.</div>
        <button class="btn cfg-mini" onclick="abrirNuevoUsuarioNegocio()">+ Nuevo usuario</button>
      </div>
      <div id="neg-usuarios-lista">Cargando...</div>
      <small class="cfg-ayuda" style="display:block; margin-top:10px;">Los profesionales se dan de alta desde "Mi equipo" dentro del negocio.</small>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" onclick="cerrarModal()">Cerrar</button>
    </div>
  `;
  _negCargarUsuarios(id);
}

async function _negCargarUsuarios(negocioId) {
  const cont = document.getElementById('neg-usuarios-lista');
  if (!cont) return;
  const { data, error } = await sb.from('usuarios').select('*').eq('negocio_id', negocioId).order('nombre');
  if (error) { cont.innerHTML = `<div class="vacio" style="padding:1rem;">Error: ${error.message}</div>`; return; }
  if (!data || !data.length) {
    cont.innerHTML = '<div class="vacio" style="padding:1rem;">Sin usuarios todavía. Creá el dueño del negocio.</div>';
    return;
  }

  const rolBadge = {
    'negocio': '<span class="badge" style="background:#534AB7; color:white;">Dueño</span>',
    'recepcion': '<span class="badge badge-llego">Recepción</span>',
    'profesional': '<span class="badge badge-en_atencion">Profesional</span>'
  };

  cont.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th style="text-align:right;">Acciones</th></tr></thead>
      <tbody>
        ${data.map(u => {
          const esYo = u.id === usuarioActual.id;
          return `
          <tr>
            <td><strong>${u.nombre}</strong>${esYo ? ' <span style="font-size:11px; color:var(--texto-tenue);">(vos)</span>' : ''}</td>
            <td>${u.email}</td>
            <td>${rolBadge[u.rol] || u.rol}</td>
            <td>${u.activo ? '<span class="badge badge-llego">Activo</span>' : '<span class="badge badge-cancelado">Inactivo</span>'}</td>
            <td>
              <div class="tabla-acciones">
                ${!esYo ? `<button class="btn-icon" onclick="_negToggleUsuario('${u.id}', ${!u.activo})" title="${u.activo ? 'Desactivar' : 'Activar'}" style="color:${u.activo ? 'var(--peligro)' : 'var(--exito)'};">${u.activo ? '🚫' : '✓'}</button>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function _negToggleUsuario(uid, activar) {
  const accion = activar ? 'activar' : 'desactivar';
  if (!await confirmarModal({ titulo: 'Confirmar', texto: `¿Seguro que querés ${accion} este usuario?`, textoSi: 'Confirmar' })) return;
  const { error } = await sb.from('usuarios').update({ activo: activar }).eq('id', uid);
  if (error) { mostrarMensaje('Error: ' + error.message, 'error'); return; }
  mostrarMensaje(activar ? 'Usuario activado' : 'Usuario desactivado', 'exito');
  await _negCargarUsuarios(window._neg.id);
}

// ---------- Nuevo usuario (dueño / recepción) dentro del negocio ----------
function abrirNuevoUsuarioNegocio() {
  const { id } = window._neg;
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo usuario</div>
      <button class="modal-cerrar" onclick="abrirModalNegocio('${id}','usuarios')">×</button>
    </div>
    <form id="form-nuevo-usuario-neg">
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
          <select name="rol" required>
            <option value="negocio">Dueño</option>
            <option value="recepcion">Recepción</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="abrirModalNegocio('${id}','usuarios')">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-crear-usuario-neg">Crear usuario</button>
      </div>
    </form>
  `);

  document.getElementById('form-nuevo-usuario-neg').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());

    const tope = await topeUsuariosNegocio(id, d.rol);
    if (tope && tope.alcanzado) {
      const msg = d.rol === 'negocio'
        ? 'Este negocio ya tiene su usuario dueño. Solo se permite 1.'
        : `Llegaste al límite de usuarios de recepción del plan (${tope.max}). Para sumar más, cambiá de plan.`;
      mostrarMensaje(msg, 'error');
      return;
    }

    const btn = document.getElementById('btn-crear-usuario-neg');
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      await _crearUsuario({
        email: d.email.trim().toLowerCase(),
        password: d.password,
        nombre: d.nombre.trim(),
        rol: d.rol,
        negocio_id: id
      });
      mostrarMensaje('Usuario creado correctamente', 'exito');
      await abrirModalNegocio(id, 'usuarios');
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      btn.disabled = false; btn.textContent = 'Crear usuario';
    }
  });
}

// ---------- Nuevo super admin interno (sin negocio) ----------
function abrirNuevoSuperAdmin() {
  abrirModal(`
    <div class="modal-header">
      <div class="modal-titulo">Nuevo super admin</div>
      <button class="modal-cerrar" onclick="cerrarModal()">×</button>
    </div>
    <form id="form-nuevo-sa">
      <div class="modal-body">
        <div class="cfg-ayuda" style="margin-bottom:12px;">Usuario interno de Optium, sin negocio asociado.</div>
        <div class="input-group">
          <label>Nombre completo *</label>
          <input type="text" name="nombre" required placeholder="Ej: Juan Pérez">
        </div>
        <div class="input-group">
          <label>Email *</label>
          <input type="email" name="email" required placeholder="usuario@email.com">
        </div>
        <div class="input-group">
          <label>Contraseña *</label>
          <input type="text" name="password" required minlength="6" placeholder="Mínimo 6 caracteres">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary-sm" id="btn-crear-sa">Crear super admin</button>
      </div>
    </form>
  `);

  document.getElementById('form-nuevo-sa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const d = Object.fromEntries(fd.entries());
    const btn = document.getElementById('btn-crear-sa');
    btn.disabled = true; btn.textContent = 'Creando...';
    try {
      await _crearUsuario({
        email: d.email.trim().toLowerCase(),
        password: d.password,
        nombre: d.nombre.trim(),
        rol: 'super_admin',
        negocio_id: null
      });
      mostrarMensaje('Super admin creado correctamente', 'exito');
      cerrarModal();
    } catch (error) {
      mostrarMensaje('Error: ' + error.message, 'error');
      btn.disabled = false; btn.textContent = 'Crear super admin';
    }
  });
}

// Llama a la Edge Function que crea el usuario de auth + fila en `usuarios`.
async function _crearUsuario(payload) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sesión expirada');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Error desconocido');
  return result;
}

// ---------- Negocio NUEVO ----------
function _negModalNuevo() {
  return (async () => {
    const { data: planes } = await sb.from('planes').select('*').eq('activo', true).order('orden');
    abrirModal(`
      <div class="modal-header">
        <div class="modal-titulo">Nuevo negocio</div>
        <button class="modal-cerrar" onclick="cerrarModal()">×</button>
      </div>
      <form id="form-negocio-nuevo">
        <div class="modal-body">
          <div class="input-group">
            <label>Nombre del negocio *</label>
            <input type="text" name="nombre" required>
          </div>
          <div class="input-group">
            <label>Plan</label>
            <select name="plan">
              ${(planes || []).map(p => `<option value="${p.id}">${p.nombre} - ${p.descripcion}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label>Consultorios extras (adicionales al plan)</label>
              <input type="number" name="consultorios_extras" value="0" min="0">
            </div>
            <div class="input-group">
              <label>Estado</label>
              <select name="activo">
                <option value="true" selected>Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
          <div class="input-group" style="border-top: 1px solid var(--borde-tenue); padding-top: 1rem; margin-top: 0.5rem;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" name="sin_cobro" onchange="toggleCortesiaFecha(this.checked)">
              <span>Cortesía (sin cobro)</span>
            </label>
          </div>
          <div class="input-group" id="grupo-gratis-hasta" style="display:none;">
            <label>Gratis hasta</label>
            <input type="date" name="gratis_hasta" value="">
            <small style="color: var(--texto-tenue); display:block; margin-top: 4px;">Dejala vacía para cortesía sin vencimiento.</small>
          </div>
          <div class="input-group">
            <label>Notas internas</label>
            <textarea name="notas" rows="2"></textarea>
          </div>
          <div style="background: var(--info-claro, #EEF3FB); color: var(--info, #2B6CB0); padding: 10px 12px; border-radius: 10px; font-size: 12px; margin-top: 1rem;">
            <strong>Después de crear el negocio:</strong> se abre su detalle para que crees el usuario dueño desde la solapa "Usuarios".
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" onclick="cerrarModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary-sm">Crear negocio</button>
        </div>
      </form>
    `);

    document.getElementById('form-negocio-nuevo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const d = Object.fromEntries(fd.entries());
      d.activo = d.activo === 'true';
      d.consultorios_extras = parseInt(d.consultorios_extras) || 0;
      if (!d.notas) d.notas = null;
      const sinCobro = e.target.sin_cobro.checked;
      d.sin_cobro = sinCobro;
      d.gratis_hasta = (sinCobro && d.gratis_hasta) ? d.gratis_hasta : null;

      const res = await sb.from('negocios').insert(d).select().single();
      if (res.error) { mostrarMensaje('Error: ' + res.error.message, 'error'); return; }
      mostrarMensaje('Negocio creado', 'exito');
      await cargarNegocios();
      // Abrir el detalle del negocio recién creado en la solapa Usuarios.
      if (res.data?.id) await abrirModalNegocio(res.data.id, 'usuarios');
      else cerrarModal();
    });
  })();
}

// Muestra/oculta el campo "Gratis hasta" según el tilde de cortesía.
function toggleCortesiaFecha(checked) {
  const g = document.getElementById('grupo-gratis-hasta');
  if (g) g.style.display = checked ? 'block' : 'none';
}
